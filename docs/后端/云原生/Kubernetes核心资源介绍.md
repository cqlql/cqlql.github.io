---
title: Kubernetes 核心资源介绍
icon: devicon:kubernetes
sort: 6
---

Kubernetes（K8s / K3s）通过声明式的方式描述应用「期望状态」，由控制平面不断调和（Reconcile）实际状态向期望状态靠拢。本文系统梳理 Kubernetes 的核心资源与概念，覆盖工作负载、服务发现与网络、配置与密钥等。

## 一、核心概念

### 集群与节点

- **集群**：由**多台机器**组成的整体，可包含 2 台、10 台甚至上千台机器。
- **节点**：集群里的**单台机器**。
- **工作节点（Worker Node）**：物理机或虚拟机，一个工作节点对应一台机器。

### Pod 与 Labels/Selectors

Pod 推荐只放一个主进程 + 多个辅助进程，也就是一个微服务。

通过 Labels + Selectors 来区分和管理 Pod：

| **维度**            | **例子**                       | **作用**                                   |
| ------------------- | ------------------------------ | ------------------------------------------ |
| **Namespace**       | `prod-env`                     | 区分不同的运行环境（生产 vs 开发）         |
| **App Label**       | `app: mall-system`             | 区分大应用（比如整个商城系统）             |
| **Component Label** | `tier: frontend` 或 `role: db` | 区分应用内的组件（前端、后端、数据库）     |
| **Version Label**   | `version: v1.2`                | 区分同一个微服务的不同版本                 |

### 控制平面与 API Server

- **kube-apiserver**：Kubernetes 控制平面的核心组件，集群的「大脑」，负责管理所有 API 请求和集群状态。
  - **集群的通信枢纽**：所有组件和外部客户端的**唯一入口**。
  - **资源操作的权威来源**：直接与 `etcd` 通信，负责校验、持久化和管理集群状态。
  - **版本兼容性控制中心**：决定集群支持哪些 API 版本。

### 容器运行时与镜像标准

目前主要的容器运行时对比：

| **特性**            | **containerd**                   | **CRI-O**                                  | **Docker Engine**                           |
| ------------------- | -------------------------------- | ------------------------------------------ | ------------------------------------------- |
| **定位**            | 轻量级容器运行时（专注核心功能） | 专为 Kubernetes 优化的轻量运行时           | 完整的容器引擎（含开发工具链）              |
| **兼容性**          | 支持 OCI 标准，兼容 Docker 镜像  | 仅支持 Kubernetes CRI（不兼容 Docker CLI） | 完整支持 Docker 镜像和 CLI                  |
| **性能**            | 高（无额外开销）                 | 高（极简设计）                             | 中等（含 Docker 守护进程开销）              |
| **Kubernetes 集成** | 通过 CRI 插件原生支持            | 原生支持 CRI，Kubernetes 官方推荐          | 需通过 `dockershim`（已弃用）或 cri-dockerd |
| **依赖组件**        | 需额外安装 `runc`                | 需 `runc` 和 `conmon`（监控容器）          | 内置 `containerd` 和 `runc`                 |
| **安全性**          | 高（最小化攻击面）               | 高（专注 K8s 安全策略）                    | 中等（历史漏洞较多）                        |
| **易用性**          | 需 CLI 工具（`ctr`，不友好）     | 仅限 Kubernetes（无独立 CLI）              | 最佳（完整的 `docker` 命令生态）            |

- **生产环境/Kubernetes 必选 `containerd`**，更轻量、稳定，且为未来标准。
- 云原生生态已全面转向 `containerd`/`CRI-O`，长期投资建议聚焦于此。

镜像标准方面：

