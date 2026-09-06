---
title: PassUp 前端 K8s 部署清单（Nginx + MinIO 静态资源）
icon: mdi:web
sort: 7
---

> 本文记录 `pass-up.frontend` 项目在 k3s 上的前端部署方案：**Nginx 镜像托管入口 + 静态资源上 MinIO**。核心是解决 SPA 发版后「旧用户点击未访问路由 → 请求已删除的旧 chunk → 404」这一经典问题。与后端部署清单（`PassUp后端部署清单.md`）同处 `passup` 命名空间，共享集群与 Ingress。

## 一、方案演进

前端部署经历了三个阶段，每次演进都围绕「发版是否导致在线用户 404」：

| 阶段 | 方式 | 旧 chunk 404？ | 问题 |
| :--- | :--- | :--- | :--- |
| 1. Docker Compose | Caddy + bind mount + SCP 上传 | 不 404 | 宿主机目录增量累积，旧 `assets<v>` 保留，但绑死单机 |
| 2. 镜像化初版 | caddy 镜像 + hostPath | **会 404** | 镜像每次全新构建，只含当前版本 assets，旧文件被清掉 |
| 3. **当前方案** | Nginx 镜像 + 资源上 MinIO | 不 404 | 资源与容器解耦，只增不删，彻底根治 |

> 阶段 2 之所以会 404，本质是「镜像不可变」与「资源需要增量累积」的冲突。阶段 3 用对象存储承接资源，把这一冲突化解。

## 二、整体架构

```text
用户浏览器
  │
  ├── 请求 index.html ──→ Traefik Ingress ──→ frontend Nginx（拿到最新入口）
  │
  └── 请求 *.js/*.css ──→ MinIO（资源按 content-hash 只增不删，永不 404）

frontend Nginx 内部反代：
  /api/      → passup-backend:8005      （业务接口）
  /ws/       → passup-backend:8005      （WebSocket，实时面试）
  /actuator/ → passup-backend:8009      （管理端口，仅 admin）
```

前端资源请求走**相对路径**（`VITE_API_BASE_URL` 未配置，默认为空），因此反代放在 Nginx 容器内完成（对应 docker 时代 Caddy 的职责），Traefik Ingress 只负责「域名 → 前端 Service」的入口路由。

## 三、目录结构

前端仓库新增的部署文件：

```text
pass-up.frontend/
├── .dockerignore                          # 排除 node_modules/dist/.git
├── apps/
│   ├── user/
│   │   ├── Dockerfile                     # 单阶段：nginx + COPY dist
│   │   └── nginx.conf                     # /api、/ws 反代 + SPA 回退
│   └── admin/
│       ├── Dockerfile
│       └── nginx.conf                     # 额外 /actuator 反代
├── packages/vite-config/src/index.ts      # 新增 base 支持
├── k8s/
│   ├── user.yaml                          # frontend-user Deployment + Service
│   ├── admin.yaml                         # frontend-admin Deployment + Service
│   └── ingress.yaml                       # client/admin 域名路由
└── .gitea/workflows/
    ├── deploy-user.yml                    # 构建 → MinIO → 镜像 → 滚动发布
    └── deploy-admin.yml
```

## 四、关键设计点

### 1. Vite base 指向 MinIO（核心）

在共享的 `@pass-up/vite-config` 中新增 `base` 支持：

```ts
const envVars = loadEnv(env.mode, appDir, '');

const baseConfig: UserConfig = {
  // 生产指向 MinIO/CDN，未配置时默认 '/'
  base: envVars.VITE_ASSET_BASE_URL || process.env.VITE_ASSET_BASE_URL || '/',
  build: {
    outDir: envVars.VITE_OUTPUT_DIR || 'dist',
    assetsDir: `assets${version}`,   // 版本隔离
  },
};
```

- 生产环境 CI 注入 `VITE_ASSET_BASE_URL`（=`https://<minio-public>/passup-public/user/`），`index.html` 里的 `<script src>` 自动变成 MinIO 绝对地址；
- 本地开发、`vite preview` 不设置该变量，`base` 回落 `/`，走 Vite dev proxy，完全不受影响。

### 2. 静态资源只增不删（根治 404）

`assets${version}` 目录 + content-hash 文件名，配合 CI 的**增量上传**，使旧版本资源永久保留：

```text
MinIO 桶 passup-public/
├── user/
│   ├── assets1.0.0/
│   │   ├── index-a1b2c3d4.js   ← 旧版本，保留
│   │   └── index-e5f6a7b8.js   ← 新版本，追加
│   └── index.html              ← 冗余上传，无害
└── admin/
    └── assets1.0.0/...
```

旧用户停留在旧页面，点未访问的路由触发异步 chunk 请求，浏览器按旧 `index.html` 里的旧 hash 去 MinIO 取，**永远命中**。

### 3. 单阶段镜像（避免重复构建）

方案 2 需要 CI 先产出 `dist`（既用于上传 MinIO，又用于打包镜像），因此 Dockerfile 改为**单阶段**，不再在容器内重复 `pnpm build`：

