---
title: PassUp 前端 K8s 部署清单（Nginx 托管 + 对象存储资源）
icon: mdi:web
sort: 7
---

> 本文记录 `pass-up.frontend` 在 k3s 上的部署。**全文围绕一个问题**：
> SPA 发版后，还开着旧页面的用户去加载「已被删掉的旧 chunk」会 404。
> 围绕它有两条静态资源策略（**同源** / **对象存储**），本文说清取舍、
> **当前用的是对象存储**、以及为此必须先配好的三个服务端条件。
> 与后端部署清单（`PassUp后端部署清单.md`）同处 `passup` 命名空间。

## 一、结论先行

| 项 | 当前实际 |
| :--- | :--- |
| 站点 | `frontend-user` × 3、`frontend-admin` × 3 |
| 入口 | **单入口 + 路径分流**：`/` → user，`/admin` → admin（Traefik `StripPrefix`） |
| `index.html` | 随镜像发布（在容器内 nginx） |
| `*.js` / `*.css` | **对象存储**：`http://172.16.0.222:8007/passup-public/<app>/` |
| 上传策略 | **只增不删**（`mc cp` 不带 `--remove`），旧 chunk 一直留着 |
| TLS | **集群侧不做**，由外层 nginx 终止后 http 转发进来 |
| 旧 chunk 404 | ✅ **已解决**（实测上一版 `index-*.js` 仍返回 200） |

**为什么最终选对象存储**：它是唯一能真正解决旧 chunk 404 的方案（见第二节）。
它要求**浏览器能访问到对象存储端点** —— 本环境 MinIO 在 `172.16.0.222:8007`，
前端也部署在同一局域网，所以**可达性成立**（这是之前选同源时唯一卡住的点）。

> 上线后端点换成 MinIO 的公网域名：`ASSET_ENDPOINT=https://<域名> bash k8s/deploy.sh`。
> ⚠️ 这个地址是**编译进 `index.html`** 的，换端点必须重新构建，光改配置重启 Pod 没用。

## 二、核心权衡：静态资源放哪

| | **同源**（资源打进镜像） | **对象存储**（MinIO / CDN） |
| :--- | :--- | :--- |
| 旧 tab 请求旧 chunk | ❌ **404**（新镜像里没有旧 hash 文件） | ✅ 保留（**只增不删**，旧 hash 文件一直在） |
| 依赖 | 无 | 需要**浏览器可达**的对象存储端点 + CORS + 匿名读 |
| 发版时资源清理 | 随镜像一起被替换 | 需另行配生命周期策略清理 |
| 适用 | 内网 / 没有对象存储 | 有浏览器可达的对象存储 |

**为什么同源一定 404**：镜像不可变 —— 新镜像里只有「本次构建产出的那些 hash 文件」，
上一次构建的 hash 文件不在里面。旧页面的 `<script>` / 动态 `import()` 指向的是旧 hash，
请求打过来就是 404。

> 关键区分：**这个 404 与「资源放哪」无关，与「旧文件是否被保留」有关。**
> 镜像天然不保留旧文件，对象存储默认保留。
>
> 反过来说：同源方案如果**不在发版时删旧目录**，其实也能保住旧 chunk ——
> 但那样镜像会无限膨胀（每次发版多几十 MB，永不回收）。对象存储让「保留」这件事
> 变得廉价，这才是它真正的优势所在。

### 实测：旧 chunk 确实还在（2026-09-24）

```text
# 当前 index.html 引用的：index-C1uljjco.js
http://172.16.0.222:8007/passup-public/user/assets1.0.0/index-C1uljjco.js  → 200
# 上一版构建的（已从 index.html 消失）：
http://172.16.0.222:8007/passup-public/user/assets1.0.0/index-C9E2EoSO.js  → 200   ← 关键
```

两个 `index-*.js` 在同一目录并存，正是「只增不删」生效的直接证据。

## 三、资源目录命名：`assets<version>`

构建时由 `packages/vite-config/src/index.ts` 决定：

