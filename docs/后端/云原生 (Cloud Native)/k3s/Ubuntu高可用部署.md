---
title: Ubuntu 高可用部署 (HA)
icon: server
sort: 2
---

## 部署形态

在 Ubuntu 上部署 K3s，一般分两种：

1. **单机开发/测试**：1 台 server 节点即可
2. **生产高可用**：3 台 server（control-plane + embedded etcd）+ 若干 worker

如果规划的是 3 台服务器跑 K3s，同时部署 PostgreSQL、Redis、MinIO，建议直接按 **HA** 方式设计。K3s 官方支持通过安装脚本快速部署，也支持 embedded etcd 做高可用集群。

---

## 一、服务器规划

| 节点     | IP         | 角色     |
| ------ | ---------- | ------ |
| k3s-01 | 10.0.1.101 | server |
| k3s-02 | 10.0.1.102 | server |
| k3s-03 | 10.0.1.103 | server |

三台都安装：

- Ubuntu 24.04
- Docker 不需要（K3s 自带 containerd）
- 固定 hostname
- 固定 IP

> K3s 每个节点 hostname 必须唯一。

---

## 二、基础环境准备（三台都执行）

### 1. 设置 hostname

```bash
# k3s-01
hostnamectl set-hostname k3s-01

# k3s-02
hostnamectl set-hostname k3s-02

# k3s-03
hostnamectl set-hostname k3s-03
```

### 2. 配置 hosts

```bash
vim /etc/hosts
```

加入：

```
10.0.1.101 k3s-01
10.0.1.102 k3s-02
10.0.1.103 k3s-03
```

测试：

```bash
ping k3s-01
```

### 3. 更新系统

```bash
apt update && apt upgrade -y
```

### 4. 关闭 swap

Kubernetes 要求关闭 swap：

```bash
swapoff -a
```

永久关闭，编辑 `/etc/fstab` 注释掉 swap 行。

### 5. 关闭 ufw（简单环境）

官方建议 Ubuntu 环境关闭 ufw，或开放 Kubernetes 网络端口。

简单方式：

```bash
ufw disable
```

生产环境保留 ufw，但需要开放：

```
6443/tcp
8472/udp
10250/tcp
```

---

## 三、第一台安装 K3s Server（k3s-01）

```bash
curl -sfL https://get.k3s.io | sh -s - server \
  --cluster-init \
  --write-kubeconfig-mode=644
```

等待并查看状态：

```bash
systemctl status k3s
kubectl get nodes
```

预期输出：

```
NAME      STATUS
k3s-01    Ready
```

---

## 四、获取加入 token（k3s-01）

```bash
cat /var/lib/rancher/k3s/server/node-token
```

输出形如：

```
K10xxxxx::serverxxxxx
```

保存该 token，后续节点加入时使用。

---

## 五、加入第二、第三台 Server（k3s-02 / k3s-03）

```bash
curl -sfL https://get.k3s.io | sh -s - server \
  --server https://10.0.1.101:6443 \
  --token K10xxxxx::serverxxxxx
```

回到 k3s-01 验证：

```bash
kubectl get nodes
```

预期输出：

```
NAME      STATUS   ROLES
k3s-01    Ready    control-plane
k3s-02    Ready    control-plane
k3s-03    Ready    control-plane
```

此时即完成 3 节点 HA。

---

## 六、本地配置 kubectl

想从本机管理集群，复制 kubeconfig：

```bash
scp root@10.0.1.101:/etc/rancher/k3s/k3s.yaml .
```

将文件中的：

```yaml
server: https://10.0.1.101:6443
```

改成 VIP 地址（Keepalived 或 kube-vip 提供的高可用地址）：

```
server: https://你的VIP:6443
```

> VIP 方案见 `01_介绍与安装.md` 中的 kube-vip / Keepalived。

---

## 七、从单节点（SQLite）升级为双 Server 高可用

### 背景

K3s 默认安装（不指定 `--cluster-init` / `--datastore-endpoint`）使用**内嵌 SQLite** 作为数据存储。SQLite 模式**无法横向扩容控制面**，即无法把第二台机器以 `server` 角色加入——此时想要双 Server 高可用，**必须先重构主节点**，重装并启用内嵌 etcd。

> `--cluster-init` 的作用是「初始化 etcd 集群主控」。只有主节点以该参数启动后，其他机器才能以 `server` 身份加入同一个 etcd 集群。

### 操作步骤

**1. 重装主节点并开启内嵌 etcd 模式**

以主节点 `172.16.0.211` 为例：

```bash
# 卸载原有 k3s（含 SQLite 数据）
k3s-uninstall.sh
rm -rf /var/lib/rancher/k3s /etc/rancher/k3s

# 重新安装并初始化 etcd 集群主控
curl -sfL https://get.k3s.io | sh -s - server --cluster-init
```

执行后该节点即成为 etcd 集群的第一个（也是主控）成员，此时才支持其他机器以 `server` 加入。

**2. 第二台机器以 server 加入**

主节点装好后，在第二台执行原本的 server 加入命令即可正常运行：

```bash
curl -sfL https://get.k3s.io | sh -s - server \
  --server https://172.16.0.211:6443 \
  --token <主节点 node-token>
```

> `--cluster-init` 只需在**第一台**主节点上使用一次；后续节点均用 `--server` + `--token` 加入，无需再带 `--cluster-init`。

### 要点小结

- 原生 SQLite 模式不能扩容控制面，升级 HA 必须重装主节点。
- 重装会清空原 SQLite 数据（需提前备份工作负载），切换到 etcd 后数据重新落盘。
- `--cluster-init` 是「把单节点升级为 etcd 集群」的关键开关，务必先在主节点执行。
