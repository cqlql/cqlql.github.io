> 状态：**方案（未实现）**；2026-11-10 23:4x 按当前代码基座刷新方案并补交互原型，
> 进入「P3 第一刀」的**评审准备**（按 11-07 拍板：只做 `--dry-run` 与 `deploy.sh`
> 逐条对齐，**不真实发布**）。命令未注册、代码未写、原型不连远端；
> 未实现方案的配置键表从 config.md §5 移入本文 §8。

# 单机一键 Docker 部署

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)；本方案的键表见本文 §8，
> 现行 `ops.env` / `backup.env` 的键见 [config.md](config.md)。

## 1. 目标与范围

一条 `ops deploy` 完成「预检 → 配置同步 → 构建 → 传输 → 拉起 → 健康门」，把 PassUp 全套应用
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

**2026-11-10 基座校准**：P0/P1/P2 与备份恢复 / 手动备份均已落地，本仓已按能力竖切
`internal/<能力>/`；P3 实现时沿用现有基座，不另起一套 —— 清单解析与 SSH 执行
（`servers.json` → `shared.SSHTarget`）、界面唯一后台任务锁、写动作的
「显式二次确认 + 服务端预检门」、只读动作「连不上回完整快照、不白屏、不猜 0」。
新增能力继续在 `internal/deploy/` 下建包（见 AGENTS.md「目录与边界」）。

## 2. 命令

🔴 **以下是草案**：`ops deploy` / `rollback` / `ps` / `logs` 均**未注册**
（`main.go` 的 `commandHandler` 是动词唯一注册表），不要照抄执行。

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

**本轮第一刀只实现 `--dry-run` 链路**：`ops deploy ... --dry-run` 只做真实 ssh 只读
预检并打印将执行的每条远端命令，与 `deploy.sh` 的人工步骤逐条对齐；不改远端任何文件、
不构建镜像、不 `compose up`。正式发布路径、`rollback` / `ps` / `logs` 属于后续刀（§5）。
界面侧同样先只有「只读预演」，**没有正式发布按钮**。

## 3. 部署流程

### 3.1 预检

- 本机：`docker`、`ssh`、三个仓库目录存在、当前 git commit 可读；
- 远端：目标机来自 [servers.json](servers.md)，提权用该条目的 `user` + `sudo`
  （免密 `sudo -n` 或一次性密码经 stdin）；Docker + compose 插件、目标端口未被非本栈容器占用、
  磁盘余量、`/data/postgres` 与 `/data/minio/data` 可写；
- 远端加锁（`/opt/passup/.deploy/lock`），拿不到锁立刻失败，不排队。
- **身份口径（2026-11-10 校准）**：统一用清单 `user/key` 登录，提权只走 P0 已真机验证的
  免密 `sudo -n`；界面不新造密码收集框，确需一次性密码也只经 stdin（硬约束 9）。
  任何输出 / 错误 / 日志不打印私钥路径（硬约束 8）。
- **锁与并发（2026-11-10 校准）**：远端锁与界面唯一后台任务锁都要拿；拿不到立刻失败、
  不排队。撞锁是**运行期结果**，不是预演阻塞（手动备份 `locked` 同理）；已有任务在跑时
  界面直接挡住第二次请求（409），不排队、不复用别人的任务日志。

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
- **同步是写动作**：只在正式发布路径执行；`--dry-run` 只打印 rsync 命令与 CRLF
  归一化步骤，不落盘、不传文件、不覆盖远端 `.env`。

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
- **本轮不真实发布**，健康门只做「判定单测 + 预演文本」：连续 2 次 200 的判据，
  以及 200/404/超时/「第一次 200、第二次失败」都要有单测（§5），不在真机造故障。
- 失败报告只报检查结果与日志尾部，**不写「服务已恢复正常 / 部署成功」**；
  自动回滚属于 P4，但 §3.7 的如实报告口径本轮先钉死。

### 3.7 回滚

- 发布前把当前镜像 tag 记为 `:previous`（写在远端 `.deploy/state.env`）；
- `ops rollback` 重新 tag 并 `compose up -d`；
- 🔴 **只回滚镜像，不回滚数据库**：Flyway 迁移是单向的，回滚旧镜像可能因 schema 已前进而起不来。
  此时必须明确说「镜像已回滚但服务可能起不来，需要前向修复」，**不许假装成功**。
