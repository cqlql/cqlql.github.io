---
title: Ubuntu 静态IP配置
sort: 1
---

# Ubuntu 24.04 固定静态 IP

Ubuntu 24.04 统一使用 **Netplan** 管理网络（底层 renderer 为 `networkd`），推荐先看网卡信息再配置。

## 一、先查看关键信息（必做）

**查看网卡名称**
```bash
ip addr
```
输出示例：
```
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
2: ens33: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
```
网卡名通常为 `ens33` / `enp0s3` / `eth0`，记下来。

**查看 netplan 配置文件**
```bash
ls /etc/netplan/
```
常见文件名：
- `00-installer-config.yaml` / `50-cloud-init.yaml`

## 二、方法一：Netplan YAML 配置（通用，推荐）

> YAML 严格**空格缩进**，禁止 Tab，冒号后必须加空格，缩进用 2 个空格。

**步骤 1：备份原配置**
```bash
sudo cp /etc/netplan/00-installer-config.yaml /etc/netplan/00-installer-config.yaml.bak
```

**步骤 2：编辑配置文件**
```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

**配置模板（renderer: networkd）**
```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    ens33:  # 替换成你的网卡名
      dhcp4: false  # 关闭 DHCP 自动获取
      addresses:
        - 192.168.1.100/24  # 静态 IP/子网掩码
      routes:
        - to: default
          via: 192.168.1.1  # 网关
      nameservers:
        addresses:
          - 223.5.5.5
          - 114.114.114.114
```

**步骤 3：保存退出**
nano：`Ctrl+O` 保存 → 回车 → `Ctrl+X` 退出

**步骤 4：权限修复（避免报错）**
```bash
sudo chmod 600 /etc/netplan/00-installer-config.yaml
```

**步骤 5：生效配置（推荐先测试）**
```bash
# 测试配置：120 秒内网络异常自动回滚，生产必用
sudo netplan try
# 确认网络正常，永久生效
sudo netplan apply
```

**验证 IP 是否固定**
```bash
ip a
ping 网关IP
ping baidu.com
```

## 三、常见坑与注意事项

1. **YAML 缩进错误**：所有层级用 2 空格，不能用 Tab，冒号后必须空格，否则 `netplan apply` 报错
2. **CIDR 格式**：IP 必须带 `/24`，不能只写 `192.168.1.100`
3. **cloud-init 云服务器**：如果有 `50-cloud-init.yaml`，注意里面 `dhcp4: true`，否则重启会覆盖 IP
4. **网关弃用提示**：新版 netplan 不推荐 `gateway4: xxx`，统一用 `routes: to: default via`
5. **多网卡**：在 `ethernets` 下新增对应网卡节点即可分别配置静态 IP

## 四、恢复 DHCP 自动获取

修改 yaml 中 `dhcp4: true`，删除 `addresses/routes/nameservers`，执行：
```bash
sudo netplan apply
```
