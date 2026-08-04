# kubeadm 部署

kubeadm 官方推荐，适合学习，小规模集群

Kubespray 部署简单，但部署时系统检查耗时，而且依赖庞大

## 1. 关闭 swap（必须）

```
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab
```

swap 慢，可能会卡爆 Pod，而且超内存的Pod也不会被杀掉（OOM Killer），因为一直有内存，整个节点被拖死（比杀一个 Pod 更糟）

> 🧠 总结一句：
> 👉 **swap = “用磁盘假装内存”**
> 👉 **K8s = 需要“真实内存”做调度决策**

## 2. 开启内核参数

```bash
cat <<EOF | tee /etc/modules-load.d/k8s.conf
br_netfilter
EOF

modprobe br_netfilter

cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables = 1
net.ipv4.ip_forward = 1
EOF

sysctl --system
```

让pod网络可以正常通讯

## 3. 查看 Pod 事件（定位确切原因）

不要先看日志，先用 `describe` 命令查看 Pod 的 **Events（事件列表）**，这是最直接的诊断方式：

```bash
sudo kubectl describe pod kube-vip -n kube-system
```

在输出的最底部，重点看 **`Events:`** 部分：

- 如果看到 `Pulling image "ghcr.io/..."` 且长时间卡住，说明是**镜像下载不下来**。
- 如果看到 `Failed to pull image... i/o timeout`，说明**网络连接超时**。
- 如果是 CNI 或挂载问题，也会在这里抛出明确报错。
