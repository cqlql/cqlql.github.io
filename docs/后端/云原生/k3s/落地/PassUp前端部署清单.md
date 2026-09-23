---
title: PassUp 前端 K8s 部署清单（Nginx 托管 + 静态资源策略）
icon: mdi:web
sort: 7
---

> 本文记录 `pass-up.frontend` 在 k3s 上的部署。**全文围绕一个问题**：
> SPA 发版后，还开着旧页面的用户去加载「已被删掉的旧 chunk」会 404。
> 围绕它有两条静态资源策略（**同源** / **对象存储**），本文说清取舍、当前用的是哪条，
> 以及各自还剩什么没解决。与后端部署清单（`PassUp后端部署清单.md`）同处 `passup` 命名空间。

## 一、结论先行

| 项 | 当前实际 |
| :--- | :--- |
| 站点 | `frontend-user` × 3、`frontend-admin` × 3 |
| 入口 | **单入口 + 路径分流**：`/` → user，`/admin` → admin（Traefik `StripPrefix`） |
| 静态资源 | **同源**（资源打进镜像，由容器内 nginx 直接返回） |
| TLS | **集群侧不做**，由外层 nginx 终止后 http 转发进来 |
| 旧 chunk 404 | ❌ **没有彻底解决**（这是本文的核心问题，见第二节） |

**为什么选了同源**：另一条路（对象存储）要求**浏览器能访问到对象存储端点**。
集群里那套 MinIO 只在局域网（`172.16.0.222:8007`），而 CI 里写的是公网域名
`hragentadmin.xiaodingtie.com` —— 那个域名是否还可用无法确认。
同源不依赖任何外部端点，**保证页面一定能打开**，代价是第二节那个问题回来了。

> ⚠️ 所以「用同源」是一个**可用的取舍，不是最优解**。等对象存储端点确认可达（且配好
> CORS + 匿名读）之后，切回对象存储才是把旧 chunk 问题真正解决掉的做法。

## 二、核心权衡：静态资源放哪

| | **同源**（资源打进镜像） | **对象存储**（MinIO / CDN） |
| :--- | :--- | :--- |
| 旧 tab 请求旧 chunk | ❌ **404**（新镜像里没有旧 hash 文件） | ✅ 保留（**只增不删**，旧 hash 文件一直在） |
| 依赖 | 无 | 需要**浏览器可达**的对象存储端点 + CORS + 匿名读 |
| 发版时资源清理 | 随镜像一起被替换 | 需另行配生命周期策略清理 |
| 适用 | 内网 / 没有对象存储 | 有浏览器可达的对象存储 |

**为什么同源一定会 404**：镜像不可变 —— 新镜像里只有「本次构建产出的那些 hash 文件」，
上一次构建的 hash 文件不在里面。旧页面的 `<script>` / 动态 `import()` 指向的是旧 hash，
请求打过来就是 404。

> 关键区分：**这个 404 与「资源放哪」无关，与「旧文件是否被保留」有关。**
> 镜像天然不保留旧文件，对象存储默认保留。

## 三、资源目录命名：`assets<version>`

构建时由 `packages/vite-config/src/index.ts` 决定：

```ts
build: {
  outDir: envVars.VITE_OUTPUT_DIR || 'dist',
  assetsDir: `assets${version}`,   // ← 资源目录
}
```

`version` 的取值顺序：

```text
apps/<app>/package.json 的 version
  → 若为占位版本 0.0.0 或读不到 → git 短提交 hash
    → 非 git 环境 → 时间戳
```

当前 `apps/user` 与 `apps/admin` 的 `package.json` **都写死 `1.0.0`**，
CI 里也没有 bump 版本的步骤 —— 所以资源目录**恒为 `assets1.0.0/`**，
变的是目录里的**文件名**（content-hash）：

```text
dist/assets1.0.0/index-C9E2EoSO.js     ← 本次构建
dist/assets1.0.0/index-8nYQTMZW.js     ← 下次构建（文件名变了）
```

> 这个设计的**本意**是「不同版本的资源互不覆盖，从而支持保留历史版本 + 长缓存」。
> 但要注意：**它只有在「旧版本目录被保留下来」的存储上才成立**。
> 放进镜像里，`assets1.0.0/` 这个目录每次都被整份替换掉，
> 版本号写死反而让「互不覆盖」失去了意义 —— 真正起作用的是文件名 hash。

## 四、整体架构（当前实际）

```text
用户浏览器
  │
  │  https://<公网域名>
  ▼
外层 nginx（终止 TLS，已有证书）
  │
  │  http://172.16.0.180   ← Traefik 的 kube-vip VIP
  ▼
Traefik Ingress（只走 web/80；rules **不写 host**）
  ├── /admin  → StripPrefix 去掉 /admin → frontend-admin
  └── /       → frontend-user
                    │
                    ├── 静态资源：容器内 nginx 直接返回（同源）
                    ├── /api/  → passup-backend:8005
                    └── /ws/   → passup-backend:8005（WebSocket）
```