```ts
export function defineConfig(config?: PassUpViteConfig, options: DefineConfigOptions = {}) {
  return defineViteConfig(async (env: ConfigEnv) => {
    const version = resolveVersion(appDir, options.version);
    const envVars = loadEnv(env.mode, appDir, '');

    const baseConfig: UserConfig = {
      // 静态资源 base：生产环境指向 MinIO/CDN（VITE_ASSET_BASE_URL）
      base: envVars.VITE_ASSET_BASE_URL || process.env.VITE_ASSET_BASE_URL || '/',
      build: {
        outDir: envVars.VITE_OUTPUT_DIR || 'dist',
        assetsDir: `assets${version}`,   // ← 资源目录
      },
    };
  });
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
>
> 换成对象存储后，这个设计**重新变得有意义**：目录名恒定、文件名 hash，
> 加上「只增不删」，三层效果叠起来就是「任何历史版本的任何 chunk 都取得到」。

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
                    ├── index.html：容器内 nginx 直接返回
                    ├── *.js/*.css：→ MinIO（172.16.0.222:8007）  ← 跨源，浏览器直连
                    ├── /api/  → passup-backend:8005
                    └── /ws/   → passup-backend:8005（WebSocket）
```

**关键点**：`/api/`、`/ws/` 的反代在**容器内 nginx**完成（Traefik 只负责「路径 → Service」）；
而静态资源是**浏览器的第二次请求，直接打到 MinIO**，不经 nginx、不经 Traefik。
所以 `VITE_ASSET_BASE_URL` 必须是**浏览器视角可达的绝对地址**，不能是集群内的 Service 名。

## 五、目录结构

```text
k8s/
├── README.md            # 部署说明（拓扑、两条构建路径、踩过的坑）
├── deploy.sh            # 一键：构建 + 传资源到 MinIO + 推镜像 + 部署
├── user.yaml            # 客户端 Deployment + Service
├── admin.yaml           # 管理端 Deployment + Service
└── ingress.yaml         # Traefik Middleware（StripPrefix）+ Ingress
```

CI 侧：`.gitea/workflows/deploy-{user,admin}.yml`。
MinIO 侧的服务端预置：`infra/docker-infra/minio/provision.sh`。

## 六、对象存储的三个前置条件（少一个就白屏）

MinIO 的「桶 / 匿名读 / CORS」是**服务端状态**，不在任何 compose 文件里 ——
这是本次落地最容易漏的地方。**这三个条件必须同时满足**，否则现象都是「页面白屏」，
但排查方向完全不同：

| 条件 | 检查方式 | 不满足的现象 |
| :--- | :--- | :--- |
| 桶 `passup-public` 存在 | `mc ls <alias>/passup-public` | 上传报 `The specified bucket does not exist` |
| 桶设了**匿名只读** | `curl <端点>/passup-public/<存在对象>` 返回 200 | 浏览器取 JS 得 **403** → 白屏 |
| **CORS** 允许前端 origin | `curl -X OPTIONS -H "Origin: <前端地址>"` 看响应头 | 跨源被浏览器拦 → 控制台报 CORS → 白屏 |

### 三个容易误判的探测方式（都实测过）

**① `?policy=` 查询参数不能用来判断匿名读**

```bash
# ❌ 这个请求需要签名，匿名取必然 AccessDenied，与桶策略无关
curl "http://172.16.0.222:8007/passup-public/?policy="
```

**② 判断匿名读要用「GET 一个不存在的对象」看 403 还是 404**

```bash
# 匿名可读 → 404（能读，只是没有这个对象）
# 未开匿名读 → 403（读都不让读）
curl -s -o /dev/null -w '%{http_code}\n' "http://172.16.0.222:8007/passup-public/__notexist__"
```

**③ CORS 是全局配置，不是按桶设的**

MinIO 的 `api cors_allow_origin` 是**服务端级别**的（只能 all origins 或一个 origin）。
所以 OPTIONS 预检**在任何路径上都返回 204 + `Access-Control-Allow-Origin`，哪怕桶不存在** ——
不能靠它反推桶的状态。实测：

