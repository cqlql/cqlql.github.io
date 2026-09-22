---
title: PassUp 后端 K8s 部署清单（Kustomize）
icon: mdi:kubernetes
sort: 6
---

> 本文记录 `pass-up.backend` 项目 `k8s/` 目录的部署清单，一个基于 **Kustomize** 组织的、面向 **k3s** 环境的完整后端部署示例，可作为 Spring Boot + PostgreSQL + Redis + MinIO 上 k3s 的参考模板。

## 一、整体概览

这份清单用 **Kustomize** 组织 Kubernetes 资源，遵循 **base + overlays** 的经典目录结构：

```text
k8s/
├── base/                        # 基础清单（所有环境共用）
│   ├── namespace.yaml           # passup 命名空间
│   ├── configmap.yaml           # 非敏感配置（Spring 环境变量）
│   ├── secret.example.yaml      # 敏感配置模板（勿提交真实值）
│   ├── secret.yaml              # 由 example 复制生成（Git 忽略）
│   ├── deployment.yaml          # 后端应用 Deployment
│   ├── service.yaml             # 后端 ClusterIP Service
│   ├── postgres.yaml            # PostgreSQL StatefulSet + PVC + Service
│   ├── redis.yaml               # Redis Deployment + PVC + Service
│   ├── minio.yaml               # MinIO Deployment + PVC + Service
│   ├── ingress.yaml             # Traefik Ingress + 中间件
│   └── kustomization.yaml       # Kustomize 入口
└── overlays/
    ├── dev/                     # 开发环境（当前为空壳）
    │   └── patches/
    └── prod/                    # 生产环境覆盖（副本数 3）
        └── kustomization.yaml
```

面向的 k3s 环境默认提供 `local-path` 存储类与 `traefik` Ingress，因此清单中**没有**自行部署 CNI、存储 Provisioner、Ingress Controller，全部复用 k3s 内置能力。

## 二、关键约定（速查表）

| 项目 | 值 |
| :--- | :--- |
| 命名空间 | `passup` |
| 业务端口 | `8005`（HTTP + WebSocket） |
| 管理端口 | `8009`（Actuator：health/prometheus/loggers） |
| 数据库 | PostgreSQL `postgres.passup.svc.cluster.local:5432/pass_up` |
| Redis | `redis.passup.svc.cluster.local:6379` |
| MinIO | `minio.passup.svc.cluster.local:9000`（API）/ `9001`（Console） |
| 存储类 | `local-path` |
| 运行用户 | 非 root，uid/gid 1001 |
| 副本数 | base 2 副本，prod overlay 3 副本 |

## 三、base 各资源解读

### 1. namespace.yaml

创建 `passup` 命名空间并打 `app.kubernetes.io/name: passup` 标签。Kustomize 中 `kustomization.yaml` 顶层声明 `namespace: passup`，会自动为所有资源注入命名空间。

### 2. configmap.yaml（非敏感配置）

通过 `envFrom.configMapRef` 注入后端容器的环境变量，主要包括：

- **Spring 基础**：`SPRING_PROFILES_ACTIVE=prod`、`SERVER_PORT=8005`
- **数据源**：`SPRING_DATASOURCE_URL` 指向集群内 PostgreSQL Service
- **Redis**：`SPRING_DATA_REDIS_HOST/PORT/DATABASE`
- **MinIO**：内部访问端点、三个 bucket 名、公网端点、预签名 URL 有效期
- **简历解析 AI 服务**：`RESUME_AI_BASE_URL`（指向未部署的 Python 服务，无此服务可留空）
- **JVM 参数**：`JAVA_OPTS` 使用 `UseContainerSupport` + `MaxRAMPercentage=70.0` + G1GC，容器化内存自适应

### 3. secret.example.yaml（敏感配置模板）

类型 `Opaque`，字段值全部为 base64 编码。涵盖数据库账号密码、Redis 密码、JWT/刷新密钥、管理员默认密码、豆包 ASR/LLM 密钥、微信小程序/支付密钥、MinIO 访问密钥。

> 部署时需 `cp secret.example.yaml secret.yaml` 后替换 `CHANGE_ME`。`secret.yaml` 已被 `.gitignore` 忽略，真实密钥不入库。

### 4. deployment.yaml（后端应用）

核心亮点：

- **安全上下文**：`runAsNonRoot: true`，uid/gid 1001（与 Dockerfile 中 appuser 一致）；容器侧 `drop: ["ALL"]` 丢弃所有 capabilities，禁止提权。
- **镜像拉取密钥**：`imagePullSecrets` 引用私有仓库的 `passup-registry-secret`。
- **滚动更新**：`maxUnavailable: 0` + `maxSurge: 1`，保证更新过程中始终有可用副本。
- **双端口**：`http`（8005）与 `management`（8009）分离，业务与健康检查端口隔离。
- **配置注入**：`envFrom` 同时引用 ConfigMap 与 Secret；微信支付 PEM 文件通过 Secret 卷挂载到 `/app/secrets/`，用 `WECHAT_PAY_PRIVATE_KEY_PATH` 等 env 指向文件路径。
- **三类探针**（均走 management 端口）：
  - `startupProbe`：`/actuator/health`，失败阈值 30 次，给足冷启动时间；
  - `readinessProbe`：`/actuator/health/readiness`，就绪后才接入流量；
  - `livenessProbe`：`/actuator/health/liveness`，探活失败重启容器。

