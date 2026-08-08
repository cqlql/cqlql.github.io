---
title: Service 与 Ingress
icon: mdi:router-network
sort: 5
---

在 Kubernetes / K3s 中，`Service` 和 `Ingress` 是负责 **网络暴露与流量路由** 的两个核心资源。

如果把容器 Pod 比作房间里的员工，简单来说：

- **Service** 就像是**内部分机号**，确保集群内部能稳定找到这群员工。
- **Ingress** 就像是**公司前台大门**，负责把来自互联网的外部访问按域名/路径分发给正确的内部部门。

---

## 一、`kind: Service`（集群内/外的服务暴露与负载均衡）

### 1. 为什么需要 Service？

Pod 是有生命周期的，重启或重新部署后 **Pod IP 会发生改变**。如果直接用 Pod IP 通信，服务一更新就会找不到地址。

### 2. Service 的作用

- **固定入口**：提供一个稳定的集群内虚拟 IP（ClusterIP）和 DNS 域名，无论 Pod 怎么销毁重拉，Service 的地址永远不变。
- **负载均衡**：自动将发往 Service 的流量轮询分发给后端的多个 Pod 副本。

### 3. 常见 Service 类型

- **`ClusterIP`（默认）**：仅限集群内部访问（比如让 Spring Boot 访问内部的 Redis 或 MySQL）。
- **`NodePort`**：在每个节点上开放一个物理端口（如 `30080`），可通过 `节点IP:30080` 从集群外访问。
- **`LoadBalancer`**：结合云厂商的负载均衡器（或 K3s 内置的 ServiceLB）分配一个公网/局域网 IP。

---

## 二、`kind: Ingress`（七层 HTTP/HTTPS 域名路由）

### 1. 为什么需要 Ingress？

虽然 `Service`（如 `NodePort`）可以暴露服务，但如果每个项目都占一个端口，端口不仅难管理，也不支持基于 **域名（`api.example.com`）** 和 **URL 路径（`/user`、`/order`）** 的高级路由，更不支持集中管理 SSL/TLS 证书。

### 2. Ingress 的作用

- **域名与路径路由**：根据 HTTP 请求的 Host（域名）和 Path（路径），将流量转发到对应的 `Service` 上。
- **TLS/HTTPS 统一终结**：在入口处统一配置加密证书，无需在 Spring Boot 应用内部配置 HTTPS。
- **轻量接入**：在 K3s 中，内置了 Traefik 作为默认的 Ingress 控制器（Ingress Controller），开箱即用。

---

## 三、完整架构与流量走向

集群外部流量请求服务的完整过程如下：

```text
外部用户 (如 https://app.example.com/api)
       │
       ▼
┌──────────────┐
│   Ingress    │ (识别域名 app.example.com 与 /api 路径，解密 HTTPS)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Service    │ (按 ClusterIP 寻址，自动做多副本负载均衡)
└──────┬───────┘
       │
   ┌───┴───┐
   ▼       ▼
┌────┐   ┌────┐
│Pod1│   │Pod2│ (最终运行 Spring Boot / Java 应用的容器)
└────┘   └────┘
```

---

## 四、YAML 配置示例

在 Spring Boot 部署清单中，三者通常配合使用：

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
  - port: 80         # Service 暴露出给集群内部用的端口
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

> **总结**：`Deployment` 负责创建和维持容器 Pod，`Service` 负责在集群内部建立稳定负载均衡，而 `Ingress` 负责对外暴露统一的域名入口。
