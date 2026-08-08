---
title: Ubuntu Server 磁盘分区 LVM 方案
sort: 14
---

# Ubuntu Server 磁盘分区配置（EFI + LVM）

基于单块 40G 虚拟磁盘、UEFI 启动模式的文本安装器存储配置，采用 **ESP + 独立 /boot + LVM** 方案。

## 一、整体磁盘分区（三块主分区）

整块磁盘 40.00G，切成 3 个独立分区，互不干涉：

| 分区 | 大小 | 类型 / 文件系统 | 挂载点 | 作用 |
|------|------|----------------|--------|------|
| Partition 1 | 1.049G | ESP / FAT32 | `/boot/efi` | EFI 引导文件，UEFI 启动必需 |
| Partition 2 | 2.000G | ext4 | `/boot` | 内核、initramfs、grub，独立分区避免 LVM 故障无法开机 |
| Partition 3 | 36.948G | LVM 物理卷 (PV) | — | 全部划入卷组 `ubuntu-vg` |

> 三块之和：`1.049 + 2.000 + 36.948 = 39.997G` ≈ 40G，微小差值来自分区表占用与容量换算精度。

## 二、名词区分：ubuntu-vg / ubuntu-lv

- **ubuntu-vg（VG = Volume Group 卷组）= 存储资源池**
  Partition 3 的 36.948G 做成 PV，合并成一个大池子，名为 `ubuntu-vg`，总容量 **36.945G**。
- **ubuntu-lv（LV = Logical Volume 逻辑卷）= 从池子里割出的一块**
  从 `ubuntu-vg` 切出 18.472G 给根目录 `/`，这就是 `ubuntu-lv`。
  剩余空闲：`36.945 - 18.472 ≈ 18.473G`（界面显示 `free space 18.472G`，四舍五入差异）。

类比：`ubuntu-vg` 是一整块 37G 仓库，`ubuntu-lv` 是从仓库割出 18G 装系统，仓库还剩 18G 空地。

## 三、结构树

```
40G 整块虚拟磁盘
├─ 分区1：1.049G → /boot/efi（FAT32，UEFI 启动）
├─ 分区2：2.000G → /boot（ext4，内核文件）
└─ 分区3：36.948G → LVM 物理卷，组成 ubuntu-vg（资源池）
   ├─ ubuntu-lv：18.472G → / 根目录
   └─ 空闲空间：18.472G （可后续扩容 / 新建逻辑卷）
```

**关键误区澄清**
- 36.948G 只是第三块分区，不是整块硬盘；
- ubuntu-lv 的 18G 是从 36.948G 里再细分，与前面 1G、2G 引导分区无关；
- 计算关系：`磁盘 = EFI(1G) + boot(2G) + LVM大分区(36.948G)`，而 `LVM大分区 = ubuntu-lv(18.472G) + 空闲(18.472G)`。

## 四、文件系统总览

| 挂载点 | 大小 | 文件系统 | 底层设备 |
|--------|------|----------|----------|
| `/boot/efi` | 1.049G | fat32 | 磁盘分区 1 |
| `/boot` | 2.000G | ext4 | 磁盘分区 2 |
| `/` | 18.472G | ext4 | LVM 逻辑卷 ubuntu-lv |

## 五、方案优缺点

### ✅ 优点
1. 标准 UEFI 启动：`/boot/efi` + 独立 `/boot`，兼容性强，崩溃后可单独修复引导；
2. LVM 灵活扩容：根分区只占用一半 VG，后续可直接在线扩容 `/`，也能新建独立数据卷；
3. 布局规范，符合生产服务器通用部署标准。

### ⚠️ 可优化点
1. 40G 仅给根 18G，剩余 18G 闲置；若不分独立数据盘，建议把全部 VG 空间分配给 `/`；
2. 无独立 swap，内存不足会直接 OOM；生产环境建议额外划分 2G~4G swap LV。

## 六、安装界面操作

### 当前配置确认安装
直接选底部 `Done` 进入下一步。

### 扩容根分区（把全部 VG 给 /）
1. 选中 `ubuntu-lv`，回车编辑；
2. 大小改为 `36.945G`（或直接填最大值，界面自动填充全部空闲）；
3. 保存后 `ubuntu-vg` 的 free space 变为 0；
4. 确认后点 `Done`。

### 添加 swap 交换分区
选中 `ubuntu-vg` 空闲空间 → 新建逻辑卷 → 格式化为 swap。

### 新建多个逻辑卷（服务器标准方案）
VG 空闲空间可拆分为多个独立 LV，互不影响：

| 逻辑卷名 | 挂载点 | 建议大小 | 用途 |
|----------|--------|----------|------|
| ubuntu-lv-root | / | 20G | 系统根目录 |
| ubuntu-lv-var | /var | 8G | 日志、缓存、容器数据 |
| ubuntu-lv-swap | swap | 4G | 交换分区兜底 |
| ubuntu-lv-data | /data | 剩余全部 | 业务文件、项目数据 |

> 拆分好处：`/var` 日志打满不会卡死系统；数据盘单独划分，重装系统时可保留数据不格式化。

### 重置分区
选 `Reset` 清空所有分区配置重新规划。

## 七、两种方案对比

### 方案 1：只建 1 个 LV（全部空间给 /）
- 优点：操作最简单，适合测试机、个人虚拟机，无需后续管理；
- 缺点：所有文件挤在同一分区，日志爆满 / 业务膨胀会占满系统盘导致崩溃。

### 方案 2：多个独立 LV
- 优点：分区隔离，单块占满不影响系统；可单独扩容、单独备份；生产通用规范；
- 缺点：安装配置步骤更多，需提前规划各目录容量。

> 提醒：`/boot`、`/boot/efi` 是独立磁盘分区，不属于 LVM，不能拆成逻辑卷；安装后也能通过 LVM 在线扩容 / 新建 LV。

## 八、安装完成后在线扩容根分区命令

若安装时只给 `ubuntu-lv` 分配了部分空间，装好后可在线把空闲 VG 空间并入根分区：

```bash
# 1. 查看卷组空闲空间
vgdisplay ubuntu-vg | grep "Free  PE"

# 2. 把全部空闲空间扩容给逻辑卷（按百分比，最省心）
lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv

# 3. 扩展文件系统（ext4）
resize2fs /dev/ubuntu-vg/ubuntu-lv

# 4. 确认结果
df -h /
```

> 要点：`lvextend` 扩容 LV，`resize2fs` 同步扩展 ext4 文件系统；xfs 用 `xfs_growfs /`。
> 新建 swap LV 示例：`lvcreate -L 4G -n ubuntu-lv-swap ubuntu-vg` → `mkswap /dev/ubuntu-vg/ubuntu-lv-swap` → `swapon /dev/ubuntu-vg/ubuntu-lv-swap`，并在 `/etc/fstab` 写入挂载。