### 5. service.yaml（后端 Service）

`ClusterIP` 类型，同时暴露 `http`（8005）与 `management`（8009）两个端口，selector 匹配 `app: passup-backend`。

### 6. postgres.yaml（数据库）

采用 **StatefulSet + volumeClaimTemplates** 部署单副本 PostgreSQL 18：

- `serviceName: postgres`（StatefulSet 必须，提供稳定的网络标识）；
- 账号密码从 Secret 的 `SPRING_DATASOURCE_USERNAME/PASSWORD` 读取（与后端共享同一 Secret，保证一致）；
- `PGDATA` 指定到 `/var/lib/postgresql/data/pgdata` 子目录；
- 探针用 `pg_isready` 命令判断就绪；
- 存储 `ReadWriteOnce` + `local-path`，20Gi。

### 7. redis.yaml（缓存）

`Deployment`（单副本，`Recreate` 策略）+ PVC 持久化：

- 启动参数开启 `appendonly yes`（AOF 持久化），并设置 `--save 60 1000`（60 秒内 1000 次写触发 RDB 快照）；
- 探针用 `redis-cli ping`；
- 存储 `local-path` 5Gi。

> 单副本 + Recreate：Redis 无多副本主从，重建时先删后建避免 PVC 冲突。

### 8. minio.yaml（对象存储）

`Deployment`（单副本，`Recreate`）+ PVC：

- 镜像锁定到特定 RELEASE 版本；
- `args` 启动 `server /data --console-address :9001`，API 与 Console 分离；
- root 账号密码从 Secret 的 `MINIO_ACCESS_KEY/SECRET_KEY` 读取；
- 探针访问 `/minio/health/live`；
- 存储 `local-path` 20Gi。

### 9. ingress.yaml（对外入口）

- `ingressClassName: traefik`，复用 k3s 内置 Traefik；
- 注解配置 `router.entrypoints: web`，并通过中间件 `passup-backend-headers` 透传真实客户端信息；
- 域名 `api.your-domain.com` 需替换为真实域名；
- 同文件还定义了一个 Traefik `Middleware`（`traefik.io/v1alpha1`），设置 `X-Forwarded-Proto: https`（对应原 Caddy 配置的行为）。

### 10. kustomization.yaml

- `namespace: passup` 统一注入；
- `resources` 列出所有资源文件；
- `images` 将镜像 tag 固定为 `latest`；
- `commonLabels` 为所有资源打 `app.kubernetes.io/part-of: passup`。

## 四、overlays 目录

### prod（生产覆盖）

`resources` 引入 `../../base`，并通过 `replicas` 字段把 `passup-backend` 副本数从 2 提升到 3。

```yaml
replicas:
  - name: passup-backend
    count: 3
```

注释里还演示了如何用 `configMapGenerator`（`behavior: merge`）覆盖生产环境配置，例如把 `MINIO_PUBLIC_ENDPOINT` 换成生产域名。

### dev（开发环境）

当前是空壳，仅有空的 `patches/` 目录，尚未编写覆盖逻辑。

## 五、部署流程

### 1. 准备 Secret

```bash
cd k8s/base
cp secret.example.yaml secret.yaml
# 编辑 secret.yaml，替换 CHANGE_ME（base64 编码）
echo -n '你的密码' | base64   # 生成 base64 值
```

### 2. 创建镜像拉取 Secret（如仓库需认证）

```bash
kubectl create secret docker-registry passup-registry-secret \
  --namespace passup \
  --docker-server=172.16.0.222:5000 \
  --docker-username=<用户名> \
  --docker-password=<密码>
```

### 3. 部署

```bash
kubectl apply -k k8s/base              # 基础清单（2 副本）
kubectl apply -k k8s/overlays/prod     # 生产 overlay（3 副本）
```

### 4. 验证

```bash
kubectl -n passup get pods
kubectl -n passup get svc
kubectl -n passup get ingress

# 本地转发验证后端健康
kubectl -n passup port-forward svc/passup-backend 8005:8005
curl http://localhost:8005/actuator/health
```

## 六、值得借鉴的设计点

1. **base + overlays 分层**：多环境共用 base，差异通过 overlay 覆盖，DRY 且清晰。
2. **敏感/非敏感分离**：ConfigMap 存非敏感、Secret 存敏感，Secret 用 example 模板 + gitignore 防泄漏。
3. **端口隔离**：业务端口与管理端口分离，健康检查走独立 management 端口。
4. **三类探针配合**：startupProbe 兜底冷启动、readinessProbe 控流量、livenessProbe 保活性。
5. **最小权限**：非 root 运行、drop all capabilities、禁用提权。
6. **复用 k3s 内置能力**：local-path 存储、traefik Ingress 直接拿来用，不重复造轮子。
7. **有状态服务差异化**：PostgreSQL 用 StatefulSet（稳定网络标识 + 独立 PVC），Redis/MinIO 用 Deployment + Recreate + PVC。
