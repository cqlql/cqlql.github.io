## 部署方式

### minikube 部署（单节点、开发测试）

一般用来部署单节点集群，即一个节点同时是主节点和工作节点。

多用于开发测试环境；也可用于小型项目生产环境。

也支持多节点部署。

可能不适合 GPU 集群部署。

### Kubeadm 部署（生产环境、GPU集群）

部署后的集群管理主要通过 Kubernetes 的命令行工具 kubectl 进行。

### Rancher 部署（社区、快速搭建和管理、图形界面）

Rancher 是一个开源的 Kubernetes 管理平台。

```bash
sudo docker run --privileged -d --restart=unless-stopped -p 80:80 -p 443:443 rancher/rancher
```

## 理解--pop 副本

相同的定义：每个 Pod 副本都基于相同的 Pod 模板创建

独立的运行：每个 Pod 副本都是独立运行在集群中的不同节点上

## 容器网络插件

canal

cilium

calico

fannel

multus,canal

multus,cilium

multus,calico

## 网络

端口是否开放

```shell
 nc 127.0.0.1 6443 -zv -w 2
```

## [Kubernetes IDE](https://k8slens.dev/)

## 工作节点（Worker Node）



## 集群--工作节点--pop？



## API 服务器（API Server）

API 服务器（API Server）特指 `kube-apiserver` 组件，它是 Kubernetes 控制平面（Control Plane）的核心组件之一，是 Kubernetes 集群的“大脑”，负责管理所有 API 请求和集群状态。

### **定义与作用**

- **集群的通信枢纽**：
  API 服务器是所有 Kubernetes 组件（如 `kubelet`、`kube-controller-manager`、`kube-scheduler`）和外部客户端（如 `kubectl`）的**唯一入口**。所有操作（创建 Pod、查询状态等）均通过 RESTful API 与 API 服务器交互。
- **资源操作的权威来源**：
  它直接与集群的持久化存储（`etcd`）通信，负责校验、持久化和管理集群状态（如 Pod、Service 等资源的元数据）。
- **版本兼容性控制中心**：
  API 服务器决定了集群支持哪些 Kubernetes API 版本（如 `v1`、`apps/v1`），而其他组件（如 `kubelet`）必须遵循其版本约束。

### 通过 `**kubeadm**`安装

```shell
# 安装 kubeadm、kubelet、kubectl
sudo apt-get update && sudo apt-get install -y kubeadm kubelet kubectl

# 初始化集群（自动安装 API 服务器等组件）
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
```

- `kubeadm` 会自动拉取并启动 `kube-apiserver`、`etcd`、`kube-controller-manager`、`kube-scheduler` 的容器化版本。

## K8s 管理面板

Rancher、Kubernetes Dashboard

- **如果你是在做个人项目 / 小团队 / 学习 / 开发环境**，用 **Kubernetes Dashboard** 就足够了 — 它简单、轻量、上手快。
- **如果你在企业 / 多集群 /有多团队 /对权限有要求**，建议用 **Rancher** 或类似的集群管理平台，因为它能大幅提升可管理性与扩展性。
- 在实际部署时，也不必完全抛弃 Dashboard：即使你用了 Rancher，内部原生的 Dashboard 通常还是可以作为 “快速查看 / 调试工具” 保留。