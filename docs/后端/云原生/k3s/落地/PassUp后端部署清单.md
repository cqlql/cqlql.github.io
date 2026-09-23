---
title: PassUp 后端 K8s 部署清单（Kustomize）
icon: mdi:kubernetes
sort: 6
---

> 本文记录 `pass-up.backend` 项目 `k8s/` 目录的部署清单：一个基于 **Kustomize** 组织的、面向 **k3s** 的 Spring Boot 后端部署。
>
> ⚠️ **本文已于 2026-09-23 按实际部署结果重写。** 此前版本描述的部分资源（`postgres.yaml` / `redis.yaml` / `minio.yaml`）
> **在仓库里并不存在**，目录名、profile、端口、探针参数也有多处与代码不一致。
> 本次是**先按清单真部署、再按部署结果回填文档**，所有数字都是实测值。勘误清单见文末[第九节](#九与旧版本的差异勘误)。

## 一、当前真实形态（先看这个）

```text
┌─ k3s 集群（3 节点）─────────────────────────────────────┐
│                                                          │
│   passup 命名空间                                         │
│     passup-backend  × 3 副本（Deployment）                │
│       2 个在 k2、1 个在 k1                                │
│       （k3 带 k3s-monitoring 污点，留给监控栈，不承载业务）│
│                                                          │
└──────────────────────────────────────────────────────────┘
              │  出集群访问
              ▼
┌─ 宿主机 Docker（172.16.0.222）──────────────────────────┐
│   postgres:18   → 5432   库 pass_up_dev                  │
│   redis:7       → 6379   appendonly，无密码               │
│   minio         → 8007   API（8008 是 Console）           │
│   ai            → 8006   简历解析服务                     │
│   registry:3.1  → 5000   私有镜像仓库（匿名可读）          │
└──────────────────────────────────────────────────────────┘
```

**关键事实：数据库 / Redis / MinIO 目前仍跑在宿主机的 Docker 上，没有上集群。**

这是一次**分步迁移**：先把无状态的后端应用搬进集群（拿到多副本调度、指标采集、日志采集、滚动发布），
有状态依赖留到后面再迁。所以清单里**没有** `postgres.yaml` / `redis.yaml` / `minio.yaml` ——
它们从来就不在仓库里，之前的文档把它们写成了已存在的东西。

> 集群里的 Pod 能直接访问宿主机（已实测 5432 / 6379 / 8007 / 8006 / 5000 全通）。
> 这是**过渡态**，等依赖也上集群后应该切到 `overlays/prod`（走 `*.passup.svc.cluster.local`）。

## 二、目录结构（实际文件）

```text
k8s/
├── gen-secret.sh                    # 从 docker/.env + docker/secrets/ 生成 secret.yaml
├── base/                            # 基础清单（所有环境共用）
│   ├── namespace.yaml               # passup 命名空间
│   ├── configmap.yaml               # 非敏感配置（Spring 环境变量）
│   ├── secret.example.yaml          # 敏感配置模板（勿提交真实值）
│   ├── secret.yaml                  # ← gen-secret.sh 生成，已被 .gitignore 排除
│   ├── deployment.yaml              # 后端应用 Deployment
│   ├── service.yaml                 # 后端 ClusterIP Service
│   ├── ingress.yaml                 # Traefik Ingress + 中间件（**占位域名，未启用**）
│   └── kustomization.yaml           # Kustomize 入口
└── overlays/
    ├── local/                       # 本地/测试覆盖（kustomization.yaml 被 gitignore）
    │   └── kustomization.example.yaml
    ├── prod/                        # 生产覆盖：镜像仓库地址 + 3 副本
    │   └── kustomization.yaml
    └── k3s/                         # 本集群覆盖：依赖外置 + 探针/内存调整（新增）
        └── kustomization.yaml
```

> 注意：`overlays/` 下**没有 `dev/`**（旧文档写的 `dev/` 不存在）。
> 面向开发环境的是 `local/`，且它的 `kustomization.yaml` 被 `.gitignore` 排除（环境地址随环境变动）。

## 三、关键约定（速查表）

| 项目 | 值 |
| :--- | :--- |
| 命名空间 | `passup` |
| 业务端口 | `8005`（HTTP + WebSocket） |
| 管理端口 | `8009`（Actuator：health / prometheus / loggers） |
| 数据库 | `172.16.0.222:5432/pass_up_dev`（宿主机 Docker，PostgreSQL 18.4） |
| Redis | `172.16.0.222:6379`，无密码 |
| MinIO | `172.16.0.222:8007`（API） |
| 存储类 | `local-path`（本清单**未使用** —— 无状态应用，依赖全外置） |
| 运行用户 | 非 root，uid/gid `1001` |
| 副本数 | base 2 副本；`prod` / `k3s` overlay 均为 3 副本 |
| 运行时 | Java 25.0.4（`JAVA_OPTS` 用 `MaxRAMPercentage=70.0` + G1GC） |
| 冷启动 | **145 ~ 256 秒**（实测，随节点负载浮动很大，见第八节） |

## 四、base 各资源解读

### 1. namespace.yaml

创建 `passup` 命名空间。`kustomization.yaml` 顶层声明 `namespace: passup`，为所有资源注入命名空间。

### 2. configmap.yaml（非敏感配置）

通过 `envFrom.configMapRef` 注入：

| 键 | base 里的值 | 说明 |
| :--- | :--- | :--- |
| `SPRING_PROFILES_ACTIVE` | `dev,local` | ⚠️ **base 是占位值**，各环境必须覆盖（见下） |
| `SERVER_PORT` | `8005` | |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://CHANGE_ME:5432/pass_up` | 占位 |
| `SPRING_DATA_REDIS_HOST/PORT/DATABASE` | `CHANGE_ME` / 6379 / 0 | 占位 |
| `MINIO_ENDPOINT` | `http://CHANGE_ME:9000` | 占位 |
| `MINIO_BUCKETS_PUBLIC/PRIVATE/TEMP` | `passup-public` 等三个 | |
| `MINIO_PUBLIC_ENDPOINT` | `https://hragentadmin.xiaodingtie.com` | 预签名 URL 用的公网地址 |
| `MINIO_AUTO_CREATE_BUCKET` | `true` | 启动时自动建 bucket |
| `MINIO_PRESIGNED_URL_EXPIRY_SECONDS` | `900` | |
| `RESUME_AI_BASE_URL` | `http://resume-ai.passup.svc.cluster.local:8006` | 指向未上集群的 Python 服务，各环境要覆盖 |
| `JAVA_OPTS` | `UseContainerSupport` + `MaxRAMPercentage=70.0` + G1GC + `ExitOnOutOfMemoryError` | 容器内存自适应 |

> ⚠️ **`SPRING_PROFILES_ACTIVE` 不是随便填的**：集群里的日志采集链路靠 `prod` profile 的
> ECS 结构化输出（见第七节）。base 的 `dev,local` 会让日志变成纯文本，
> `| level = "ERROR"` 恒为空 —— 不报错，只是永远查不到。

### 3. secret.example.yaml（敏感配置模板）

类型 `Opaque`。模板用 `stringData` 填明文（K8s 自动转码）；
`gen-secret.sh` 生成的那份用 `data`（kubectl 已经 base64 过）。两种都合法。

涵盖：数据库账号密码、Redis 密码、JWT/刷新密钥、管理员默认密码、豆包 ASR/LLM 密钥、
微信小程序 / 开放平台 / 支付密钥、MinIO 访问密钥，以及两个 PEM 文件
（`wechat-pay-private-key.pem` / `wechat-pay-public-key.pem`）。

> ⚠️ 不要手工 `cp` 再逐条 base64 —— 20+ 个键，错一个字符就变成「密码不对」，
> 而现象是连不上库或鉴权失败，很难反查到 Secret 上。用 `k8s/gen-secret.sh`（见第六节）。
>
> ⚠️ 模板里的键必须与 `gen-secret.sh` 的 `SENSITIVE_KEYS` 白名单、以及代码里的
> `@ConfigurationProperties` 保持一致。本次重写就发现了两处不一致：
> 模板里有 3 个代码根本不读的 `DOUBAO_REALTIME_API_*`，却漏了微信开放平台的
> `WECHAT_OPEN_PLATFORM_APP_ID/APP_SECRET`。

### 4. deployment.yaml（后端应用）

| 项 | 值 |
| :--- | :--- |
| 副本数 | 2（`prod` / `k3s` overlay 覆盖为 3） |
| 滚动更新 | `maxUnavailable: 0` + `maxSurge: 1`（更新期间始终有可用副本） |
| 安全上下文 | `runAsNonRoot: true`，uid/gid 1001；容器侧 `allowPrivilegeEscalation: false` + `capabilities.drop: ["ALL"]` |
| 终止宽限 | `terminationGracePeriodSeconds: 30`（等 WebSocket / 音频会话收尾） |
| 端口 | `http` 8005、`management` 8009 |
| 配置注入 | `envFrom` 同时引用 ConfigMap 与 Secret（**同名键以 Secret 为准**，因为它排在后面） |
| 密钥文件 | Secret 卷挂到 `/app/secrets/`，用 `WECHAT_PAY_PRIVATE_KEY_PATH` 等 env 指向 |
| 探针 | 三个都走 `management` 端口：`startupProbe` → `/actuator/health`；`readinessProbe` → `/actuator/health/readiness`；`livenessProbe` → `/actuator/health/liveness` |
| 资源 | requests `250m` / `1Gi`，limits `2` / `8Gi` |

> ⚠️ `imagePullSecrets` 引用了 `passup-registry-secret`，但私有仓库 `172.16.0.222:5000`
> **匿名可读**（实测 `/v2/` 返回 200），这个 Secret 并不需要存在。
> 引用一个不存在的 Secret 不会让 Pod 起不来，但 kubelet 会一直刷
> `FailedToRetrieveImagePullSecret` 警告事件。`k3s` overlay 里已把它移除。

### 5. service.yaml

`ClusterIP`，暴露 `http`(8005) 与 `management`(8009)，selector 匹配 `app: passup-backend`。

> 本集群**未对外暴露**。临时访问用 `kubectl -n passup port-forward svc/passup-backend 8005:8005`。

### 6. ingress.yaml（占位，未启用）

`ingressClassName: traefik` + `router.entrypoints: web` + 中间件 `passup-backend-headers`
（`traefik.io/v1alpha1` 的 `Middleware`，设置 `X-Forwarded-Proto: https`）。
域名是占位符 `api.your-domain.com`，**没有真实域名与证书，所以 `k3s` overlay 里把 Ingress 与 Middleware 都删掉了**。

> ⚠️ 以后启用时**两个对象都要恢复** —— Ingress 的注解里引用了这个 Middleware，
> 只恢复 Ingress 会报 `middlewares "passup-backend-headers" does not exist`。

### 7. kustomization.yaml

- `namespace: passup` 统一注入；
- `resources` 列出所有资源文件；
- **`images` 段不在 base** —— 镜像仓库地址由各 overlay 覆盖（base 不写死环境相关地址）；
- 标签用 kustomize v5 的 `labels: - pairs:` + `includeTemplates: true`
  （旧文档写的 `commonLabels` 是已废弃语法）。

## 五、overlays

### local（本地/测试）

`kustomization.example.yaml` 是模板，演示用 `patches` 覆盖数据源地址：

```yaml
patches:
  - target: { kind: ConfigMap, name: passup-backend-config }
    patch: |-
      - op: replace
        path: /data/SPRING_DATASOURCE_URL
        value: jdbc:postgresql://192.168.1.221:5432/pass_up
```

使用前要 `cp kustomization.example.yaml kustomization.yaml`（后者被 `.gitignore` 排除）。

### prod（生产）

引入 `../../base`，覆盖镜像仓库地址，并把副本数提到 3：

```yaml
images:
  - name: passup/backend-java
    newName: 172.16.0.222:5000/passup/backend-java
    newTag: latest
replicas:
  - name: passup-backend
    count: 3
```

### k3s（本集群，**当前实际使用的就是这个**）

在 `prod` 的基础上再改四件事：

| 改动 | 为什么 |
| :--- | :--- |
| 数据源/Redis/MinIO/AI 地址 → `172.16.0.222` | 依赖还在宿主机 Docker，没上集群 |
| `SPRING_PROFILES_ACTIVE` → `prod` | 只有 prod profile 开 ECS 结构化日志；且 `local` profile 会把 management 端口改成 7009，与探针写的 8009 不符 |
| 移除 `imagePullSecrets` | 私有仓库匿名可读，引用不存在的 Secret 只会刷警告 |
| 加 `prometheus.io/scrape: "true"` | 集群内 Prometheus 的采集契约，见第七节 |
| `startupProbe.failureThreshold` 30 → 90 | 30 次（165s）**实测不够**，见第八节 |
| `limits.memory` 8Gi → 2Gi | 8Gi 在 3 台 7.7 GiB 的节点上会让 JVM 按 5.6Gi 规划堆，与真实内存脱节 |
| 删掉 Ingress 与 Middleware | 占位域名 + 只有 HTTP，直接 apply 会生成匹配不到请求的死对象 |

## 六、部署流程（已验证）

### 1. 生成 Secret

```bash
cd k8s
./gen-secret.sh              # 生成 base/secret.yaml
./gen-secret.sh --apply      # 生成并直接 apply
```

脚本从 `../docker/.env` 与 `../docker/secrets/` 取值，**只搬白名单里的敏感键**，
并让 kubectl 自己做 base64 与 YAML 转义（避免手工编码出错）。
PEM 文件的映射：`apiclient_key.pem` → `wechat-pay-private-key.pem`，
`pub_key.pem` → `wechat-pay-public-key.pem`。

### 2. 部署

```bash
kubectl --kubeconfig=~/.kube/k3s-ha.yaml apply -k overlays/k3s
```

> ⚠️ 旧文档写的 `kubectl apply -k k8s/base` **会失败** ——
> base 的 `resources` 里列了 `secret.yaml`，而它只在跑过 `gen-secret.sh` 之后才存在。
> 而且 base 里的地址全是 `CHANGE_ME`，本来就不该直接 apply。

### 3. 等待就绪

```bash
kubectl -n passup rollout status deploy/passup-backend --timeout=900s
```

⚠️ **超时要给足**：冷启动 145~256 秒/副本，`maxSurge: 1` 一次只换一个，3 副本滚动一轮约 15 分钟。

### 4. 验证

```bash
kubectl -n passup get pods -o wide                 # 期望 3/3 Running，2:1 分布在 k1/k2
kubectl -n passup port-forward svc/passup-backend 8005:8005
curl http://localhost:8005/actuator/health         # 走 management 端口也可以：8009
kubectl -n passup top pod                          # 看真实内存占用
```

## 七、与监控栈的契约（**两处，缺一个就静默失效**）

集群里有一套 Prometheus + Loki + Alloy（见 `cluster-infra/monitoring/`）。
后端要能被正确观测，依赖下面两条约定：

### 1. 指标采集：Pod 注解 + 端口名

Prometheus 的 `passup-backend` job 用 `kubernetes_sd_configs`（role: pod）发现副本，靠**两个条件**过滤：

| 条件 | 在哪 |
| :--- | :--- |
| Pod 注解 `prometheus.io/scrape: "true"` | 各 overlay 的 Deployment patch |
| 容器有名为 `management` 的端口 | base 的 deployment.yaml |

**缺注解 → 目标数恒为 0**，看起来像「后端没上集群」，其实只是没声明采集契约。

验收（实测通过）：

```sql
up{job="passup-backend"}
-- 期望 3 条序列，instance 分别是 3 个 Pod 名，值都是 1
```

> 这一条正是「把监控栈从宿主机迁进集群」的核心动机：迁移前采集目标是
> **宿主机固定端口**（业务机 IP:8009），3 副本时只能命中其中一个，且随滚动更新漂移；
> 迁移后每个副本各一条独立序列。

### 2. 日志采集：`prod` profile 的 ECS 结构化输出

Alloy 的 `stage.json` 按 ECS 字段解析日志，取出 `level` / `@timestamp` / `service.name`。
这些字段只在 **`prod` profile** 下输出（`application-prod.yml` 的 `logging.structured.format.console: ecs`）。

验收（实测通过）：

```sql
{namespace="passup", app="passup-backend"} | level = "ERROR"
```

> ⚠️ **只确认「能查到日志」不算验收完成。** 用 `dev,local` profile 时日志是纯文本，
> 上面这条查询照样不报错，只是**恒为空** —— 按级别过滤的看板与告警会静默失效。

## 八、本次落地实测数据与踩到的坑

### 实测数据（2026-09-23，k3s 3 节点）

| 项 | 实测值 |
| :--- | :--- |
| 副本分布 | 3/3 Running，2 个在 k2、1 个在 k1（k3 带监控污点） |
| 冷启动（容器启动 → readiness 首次 200） | **145s / 202s / 256s** —— 浮动极大 |
| 内存占用（空载） | 468 ~ 654 MiB / 副本 |
| CPU（空载） | 37 ~ 55 m |
| 镜像大小 | 314 MB（拉取耗时约 2 分钟/节点） |
| Flyway | 校验通过 26 个迁移 |
| 数据库 | PostgreSQL 18.4，连接正常 |
| 运行时 | Java 25.0.4 |

### 坑 1：`startupProbe.failureThreshold: 30` 不够，容器被反复杀

base 的注释写「失败阈值 30 次，**给足冷启动时间**」——实测**不够**：

```text
30 × 5s + 15s(initialDelay) = 165s
实测冷启动：145s / 202s / 256s
```

容器在 195s 被 startup probe 判死（`exitCode 137`）。现象很有迷惑性：
**Pod 反复重启、日志每次都从头开始，看起来像「应用起不来」，其实只是探针窗口比冷启动短。**

`k3s` overlay 里改成 `failureThreshold: 90`（465s）。
⚠️ 这是按本集群（VirtualBox 4 vCPU × 3 台、3 副本分摊）定的；
CPU 宽裕的环境应该调回去 —— 探针窗口越长，真故障时发现得越晚。

### 坑 2：`limits.memory: 8Gi` 与节点真实内存严重脱节

`JAVA_OPTS` 里有 `-XX:MaxRAMPercentage=70.0`，JVM 按 **limit** 算堆：
8Gi limit → 5.6Gi 堆。而节点只有 7.7 GiB，同一节点落 2 个副本就是 16Gi 的 limit
—— 等于该节点全部物理内存（监控方案 §5.5.3 算过这笔账）。

实测启动期 RSS 只有 211~267 MiB，空载 468~654 MiB，**2Gi（堆约 1.4Gi）足够**。
`k3s` overlay 里改成 2Gi。

> ⚠️ 2Gi 是**起点值不是结论**：必须在真实负载下（AI 面试 / WebSocket / 音频流 / 多并发 session）
> 复测 `kubectl top pod` 与容器 OOM 记录再定。JVM 的 `MaxRAMPercentage` 会把
> 「limit 填错」放大成「堆填错」，改 limit 前先想清楚。

### 坑 3：慢启动的成因是 CPU，不是内存

一开始怀疑是内存不足或外部调用卡死，实测排除：

- 内存只用了 211~267 MiB，**远低于 limit**；
- 日志里各阶段间隔均匀（20~35s 一段），**没有单个长阻塞**；
- CPU 稳定在 1.1~1.75 核。

结论是**均匀的 CPU 饥饿**（3 个 JVM 挤在 2 台 4 vCPU 的 VM 上启动）。
这种「整体慢」而不是「卡在某一处」的形态，是区分 CPU 瓶颈与网络阻塞的关键。

## 九、与旧版本的差异（勘误）

旧文档里描述但**实际不存在**或**与代码不符**的内容：

| # | 旧文档写的 | 实际 |
| :--- | :--- | :--- |
| 1 | `base/postgres.yaml`（StatefulSet + 20Gi）、`base/redis.yaml`（5Gi）、`base/minio.yaml`（20Gi） | **这三个文件不存在**。依赖跑在宿主机 Docker 上 |
| 2 | `overlays/dev/` | 不存在，实际是 `overlays/local/` |
| 3 | base `kustomization.yaml` 有 `images` 段把 tag 固定为 `latest` | base **没有** `images` 段，镜像由各 overlay 覆盖 |
| 4 | 用 `commonLabels` 打标签 | 实际是 kustomize v5 的 `labels: - pairs:` + `includeTemplates: true` |
| 5 | Redis 启动参数含 `--save 60 1000` | 实际只有 `--appendonly yes` |
| 6 | `SPRING_PROFILES_ACTIVE=prod` | base 里是 `dev,local`（占位），由 overlay 覆盖 |
| 7 | 需要 `kubectl create secret docker-registry passup-registry-secret` | 仓库**匿名可读**，不需要；引用不存在的 Secret 只会刷警告 |
| 8 | `startupProbe` 失败阈值 30 次「给足冷启动时间」 | 实测不够（165s < 256s），已改 90 |
| 9 | 部署命令 `kubectl apply -k k8s/base` | 会失败（缺 `secret.yaml`，且地址全是 `CHANGE_ME`） |
| 10 | `secret.example.yaml` 里的 `DOUBAO_REALTIME_API_APP_ID` / `_ACCESS_KEY` / `_APP_KEY` | **代码里根本没有这三个配置项**（`DoubaoAsrProperties` 只读 `doubao.realtime.api-key`）。属于模板里的过期残留，已删除 |
| 10b | `secret.example.yaml` 漏了微信开放平台 | 代码有 `WechatOpenPlatformProperties`（读 `wechat.open-platform.app-id/app-secret`），模板里没有。缺了不会启动失败，只是扫码登录不可用。已补上 |
| 10c | 未提及 | `.env` 里**没有** `WECHAT_PAY_API_V3_KEY`，而代码读 `wechat.pay.api-v3-key` —— 也就是说微信支付 v3 接口会用代码里的占位值，实际不可用。已在 `gen-secret.sh` 白名单里加上该键，让它以「缺失」的形式暴露出来 |
| 11 | 未提及 | 缺 **Prometheus 采集注解**与 **ECS 日志 profile** 两条契约 —— 这是本次迁移的核心依赖 |
| 12 | 未提及 | `local` profile 会把 management 端口改成 **7009**，与探针写的 8009 不符 |

## 十、未完成项

1. **依赖上集群** —— PostgreSQL / Redis / MinIO 仍是宿主机 Docker，`overlays/k3s` 是过渡态。
   迁移后应切到 `overlays/prod` 的 `*.passup.svc.cluster.local` 地址。
2. **对外入口** —— Ingress 用的是占位域名且只有 HTTP，目前未启用。
   需要先定域名与证书（可参考监控栈的做法：自签两级证书 + kube-vip VIP）。
3. **`limits.memory: 2Gi` 待负载复测** —— 见第八节坑 2。
4. **`topologySpreadConstraints`** —— 目前 3 副本靠调度器自然分布成 2:1；
   业务节点只有 2 台，加约束要确认不会导致 Pod Pending。
5. **`secret.example.yaml` 与 `gen-secret.sh` 的白名单要保持同步** ——
   两边不一致会出现「example 里有、实际没注入」这类静默缺配置。
6. **MinIO 凭据强度** —— 当前是 `admin` / 8 位弱口令，且 MinIO 端口直接暴露在宿主机 `0.0.0.0:8007`。
   数据库同理（`0.0.0.0:5432`）。上集群前建议收敛。
