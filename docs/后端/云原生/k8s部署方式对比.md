---
title: K8s 部署方式对比
icon: mdi:rocket-launch-outline
sort: 2
---

Kubernetes 有多种部署方式，适用于不同的场景和规模。

## 部署方式概览

### minikube（单节点、开发测试）

一般用来部署单节点集群，即一个节点同时是主节点和工作节点。

- 多用于开发测试环境。
- 也可用于小型项目生产环境。
- 也支持多节点部署。
- 可能不适合 GPU 集群部署。

### kubeadm（官方推荐）

Kubernetes 官方推荐的部署工具，适合学习和中小规模集群。

通过 `kubeadm` 安装：

```shell
# 安装 kubeadm、kubelet、kubectl
sudo apt-get update && sudo apt-get install -y kubeadm kubelet kubectl

# 初始化集群（自动安装 API 服务器等组件）
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
```

`kubeadm` 会自动拉取并启动 `kube-apiserver`、`etcd`、`kube-controller-manager`、`kube-scheduler` 的容器化版本。

部署前的必要准备：

#### 关闭 swap（必须）

```bash
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab
```

swap 慢，可能会卡爆 Pod，而且超内存的 Pod 也不会被杀掉（OOM Killer），因为一直有内存，整个节点被拖死（比杀一个 Pod 更糟）。

> **swap = "用磁盘假装内存"**，**K8s = 需要"真实内存"做调度决策**

#### 开启内核参数

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

让 Pod 网络可以正常通讯。

### Kubespray

基于 Ansible 的部署方案，部署简单，但部署时系统检查耗时，而且依赖庞大。

### Rancher（社区、快速搭建和管理、图形界面）

Rancher 是一个开源的 Kubernetes 管理平台。

```bash
sudo docker run --privileged -d --restart=unless-stopped -p 80:80 -p 443:443 rancher/rancher
```
