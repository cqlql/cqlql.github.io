---
title: VIP 方案选型 (Kube-vip vs Keepalived+HAProxy)
icon: network-wired
sort: 3
---

给 K3s 搭建高可用（HA）集群时，选择哪种方案主要取决于你的**部署环境**、**运维复杂度要求**以及**是否需要自带负载均衡器**。

这三个组件在 K3s 架构中的定位其实有所不同：

- **Kube-vip**：云原生原生设计的 VIP 方案，兼顾 Control Plane 高可用与 Service（LoadBalancer）分发。
- **Keepalived + HAProxy**：传统且极其成熟的经典组合（Keepalived 负责 VIP 漂移，HAProxy 负责 6443 端口的 L4 负载均衡）。

下表列出它们的核心差异，帮助你快速决策：

| 评估维度 | **Kube-vip**（推荐） | **Keepalived + HAProxy** |
| --- | --- | --- |
| **部署位置** | K3s 集群内部（作为 DaemonSet/Static Pod） | K3s 集群外部（部署在 Host 宿主机上） |
| **资源消耗** | 极低（Go 编写，单个轻量容器） | 低（两个轻量进程，但需宿主机环境） |
| **安装维护** | 极简（声明式 YAML 配置或 K3s 启动参数） | 较繁琐（需手动写配置文件、配置 Keepalived 检查脚本） |
| **云原生体验** | 极佳（自动响应节点状态变化） | 一般（与 K8s 状态无天然关联） |
| **额外能力** | 支持给 K8s Service 分配 VIP (LoadBalancer) | 仅能做 Control Plane 层的负载均衡 |

---

## 选型建议

### 1. 首选方案：Kube-vip（极力推荐 🌟）

如果你追求**简单、轻量、纯粹的 K8s 体验**，选 Kube-vip 是目前 K3s 社区最主流的选择。

**为什么选它：**

- **架构极简**：不需要在宿主机上另外配置 Keepalived/HAProxy 软件，直接以 Static Pod 形式运行在 Control Plane 节点上。
- **一精多能**：不仅能做 **Control Plane 的 VIP**，还能充当 K3s 的 **Service LoadBalancer**（替代 MetalLB），直接给你的业务服务分发外网 IP。
- **运维低**：配合 ARP 模式（局域网广播），配置文件只需几十行。

**适用场景**：物理机部署、裸金属服务器、私有云/家庭实验室（Homelab）。

### 2. 传统稳妥方案：Keepalived + HAProxy

如果你有非常明确的**基础设施隔离需求**或**运维惯性**。

**为什么选它：**

- **隔离性高**：LB 跑在 K3s 集群之外，即使 K3s 节点整个挂掉或 Pod 网络出现严重异常，外层的 LB 依然能提供健康检查和 traffic routing。
- **非常成熟**：在传统 IT 和大厂的生产环境中验证了十几年，排查问题手段丰富。

**适用场景：**

- 生产环境中已有独立的 LB 节点群。
- 对高可用有极严苛要求、希望负载均衡层与容器运行时完全解耦。

---

## 快速实操建议

如果你正在从零开始搭建 K3s 高可用集群：

- **如果使用外部数据库（如 PostgreSQL/MySQL/etcd）**：直接在所有控制节点前放一个 **Kube-vip** 即可。
- **如果使用嵌入式 etcd（`--cluster-init`）**：可以在初始化首个节点时，顺手放上 Kube-vip 的 Static Pod 配置。

> **小贴士**：K3s 官方自带了轻量级客户端负载均衡器（`k3s-agent` 连 Control Plane 时自带代理机制），但针对集群外部访问 6443 (API Server) 的统一出口入口，**使用 Kube-vip 提供一个固定 VIP** 是性价比和体验最高的选择。
