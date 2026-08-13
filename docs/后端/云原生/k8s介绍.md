---
title: Kubernetes 介绍
icon: devicon:kubernetes
sort: 1
---

Kubernetes 被称为"云操作系统"。

## 核心概念

### 集群与节点

- **集群**：是由**多台机器**组成的整体。它可以包含 2 台、10 台甚至上千台机器。
- **节点**：是集群里的**单台机器**。

工作节点（Worker Node）：物理机器或者虚拟机，一个工作节点对应一台机器。

### Pod

Pod 推荐只放一个主进程 + 多个辅助进程，也就是一个微服务。

### Labels 与 Selectors

通过 Labels + Selectors 来区分和管理 Pod：

| **维度**            | **例子**                       | **作用**                                   |
| ------------------- | ------------------------------ | ------------------------------------------ |
| **Namespace**       | `prod-env`                     | 区分不同的运行环境（生产 vs 开发）         |
| **App Label**       | `app: mall-system`             | **区分大应用**（比如整个商城系统）         |
| **Component Label** | `tier: frontend` 或 `role: db` | **区分应用内的组件**（前端、后端、数据库） |
| **Version Label**   | `version: v1.2`                | 区分同一个微服务的不同版本                 |

## API 服务器（API Server）

API 服务器特指 `kube-apiserver` 组件，它是 Kubernetes 控制平面的核心组件，是集群的"大脑"，负责管理所有 API 请求和集群状态。

- **集群的通信枢纽**：所有 Kubernetes 组件和外部客户端的**唯一入口**。
- **资源操作的权威来源**：直接与 `etcd` 通信，负责校验、持久化和管理集群状态。
- **版本兼容性控制中心**：决定了集群支持哪些 Kubernetes API 版本。

## 容器网络插件

常见的 CNI 网络插件：

- Flannel
- Calico
- Cilium
- Canal
- Multus（多网络）

## K8s 管理面板

- **Kubernetes Dashboard**：简单、轻量、上手快，适合个人项目 / 小团队 / 学习 / 开发环境。
- **Rancher**：适合企业 / 多集群 / 多团队 / 有权限要求的场景，能大幅提升可管理性与扩展性。

> 实际部署时也不必完全抛弃 Dashboard：即使用了 Rancher，原生 Dashboard 通常还是可以作为快速查看 / 调试工具保留。

## 相关工具

- [Kubernetes IDE - Lens](https://k8slens.dev/)：图形化 K8s 管理工具。