- 🔴 本轮**不实现** `ops rollback`；原型只展示失败后的如实报告口径，不执行任何回滚。

## 4. 与现有 `docker/deploy.sh` 的关系

- **首期不删除脚本**；新工具先以 `--dry-run` 跑，输出与 `deploy.sh` 的人工步骤逐条对齐后再停用。
- 差异：
  - `deploy.sh` 只发 backend；新工具一次发 infra / ai / backend / web；
  - `deploy.sh` 把 tar 落到远端磁盘再 `load`，再按 compose 引用补 tag；新工具用流转并统一引用；
  - `deploy.sh` 没有健康门与自动回滚；新工具有。
- 配置来源仍是 `pass-up.backend/docker/.env` 与 `deploy.env` 的语义；
  新工具**不重新发明**一套环境变量名，只负责搬运与校验。
- **本轮边界**：对齐只跑 `--dry-run`（真实 ssh 只读预检 + 打印命令），不改远端、
  不构建、不拉起；`deploy.sh` 保留、不删、不改，对齐完成后也不在本轮停用。

## 5. 文件与阶段

```
ops/  （以下均为计划，当前一个文件都不存在）
  internal/deploy/plan.go                只读计划 / 预检结果（服务端下发，前端只渲染）
  internal/deploy/cli.go                 ops deploy 的 CLI 分发与 --dry-run 输出
  internal/deploy/deploy.go              构建、流转、compose up、健康门（P3b）
  internal/deploy/rollback.go            :previous 回滚与 state.env（P4）
  internal/deploy/*_test.go              命令拼装 / rsync 参数 / CRLF / 健康门判定（不碰真实 docker）
  web/src/features/deploy/               界面视图（待评审 + P3a 后按 ui.md §7 触发条件加）
```

| 阶段 | 内容 | 验收 |
| :--- | :--- | :--- |
| P3 | 预检 + 配置同步 + backend/ai 构建与流转 + compose up + 健康门 | `--dry-run` 与 `deploy.sh` 逐条对齐；真实环境一键发布成功 |
| P4 | `rollback` / `ps` / `logs` + web 构建同步 | 故意让健康门失败，能自动回滚并说明原因 |

测试：命令拼装与 rsync 参数单测（含 CRLF 归一化、`--delete` 只作用于 `www`）；
健康门判定单测（200/404/超时/连续 2 次）；**不写会真实构建镜像的单测**。

**本轮状态（2026-11-10 23:4x）**：完成「分册校准 + 交互原型」（`docs/deploy-prototype.html`，
分区索引 `docs/deploy-prototype-map.md`），**供评审**；代码仍为零。评审通过后按两刀落地：

| 刀 | 范围 | 不做 |
| :--- | :--- | :--- |
| P3a | 只读计划 + `ops deploy --dry-run`，输出与 `deploy.sh` 人工步骤逐条对齐 | 不构建镜像、不 `compose up`、不改远端任何文件 |
| P3b | 构建 / 流转 / 拉起 / 健康门 + 界面步骤进度与实时日志 | 不做 `rollback`（P4） |

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
| 预演被当成执行凭证 | `--dry-run` 报告固定带「本次仅预演、未改动远端」；预演通过 ≠ 可以发布 |
| 运行期失败 | 撞锁 / 构建失败 / 健康门失败 / 超时都是运行期结果，**不写成预演阻塞**；报告停在失败阶段、不假装成功 |
| 界面写动作 | 双击落地页只读；正式发布必须显式二次确认 + 服务端预检门（`ui.md` §9） |