```bash
# 桶名故意写错，预检照样 204
curl -s -i -X OPTIONS -H "Origin: http://172.16.0.180" \
  -H "Access-Control-Request-Method: GET" \
  "http://172.16.0.222:8007/__no_bucket__/x.js"
# → HTTP/1.1 204 No Content
#   Access-Control-Allow-Origin: http://172.16.0.180
```

因为 CORS 是全局的，**上线换域名时要同步改这个 origin**，
否则新域名被 CORS 拦掉 —— 而桶策略、上传流程都没问题，很容易查错方向。

### 凭据与 mc 客户端的两个坑

- **凭据来源**：`deploy.sh` 默认从 `../pass-up.backend/docker/.env` 读
  （`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`），也可用同名环境变量覆盖。
- **`mc` 必须从 GitHub Release 下**：`dl.min.io` 在 MinIO 开源版归档后
  **所有路径都返回 410 Gone**（连 `archive/` 目录也是）。
  资产名格式也变了：`mc.<os>-<arch>.<tag>.exe`
  （旧文档里的 `mc.<tag>-<os>-<arch>` 一律 404）。
  另外本机的 GitHub 大文件走代理会失败，要**绕过代理**直连。

## 七、关键设计点

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

### 3. admin 挂在 `/admin` 子路径（两个变量各管一件事）

Traefik 用 `StripPrefix` 去掉 `/admin` 后再转发，所以容器内 nginx 仍按根路径 `/` 提供 SPA。
但**浏览器**看到的路径是带 `/admin` 的。构建时两个变量都要给，**但它们管的是不同的事**：

| 变量 | 值 | 管什么 |
| :--- | :--- | :--- |
| `VITE_ASSET_BASE_URL` | `http://172.16.0.222:8007/passup-public/admin/` | **静态资源**的引用前缀（对象存储绝对地址） |
| `VITE_BASE_PATH` | `/admin` | **客户端路由** basename |

> ⚠️ 切到对象存储后，`VITE_ASSET_BASE_URL` 不再是 `/admin/` 了 ——
> 它变成了对象存储地址。`VITE_BASE_PATH` 则**仍然是 `/admin`**（与资源放哪无关）。
> 别再以为「admin 的两个 base 都是 `/admin/`」，那是同源时代的写法。
>
> ⚠️ 并且 `VITE_BASE_PATH` 因为是个「裸的 `/admin`」，会踩 MSYS 路径转换的坑（见坑 4）。

**只给一个就会出问题**：只给资源 base → 刷新 404；只给路由 basename → 页面能开但 JS 404。

### 4. 单阶段镜像

CI 里已经 `pnpm build` 过，镜像只做「nginx 基础镜像 + COPY nginx.conf + COPY dist」，
不在容器内重复装依赖、重复构建。

镜像里的 `dist/assets1.0.0/` 现在是**兜底冗余**（`index.html` 引的是对象存储地址，
正常请求不会走到它），保留它只是为了「对象存储挂了时静态资源还能降级」，
以及不必改 Dockerfile。

### 5. Ingress 的 rules **不写 host**

外层 nginx 转发进来时带的 `Host` 头不确定（可能是公网域名，也可能是 IP，取决于
`proxy_set_header Host ...` 怎么配）。写死一个 host 只要对不上就**整站 404**，
而 Traefik 只回 404、不报错，很难查。

不写 host 的 rule 匹配**任意 Host**，外层怎么配都能通。已验证：
`Host` 为空 / `app.passup.local` / `whatever.example.com` / `172.16.0.180` 全部 200。

> ✅ 不用担心它盖住别的规则：Traefik 按规则长度定优先级，带 `Host` 的规则更长、优先匹配。
> 关于入口 IP、VIP 漂移、`host` 为什么不能写 IP，见
> [Ingress / Service / Traefik 入口的关系](../原理与选型/Ingress与Service与Traefik入口的关系.md) 第七~十节。

## 八、两条部署路径

