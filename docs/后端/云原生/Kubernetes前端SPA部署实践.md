---
title: Kubernetes 前端 SPA 部署实践
icon: mdi:vuejs
sort: 10
---

在 Kubernetes 中部署 Vue/React 等 SPA 前端，**Nginx + 多阶段镜像构建 + Service + Ingress** 是生产环境中最主流、最稳定的方案。本文从方案选型到落地配置，并重点补上两个易被忽略的坑：**发版导致的异步 chunk 404** 与 **缓存策略闭环**。

## 方案选型

| 方案 | 优点 | 缺点 | 适用场景 |
| --- | --- | --- | --- |
| **Nginx + K8s**（推荐） | 部署自控、CI/CD 统一、灵活控制缓存策略、支持私有化 | 占用 K8s 算力和带宽 | 私有云/内网、中小规模生产环境 |
| **Nginx + OSS/MinIO/CDN**（进阶） | 资源持久化、解决发版 404、可 CDN 加速 | 需对象存储设施、需配置 base | 生产环境标准做法 |
| **Node.js / Express** | 适合 SSR（Next.js/Nuxt.js） | 纯静态性能远低于 Nginx、内存开销大 | 仅 SSR 场景 |

> 关键认知：**「Nginx 托管」与「资源上 OSS/CDN」不是二选一，而是正交的**。前者解决「入口与反代」，后者解决「资源持久化」，两者可以结合——用 Nginx 托管 `index.html`，把 `*.js/*.css` 放到对象存储。这恰好是解决发版 404 的推荐架构（见下文）。

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

**前后端接口的两种调用模式**，决定了反代放哪一层：

| 模式 | 前端请求路径 | 反代位置 |
| :--- | :--- | :--- |
| 独立域名 | `https://api.example.com/api/...`（绝对地址） | Ingress 按域名直接路由到 backend |
| **同域相对路径** | `/api/...`、`/ws/...`（相对地址） | **Nginx Pod 内 `proxy_pass` 到 backend** |

> 实际项目多采用**同域相对路径**（前端 `baseURL` 为空），此时 Nginx 除静态服务外，还需承担 `/api`、`/ws` 的反代职责（见下文 Nginx 配置）。

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

### monorepo 多应用的注意点

pnpm workspace 等多应用仓库，Dockerfile 放在 `apps/<app>/` 下时，**构建上下文必须是仓库根目录**：

```bash
# 注意最后的 . 是仓库根，不是 apps/<app>
docker build -f apps/user/Dockerfile .
```

`.dockerignore` 需排除 `node_modules`、`**/dist`、`.git`，否则 COPY 会把本地依赖和产物一并打进构建层，拖慢且易引入污染。

### 单阶段 vs 多阶段：资源上 OSS 时单阶段更优

若采用「资源上 OSS/MinIO」架构（见下文），CI 需要先产出 `dist`（既上传 OSS 又打包镜像），此时 Dockerfile 再走多阶段就会**重复构建一次**。应改为单阶段，直接在 CI 里构建、容器只做 COPY：

