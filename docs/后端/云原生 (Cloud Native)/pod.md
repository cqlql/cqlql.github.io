---
title: Pod
---

## 查看 Pod 事件（定位确切原因）

不要先看日志，先用 `describe` 命令查看 Pod 的 **Events（事件列表）**，这是最直接的诊断方式：

```bash
sudo kubectl describe pod kube-vip -n kube-system
```

在输出的最底部，重点看 **`Events:`** 部分：

- 如果看到 `Pulling image "ghcr.io/..."` 且长时间卡住，说明是**镜像下载不下来**。
- 如果看到 `Failed to pull image... i/o timeout`，说明**网络连接超时**。
- 如果是 CNI 或挂载问题，也会在这里抛出明确报错。

## 实时观察 Pod 状态变化

`-w`（`--watch`）会持续监听 Pod 状态变化并实时输出，适合观察 Pod 从 `Pending` → `Running` 的整个过程：

```bash
sudo kubectl get pod kube-vip -n kube-system -w
```

配合 `describe` 使用：先 `-w` 看状态变化节奏，再 `describe` 查 Events 定位原因。
