---
title: Kubernetes Deployment YAML 配置详解
icon: devicon:kubernetes
---

Deployment 是 Kubernetes 中最常用的无状态应用控制器，其 YAML 配置中有几处容易混淆的标签（Labels）设置，以及关键的选择器（Selector）机制。本文以 `passup-backend` 项目的实际配置为例，逐一拆解。

## 一、Deployment 中的三层标签

一个完整的 Deployment 包含三处标签/选择器设置，各司其职：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: passup-backend
  namespace: passup
  labels:                         # ① Deployment 对象的标签
    app: passup-backend
spec:
  replicas: 2
  selector:
    matchLabels:                  # ② Pod 选择器（匹配规则）
      app: passup-backend
  template:
    metadata:
      labels:                     # ③ Pod 模板的标签
        app: passup-backend
```

| 位置 | 字段 | 作用对象 | 用途 |
|------|------|----------|------|
| `metadata.labels` | Deployment 自身标签 | **Deployment 资源** | 给 Deployment 对象打标签，方便 `kubectl get deploy -l` 筛选 |
| `spec.selector.matchLabels` | 选择器 | **Pod 匹配规则** | 告诉 Deployment 要管理哪些 Pod（按标签过滤） |
| `spec.template.metadata.labels` | Pod 模板标签 | **新创建的 Pod** | 由 Deployment 创建的 Pod 自动带上此标签 |

> ⚠️ 第②处（selector）和第③处（Pod template labels）的标签值**必须一致**，否则 `kubectl apply` 会直接报错，因为 Deployment 无法管理自己创建的 Pod。第①处（Deployment 自身标签）技术上可以不同，但惯例上保持一致便于统一管理。

## 二、metadata 详解

```yaml
metadata:
  name: passup-backend
  namespace: passup
  labels:
    app: passup-backend
```

| 字段 | 含义 | 作用 |
|------|------|------|
| `name` | Deployment 的唯一标识名 | 通过 `kubectl get deployment passup-backend` 等命令操作 |
| `namespace` | 所属命名空间 | 将资源隔离到 `passup` 逻辑分组中，与其他 namespace 互不干扰 |
| `labels` | 资源标签 | 给 Deployment 对象自身打标签，支持按标签筛选 |

### 实际命令

```bash
# 按名称查看
kubectl get deployment passup-backend -n passup

# 按标签筛选所有关联资源
kubectl get all -l app=passup-backend -n passup
```

## 三、selector.matchLabels 详解

```yaml
  selector:
    matchLabels:
      app: passup-backend
```

`selector.matchLabels` 是 Deployment 控制器的核心机制，用于声明「我要管理哪些 Pod」。

### 工作原理

1. **匹配规则**：Deployment 持续监控集群中所有带 `app: passup-backend` 标签的 Pod
2. **关联 Pod 模板**：选择器必须与 `template.metadata.labels` 完全一致，否则 Deployment 无法管理自己创建的 Pod
3. **扩缩容依据**：实际匹配的 Pod 数量与 `replicas` 不一致时，自动创建或删除 Pod
4. **滚动更新**：在 RollingUpdate 策略下，选择器是旧 ReplicaSet 和新 ReplicaSet 交接 Pod 管理权的关键
5. **Service 关联**：Service 也通过相同的 `selector` 找到要转发流量的 Pod

### 关键约束

- **不可变性**：Deployment 创建后，`selector` 字段**不能修改**，否则会导致资源冲突
- **精确匹配**：`matchLabels` 是「与」关系，所有指定的标签都必须匹配

## 四、小结

| 概念 | 关键点 |
|------|--------|
| `metadata.name` | Deployment 唯一标识，命令行操作的核心 |
| `metadata.namespace` | 资源隔离的逻辑分组 |
| `metadata.labels` | Deployment 对象自身的标签，用于筛选 |
| `spec.selector.matchLabels` | 选择器，声明要管理哪些 Pod，**不可修改** |
| `spec.template.metadata.labels` | Pod 模板标签，新 Pod 自动带上，**必须与 selector 一致** |
