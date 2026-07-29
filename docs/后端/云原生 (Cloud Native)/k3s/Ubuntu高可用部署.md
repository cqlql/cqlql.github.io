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

### 使用国内源（推荐）

大陆环境直接拉取 `get.k3s.io` 和官方二进制包通常很慢，且容易因代理导致本地 IP 被劫持、TLS 证书报错。可改用 Rancher 国内镜像源，通过 `INSTALL_K3S_MIRROR=cn` 环境变量让安装脚本从 `rancher-mirror.rancher.cn` 拉取安装脚本与 K3s 二进制包：

```bash
curl -sfL https://rancher-mirror.rancher.cn/k3s/k3s-install.sh | INSTALL_K3S_MIRROR=cn sh -s - server \
  --cluster-init \
  --write-kubeconfig-mode=644
```

> **优点：** `rancher-mirror.rancher.cn` 会直接从国内节点拉取安装脚本和 K3s 二进制包，速度极快（通常几秒钟下载完），且完全避开了代理引发的本地 IP 劫持和 TLS 证书报错问题。下文加入节点（五）的安装命令同样可加上 `INSTALL_K3S_MIRROR=cn` 并改用该镜像脚本。

### 官方默认安装方式

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

> **国内源：** 与三、第一台安装相同，此处也可改用 Rancher 国内镜像源以加速安装：
>
> ```bash
> curl -sfL https://rancher-mirror.rancher.cn/k3s/k3s-install.sh | INSTALL_K3S_MIRROR=cn sh -s - server \
>   --server https://172.16.0.211:6443 \
>   --token <YOUR_SECRET_TOKEN>
> ```

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

> VIP 方案见 `介绍与安装.md` 中的 kube-vip / Keepalived。