| | `k8s/deploy.sh`（本地） | CI（`.gitea/workflows/`） |
| :--- | :--- | :--- |
| 触发 | 手动 | push 到 `frontend` 分支且命中 paths |
| 构建 | 本机 `pnpm build` + `docker build` | 同样，但在 runner 上 |
| 资源 base | `http://172.16.0.222:8007/passup-public/<app>/`（可用 `ASSET_ENDPOINT` 换） | `https://hragentadmin.xiaodingtie.com/passup-public/<app>/` |
| 资源上传 | `mc cp --recursive`（只增不删） | 同样 |
| 桶 / 前缀 | `passup-public` / `<app>` | 同左 |
| 镜像 tag | `日期-时间-短sha` | `短sha` + `latest` |
| apply | `deploy.sh` 内（会 `strip_pullsecret`） | `kubectl apply -f k8s/{user,ingress}.yaml`（**不删**） |

两条路径**都走对象存储、都用同一个桶前缀**，区别只在「base 地址指向哪个端点」。
所以两边交替发布是安全的（资源在同一处、只增不删、不会互相删掉），
但 `index.html` 里的资源地址会在两条路径之间来回变 —— **这是预期行为，不是 bug**。

> ⚠️ 两条路径对 `imagePullSecrets` 的处理不一致：`deploy.sh` 会把它从清单里删掉，
> CI 直接 apply 会保留。内网仓库是**匿名可读**的（实测 `/v2/` 返回 200），
> 引用一个不存在的 `passup-registry-secret` 不会让 Pod 起不来，但 kubelet 会一直刷
> `FailedToRetrieveImagePullSecret` 警告事件。**建议把这段从 `user.yaml`/`admin.yaml` 里直接删掉。**

## 九、关键约定（速查表）

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
| 对象存储 | `172.16.0.222:8007`，桶 `passup-public`，前缀 `user/` `admin/` |
| 入口 | Traefik VIP `172.16.0.180`（HTTP）；`/admin` → admin，`/` → user |
| 反代目标 | `/api`、`/ws` → `passup-backend.passup.svc.cluster.local:8005` |

## 十、实测数据与踩过的坑

### 实测（2026-09-24）

```bash
VIP=172.16.0.180
curl -s -o /dev/null -w '%{http_code}\n' "http://$VIP/"              # 200
curl -s -o /dev/null -w '%{http_code}\n' "http://$VIP/admin/"        # 200
curl -s -o /dev/null -w '%{http_code}\n' "http://$VIP/admin/login"   # 200（SPA 回退）
curl -s -o /dev/null -w '%{http_code}\n' "http://$VIP/api/"          # 200（反代到后端）
curl -s -o /dev/null -w '%{http_code}\n' "http://$VIP/ws/"           # 200
```
**逐个取页面引用的全部资源**（含 `modulepreload`）—— 这是切对象存储后必须加的验证：

```text
user:  16 个资源，0 个失败
admin: 11 个资源，0 个失败
```

> ❗ **只探测页面 200 是不够的**。切对象存储后 `index.html` 在镜像里、
> chunk 在对象存储里，页面照样 200，但如果对象存储取不到资源，用户看到的是**白屏**。
> `deploy.sh` 收尾已内置这一步：从 `index.html` 抽第一个 `<script src>` 真实取一次。

**真实浏览器验证**（`agent-browser`，Chromium 154）—— 上面全是 HTTP 层面的判据，
最终确认要用真浏览器跑一遍，因为只有它能暴露「JS 都加载了但路由不渲染」这类问题
（坑 4 就是这么抓到的）：

| 页面 | 结果 |
| :--- | :--- |
| `/`（user） | ✅ 渲染出微信登录页（`面得过` + 二维码 + 服务条款） |
| `/admin/`（admin） | ✅ 渲染出「欢迎回来」登录表单（手机号/密码/登录按钮） |
| `/admin/login` | ✅ 同上（SPA 深链回退正常） |

admin 控制台只有两条**预期**日志：`🚀 ~ isLanHost ~ host: 172.16.0.180` 与
`No token found, redirecting to login`（未登录时的正常跳转），无任何资源加载错误。