```dockerfile
# 单阶段：CI 已完成 build，这里只 COPY 产物
FROM nginx:1.27-alpine
COPY apps/user/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/user/dist/ /usr/share/nginx/html/
EXPOSE 80
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
  strategy:                  # 滚动更新，保证始终有可用副本
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
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
          imagePullPolicy: Always
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
          resources:
            requests: { cpu: "10m", memory: "16Mi" }
            limits: { cpu: "200m", memory: "64Mi" }
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

> **可回滚发布**：镜像 tag 建议用 **commit short hash**（而非仅 `latest`），CI 里 `kubectl set image` 精确指定版本，配合 `rollout undo` 即可快速回滚；`latest` + `imagePullPolicy: Always` 无法追溯具体版本。

## Nginx 配置

下面是一份**完整**的 Nginx 配置，涵盖 SPA 回退、缓存策略、gzip 压缩、API/WebSocket 反代（同域相对路径场景）：

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # gzip 压缩，加速静态资源加载
    gzip on;
    gzip_min_length 1k;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;

    # SPA 回退：$uri/ 保证缺失的 CSS/JS 不会误回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # index.html 禁止缓存（详见「缓存策略闭环」）
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # 带 Hash 的静态资源长期缓存
    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 业务 API 反代到后端（同域相对路径场景，独立域名则可省略）
    location /api/ {
        proxy_pass http://passup-backend.passup.svc.cluster.local:8005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 反代（如实时语音、即时消息）
    location /ws/ {
        proxy_pass http://passup-backend.passup.svc.cluster.local:8005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

要点：

- `proxy_pass` 不带 URI 后缀时，会**原样转发** `/api/xxx` 完整路径，切勿在地址末尾加 `/`（否则会剥离前缀）；
- WebSocket 必须显式 `Upgrade`/`Connection` 头 + 长超时，否则升级失败或长时间静默被掐断；
- 若后端还有独立管理端口（如 Actuator 的 `8009`），同样加一条 `location /actuator/` 反代即可。

## 缓存策略闭环

缓存是 SPA 部署最容易埋雷的地方，必须理解**为什么**这样配：

| 文件 | 特征 | 缓存策略 | 原因 |
| :--- | :--- | :--- | :--- |
| `index.html` | 内容随版本变，文件名固定 | `no-cache` | 必须每次验证，保证用户拿到最新入口、引用最新 chunk |
| `assets/*.js` `.css` | 文件名带 **content-hash** | `immutable` 长期缓存 | 内容变了 hash 就变（文件名不同），可永久缓存 |

**核心闭环**：

```text
index.html（no-cache，每次拿最新）
   └─ 引用 assets/index-<hash>.js（immutable）

发版后：
  新 index.html ──引用──> index-新hash.js   ✅ 新用户加载新资源
  旧 index.html ──引用──> index-旧hash.js   ⚠️ 旧文件必须还在，否则 404
```

`index.html` 不缓存是**前提**（否则浏览器用缓存的旧 html，永远引用旧 chunk，发版不生效）；而 `assets` 之所以能 `immutable`，靠的是 content-hash 文件名——内容不变 hash 不变、内容一变 hash 就变，天然支持永久缓存。

> 这一闭环直接引出下一节的核心问题：**旧 hash 文件在发版后是否还保留**。

## 发版 404 问题与解决（重点）

### 问题场景

当用户停留在页面上时，`index.html` 的内存结构已加载完毕。此时发版销毁旧 Pod，用户点击**未访问过的路由**触发懒加载：

```js
import('./views/About.vue')   // 异步 chunk，按需加载
```

浏览器会去请求旧 `index.html` 里引用的旧 JS（如 `index-a1b2c3d4.js`），而新镜像里只有新 hash 文件，旧文件已被删 → **404**，页面白屏或加载失败。

**根本原因**：SPA 代码分割（code splitting）+ 懒加载，让 chunk 按需请求；而「镜像不可变」意味着每次发版只携带当前版本的资源，旧 chunk 无从加载。

### 三种解决思路

| 方案 | 解决 404 | 体验 | 成本 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **共享存储 / 多版本镜像** | 完全解决 | 无感 | 低 | 增量保留旧文件：PV 增量复制，或镜像内保留上 N 个版本的 assets |
| **资源上 OSS/MinIO（推荐）** | 完全解决 | 无感 | 中 | `index.html` 走容器，`*.js/*.css` 走对象存储，只增不删 |
| **版本检测 + 弹窗刷新** | 缓解 | 良好 | 低 | 轮询 `version.json` 提示刷新，配合上面两方案做兜底 |

### 推荐：资源上 OSS/MinIO + Vite base

这是大型 SPA 的标准发布架构，彻底解耦「版本入口」与「静态资源」：

```text
用户浏览器
  ├─ 请求 index.html ──→ Ingress ──→ Nginx（拿到最新入口）
  └─ 请求 *.js/*.css ──→ MinIO/OSS（只增不删，永久存在）
```

落地三步：

1. **Vite 配置 `base`**：让资源引用指向对象存储地址，dev 仍走相对路径：

```ts
// vite.config.ts
export default defineConfig({
  // 生产指向 MinIO/CDN，未配置时默认 '/'
  base: process.env.VITE_ASSET_BASE_URL || '/',
  build: {
    assetsDir: 'assets',   // 可加版本隔离，如 `assets${version}`
  },
});
```

2. **CI 增量上传**：构建后把 `dist/assets/*` 同步到 MinIO，**只增不删**：

```bash
# MinIO Client 增量复制，旧 content-hash 文件保留
mc cp --recursive dist/ minio/<bucket>/<prefix>/
```

3. **镜像只打包入口**：Dockerfile 只 COPY `index.html`（及 favicon 等 public 文件），资源不进镜像。

> **效果**：旧用户停留旧页面，点击新路由请求旧 chunk，永远能从 MinIO 拿到旧 hash 文件，**绝不可能 404**；容器版本如何滚动都与资源无关。

### 补充：版本检测弹窗（可选兜底）

即使资源不 404，旧用户停留在旧页面也可能遇到**接口契约变更、逻辑不一致**。可在打包时生成 `version.json`，前端定时轮询，检测到新版本后右下角提示「建议立即刷新」，并配合全局 chunk 加载失败捕获做二次兜底。成本极低，建议与资源上 OSS 方案叠加使用。

## 双层 Nginx 的职责划分

Ingress Controller 已经是 Nginx，为什么 Pod 内还要再套一层？

```text
Internet  →  Nginx Ingress Controller  →  Frontend Nginx  →  静态文件
```

**两层职责不同，完全合理**：

| 层级 | 职责 |
| --- | --- |
| **Ingress Controller** | TLS 终止、域名路由、负载均衡、网关层策略 |
| **Pod 内 Nginx** | 静态文件服务、SPA fallback、缓存策略、gzip/brotli 压缩、API/WS 反代 |

本质是 **L7 Gateway + Application Static Server** 的分层架构，不应为了省一个 Nginx 引入更复杂的方案。

## 多项目推荐架构

以 PassUp 项目为例，多前端 + 后端 + 中间件的整体结构：

```text
K3s
├── ingress-controller
├── frontend-user       → Deployment + Service + Nginx → React SPA（资源上 MinIO）
├── frontend-admin      → Deployment + Service + Nginx → React SPA（资源上 MinIO）
├── passup-backend      → Deployment + Service → Spring Boot
├── Redis
└── 其他服务
```

Ingress 路由：

```text
user.passup.com   →  frontend-user Service   →  Nginx → SPA
admin.passup.com  →  frontend-admin Service  →  Nginx → SPA
api.passup.com    →  passup-backend Service  →  Spring Boot
```

## Ingress 路由与部署验证

### Ingress 两种路由方式

对外暴露服务有两种方式，取决于是否有域名：

**方式 A：域名路由（推荐，生产标准）**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: frontend-web
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web
spec:
  ingressClassName: traefik
  rules:
    - host: user.passup.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-user
                port:
                  number: 80
    - host: admin.passup.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-admin
                port:
                  number: 80
```

**方式 B：路径路由（无域名 / 内网测试）**

没有域名时，可基于路径前缀区分服务，直接访问 `http://<VIP>/user`：

```yaml
spec:
  rules:
    - http:
        paths:
          - path: /user
            pathType: Prefix
            backend:
              service:
                name: frontend-user
                port:
                  number: 80
          - path: /admin
            pathType: Prefix
            backend:
              service:
                name: frontend-admin
                port:
                  number: 80
```

> ⚠️ 路径路由下，SPA 的 `base` 必须同步设为 `/user/` 等前缀，否则 `index.html` 里的资源引用仍是 `/assets/...` 绝对路径，会绕过前缀直接打到根路径而 404。

### 部署与验证

```bash
# 应用清单
kubectl apply -f k8s/user.yaml -f k8s/admin.yaml -f k8s/ingress.yaml

# 检查资源状态（Deployment/Service/Ingress 一次看全）
kubectl get pods,svc,ingress -n passup

# 访问测试
# 域名模式：DNS 解析到 Ingress VIP，或本地 hosts 指向 VIP 后访问
curl -I http://user.passup.com/
# 路径模式：直接访问 VIP + 路径前缀
curl -I http://<VIP>/user/
```

验证要点：

- `kubectl get pods` 确认所有 Pod `Running` 且就绪（`READY 2/2`）；
- `kubectl get ingress` 确认 `ADDRESS` 已分配（Traefik 分配的 VIP）；
- 浏览器直接刷新任意前端路由（如 `/user/about`）不 404，说明 SPA 回退生效；
- 打开开发者工具，确认 `index.html` 响应头带 `Cache-Control: no-cache`、`assets/*.js` 带 `immutable`，缓存策略正确落地。

## 总结

| 原则 | 说明 |
| --- | --- |
| **静态文件打入镜像，不用 ConfigMap** | 多阶段构建，版本化、易维护、无大小限制 |
| **Ingress 管路由，Nginx 管静态文件 + 反代** | 各司其职，同域相对路径时反代落在 Nginx 层 |
| **Hash 资源长期缓存，index.html 不缓存** | 缓存策略闭环，保证发版即时生效 |
| **资源上 OSS/MinIO，只增不删** | 根治发版后异步 chunk 404，SPA 部署最易踩的坑 |
| **镜像 tag 用 commit hash** | 可追溯、可回滚，优于仅 latest |

这是从 Docker 单机部署迁移到 K3s 时，兼顾「稳定易维护」与「发版不打断在线用户」的前端部署方案。
