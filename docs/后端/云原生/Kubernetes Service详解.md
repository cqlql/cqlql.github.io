---
title: Kubernetes Service 详解
icon: devicon:kubernetes
---

Kubernetes Service 是集群内服务发现与负载均衡的核心。本文以 `passup-backend` 项目的实际配置为例，梳理 Service 端口字段、类型选型、以及与 Deployment、Ingress 的协作关系。

## 一、Service 的三个端口字段

以项目 `service.yaml` 为例：

```yaml
spec:
  type: ClusterIP
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

三个端口字段的含义：

| 字段 | 含义 | 必填 |
| --- | --- | :---: |
| `port` | Service 自身监听的端口，集群内访问该 Service 时使用 | 是 |
| `targetPort` | 流量转发到 Pod 的哪个端口，可用数字或 Pod 中定义的端口名 | 否（默认与 `port` 相同） |
| `nodePort` | 节点上暴露的端口（30000–32767），仅 `NodePort` / `LoadBalancer` 类型有效 | 否 |

项目采用双端口设计：

- `http`（8005）：业务流量（HTTP + WebSocket）
- `management`（8009）：管理端点（Actuator 健康检查、Prometheus 指标）

业务端口与管理端口分离，健康检查走独立端口，与业务流量互不干扰。

## 二、为什么 Deployment 和 Service 都要定义端口

`deployment.yaml` 里已经声明了 `containerPort: 8005`，为什么 `service.yaml` 里还要写 `port: 8005` 和 `targetPort: http`？

### 两者的职责不同

| 位置 | 字段 | 性质 | 实际作用 |
| --- | --- | --- | --- |
| Deployment | `containerPort` | **声明/文档** | 告知容器监听端口；供 Service 按名称引用 |
| Service | `port` | **网络规则** | Service 虚拟 IP 上真正监听的端口 |
| Service | `targetPort` | **网络规则** | 流量转发到 Pod 的目标端口 |

`containerPort` 本身**不会创建任何网络规则**，删除它不影响 Pod 的网络连通性。它只有两个价值：

1. 为 `targetPort` 提供按名称引用的能力（`targetPort: http` 指向 `containerPort` 名为 `http` 的端口）；
2. 作为文档，让阅读者一眼知道容器暴露了哪些端口。

真正负责流量路由的是 Service —— 它创建 ClusterIP、配置 iptables/IPVS 规则，把请求从 `port` 转发到 Pod 的 `targetPort`。

### 端口映射：port 和 targetPort 可以不同

正因为端口定义在两层，才能实现端口映射——运维人员可以在不修改应用代码的前提下调整对外端口：

```yaml
ports:
  - name: http
    port: 8080          # 集群内访问 Service 用 8080
    targetPort: http    # 但转发到 Pod 的 8005
```

## 三、targetPort 用命名端口而非数字

```yaml
targetPort: http   # 引用 Pod 定义中的端口名称
```

它必须与 `deployment.yaml` 中容器的端口名一致：

```yaml
# deployment.yaml
ports:
  - name: http
    containerPort: 8005
```

**用命名端口的好处：**

1. **解耦**：即使容器内部端口号变了（如 8005 → 8080），只要端口名不变，Service 无需改动。
2. **语义清晰**：`http`、`management` 比纯数字可读性更强。

### `ports[].name` 的作用

```yaml
ports:
  - name: http        # 给这一组端口配置起名
    port: 8005
    targetPort: http
```

`name` 是给这个端口条目贴的标签，实际作用因场景而异：

| 场景 | `name` 是否必需 |
| --- | --- |
| 单端口 + `targetPort` 写数字 | 否，纯语义标签 |
| 多端口（如 http + management） | **是，K8s 强制要求，不写会报错** |
| `targetPort` 按名引用 | 否，关键在 Pod 侧的端口名 |

## 四、metadata.name 与 ports[].name 的区别

两者都叫 `name`，但作用完全不同：

| 位置 | 示例 | 作用 |
| --- | --- | --- |
| `metadata.name` | `passup-backend` | Service 资源名，集群内 DNS 访问的依据 |
| `spec.ports[].name` | `http` | 端口条目标识，区分端口 / 供 `targetPort` 引用 |

### 集群内 DNS 访问用的是 metadata.name

```text
passup-backend.passup.svc.cluster.local:8005
└─────── metadata.name ───────┘ └ port ┘
```

格式为 `<Service名称>.<命名空间>.svc.cluster.local`，加 `port` 数字端口。`ports[].name`（`http`）**不参与** DNS 解析。

### 完整对应关系

```yaml
metadata:
  name: passup-backend        # ① DNS 访问入口
spec:
  ports:
    - name: http              # ② 端口条目标识
      port: 8005              # ③ Service 暴露端口
      targetPort: http        # ④ 引用 Pod 中 name: http 的端口
