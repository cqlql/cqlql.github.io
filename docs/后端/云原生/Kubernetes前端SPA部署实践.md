---
title: Kubernetes 前端 SPA 部署实践
icon: mdi:vuejs
sort: 10
---

在 Kubernetes 中部署 Vue/Vite 等 SPA 前端，**Nginx + 多阶段镜像构建 + Service + Ingress** 是生产环境中最主流、最稳定的方案。本文从方案选型到落地配置，给出完整实践指南。

## 方案选型

| 方案 | 优点 | 缺点 | 适用场景 |
| --- | --- | --- | --- |
| **CDN + OSS/S3**（云原生最佳实践） | 无服务器运维、全球加速、抗高并发 | 需配置 SPA 404 回退、发版需刷新 CDN | 大型生产环境、跨地域访问 |
| **Nginx + K8s**（推荐） | 部署自控、CI/CD 统一、灵活控制缓存策略、支持私有化 | 占用 K8s 算力和带宽 | 私有云/内网、中小规模生产环境 |
| **Node.js / Express** | 适合 SSR（Next.js/Nuxt.js） | 纯静态性能远低于 Nginx、内存开销大 | 仅 SSR 场景 |

> 本文聚焦方案二：**Nginx + K8s** 的落地实践。

## 整体架构

```text
用户
 │
 ▼
Ingress Controller
 │
 ├── client.example.com  ──→  frontend Service  ──→  Nginx Pod  ──→  静态文件
 │
 └── api.example.com     ──→  backend Service   ──→  Spring Boot Pod
```

## 镜像构建

### 为什么不用 ConfigMap 挂载静态文件

```yaml
# ❌ 不推荐
volumes:
  - name: static
    configMap:
      name: frontend-static
```

ConfigMap 有 **1MB 大小限制**，而 Vite 打包后文件多且分散，多前端项目各自独立构建时更难维护。此方式仅适合演示。

### 多阶段构建（推荐）

将 `npm run build` 与 Nginx 运行时合并到一个 Dockerfile，最终镜像只包含 Nginx + 静态文件，体积小、版本化清晰：

```dockerfile
# 第一阶段：构建
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 第二阶段：运行
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

构建产物：

```text
frontend-client:1.0.0
└── /usr/share/nginx/html
    ├── index.html
    └── assets/
```

## K8s 资源配置

静态文件打入镜像后，不再需要挂载 volume，Deployment 和 Service 都非常简洁：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-client
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend-client
  template:
    metadata:
      labels:
        app: frontend-client
    spec:
      containers:
        - name: frontend-client
          image: registry.example.com/frontend-client:v1.0.0
          ports:
            - name: http
              containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
          livenessProbe:
            httpGet:
              path: /
              port: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-client
spec:
  selector:
    app: frontend-client
  ports:
    - name: http
      port: 80
      targetPort: 80
```

## Nginx 配置

Vite 打包后静态资源文件名带 Hash（如 `index-C8d2aK3x.js`），可利用浏览器长期缓存；`index.html` 则必须禁止缓存，否则发版后可能加载旧资源引用：

```nginx
server {
    listen 80;

    root /usr/share/nginx/html;
    index index.html;

    # SPA 回退：$uri/ 保证缺失的 CSS/JS 不会误回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # index.html 禁止缓存
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # 带 Hash 的静态资源长期缓存
    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 双层 Nginx 的职责划分

Ingress Controller 已经是 Nginx，为什么 Pod 内还要再套一层？

```text
Internet  →  Nginx Ingress Controller  →  Frontend Nginx  →  静态文件
```

**两层职责不同，完全合理**：

| 层级 | 职责 |
| --- | --- |
| **Ingress Controller** | TLS 终止、域名路由、负载均衡、网关层策略 |
| **Pod 内 Nginx** | 静态文件服务、SPA fallback、缓存策略、gzip/brotli 压缩 |

本质是 **L7 Gateway + Application Static Server** 的分层架构，不应为了省一个 Nginx 引入更复杂的方案。

## 多项目推荐架构

以 PassUp 项目为例，多前端 + 后端 + 中间件的整体结构：

```text
K3s
├── ingress-controller
├── frontend-user       → Deployment + Service + Nginx → Vue SPA
├── frontend-admin      → Deployment + Service + Nginx → Vue SPA
├── passup-backend      → Deployment + Service → Spring Boot
├── Redis
└── 其他服务
```

Ingress 路由：

```text
user.passup.com   →  frontend-user Service   →  Nginx → Vue SPA
admin.passup.com  →  frontend-admin Service  →  Nginx → Vue SPA
api.passup.com    →  passup-backend Service  →  Spring Boot
```

## 总结

| 原则 | 说明 |
| --- | --- |
| **静态文件打入镜像，不用 ConfigMap** | 多阶段构建，版本化、易维护、无大小限制 |
| **Ingress 管路由，Nginx 管静态文件** | 各司其职，不混为一谈 |
| **Hash 资源长期缓存，index.html 不缓存** | 利用浏览器缓存加速，同时保证发版即时生效 |

这是从 Docker 单机部署迁移到 K3s 时，最平衡、最容易维护的前端部署方案。