---
title: 查看 Pod 所在节点
icon: mdi:server-network
sort: 20
---

排查问题时经常需要知道某个 Pod 被调度到了集群中的哪台节点上。本文整理常用命令和排查场景。

> K3s 的 `kubectl` 内嵌在 K3s 二进制中，统一用 `sudo k3s kubectl` 前缀调用（集群外管理机使用普通 `kubectl` 即可）。

---

## 一、核心命令

### 列出 Pod 及其所在节点（最常用）

```bash
sudo k3s kubectl get pods -n passup -o wide
```

`-o wide` 输出会比默认多出 `NODE`、`IP` 等列，其中 **`NODE` 列就是该 Pod 调度到的节点名**。

### 只关心某个 Deployment 的 Pod（配合 label 过滤）

```bash
sudo k3s kubectl get pods -n passup -l app=passup-backend -o wide
```

先通过 label 缩小范围，再定位具体 Pod，避免在全量列表里大海捞针。

### 查看某个具体 Pod 的节点名

```bash
sudo k3s kubectl get pod <pod-name> -n passup -o jsonpath='{.spec.nodeName}'
```

只输出节点名，适合写脚本或快速确认。

---

## 二、补充排查场景

### 查看 Pod 详情（含调度节点、事件、资源）

```bash
sudo k3s kubectl describe pod <pod-name> -n passup
```

`describe` 会输出 Pod 的调度节点、事件、资源限制等完整信息，是排查"Pod 为什么没起来 / 为什么调度到某节点"的第一选择。

### 查看整个集群所有节点

```bash
# 节点列表及基本信息
sudo k3s kubectl get nodes -o wide

# 各节点资源使用情况
sudo k3s kubectl top nodes
```

---

## 三、多副本场景注意点

当 Deployment 配置了多个副本（例如生产 overlay 中 `passup-backend` 的 `replicas.count = 2`）时：

- 2 个 Pod **可能落在同一台节点，也可能被调度到不同节点**（取决于各节点资源与调度策略）。
- 排查问题时，务必先确认是**哪个 Pod** 出问题（通过 label 过滤 + `-o wide` 定位），再看它的 `NODE` 列，不要笼统地说"这个服务在某某节点"。

---

## 四、常用组合场景

### 定位某个异常 Pod 在哪个节点

```bash
# 1. 全量看 Pod 状态
sudo k3s kubectl get pods -n passup -o wide

# 2. 缩小到目标工作负载
sudo k3s kubectl get pods -n passup -l app=passup-backend -o wide

# 3. 看具体 Pod 的节点与事件
sudo k3s kubectl describe pod <pod-name> -n passup
```

### 确认节点是否承载了预期副本

```bash
# 看某节点上跑了哪些 Pod
sudo k3s kubectl get pods -A -o wide --field-selector spec.nodeName=<node-name>
```
