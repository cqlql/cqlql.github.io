---
title: etcdctl 客户端
icon: mdi:database-outline
sort: 5
---

> `etcdctl` 是 etcd 项目的官方命令行客户端，与具体发行版（K3s / kubeadm 等）无关。
> 本文以 **K3s 内置 etcd** 作为连接示例。

## 手动安装 etcdctl 客户端

这是管理 etcd 最规范、最方便的方式。单独安装一个独立版 `etcdctl` 只需要几十秒（K8s 发行版默认通常不带这个命令）：

```bash
# 1. 下载并解压 etcdctl（以 v3.5.10 为例）
ETCD_VER=v3.5.10
curl -L https://github.com/etcd-io/etcd/releases/download/${ETCD_VER}/etcd-${ETCD_VER}-linux-amd64.tar.gz -o /tmp/etcd.tar.gz
tar -zxvf /tmp/etcd.tar.gz -C /tmp/

# 2. 将 etcdctl 移动到 PATH 路径下
sudo mv /tmp/etcd-${ETCD_VER}-linux-amd64/etcdctl /usr/local/bin/
rm -rf /tmp/etcd*

# 3. 验证是否安装成功
etcdctl version
```

---

## 连接 etcd（以 K3s 内置 etcd 为例）

etcd 通常使用 TLS 双向认证，调用时需要带上 CA 与客户端证书/密钥。K3s 把 etcd 证书放在：

```
/var/lib/rancher/k3s/server/tls/etcd/
```

连接并查看成员列表：

```bash
sudo etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/var/lib/rancher/k3s/server/tls/etcd/server-ca.crt \
  --cert=/var/lib/rancher/k3s/server/tls/etcd/client.crt \
  --key=/var/lib/rancher/k3s/server/tls/etcd/client.key \
  member list -w table
```

常用操作示例（移除一个 unhealthy 成员）：

```bash
sudo etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/var/lib/rancher/k3s/server/tls/etcd/server-ca.crt \
  --cert=/var/lib/rancher/k3s/server/tls/etcd/client.crt \
  --key=/var/lib/rancher/k3s/server/tls/etcd/client.key \
  member remove e417f91bcf44a393
```

> 非 K3s 环境（如 kubeadm）证书路径不同，按需替换为对应 `--cacert/--cert/--key` 即可，etcdctl 命令本身完全一致。
