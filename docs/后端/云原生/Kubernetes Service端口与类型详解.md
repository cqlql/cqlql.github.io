---
title: Kubernetes Service 端口与类型详解
icon: mdi:lan-connect
sort: 7
---

> 本文聚焦 Service 的**端口映射细节**（`port` / `targetPort` / `nodePort`）与**类型选型**，结合 `pass-up.backend` 的 `k8s/base/service.yaml` 实例讲解「为什么有的 Service 没有 nodePort」。

## 一、Service 端口三字段

一个 Service 的 `ports` 段可以出现三个端口相关字段，它们各司其职：

| 字段 | 含义 | 是否必填 |
| --- | --- | --- |
| `port` | **Service 对外暴露的端口**（集群内访问 Service 时用的端口） | 必填 |
| `targetPort` | **后端 Pod 容器实际监听的端口**（Service 转发流量的目标） | 可填（缺省时等于 `port`） |
| `nodePort` | **每个节点上开放的物理端口**（仅 NodePort/LoadBalancer 类型有效） | 可选 |

三者关系：

```text
客户端 → Service(port)  →  Pod(targetPort)
                │
                └─(NodePort 类型时) 额外映射到 节点IP:nodePort
```

### 实例：pass-up 后端 Service

```yaml
spec:
  type: ClusterIP
  selector:
    app: passup-backend
  ports:
    - name: http
      port: 8005
      targetPort: http
      protocol: TCP
    - name: management
      port: 8009
      targetPort: management
      protocol: TCP
```

两个端口的作用：

- `http`：业务流量（HTTP + WebSocket），`8005 → 8005`；
- `management`：管理端点（Actuator 健康检查、prometheus 指标），`8009 → 8009`。

业务端口与管理端口分离，健康检查走独立的 management 端口，与业务流量互不干扰。

## 二、targetPort 用「命名端口」而非数字

上例中 `targetPort: http` 引用的是 **Pod 定义里的端口名称**，而非数字。它必须与 `deployment.yaml` 中容器的端口名一致：

```yaml
# deployment.yaml 中容器端口定义
ports:
  - name: http
    containerPort: 8005
```

**用命名端口的好处：**

1. **解耦**：即使容器内部端口号变了（如 8005 改成 8080），只要 `deployment.yaml` 里端口名仍是 `http`，Service 无需改动。
2. **语义清晰**：`http`、`management` 比纯数字可读性更强。

> 而 `port`（Service 对外端口）必须写数字，因为它决定集群内 DNS 访问入口，如 `passup-backend.passup.svc.cluster.local:8005`。

## 三、为什么这个 Service 没有 nodePort

因为它的类型是 `ClusterIP`（默认类型）。**`nodePort` 字段只在 `NodePort` 或 `LoadBalancer` 类型下才有效**，不同类型对端口字段的要求不同：

| 类型 | `port` | `targetPort` | `nodePort` |
| --- | :---: | :---: | :---: |
| `ClusterIP`（默认） | 必填 | 可填 | **不适用** |
| `NodePort` | 必填 | 可填 | 可选（默认自动分配 30000–32767） |
| `LoadBalancer` | 必填 | 可填 | 可选 |

### 为什么后端选择 ClusterIP 而非 NodePort

后端服务**不需要从集群外部直接访问**，而是通过 Traefik Ingress 暴露：

```text
外部请求 → Ingress (Traefik, 80/443) → Service (ClusterIP, 8005) → Pod
```

- **ClusterIP** 只在集群内部提供一个虚拟 IP 和 DNS 名，供集群内其他 Pod 互访（PostgreSQL、Redis、MinIO 同理）。
- **对外暴露**统一交给 `ingress.yaml` 里的 Traefik，它监听集群入口端口（如 80/443），再按域名/路径路由到后端 Service。

这是微服务/容器化部署的常见分工：

- **对外**：用 Ingress（统一入口、域名路由、TLS、超时中间件等都集中在这一层）。
- **对内**：用 ClusterIP（服务间互访，只暴露必要端口）。

## 四、什么时候才会出现 nodePort

如果想让某个服务**绕过 Ingress、直接从集群节点 IP + 端口访问**，才需要 `NodePort`：

```yaml
spec:
  type: NodePort
  ports:
    - name: http
      port: 8005
      targetPort: http
      nodePort: 30080   # 集群每个节点 IP:30080 都能直接访问
```

**代价**：会暴露到所有节点的固定端口，安全性和可维护性都不如 Ingress。因此本项目的后端、MinIO Console（9001）都选择了 `ClusterIP`，不对外暴露。

## 五、选型速记

| 需求 | 推荐类型 |
| --- | --- |
| 仅供集群内部互访（默认场景） | `ClusterIP` |
| 需要绕过 Ingress、从节点 IP+端口直接访问 | `NodePort` |
| 需要云厂商 LB 或 K3s ServiceLB 分配入口 IP | `LoadBalancer` |
| 基于域名/路径的七层路由、TLS 终结 | `ClusterIP` + `Ingress` |