- **OCI 镜像是标准**，Docker 镜像是实现（并兼容标准）。
- 现代 Docker 已拥抱 OCI，两者差异逐渐缩小，但 OCI 更开放、跨平台。
- **生产部署**建议转换为 OCI 镜像（兼容性更好，避免厂商锁定），可使用 `buildah`/`skopeo` 等支持双格式的工具。
- [Docker Hub](https://hub.docker.com/) 存储的是 Docker 格式镜像，但**内容完全兼容 OCI**，所有 OCI 工具均可直接使用。

## 二、工作负载（Workload）

工作负载资源负责在集群中运行和管理 Pod。它们之间的关系是：**所有高级控制器最终都通过创建和管理 Pod 来运行实际业务**。

### 1. Pod —— 最小调度单元

- **核心定义**：Kubernetes 中**最小的部署与调度单元**，是容器的「外壳」。
- **工作机制**：一个 Pod 内可包含一个或多个共享网络（IP）和存储卷（Volume）的容器（如主应用容器 + Sidecar 辅助容器）。
- **注意**：通常**不建议直接创建孤立的 Pod**。单副本 Pod 一旦崩溃或所在节点宕机，没有任何机制会自动恢复它。

> 诊断 Pod 问题：先用 `kubectl describe pod xxx -n ns` 查看 **Events** 定位原因，再用 `kubectl get pod xxx -n ns -w` 实时观察状态变化（`Pending` → `Running`）。

### 2. Deployment —— 无状态应用控制器

- **核心定义**：最常用的无状态应用（Stateless Application）管理工具。
- **工作机制**：
  - **关注副本数量**：声明「需要 3 个副本」，Deployment 会确保集群中始终有 3 个相同的 Pod 在运行。
  - **位置不敏感**：Pod 被随机调度到各可用节点，不限制必须落在特定节点。
  - **版本管理**：支持平滑的**滚动更新（Rolling Update）**和**一键回滚**。
- **典型场景**：Web 服务、微服务 API（Spring Boot、Go、Node.js）、前端 Nginx。

### 3. DaemonSet —— 节点守护进程控制器

- **核心定义**：确保集群的**每一个（或指定）节点上，且仅运行一个 Pod 副本**。
- **工作机制**：自动跟随节点扩缩容，新增节点自动拉起 Pod，节点移除时 Pod 随之销毁。
- **典型场景**：日志收集（Fluentd、Filebeat）、节点监控（Prometheus Node Exporter）、网络/基础设施插件（Flannel、Calico、kube-vip）。

### 4. StatefulSet —— 有状态应用控制器

- **核心定义**：专门用于管理有状态应用（Stateful Applications）的控制器。
- **工作机制**：
  - **固定身份**：每个 Pod 都有唯一且固定的网络标识/主机名（如 `web-0`、`web-1`），即使漂移到其他节点也不改变。
  - **稳定存储**：每个 Pod 绑定专属持久化存储（PVC/PV），重建后仍能重新挂载原数据卷。
  - **有序增删**：Pod 的创建、更新和销毁严格按照顺序进行（`0 -> 1 -> 2`）。
- **典型场景**：数据库（MySQL 主从、PostgreSQL）、分布式中间件与存储（Redis 集群、Kafka、ZooKeeper、Elasticsearch）。

### 5. Job & CronJob —— 任务类控制器

用于处理**非持续运行**的任务，任务执行完毕即退出。

- **Job（一次性任务）**：启动一个或多个 Pod 执行特定任务，成功后（退出码 0）Pod 变为 `Completed` 并停止，不会无限重启。典型场景：数据库 Migration 脚本、一次性数据计算/导出、源码打包编译。
- **CronJob（定时任务）**：类似 Linux 的 `crontab`，基于 Cron 表达式（如 `0 2 * * *`）**周期性触发并创建 Job**。典型场景：每日凌晨数据库备份、定时清理日志/临时文件、定时发送对账邮件。

### 选型决策树

```text
               你的应用需要持续运行吗？
                     /       \
                   是         否
                  /             \
      它需要固定身份/存储吗？    它是周期性定时触发的吗？
        /            \            /           \
      是              否        是             否
      |               |         |              |
StatefulSet      每台机器都要      CronJob        Job
                 运行一个吗？
                   /     \
                 是       否
                 |        |
            DaemonSet   Deployment
```

## 三、服务发现与网络（Service / Ingress / Gateway API）

### 1. Service —— 集群内/外的服务暴露与负载均衡

Pod 是有生命周期的，重启或重新部署后 **Pod IP 会改变**。Service 提供稳定的访问入口：

- **固定入口**：提供稳定的集群内虚拟 IP（ClusterIP）和 DNS 域名，无论 Pod 如何销毁重拉，地址永远不变。
- **负载均衡**：自动将流量轮询分发给后端的多个 Pod 副本。

常见 Service 类型：

- **`ClusterIP`（默认）**：仅限集群内部访问（如让 Spring Boot 访问内部的 Redis / MySQL）。
- **`NodePort`**：在每个节点上开放物理端口（如 `30080`），通过 `节点IP:30080` 从集群外访问。
- **`LoadBalancer`**：结合云厂商负载均衡器（或 K3s 内置的 ServiceLB）分配公网/局域网 IP。

### 2. Ingress —— 七层 HTTP/HTTPS 域名路由

每个项目都占一个端口不仅难管理，也不支持基于域名/路径的高级路由和证书集中管理。Ingress 解决这些问题：

- **域名与路径路由**：根据 HTTP 请求的 Host（域名）和 Path（路径），将流量转发到对应 Service。
- **TLS/HTTPS 统一终结**：在入口处统一配置加密证书，无需在应用内部配置 HTTPS。
- **轻量接入**：K3s 内置 Traefik 作为默认 Ingress 控制器，开箱即用。

### 3. Gateway API —— 新一代流量网关标准

Gateway API 是 Ingress 的**演进与替代方案**，由 Kubernetes 官方社区（SIG Network）维护，引入更语义化、可扩展的抽象：

- **角色分离**：将「基础设施管理员」和「应用开发者」的职责拆分为不同资源——`GatewayClass`（底层网关实现）、`Gateway`（网关实例，由平台团队管理）、`HTTPRoute`（路由规则，由应用团队管理）。
- **能力增强**：原生支持**按 Header、权重、灰度发布（金丝雀）**等高级路由策略，而 Ingress 只能做简单的 Host/Path 匹配。
- **协议扩展**：支持 HTTP、TCP、UDP、gRPC 等多种协议，不局限于 HTTP。
- **与 Ingress 的关系**：多数 Ingress 控制器（如 Traefik、NGINX）已逐步提供 Gateway API 实现，二者可共存过渡。

### 流量走向示意

```text
外部用户 (如 https://app.example.com/api)
       │
       ▼
┌──────────────────────────┐
│  Ingress / Gateway API   │ (识别域名/路径，解密 HTTPS，做高级路由)
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│        Service           │ (按 ClusterIP 寻址，自动多副本负载均衡)
└──────────┬───────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
  ┌────┐      ┌────┐
  │Pod1│      │Pod2│   (最终运行业务应用的容器)
  └────┘      └────┘
```

## 四、配置与密钥（ConfigMap & Secret）

配置与密钥用于把应用配置从容器镜像中**解耦**出来，实现「一次构建、到处运行」。

### 1. ConfigMap —— 非敏感配置

- **用途**：存储非敏感的配置信息，如环境变量、配置文件内容（`.properties`、`.yaml`、`nginx.conf`）、命令行参数。
- **挂载方式**：以**环境变量**注入容器、以**文件**挂载到 Pod 的某个路径（`volume`）、作为命令行参数引用。
- **好处**：修改配置无需重新构建镜像，改 ConfigMap 后重启 Pod 即可生效。

### 2. Secret —— 敏感配置

- **用途**：存储敏感信息，如密码、Token、SSH 密钥、TLS 证书、Docker 仓库认证信息。
- **特点**：
  - 内容默认**以 Base64 编码**存储（注意：Base64 只是编码而非加密，需配合 RBAC 权限控制访问）。
  - 与 ConfigMap 一样，可以环境变量或文件方式挂载。
- **常见类型**：`Opaque`（通用键值）、`kubernetes.io/tls`（TLS 证书）、`kubernetes.io/dockerconfigjson`（镜像仓库认证）。

> **对比总结**：`ConfigMap` 存**非敏感**配置，`Secret` 存**敏感**配置，二者本质用法一致，区别在于 Secret 有更强的访问控制与类型约束。

### 使用示例

```yaml
# ConfigMap：存储非敏感配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  SPRING_PROFILES_ACTIVE: "prod"
  app.properties: |
    server.port=8080
    logging.level.root=info
---
# Secret：存储敏感配置（stringData 可直接写明文，由集群自动编码）
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
stringData:
  DB_PASSWORD: "my-password"
  API_TOKEN: "xxxxx"
---
# 在 Deployment 中同时引用二者
apiVersion: apps/v1
kind: Deployment
metadata:
  name: springboot-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: springboot-demo
  template:
    metadata:
      labels:
        app: springboot-demo
    spec:
      containers:
      - name: springboot-demo
        image: my-registry/springboot-demo:v1.0
        envFrom:
        - configMapRef:            # 将 ConfigMap 全部键作为环境变量注入
            name: app-config
        - secretRef:               # 将 Secret 全部键作为环境变量注入
            name: app-secret
        volumeMounts:
        - name: config
          mountPath: /etc/app      # 以文件方式挂载 ConfigMap
      volumes:
      - name: config
        configMap:
          name: app-config
```

## 五、完整示例：Deployment + Service + Ingress

三者通常配合使用，构成一个完整的对外服务：

```yaml
# 1. 业务容器
apiVersion: apps/v1
kind: Deployment
metadata:
  name: springboot-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: springboot-demo
  template:
    metadata:
      labels:
        app: springboot-demo
    spec:
      containers:
      - name: springboot-demo
        image: my-registry/springboot-demo:v1.0
        ports:
        - containerPort: 8080
---
# 2. 内部分级路由 (Service)
apiVersion: v1
kind: Service
metadata:
  name: springboot-service
spec:
  type: ClusterIP # 内部固定 IP
  selector:
    app: springboot-demo # 关联 label 为 app: springboot-demo 的 Pod
  ports:
  - port: 80         # Service 暴露给集群内部用的端口
    targetPort: 8080 # 对应容器内部 Spring Boot 的端口
---
# 3. 外部域名入口 (Ingress)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: springboot-ingress
spec:
  rules:
  - host: demo.example.com # 绑定的域名
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: springboot-service # 转发给指定的 Service
            port:
              number: 80
```

> `Deployment` 负责创建和维持容器 Pod，`Service` 负责在集群内部建立稳定负载均衡，而 `Ingress` 负责对外暴露统一的域名入口。

## 总结归纳

| 资源 | 作用 | 一句话定位 |
|------|------|------------|
| **Pod** | 运行容器的最小单元 | 一切工作的载体 |
| **Deployment** | 管理无状态副本、滚动更新 | 普通 Web/微服务的默认选择 |
| **DaemonSet** | 每个节点跑一个副本 | 网络/日志/监控等守护服务 |
| **StatefulSet** | 有状态应用（固定身份+存储） | 数据库/中间件 |
| **Job / CronJob** | 一次性 / 定时任务 | 跑完即退出的任务 |
| **Service** | 稳定入口 + 负载均衡 | 集群内固定「分机号」 |
| **Ingress / Gateway API** | 七层域名/路径路由 | 集群「前台大门」 |
| **ConfigMap** | 非敏感配置 | 配置与镜像解耦 |
| **Secret** | 敏感配置 | 密码/证书/Token |