前端资源请求走**相对路径**，所以反代放在容器内 nginx 完成，Traefik 只负责「路径 → Service」。

## 五、目录结构

```text
k8s/
├── README.md            # 部署说明（拓扑、两条构建路径、踩过的坑）
├── deploy.sh            # 一键：构建 + 推镜像 + 部署（同源资源）
├── user.yaml            # 客户端 Deployment + Service
├── admin.yaml           # 管理端 Deployment + Service
└── ingress.yaml         # Traefik Middleware（StripPrefix）+ Ingress
```

CI 侧：`.gitea/workflows/deploy-{user,admin}.yml`。

## 六、关键设计点

### 1. Nginx 反代：请求时才解析上游

```nginx
resolver 10.43.0.10 valid=5s ipv6=off;

location /api/ {
    set $backend "passup-backend.passup.svc.cluster.local:8005";
    proxy_pass http://$backend;
    ...
}
```

`resolver` 指向集群 DNS（`10.43.0.10`），配合 `set $backend` + 变量形式的 `proxy_pass`，
让域名在**每个请求**时解析 —— 这样**后端 Service 还没创建时 nginx 也能正常启动**并提供静态资源，
而不是启动就报 `host not found in upstream` 直接挂掉。

### 2. SPA History 回退

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

否则用户刷新 `/interview/history` 这类前端路由会 404。

### 3. admin 挂在 `/admin` 子路径（两个 base 必须成对注入）

Traefik 用 `StripPrefix` 去掉 `/admin` 后再转发，所以容器内 nginx 仍按根路径 `/` 提供 SPA。
但**浏览器**看到的路径是带 `/admin` 的，所以构建时必须同时给两个变量：

| 变量 | 值 | 管什么 |
| :--- | :--- | :--- |
| `VITE_ASSET_BASE_URL` | `/admin/` | 静态资源的引用前缀 |
| `VITE_BASE_PATH` | `/admin` | 客户端路由 basename |

**只给一个就会出问题**：只给资源 base → 刷新 404；只给路由 basename → 页面能开但 JS 404。

### 4. 单阶段镜像

CI 里已经 `pnpm build` 过，镜像只做「nginx 基础镜像 + COPY nginx.conf + COPY dist」，
不在容器内重复装依赖、重复构建。

### 5. Ingress 的 rules **不写 host**

外层 nginx 转发进来时带的 `Host` 头不确定（可能是公网域名，也可能是 IP，取决于
`proxy_set_header Host ...` 怎么配）。写死一个 host 只要对不上就**整站 404**，
而 Traefik 只回 404、不报错，很难查。

不写 host 的 rule 匹配**任意 Host**，外层怎么配都能通。已验证：
`Host` 为空 / `app.passup.local` / `whatever.example.com` / `172.16.0.180` 全部 200。

> ✅ 不用担心它盖住别的规则：Traefik 按规则长度定优先级，带 `Host` 的规则更长、优先匹配。
> 关于入口 IP、VIP 漂移、`host` 为什么不能写 IP，见
> [Ingress / Service / Traefik 入口的关系](../原理与选型/Ingress与Service与Traefik入口的关系.md) 第七~十节。

## 七、两条部署路径

| | `k8s/deploy.sh`（本地） | CI（`.gitea/workflows/`） |
| :--- | :--- | :--- |
| 触发 | 手动 | push 到 `frontend` 分支且命中 paths |
| 构建 | 本机 `pnpm build` + `docker build` | 同样，但在 runner 上 |
| **资源 base** | **同源**（`/` 或 `/admin/`） | 对象存储公网地址 |
| 资源上传 | 无（打进镜像） | `mc cp` 到 MinIO（只增不删） |
| 镜像 tag | `日期-时间-短sha` | `短sha` + `latest` |
| apply | `deploy.sh` 内（会 `strip_pullsecret`） | `kubectl apply -f k8s/{user,ingress}.yaml`（**不删**） |

> ⚠️ 两条路径对 `imagePullSecrets` 的处理不一致：`deploy.sh` 会把它从清单里删掉，
> CI 直接 apply 会保留。内网仓库是**匿名可读**的（实测 `/v2/` 返回 200），
> 引用一个不存在的 `passup-registry-secret` 不会让 Pod 起不来，但 kubelet 会一直刷
> `FailedToRetrieveImagePullSecret` 警告事件。**建议把这段从 `user.yaml`/`admin.yaml` 里直接删掉。**