## 7. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| 默认 `docker save` → `ssh docker load` | 强制走 registry | 不要求目标机能访问镜像仓库；registry 作为可选加速 |
| 默认 `all` | 按服务发布 | 「一键」语义；单服务仍可用 `deploy backend` |
| 远端锁 + 本地锁 | 只加本地锁 | 多人 / 多机发布时本地锁挡不住 |
| 新增能力按 `internal/<能力>/` 竖切 | 继续横切 `backup/` + `deploy/` | 2026-11-05 已按能力竖切 Go 包，AGENTS.md「目录与边界」要求新增能力继续建包；P3 沿用，**不复活旧决策** |
| 只做单机 Docker | 纳入 k8s | 本期目标明确是单机一键；k8s 另起分册 |
| 主机来自 `servers.json` | 每台机器各写一套 `DEPLOY_HOST` | 主机定义只维护一处，`--server` 选目标；避免与备份端配置漂移 |

## 8. 配置键（方案，未实现）

> 2026-11-07 从 [config.md](config.md) §5 移来：未实现方案不该在「现行配置」文档里
> 占一节，也不该让人照着填进 `ops.env`。

🔴 **本节是设计稿**：当前版本**没有任何代码读这些键**，写进 `ops.env` 会被
`LoadConfig()` 直接拒绝并提示「应用部署（P3–P4）方案尚未实现」（原因表见
`internal/shared/opsenv.go` 的 `retiredOpsEnvKeys`）。实现时先在 `opsEnvKeys` 登记，
再删掉本节提示；`opsenv_test.go` 会断言本节键名数量与 `retiredOpsEnvKeys` 一致，
改键表要同步两处。🔴 **2026-11-10 本轮校准未改动任何键名**（12 个键原样保留）。

目标机同样由 `--server` 从清单选择；以下只保留非主机类配置。

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_DEPLOY_DIR` | `/opt/passup` | compose、`.env`、`secrets`、`www` 的根目录 |
| `PASS_UP_OPS_DEPLOY_IMAGE_PREFIX` | `172.16.0.222:5000/passup` | 必须与 compose 的 `image:` 前缀逐字一致 |
| `PASS_UP_OPS_DEPLOY_REGISTRY` | 空 | 空 = save/load；填了 = push/pull（前缀仍需可达） |
| `PASS_UP_OPS_BACKEND_DIR` | 工具目录的 `../pass-up.backend` | 本机仓库路径 |
| `PASS_UP_OPS_AI_DIR` | 工具目录的 `../pass-up.ai` | |
| `PASS_UP_OPS_WEB_DIR` | 工具目录的 `../pass-up.frontend` | |
| `PASS_UP_OPS_IMAGE_TAG` | 空 | 空 = git 短 commit |
| `PASS_UP_OPS_BACKEND_HEALTH` | `http://127.0.0.1:8009/actuator/health/readiness` | |
| `PASS_UP_OPS_AI_HEALTH` | `http://127.0.0.1:8006/resume/health` | |
| `PASS_UP_OPS_WEB_HEALTH` | `http://127.0.0.1:80/` | |
| `PASS_UP_OPS_DEPLOY_HEALTH_TIMEOUT` | `120s` | |
| `PASS_UP_OPS_DEPLOY_KEEP_PREVIOUS` | `1` | 保留几份旧镜像 tag（磁盘紧张时设 0） |

## 9. 本轮交付与评审口径（2026-11-10）

- 交付：本文按当前代码基座校准 + `docs/deploy-prototype.html`
  （分区索引 `docs/deploy-prototype-map.md`）。原型是**交互速览 + 验收用例集**：
  七个场景 = 第一刀与后续刀的判据基线；不连远端、不发网络请求、不执行任何动作。
- 🔴 **判据权威仍是本分册**：原型与分册不一致时**改原型，不是改分册**。
  界面视图按 `ui.md` §7 触发条件再加，本轮不改 `web/`。
- 🔴 本轮**没有**：注册 `ops deploy` / 回滚命令、改 `opsEnvKeys` /
  `retiredOpsEnvKeys`、写 `internal/deploy/`、改前端、连真机、构建镜像、真实发布。
- 🔴 七个场景钉死四条口径：① 第一刀只有 `--dry-run`，**没有正式发布按钮**；
  ② 预演不是执行凭证；③ 撞锁 / 构建失败 / 健康门失败 / 已有任务是运行期结果，
  不写成预演阻塞；④ 不 `down -v`、不删 `/data`、Flyway 单向且回滚后如实说明。
- 评审通过后先落 P3a（§5），只跑真机只读对齐；**真实发布要等 P3b 单独授权**。