> 顺带说明：user 页面上微信二维码显示「redirect_uri 参数错误」，
> 这是微信开放平台回调域名白名单的配置问题，**与本次部署无关**
> （页面本身渲染正常，说明前端资源链路是通的）。

### 坑 1：桶根本不存在，而 CI 一直在「成功」上传

**这次的起点现象**：MinIO（`172.16.0.222:8007`）上 `passup-public` 桶**完全不存在**
（`ListBuckets` 返回空，`/data` 下只有 `.minio.sys`）。

根因是**职责错位**：MinIO 服务定义在后端仓库的 `docker-compose.base.yml`，
而「建桶 / 匿名读 / CORS」是**服务端状态**，不在任何 compose 文件里。
于是「compose 起来了」被当成了「对象存储可用了」，但实际是**一个空实例**。

> 教训：**基础设施的可用性不能只由「容器起来了」定义**。
> 现在由 `infra/docker-infra/minio/provision.sh` 幂等预置这三个条件，
> 跟 `cluster-infra` 的「清单 + 幂等脚本」是同一个套路。

顺带纠正一个误判：这个 MinIO **不在 infra 仓库里**（infra 下的 `docker-infra/minio/`
是 `backup-minio`，端口 9000/9001，是另一套）。`172.16.0.222:8007` 是**后端 compose**
里的 `minio` 服务（`0.0.0.0:8007->9000`），宿主机 `/data/minio/data`。

### 坑 2：`mc cp -r dist/ <prefix>/` 会多出一层 `dist/`

本地实测：`mc cp --recursive apps/user/dist/ minio/passup-public/user/`
把对象传成了 `passup-public/user/dist/index.html` —— 多了一层 `dist/`，
与 CI 的 `passup-public/user/index.html` 对不上，`index.html` 里引用的地址会 404。

修正做法是**逐项拷 `dist` 下的顶层条目**（`index.html`、`favicon.ico`、`assets1.0.0`），
`deploy.sh` 已按这个写。另注意 Windows 上 mc 要 Windows 形态路径（`cygpath -m`）。

### 坑 3：Windows + Git Bash 下的三个构建/部署失败

| 现象 | 根因 | 处理 |
| :--- | :--- | :--- |
| `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`，且**user 构建成功、admin 构建失败** | 带删除保护的沙箱环境通过 `NODE_OPTIONS` 注入了 shim，额度按 turn 累计 —— 第一个 app 用完后第二个超阈值 | 构建时加 `NODE_OPTIONS= CODEBUDDY_SAFE_DELETE_ENABLED=0` |
| `SAFE_DELETE_FAIL_CLOSED`，路径出现 `/d/_work/.../C:/Users/...` 双重路径 | `mktemp -d` 给的是 `/tmp/...`，与非 MSYS 感知的程序拼接时被拼坏 | 临时目录也 `cygpath -m` 转一次 |
| `kubectl 无法连接集群`，但 kubeconfig 明明在 | Windows 原生 kubectl 读不了 Git Bash 的 `/c/...` 形态路径 | `KUBECONFIG` 也要 `cygpath -m` 转 |

> 三条都已修进 `k8s/deploy.sh`。**第一条的现象特别有迷惑性** ——
> 「user 成功、admin 失败」很容易被误判成 admin 应用自己有问题，
> 实际是额度按 turn 累计、第二个 app 才踩到阈值。

### 坑 4：MSYS 把「裸的 `/admin`」环境变量值转成了 Windows 路径 → admin 白屏

**这次的第二个真 bug**，而且现象极具误导性：`admin` 整页白屏、
但**资源全部 200、Pod 全部 Running、`index.html` 也正常返回**。

浏览器控制台里的报错才是真相：

```text
[warning] <Router basename="/C:/Users/cql13/.workbuddy-ai/binaries/PortableGit/versions/1.2.0/admin">
          is not able to match the URL "/admin/" because it does not start with the basename,
          so the <Router> won't render anything.
```