```dockerfile
FROM nginx:1.27-alpine
COPY apps/user/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/user/dist/ /usr/share/nginx/html/
EXPOSE 80
```

> 镜像内的 assets 仅为兜底冗余（资源引用已指向 MinIO），不影响「资源持久化」效果。这样省掉一次 `pnpm install + build`，CI 耗时减半。

### 4. Nginx 反代与 SPA 回退

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA History 模式回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 业务 API（相对路径，容器内反代到后端）
    location /api/ {
        proxy_pass http://passup-backend.passup.svc.cluster.local:8005;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket（实时面试 /ws/audio）
    location /ws/ {
        proxy_pass http://passup-backend.passup.svc.cluster.local:8005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

- `proxy_pass` 不带 URI，原样转发 `/api/xxx` 完整路径；
- WebSocket 需 `Upgrade`/`Connection` 头 + 长超时；
- admin 额外增加 `/actuator/` → `8009`（日志管理等 Actuator 端点）。

## 五、CI/CD 流程

以 `deploy-user.yml` 为例：

```text
Checkout → Node 24 + pnpm → pnpm install
  → VITE_ASSET_BASE_URL=... pnpm build        （base 指向 MinIO）
  → mc cp --recursive dist/ minio/bucket/prefix/   （增量上传，只增不删）
  → docker build -f apps/user/Dockerfile      （单阶段 COPY dist）
  → docker push（tag: latest + commit short hash）
  → kubectl apply -f k8s/user.yaml -f k8s/ingress.yaml
  → kubectl set image deployment/frontend-user user=$IMAGE:$SHORT_SHA
  → kubectl rollout status（滚动发布，可回滚）
```

要点：

- 镜像 tag 用 **commit short hash**（`$GITHUB_SHA` 截取前 8 位）而非仅 `latest`，配合 `set image` 实现精确版本发布与回滚；
- `mc cp`（MinIO Client）是**增量追加**，不会删除目标端旧文件，这是方案 2 生效的关键；
- 两个 workflow 都会 `apply ingress.yaml`（幂等，内容相同无副作用）。

## 六、关键约定（速查表）

| 项目 | 值 |
| :--- | :--- |
| 命名空间 | `passup`（与后端共享） |
| 镜像 | `172.16.0.222:5000/passup/frontend-{user,admin}` |
| 前端 Service | `frontend-user`、`frontend-admin` |
| 资源 base | `VITE_ASSET_BASE_URL` = `https://<minio-public>/passup-public/{user\|admin}/` |
| MinIO 桶 | `passup-public`（`user/`、`admin/` 前缀隔离） |
| 反代端口 | `/api`、`/ws` → 8005；`/actuator` → 8009（仅 admin） |
| 副本数 | 2（滚动更新 `maxUnavailable: 0`） |
| 资源版本目录 | `assets${version}`（version 来自 package.json） |

## 七、部署前置条件

1. **Gitea Secrets**：
   - `REGISTRY_USERNAME` / `REGISTRY_PASSWORD`（镜像仓库登录）
   - `KUBECONFIG`（kubectl 访问集群）
   - `MINIO_ENDPOINT`（内网，如 `http://192.168.1.221:9000`）
   - `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`
2. **镜像拉取凭证**：`passup-registry-secret`（后端已创建，前端 Deployment 复用）。
3. **MinIO 桶配置**：`passup-public` 需**匿名可读 + CORS**，否则浏览器跨域拉资源失败。
4. **域名**：`k8s/ingress.yaml` 中 `client.your-domain.com` / `admin.your-domain.com` 替换为真实域名。

## 八、值得借鉴的设计点

1. **资源与容器解耦**：入口（index.html）走容器拿最新、资源走对象存储只增不删，彻底解决 SPA 发版 404。
2. **版本隔离 + 增量上传**：`assets${version}` + content-hash 文件名 + `mc cp` 追加，旧资源天然保留。
3. **构建只做一次**：单阶段镜像，避免容器内重复 `pnpm install/build`。
4. **反代职责内聚**：Nginx 容器内反代 `/api`、`/ws`，Ingress 只做域名路由，分层清晰（对应 `Kubernetes前端SPA部署实践.md` 中「双层 Nginx 职责划分」）。
5. **可回滚发布**：镜像 tag 用 commit hash + `kubectl set image`，比 `latest` + `rollout restart` 更可控。

## 九、遗留与后续

- **方案 3（版本检测弹窗）暂未落地**：资源 404 已由 MinIO 解决，但旧用户停留在旧页面仍可能遇到接口契约变更，后续可加 `version.json` 轮询 + 刷新提示 + chunk 加载失败兜底，作为体验增强。
- **MinIO 公网 URL 结构需确认**：是 path-style（`/passup-public/user/`）还是 virtual-host（`passup-public.<domain>`），决定 `VITE_ASSET_BASE_URL` 的正确拼法，当前按 path-style 假设。
- **旧资源清理**：可给 `passup-public` 桶配 30 天生命周期策略，对齐原 SCP 方案的 `-mtime +30` 清理逻辑。
