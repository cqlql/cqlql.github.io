> 状态：**方案（未实现）**（2026-11-05）

# 单机一键 Docker 部署

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)；配置键见 [config.md](config.md)。

## 1. 目标与范围

一条 `ops deploy` 完成「预检 → 配置同步 → 构建 → 传输 → 拉起 → 健康门」，把 Pass-up 全套应用
部署到**一台 Docker 主机**：

| 服务 | 来源 | 端口 | 健康检查 |
| :--- | :--- | :--- | :--- |
| postgres | `docker-compose.base.yml` | 5432 | `pg_isready`（可选） |
| redis | 同上 | 6379 | `redis-cli ping`（可选） |
| minio | 同上 | 8007 / 8008 | `GET /minio/health/live` |
| passup/ai | `pass-up.ai/docker/docker-compose.yml` | 8006 | `GET /resume/health` |
| passup/backend-java | `pass-up.backend/docker/docker-compose.yml` | 8005 / 8009 | `GET /actuator/health/readiness`（8009） |
| frontend-web（Caddy + 静态站） | 同上 | 80 / 81 / 82 | `GET /` |

「一键」指一条命令，不是零配置：Docker、`/data` 目录、`.env`、`secrets/` 仍需首次准备。
**部署目标与备份服务器可以是同一台，也可以是两台**；目标机一律由
[servers.json](servers.md) 的 `--server <name>` 选择，不再在 `ops.env` 里重复写 host。

## 2. 命令

```
ops deploy [all|infra|ai|backend|web] [--server <name>] [--dry-run] [--no-build] [--no-sync]
    all（默认）：infra → ai → backend → web
    --server    目标机（来自 servers.json）；省略用清单的 default
    --dry-run  只预检并打印将执行的每条远端命令，不改远端任何文件
    --no-build 复用远端已有镜像（只同步配置并 compose up）
    --no-sync  不同步配置（假定远端配置已就绪），只换镜像

ops rollback [all|ai|backend] [--server <name>]
    回到上一次成功的镜像 tag 并重建；**不回滚数据库**

ops ps / ops logs <service> [-f] [--server <name>]
    只读查看容器状态与日志
```

## 3. 部署流程

### 3.1 预检

- 本机：`docker`、`ssh`、三个仓库目录存在、当前 git commit 可读；
- 远端：目标机来自 [servers.json](servers.md)，提权用该条目的 `user` + `sudo`
  （免密 `sudo -n` 或一次性密码经 stdin）；Docker + compose 插件、目标端口未被非本栈容器占用、
  磁盘余量、`/data/postgres` 与 `/data/minio/data` 可写；
- 远端加锁（`/opt/passup/.deploy/lock`），拿不到锁立刻失败，不排队。

### 3.2 配置备份 + 同步

- 先把远端现有 `.env` / compose / `Caddyfile` 备份到 `/opt/passup/.deploy/backup/<时间戳>/`；
- rsync：
  - backend：`docker/docker-compose.base.yml`、`docker/docker-compose.yml`、`docker/.env`、
    `docker/Caddyfile`、`docker/secrets/`、`docker/www/{client,admin}`
  - ai：`docker/docker-compose.yml`
- 🔴 **`docker/.env` 是 CRLF**：同步时统一转 LF（或远端 `sed -i 's/\r$//'`）。
  否则同一根因会伪装成三个不相干故障（PG 认证失败 / Lettuce 握手断开 /
  api-key `invalid header value`）。
- `docker/www/` 用 `--delete`（纯构建产物）；`secrets/` **不用** `--delete`，权限 `600`，内容不打印。

### 3.3 构建

- backend：`docker build -f docker/Dockerfile -t <image-prefix>/backend-java:<tag> .`
- ai：`docker build -f docker/Dockerfile -t <image-prefix>/ai:<tag> .`
- 🔴 `<image-prefix>` 必须**逐字等于**现有 compose 的 `image:` 前缀。
  save/load 模式不要求该仓库可访问，但引用必须一致，否则 compose 会去找一个不存在的 tag。
- 远端拉起时由工具注入 `IMAGE_TAG=<tag>`（compose 里是 `${IMAGE_TAG:-latest}`）。
- web：在 `pass-up.frontend` 执行 `pnpm build:user` / `pnpm build:admin`，
  产物 `apps/{user,admin}/dist` → `pass-up.backend/docker/www/{client,admin}`。
- `<tag>` 默认 git 短 commit；构建失败即停，**不碰远端**。

### 3.4 传输

两种模式：

- 默认「流转」：`docker save <完整镜像引用> | ssh ... 'docker load'`，
  不落本地 tar，也不要求远端能访问镜像仓库（沿用现有 `deploy.sh` 的免仓库思路）；
- 配了 `PASS_UP_OPS_DEPLOY_REGISTRY`：`docker push` + 远端 `compose pull`。

两种模式都使用**与 compose 中一致的完整镜像引用**，不做「load 后再 tag」的绕路。