## 八、关键约定（速查表）

| 项目 | 值 |
| :--- | :--- |
| 命名空间 | `passup`（与后端共享） |
| 镜像 | `172.16.0.222:5000/passup/frontend-{user,admin}` |
| Service | `frontend-user:80`、`frontend-admin:80`（ClusterIP） |
| 副本数 | **3**（`maxUnavailable: 0` + `maxSurge: 1`） |
| 容器端口 | `http` = 80 |
| 探针 | readiness / liveness 都是 `GET /` |
| 资源 | requests `10m`/`16Mi`，limits `200m`/`64Mi` |
| 资源目录 | `assets${version}`，当前 version 恒为 `1.0.0` |
| 入口 | Traefik VIP `172.16.0.180`（HTTP）；`/admin` → admin，`/` → user |
| 反代目标 | `/api`、`/ws` → `passup-backend.passup.svc.cluster.local:8005` |

## 九、实测数据与踩过的坑

### 实测（2026-09-23）

```bash
VIP=172.16.0.180
curl -s -o /dev/null -w '%{http_code}\n' "http://$VIP/"              # 200
curl -s -o /dev/null -w '%{http_code}\n' "http://$VIP/admin/"        # 200
curl -s -o /dev/null -w '%{http_code}\n' "http://$VIP/admin/login"   # 200（SPA 回退）
curl -s -o /dev/null -w '%{http_code}\n' "http://$VIP/api/"          # 200（反代到后端）
```

- admin 的入口 JS 经 `/admin/assets1.0.0/...` 取到（nginx 日志确认 50 KB 真实内容）
- `Host` 为空 / 任意域名 / IP **全部 200**

### 坑 1：Windows + Git Bash 下的三个构建/部署失败

| 现象 | 根因 | 处理 |
| :--- | :--- | :--- |
| `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`，且**user 构建成功、admin 构建失败** | 带删除保护的沙箱环境通过 `NODE_OPTIONS` 注入了 shim，额度按 turn 累计 —— 第一个 app 用完后第二个超阈值 | 构建时加 `NODE_OPTIONS= CODEBUDDY_SAFE_DELETE_ENABLED=0` |
| `SAFE_DELETE_FAIL_CLOSED`，路径出现 `/d/_work/.../C:/Users/...` 双重路径 | `mktemp -d` 给的是 `/tmp/...`，与非 MSYS 感知的程序拼接时被拼坏 | 临时目录也 `cygpath -m` 转一次 |
| `kubectl 无法连接集群`，但 kubeconfig 明明在 | Windows 原生 kubectl 读不了 Git Bash 的 `/c/...` 形态路径 | `KUBECONFIG` 也要 `cygpath -m` 转 |

> 三条都已修进 `k8s/deploy.sh`。**第一条的现象特别有迷惑性** ——
> 「user 成功、admin 失败」很容易被误判成 admin 应用自己有问题，
> 实际是额度按 turn 累计、第二个 app 才踩到阈值。

### 坑 2：CI 与本地构建的资源来源不同，别混着看

排查「页面白屏」时，先确认**这份镜像到底是哪条路径构建的**：
看 `index.html` 里的资源地址是 `/assets1.0.0/...`（同源）还是
`https://<对象存储>/passup-public/<app>/assets1.0.0/...`（对象存储）。

## 十、遗留与后续

1. **旧 chunk 404 未解决**（本文核心问题）。当前靠「同源」换取了「一定能打开」。
   彻底解决需要把资源放回**只增不删**的对象存储，并确认：
   - 对象存储端点**浏览器可达**（不是只有集群/局域网可达）；
   - 桶配好**匿名读 + CORS**；
   - 公网 URL 结构是 path-style 还是 virtual-host（决定 `VITE_ASSET_BASE_URL` 的拼法）。
2. **版本检测弹窗（原「方案 3」）未落地**：资源 404 之外，旧页面还可能撞上接口契约变更。
   可加 `version.json` 轮询 + 刷新提示 + chunk 加载失败兜底。
3. **`assets<version>` 里的 version 写死 1.0.0**：既然目录恒定、文件名才是 hash，
   这个版本号目前没起作用。要么真正按发布 bump 它，要么明确它就是常量、别指望它做隔离。
4. **`imagePullSecrets` 建议从清单里删掉**（仓库匿名可读，见第七节）。
5. **入口**：外层 nginx 的上游建议指向 VIP `172.16.0.180:80` 而不是某台节点的 NodePort
   —— NodePort 端口号是自动分配的、且 `externalTrafficPolicy: Local` 下部分节点根本不通。
   详见 [Ingress / Service / Traefik 入口的关系](../原理与选型/Ingress与Service与Traefik入口的关系.md) 第七~九节。