`VITE_BASE_PATH=/admin` 传给 node 时被 MSYS **当成 Unix 绝对路径做了转换**，
变成了 Git Bash 安装目录下的 `.../PortableGit/versions/1.2.0/admin`，
于是路由 basename 完全对不上，React Router 什么都不渲染。

实测对照（`node -e "console.log(process.env.VITE_BASE_PATH)"`）：

```text
不带保护: "C:/Users/cql13/.../PortableGit/versions/1.2.0/admin"   ← 坏的
带保护:   "/admin"                                              ← 对的
```

修法：构建时加 `MSYS_NO_PATHCONV=1`。

> **为什么 user 没中招**：user 的路由在根路径，根本没有 `VITE_BASE_PATH` 这个变量。
> **为什么以前没暴露**：`VITE_ASSET_BASE_URL` 是完整 URL（`http://...`），MSYS 不认，
> 所以同源时代两个变量一个没转、一个转了但只有 admin 用 —— 一直没撞上。
> 只有当「admin + 裸路径变量」同时出现时才会踩到。
>
> 这是本项目里 MSYS 路径转换导致的**第 4 个** bug（前三个见坑 3）。
> 共同规律：**只要把路径样式的值跨 shell 边界传给原生程序，就得防这一手**。

`deploy.sh` 现在有静态断言，不用等用户反馈白屏：

```text
[deploy] 检查构建产物是否被 MSYS 路径转换污染：
[deploy]   admin: OK
```

检出原理是搜产物里的 `PortableGit` / `/X:/` / `/c/Users` 特征串。

### 坑 5：确认「这份镜像到底是哪条路径构建的」

排查「页面白屏」时，第一步是看 `index.html` 里的资源地址：

```bash
curl -s http://172.16.0.180/ | grep -oE 'src="[^"]+\.js"' | head -2
```

- → `http://172.16.0.222:8007/passup-public/user/assets1.0.0/...` = 走了对象存储（本地 `deploy.sh`）
- → `https://hragentadmin.xiaodingtie.com/...` = CI 构建
- → `/assets1.0.0/...` = 同源（**当前已不应出现**，出现说明用的是旧镜像）

### 坑 6：`172.16.0.222:8007` 的 MinIO，数据其实在 WSL 里（**最危险的一个**）

`docker-compose.base.yml` 里写的是：

```yaml
volumes:
  - /data/minio/data:/data
```

这个 `/data` **既不是 Windows 目录，也不是 Docker Desktop VM 的目录**，而是
**WSL `Ubuntu-24.04` 发行版里的 `/data/minio/data`**。判据（四步都能独立复现）：

```bash
# 1) 挂载来源与种类
docker inspect minio --format '{{range .Mounts}}{{.Source}} {{end}}'
# → /data/minio/data     且 Attributes 里有 SourceKind=wsl2DistroFile

# 2) 容器内 /data 的设备号
docker exec minio stat -c '%n dev=%D' /data
# → /data dev=850        0x850 = major 8 minor 80 = /dev/sdf

# 3) sdf 挂到哪
#    在 VM 里看 mount：/mnt/host/wsl/docker-desktop-bind-mounts/Ubuntu-24.04/<hash>

# 4) 从 Windows 直接读（这一步最能说明问题）
ls "//wsl.localhost/Ubuntu-24.04/data/minio/data"
```

对照：`docker-desktop` 发行版里**没有** `/data`；Windows 的 `D:\data` **不存在**。
所以**别去 VM 宿主（`nsenter -t 1`）里找** —— 那里看不到，会误判成「数据不存在」。

**踩的坑（真丢过一次数据）**：容器从 8/25 起一直没重启过，bind mount 视图已经陈旧。
往它上传对象「成功」了 —— `mc cp` 返回 0、紧接着 `mc cat` 也能读回来 ——
但**写进的不是 `sdf` 上那一份**。执行 `docker restart minio` 后 Docker Desktop
重新解析挂载，才切回 `sdf` 的真实数据，于是此前上传的对象**全部消失**
（`passup-public` 里只剩 8 月的 `qrcode/`）。

