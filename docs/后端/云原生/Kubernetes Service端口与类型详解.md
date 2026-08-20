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

### `name: http` 这一行是什么

```yaml
ports:
  - name: http        # ← 给「这一组端口配置」起名叫 http
    port: 8005
    targetPort: http
```

`name` 是给**这个端口条目（port + targetPort 这一组）**贴的标签，它的实际作用分场景：

| 场景 | `name` 是否有实际作用 |
| --- | --- |
| 单端口 + `targetPort` 写数字 | 无，纯语义标签，可省略 |
| **多端口**（本例 http + management） | **有，K8s 强制要求，不写会报错** |
| `targetPort` 按名引用 | 有，但关键在 **Pod 侧的 name**（见下） |

> 一句话：对「流量转发到哪个 Pod 端口」这件事，Service 的 `name` 本身不起作用（那是 `targetPort` 的职责）；但在**多端口场景下，`name` 是 K8s 强制要求的、用来区分端口条目的标识**。本例正好是多端口，所以 `name` 必须写。

## 三、`metadata.name`（服务名）与 `ports[].name`（端口名）的区别

两者都叫 `name`，但作用完全不同，别混淆：

| 位置 | 示例 | 作用 |
| --- | --- | --- |
| `metadata.name` | `passup-backend` | **Service 资源名**，集群内 DNS 访问的依据 |
| `spec.ports[].name` | `http` | **端口条目标识**，区分端口 / 供 `targetPort` 引用 |

### 集群内访问 Service 用的是 `metadata.name`，不是端口名

集群内其它 Pod 访问它的完整 DNS 名是：

```text
passup-backend.passup.svc.cluster.local:8005
└─────── ① metadata.name ───────┘ └ ② port 数字 ┘
```

即 `<Service名称>.<命名空间>.svc.cluster.local`，加 `port` 数字端口。而 `ports[].name`（`http`）**不参与** DNS 访问。

### 完整对应关系

```yaml
metadata:
  name: passup-backend        # ① 访问入口名（DNS 依据）
spec:
  ports:
    - name: http              # ② 端口条目标识（区分/引用）
      port: 8005              # ③ Service 暴露端口（访问时用这个数字）
      targetPort: http        # ④ 引用 Pod 里 name: http 的端口
```

> 小结：「服务名」是 `metadata.name`，「端口名」是 `ports[].name`，两者同名纯属约定，作用完全不同。

## 四、为什么这个 Service 没有 nodePort

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

## 五、什么时候才会出现 nodePort

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

## 六、选型速记

| 需求 | 推荐类型 |
| --- | --- |
| 仅供集群内部互访（默认场景） | `ClusterIP` |
| 需要绕过 Ingress、从节点 IP+端口直接访问 | `NodePort` |
| 需要云厂商 LB 或 K3s ServiceLB 分配入口 IP | `LoadBalancer` |
| 基于域名/路径的七层路由、TLS 终结 | `ClusterIP` + `Ingress` |