### 3.5 拉起

- 顺序：`infra` → `ai` → `backend` → `web`；
- backend/infra 合并 compose：
  `docker compose -f docker-compose.base.yml -f docker-compose.yml up -d`；
- ai 单独 compose（`passup-network` 为 external）；
- 🔴 不使用 `down -v`，不删除 `/data`，默认**不加** `--remove-orphans`
  （同机可能还有别的 compose 项目）。

### 3.6 健康门

- backend：远端 `curl 127.0.0.1:8009/actuator/health/readiness`，连续 2 次 200；
- ai：`127.0.0.1:8006/resume/health`；web：`127.0.0.1:80/`；
- 总上限由 `PASS_UP_OPS_DEPLOY_HEALTH_TIMEOUT` 控制；
- 失败 → 自动回滚到 `:previous` 并重建，输出失败日志尾部。

### 3.7 回滚

- 发布前把当前镜像 tag 记为 `:previous`（写在远端 `.deploy/state.env`）；
- `ops rollback` 重新 tag 并 `compose up -d`；
- 🔴 **只回滚镜像，不回滚数据库**：Flyway 迁移是单向的，回滚旧镜像可能因 schema 已前进而起不来。
  此时必须明确说「镜像已回滚但服务可能起不来，需要前向修复」，**不许假装成功**。

## 4. 与现有 `docker/deploy.sh` 的关系

- **首期不删除脚本**；新工具先以 `--dry-run` 跑，输出与 `deploy.sh` 的人工步骤逐条对齐后再停用。
- 差异：
  - `deploy.sh` 只发 backend；新工具一次发 infra / ai / backend / web；
  - `deploy.sh` 把 tar 落到远端磁盘再 `load`，再按 compose 引用补 tag；新工具用流转并统一引用；
  - `deploy.sh` 没有健康门与自动回滚；新工具有。
- 配置来源仍是 `pass-up.backend/docker/.env` 与 `deploy.env` 的语义；
  新工具**不重新发明**一套环境变量名，只负责搬运与校验。

## 5. 文件与阶段

```
ops/
  internal/deploy/deploy.go               预检、rsync、构建、流转、compose up、健康门
  internal/deploy/rollback.go             :previous 回滚与 state.env
  internal/deploy/deploy_test.go          预检/命令拼装/健康门判定的单测（不碰真实 docker）
```

| 阶段 | 内容 | 验收 |
| :--- | :--- | :--- |
| P3 | 预检 + 配置同步 + backend/ai 构建与流转 + compose up + 健康门 | `--dry-run` 与 `deploy.sh` 逐条对齐；真实环境一键发布成功 |
| P4 | `rollback` / `ps` / `logs` + web 构建同步 | 故意让健康门失败，能自动回滚并说明原因 |

测试：命令拼装与 rsync 参数单测（含 CRLF 归一化、`--delete` 只作用于 `www`）；
健康门判定单测（200/404/超时/连续 2 次）；**不写会真实构建镜像的单测**。

## 6. 风险与硬约束

| 风险 | 说明与对策 |
| :--- | :--- |
| 首次部署缺前置 | `/data`、`.env`、`secrets/` 未就绪时，预检必须**明确指出缺哪一项**，不要开始构建 |
| Docker 权限 | 目标用户不在 `docker` 组会 permission denied；预检先 `docker info` 探一次；必要时用清单里的 `user` + 免密 sudo |
| 多台应用服务器 | 由 `--server` 逐台发布；本期不做并行批量（锁与端口冲突都按单机设计） |
| 镜像很大 | Java 镜像 1GB+，流转耗时；可切 registry 模式或 `--no-build` |
| Flyway 单向 | 镜像可回滚，schema 不可；回滚文案必须如实 |
| CRLF | 见 §3.2，这是本仓库最容易复发的部署故障 |
| 同机其他容器 | 默认不加 `--remove-orphans`，不 `down -v`，不删 `/data` |
| 并发发布 | 远端锁 + 本地锁；拿不到锁立刻失败 |
| 密钥与 `.env` | 只 rsync，不在终端回显；`secrets/` 权限保持 `600` |

## 7. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| 默认 `docker save` → `ssh docker load` | 强制走 registry | 不要求目标机能访问镜像仓库；registry 作为可选加速 |
| 默认 `all` | 按服务发布 | 「一键」语义；单服务仍可用 `deploy backend` |
| 远端锁 + 本地锁 | 只加本地锁 | 多人 / 多机发布时本地锁挡不住 |
| 暂不竖切 Go 包 | `backup/` + `deploy/` 子包 | 当前领域 < 10，按母本阈值先横切；触发条件出现再拆（见 `AGENTS.md`） |
| 只做单机 Docker | 纳入 k8s | 本期目标明确是单机一键；k8s 另起分册 |
| 主机来自 `servers.json` | 每台机器各写一套 `DEPLOY_HOST` | 主机定义只维护一处，`--server` 选目标；避免与备份端配置漂移 |