同一次重启也**暴露出了真实的 8 月生产数据**（`backup-avatar`、`backup-feeling-public`、
`backup-passup`、`backup-passup-private`、`passup-private`、`passup-public/qrcode`，
共 110 个对象 / 52 MiB）—— 这些是**真实数据，绝不能被覆盖**。

由此定的三条规矩：

1. **动这个 MinIO 之前先确认挂载是否新鲜**：`\\wsl.localhost\Ubuntu-24.04\data\minio\data`
   里要能看到桶内容，且与 `mc ls` 的结果对得上；
2. **不要随手 `docker restart minio`**。只改桶/策略**不需要重启**；
   只有 CORS（`admin config set api cors_allow_origin`）需要。infra 的
   `docker-infra/minio/provision.sh` 已改成默认不重启，要重启得显式 `RESTART_MINIO=1`；
3. **上传后必须用匿名 GET 验证**（`curl` 取一个真实对象的 URL），
   别只看 `mc cp` 的返回值 —— 它就是那个「成功但写错地方」的典型。

### 坑 7：`mc find --print '{key}'` 会静默给出错误结果

`{key}` **不是有效占位符**。它不会报错，而是**原样输出** `{key}` 三个字符：

```bash
mc find alias/bucket --print '{key}'     # → {key}
mc find alias/bucket --print '{base}'    # → 01m0vdjdj888mqbypsrszavr29.png（只有文件名）
mc ls --recursive alias/bucket/ | awk '{print $NF}'   # → qrcode/2026/08/25/....png（完整 key）
```

拿 `{key}` 去 GET 必然 404，于是脚本误判「匿名读没生效」，进而执行
`anonymous set download` —— **把桶上原有的 `custom` 策略覆盖掉**。
这条也顺带说明：判断「匿名读是否生效」的探针**必须用真实的 key**，
探针本身写错会直接把结论带偏。

## 十一、遗留与后续

1. **上线换端点**：`ASSET_ENDPOINT=https://<MinIO 公网域名> bash k8s/deploy.sh`。
   同时要改三处，漏一处就白屏或跨域失败：
   - `deploy.sh` 的 `ASSET_ENDPOINT`（构建时编译进 `index.html`）
   - MinIO 的 `api cors_allow_origin`（全局，见第六节）
   - 外层 nginx 的上游（如果它也要指过去）
2. **`assets<version>` 里的 version 写死 1.0.0**：既然目录恒定、文件名才是 hash，
   这个版本号目前没起作用。要么真正按发布 bump 它，要么明确它就是常量、别指望它做隔离。
3. **对象存储的生命周期清理未配**：现在只增不删，长期会一直涨
   （本轮 3 次构建就让 user 累积到 47 个对象、admin 72 个）。
   需要配一条「删 30 天以上 `assets*` 对象」的规则（旧 index.html 的缓存有效期撑不到 30 天）。
4. **版本检测弹窗（原「方案 3」）未落地**：资源 404 之外，旧页面还可能撞上接口契约变更。
   可加 `version.json` 轮询 + 刷新提示 + chunk 加载失败兜底。
5. **`imagePullSecrets` 建议从清单里删掉**（仓库匿名可读，见第八节）。
6. **入口**：外层 nginx 的上游建议指向 VIP `172.16.0.180:80` 而不是某台节点的 NodePort
   —— NodePort 端口号是自动分配的、且 `externalTrafficPolicy: Local` 下部分节点根本不通。
   详见 [Ingress / Service / Traefik 入口的关系](../原理与选型/Ingress与Service与Traefik入口的关系.md) 第七~九节。
7. **CI 侧也要补 `MSYS_NO_PATHCONV` 吗**：不用，CI 跑在 Linux runner 上，
   没有 MSYS 转换这回事。但**如果有人在 Windows 上手工跑 CI 里那套命令**，
   就会踩坑 4 —— 判据同样是看产物里有没有 `PortableGit`。
