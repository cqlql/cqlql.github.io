
---
title: apt 包管理
sort: 11
---

```sh
# 更新软件源头
apt update

# 显示可升级的软件包
apt list --upgradeable

# 显示已安装的软件包
apt list --installed

# 升级所有已安装软件
apt upgrade

# 安装指定软件 ( -f 修复依赖关系)
apt install -f mysql-server

# 删除已安装软件包
apt remove mysql-server

# 自动清理不再使用的依赖和库文件
apt autoremove

# 显示已安装软件包信息（版本号，安装大小，依赖关系，bug报告等等）
apt show mysql-server
```

## apt update / apt upgrade / apt full-upgrade 区别

三者职责不同，日常维护通常按顺序执行 `update -> upgrade`。

### apt update（更新软件源索引）
- 只刷新本地软件包索引列表，**不安装、不升级任何软件**。
- 作用：从 `/etc/apt/sources.list` 配置的源下载最新的包版本信息（元数据），让系统知道「有哪些包、最新版本号是多少」。
- 必须在 `upgrade` / `install` 之前执行，否则升级的是旧的索引信息。

```sh
apt update
```

### apt upgrade（升级已安装的包，保守）
- 升级所有已安装的软件包到最新版本。
- **不会删除已有包，也不会安装新的依赖包来满足升级**。
- 如果某个升级需要移除其它包或新增依赖，该升级会被**跳过**（保持现状），以保证系统稳定。
- 适合日常更新，风险最低。

```sh
apt upgrade
```

### apt full-upgrade（完整升级，彻底）
- 同样升级所有已安装的包，但比 `upgrade` 更「激进」。
- 当升级需要**移除旧包**或**安装新的依赖包**时，会照做以满足依赖关系。
- 典型场景：发行版大版本升级（如 Debian/Ubuntu 跨版本），或某些包改名、合并时。
- 风险略高（可能移除你正在用的包），但能完成 `upgrade` 无法完成的升级。

```sh
apt full-upgrade
```

### 对比速查

| 命令 | 是否更新索引 | 是否升级包 | 是否移除旧包 | 是否新增依赖 | 风险 |
|------|------|------|------|------|------|
| `apt update` | 是 | 否 | 否 | 否 | 无 |
| `apt upgrade` | 否 | 是 | 否（跳过需移除的） | 否（跳过需新增的） | 低 |
| `apt full-upgrade` | 否 | 是 | 是 | 是 | 中 |

> 注：`dist-upgrade` 是 `full-upgrade` 的旧名称，二者功能等价；`apt full-upgrade` 与 `apt-get dist-upgrade` 行为一致。

### 推荐用法

```sh
# 1. 先更新索引
sudo apt update

# 2. 查看有哪些可升级
apt list --upgradeable

# 3. 日常保守升级
sudo apt upgrade

# 4. 若 upgrade 跳过了部分包，且确认要彻底升级（如跨版本）
sudo apt full-upgrade

# 5. 升级后清理不再需要的依赖
sudo apt autoremove
```