```

## 五、Service 类型：ClusterIP / NodePort / LoadBalancer

### 类型对比

| 类型 | `port` | `targetPort` | `nodePort` | 典型场景 |
| --- | :---: | :---: | :---: | --- |
| `ClusterIP`（默认） | 必填 | 可填 | 不适用 | 集群内部互访 |
| `NodePort` | 必填 | 可填 | 可选（30000–32767） | 绕过 Ingress 直连节点 |
| `LoadBalancer` | 必填 | 可填 | 可选 | 云厂商 LB / MetalLB |

### 项目为什么选择 ClusterIP

后端服务**不需要从集群外部直接访问**，而是通过 Traefik Ingress 统一暴露：

```text
外部请求 → Ingress (Traefik, 80/443) → Service (ClusterIP, 8005) → Pod
```

- **ClusterIP**：提供集群内部虚拟 IP 和 DNS 名，供 Pod 间互访（PostgreSQL、Redis、MinIO 同理）。
- **对外暴露**：统一交给 `ingress.yaml` 中的 Traefik，按域名/路径路由到后端 Service。

这是微服务部署的常见分工：**对外用 Ingress，对内用 ClusterIP**。

### 什么时候用 NodePort

如果想让某个服务**绕过 Ingress、直接从节点 IP + 端口访问**：

```yaml
spec:
  type: NodePort
  ports:
    - name: http
      port: 8005
      targetPort: http
      nodePort: 30080   # 每个节点 IP:30080 都能直接访问
```

**代价**：暴露到所有节点的固定端口，安全性和可维护性不如 Ingress。

## 六、没有 Ingress 也能从外部访问 Service 吗

**不能直接访问 ClusterIP。** ClusterIP 只在集群内部可达，局域网其他机器不在 K8s 网络中，无法解析。

外部访问有四种方式：

| 方式 | 原理 | 适用场景 |
| --- | --- | --- |
| **NodePort** | 节点 IP + 固定端口 | 测试、简单场景 |
| **LoadBalancer** | 云厂商 LB / MetalLB 分配入口 IP | 生产环境 |
| **Ingress** | Controller 以 NodePort/LoadBalancer 暴露 80/443，再按域名路由 | 七层路由，生产推荐 |
| **hostPort** | 容器直接绑定宿主机端口 | 简单但灵活性差 |

### Ingress 并没有凭空创建入口

即使有 Ingress，外部流量也不是"凭空"进来的。Ingress Controller（如 Traefik）底层仍然依赖 NodePort 或 LoadBalancer 暴露物理入口，然后在此之上做七层路由：

```text
局域网机器                    K8s 集群
    │                           │
    │  http://节点IP:30080      │
    ▼                           ▼
┌──────────┐    NodePort    ┌──────────┐
│  Traefik │ ←──────────── │ Traefik  │
│ Ingress  │               │ Controller│
│ Controller│              │ (Pod)    │
└──────────┘               └─────┬─────┘
                                 │  按 Ingress 规则路由
                                 ▼
                          ┌──────────┐
                          │ Service  │
                          │ ClusterIP│
                          │  :8005   │
                          └─────┬─────┘
                                │
                                ▼
                          ┌──────────┐
                          │   Pod    │
                          │  :8005   │
                          └──────────┘
```

核心结论：**Ingress 解决的是"路由"问题，不是"入口"问题**——入口始终要靠 NodePort 或 LoadBalancer 提供。



## 七、什么时候该用 Ingress

### 推荐加 Ingress 的场景

| 场景 | 理由 |
| --- | --- |
| 需要**域名路由**（`api.xxx.com` → 后端，`console.xxx.com` → MinIO） | Ingress 是唯一优雅的方案 |
| 需要 **TLS/HTTPS** 终结 | 证书管理集中在 Ingress 层，Service 只管 HTTP |
| 需要**中间件**（限流、超时、请求头改写、CORS） | Traefik/Nginx 的 Middleware 比应用层改代码方便 |
| 需要 **WebSocket** 长连接 | Ingress Controller 统一处理协议升级 |
| 多服务对外的**统一入口** | 一个 80/443 端口路由到 N 个后端 Service |

### 可以不用的场景

| 场景 | 替代方案 |
| --- | --- |
| 纯内部服务，集群外不需要访问 | 直接 ClusterIP 互访 |
| 简单的测试/开发环境 | NodePort 直连更快捷 |
| 非 HTTP 协议（TCP/UDP） | 用 NodePort 或 LoadBalancer |

### 决策流程

```text
需要集群外访问？
  ├── 否 → ClusterIP 即可
  └── 是 → 需要 HTTP 层路由能力（域名、TLS、中间件）？
            ├── 是 → ClusterIP + Ingress
            └── 否 → NodePort 或 LoadBalancer
```

## 八、选型速记

| 需求 | 推荐 |
| --- | --- |
| 仅供集群内部互访（默认场景） | `ClusterIP` |
| 绕过 Ingress，从节点 IP + 端口直接访问 | `NodePort` |
| 云厂商 LB 或 K3s ServiceLB 分配入口 IP | `LoadBalancer` |
| 域名/路径路由、TLS 终结 | `ClusterIP` + `Ingress` |
| 外部访问 + 七层路由（生产推荐） | `ClusterIP` + `Ingress` |