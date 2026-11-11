> 状态：**方案（未实现）**；2026-11-10 23:4x 按当前代码基座刷新方案并补交互原型，
> 进入「P3 第一刀」的**评审准备**（按 11-07 拍板：只做 `--dry-run` 与 `deploy.sh`
> 逐条对齐，**不真实发布**）。命令未注册、代码未写、原型不连远端；
> 未实现方案的配置键表从 config.md §5 移入本文 §8。
> **2026-11-11 08:4x 借鉴微信开发者工具「上传代码」弹窗**（线上版本号 / 更新类型 /
> 版本号 / 项目备注 / 上次填写）新增 §10 发版信息方案，原型加「发版信息」区与第 8 个
> 场景 `release-invalid`；仍是**只改文档与原型**：命令未注册、代码零改动、不连远端、
> 不真实发布、不新增任何 `ops.env` 配置键（§8 的 12 个键原样保留）。第一刀仍**只有
> `--dry-run`、没有正式发布按钮**。
> **2026-11-11 10:0x 补齐「版本历史」**（评审追问后按 B 落地）：台账定位改成
> **append-only 的正式发布尝试事件流**（成功 / 失败 / 回滚都留痕，预演与门禁阻塞不入账），
> 修掉「`result` 恒为 success」的自相矛盾；补保留策略、追溯字段、只读历史接口与
> 「失败回 `ok=true` + `items: []`、数组恒为 `[]`」的白屏红线；原型加只读「发版历史」
> 折叠区与第 9 个场景 `release-history`。**仍然只改文档与原型**，代码零改动。

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

ops deploy releases [--server <name>]        P3b 草案：只读查看本机发版台账（§10.4）
    --server 省略 = 全部；按时间倒序；不连远端、不改台账、不触发任何动作
```

**本轮第一刀只实现 `--dry-run` 链路**：`ops deploy ... --dry-run` 只做真实 ssh 只读
预检并打印将执行的每条远端命令，与 `deploy.sh` 的人工步骤逐条对齐；不改远端任何文件、
不构建镜像、不 `compose up`。正式发布路径、`rollback` / `ps` / `logs` 属于后续刀（§5）。
界面侧同样先只有「只读预演」，**没有正式发布按钮**。

**发版信息（借鉴小程序「上传代码」，2026-11-11 新增方案，见 §10）**：不是新命令、
也不是新配置键。P3b 的正式发布才接受 `--release-version <v>` / `--release-note <text>`
（均为草案参数），由服务端 `ValidateRelease` 逐字再验；第一刀 `--dry-run` 只在报告里
**回显**发版信息，不落台账、不写远端 `state.env`。界面表单第一刀可填写，但「上传 /
正式发布」恒禁用 —— 小程序的「上传」只到平台、还要审核发布，本工具没有审核态，
点上传就是直接改现网，所以门禁只能更严（§10.3）。

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
- 发版号（`RELEASE_VERSION`，见 §10）只是台账里的人读标签，**不参与** `:previous`
  镜像回滚，也不随回滚改动；回滚目标仍是上一个镜像 tag。
- **回滚在台账里另追加一条 `kind=rollback`**（§10.2 / §10.4）：不改、不删原发布记录，
  「回滚不回滚台账」指台账本身不是可回滚的状态，而不是「回滚这件事不留痕」。

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
  internal/deploy/release.go             ValidateRelease / 发版台账 append-only 读写（P3b，§10）
  internal/deploy/history.go             台账只读投影 / 按 server 筛选 / 空视图（P3b，§10.4）
  internal/deploy/rollback.go            :previous 回滚与 state.env + rollback 留痕（P4）
  internal/deploy/*_test.go              命令拼装 / rsync 参数 / CRLF / 健康门 / 发版号白名单 /
                                        台账追加与空数组（不碰真实 docker）
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
| P3a | 只读计划 + `ops deploy --dry-run`，输出与 `deploy.sh` 人工步骤逐条对齐 | 不构建镜像、不 `compose up`、不改远端任何文件；**不落台账、不写 `state.env`** |
| P3b | 构建 / 流转 / 拉起 / 健康门 + 界面步骤进度与实时日志 + 发版信息落台账 + **只读发版历史**（§10.4） | 不做 `rollback`（P4）；历史只读、无编辑 / 删除 / 重发 |
| P4 | `rollback` 追加一条 `kind=rollback` 台账事件 | 不删、不改已有台账记录 |

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
| 发版号被拼进命令 | 版本号白名单 + shell 字面量转义；项目备注不写远端、不拼进任何命令（§10.1 / §10.2） |
| 线上版本号未采集 | 显示「未采集 / 首次发版」，不猜 `0` / `1.0.0`；非三段式不自动推算下一版（§10.1，硬约束 3） |
| 预演被当成一次发版 | 预演只回显、不落台账、不写 `state.env`；「上传 / 正式发布」第一刀恒禁用；校验 / 预检 / 并发被挡住（**还没开始执行**）同样不落台账（§10.3） |
| 发版记录与回滚混淆 | 台账 append-only、回滚不改不删旧记录、只追加一条 `kind=rollback`；Flyway 单向口径不变（§10.3 / §3.7 / §10.4） |
| 执行期失败在历史里无痕 | 过了门禁真正开始执行的发布，成功 / 失败都留一条（`result` + `failed_stage`）；失败停在失败阶段、不写「发版成功」（§10.2） |
| 历史被静默截断 / 换机丢失 | 不自动轮转、不清理、不设条数上限，也不随配置保存被删；🔴 台账是**本机文件**、不接备份能力、不上送远端，换机 / 重装会丢，是否纳入运维机自身备份由人决定（§10.4） |
| 历史接口空数组白屏 | 读台账失败回 `ok=true` + `data.error` + `items: []`；Go nil slice 编成 `null` 会让前端 `.find` 整页白屏，服务端空视图 + 前端 normalize 双层挡（`ui.md` §11.4-5 / §12.5-3） |

## 7. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| 默认 `docker save` → `ssh docker load` | 强制走 registry | 不要求目标机能访问镜像仓库；registry 作为可选加速 |
| 默认 `all` | 按服务发布 | 「一键」语义；单服务仍可用 `deploy backend` |
| 远端锁 + 本地锁 | 只加本地锁 | 多人 / 多机发布时本地锁挡不住 |
| 新增能力按 `internal/<能力>/` 竖切 | 继续横切 `backup/` + `deploy/` | 2026-11-05 已按能力竖切 Go 包，AGENTS.md「目录与边界」要求新增能力继续建包；P3 沿用，**不复活旧决策** |
| 只做单机 Docker | 纳入 k8s | 本期目标明确是单机一键；k8s 另起分册 |
| 主机来自 `servers.json` | 每台机器各写一套 `DEPLOY_HOST` | 主机定义只维护一处，`--server` 选目标；避免与备份端配置漂移 |
| 版本号只作发版元信息，不替代 `IMAGE_TAG` | 把 `1.16.1` 直接当镜像 tag | git 短 commit 是唯一可溯源标识，compose `image:` 前缀必须逐字一致（硬约束 5）；发版号是给人看的标签，混用会让回滚找错镜像 |
| 借鉴表单，不借鉴「上传」语义 | 照搬「上传 = 提交待发布」 | 本工具没有平台审核态，点上传就是改生产；必须显式二次确认 + 服务端预检门，第一刀干脆不给按钮 |
| 校验失败挡住计划生成 | 只在正式发布时才校验 | 前端不能拿非法值生成一份「看起来可执行」的计划；`ValidateRelease` 是唯一判据、服务端逐字再验（硬约束 21 / 23） |
| 台账记**正式发布尝试**（成功 / 失败 / 回滚都留痕） | 只追加成功发版 | 原方案 `result` 字段恒为 `success`，等于失败的发布在历史里无痕；改成事件流后 `result` / `failed_stage` 才有意义。**预演与门禁阻塞仍一律不入账**，界线是「有没有真正开始执行」，不是「有没有点过按钮」 |
| 台账留在本机、不自动轮转 / 清理 / 设上限 | 写远端 `state.env` 或按条数自动截断 | 远端只存**当前**版本号（单值覆盖），存历史会被下次发布冲掉；自动截断等于静默改历史；多机上送还会互相覆盖。**代价是本机会丢**，如实写进 §10.4 而不是假装已备份 |
| 历史只读 + 失败回 `items: []` | 可编辑 / 删除 / 从历史重发 | 台账是审计痕迹不是可回滚状态；可编辑会破坏 append-only 语义，重发会绕过门禁；空数组红线见 §6 / §10.4 |

## 8. 配置键（方案，未实现）

> 2026-11-07 从 [config.md](config.md) §5 移来：未实现方案不该在「现行配置」文档里
> 占一节，也不该让人照着填进 `ops.env`。

🔴 **本节是设计稿**：当前版本**没有任何代码读这些键**，写进 `ops.env` 会被
`LoadConfig()` 直接拒绝并提示「应用部署（P3–P4）方案尚未实现」（原因表见
`internal/shared/opsenv.go` 的 `retiredOpsEnvKeys`）。实现时先在 `opsEnvKeys` 登记，
再删掉本节提示；`opsenv_test.go` 会断言本节键名数量与 `retiredOpsEnvKeys` 一致，
改键表要同步两处。🔴 **2026-11-10 本轮校准未改动任何键名**（12 个键原样保留）；
**2026-11-11 借鉴发版信息同样一个键都没加**（§10.2），`opsenv_test.go` 的数量断言不动。

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

## 9. 本轮交付与评审口径（2026-11-10；2026-11-11 补发版信息）

- 交付：本文按当前代码基座校准 + `docs/deploy-prototype.html`
  （分区索引 `docs/deploy-prototype-map.md`）。原型是**交互速览 + 验收用例集**：
  **九个场景**（2026-11-11 借鉴小程序发版信息新增 `release-invalid`，同日补齐版本历史
  再增 `release-history`）= 第一刀与后续刀的判据基线；不连远端、不发网络请求、
  不执行任何动作。原型另加「发版信息」区（线上版本号 / 更新类型 / 版本号 / 项目备注 /
  取消·上传）与只读折叠的「发版历史」区（按 server 筛选 / 成功·失败·回滚徽标 /
  模拟接口失败回空数组）。
- 🔴 **判据权威仍是本分册**：原型与分册不一致时**改原型，不是改分册**。
  界面视图按 `ui.md` §7 触发条件再加，本轮不改 `web/`。
- 🔴 本轮**没有**：注册 `ops deploy` / 回滚命令、改 `opsEnvKeys` /
  `retiredOpsEnvKeys`、写 `internal/deploy/`、改前端、连真机、构建镜像、真实发布。
- 🔴 九个场景钉死六条口径：① 第一刀只有 `--dry-run`，**没有正式发布按钮**；
  ② 预演不是执行凭证；③ 撞锁 / 构建失败 / 健康门失败 / 已有任务是运行期结果，
  不写成预演阻塞；④ 不 `down -v`、不删 `/data`、Flyway 单向且回滚后如实说明；
  ⑤ 发版信息（§10）只是元信息、**不是镜像 tag**，校验失败挡住计划、预演不落台账、
  上传恒禁用，线上版本号未采集不猜 `0`；
  ⑥ **版本历史 append-only**：预演 / 门禁阻塞不入账，过了门禁真正执行的成功 / 失败 /
  回滚都留痕，历史只读、不自动清理、失败接口回 `items: []` 不白屏（§10.4）。
- **2026-11-11 两刀都仍未碰代码**：没注册 `--release-version` / `--release-note` /
  `ops deploy releases`，没写 `internal/deploy/release.go` / `history.go`、
  没加 `GET /api/deploy/releases`、没改 `web/` / `opsEnvKeys` / `retiredOpsEnvKeys`；
  只同步了分册、原型、分区索引、`prototype-conventions.md` 清单与文档速查的口径。
- 评审通过后先落 P3a（§5），只跑真机只读对齐；**真实发布要等 P3b 单独授权**。

## 10. 发版信息（借鉴小程序「上传代码」· 2026-11-11 新增方案）

> 本节只是**设计稿**，截至 2026-11-11 代码为零。判据仍以 §2 / §3 / §6 / §9 为准；
> 原型对应 `docs/deploy-prototype.html` 的 `card-release` / `card-history` 区与
> 第 8、9 个场景 `release-invalid` / `release-history`
> （分区索引 `docs/deploy-prototype-map.md`）。**§10.4 版本历史**是 2026-11-11 10:0x
> 评审追问后补齐的：修掉了初版「只记成功却带 `result` 字段」的矛盾。

### 10.1 借鉴什么、改掉什么

微信开发者工具「上传代码」弹窗把一次发版收敛成五个字段：**线上版本号（只读）→
更新类型 → 版本号 → 项目备注 → 取消 / 上传**。价值是「发布前先看清当前线上是什么、
这次是什么、为什么发」，而不是事后从 git commit 里反推。本方案借用这层**发版元信息**，
不借用「上传」的语义：

| 小程序字段 | 本工具落点 | 改动 / 红线 |
| :--- | :--- | :--- |
| 线上版本号 `1.16.0`（只读） | 远端 `/opt/passup/.deploy/state.env` 的 `RELEASE_VERSION`，随只读预检一条 `cat` 带回 | 只读快照；连不上 / 文件不存在显示「未采集 / 首次发版」，**不猜 `0` / `1.0.0`**（硬约束 3） |
| 更新类型：版本升级 / 特性更新 / 修订补丁 | `x.y.z` 三段式分别 `x+1.0.0` / `x.y+1.0` / `x.y.z+1`；非三段式或「未采集」**不自动推算**，只让人手填 | 纯界面辅助，不是服务端判据；手填值仍过白名单 |
| 上次填写 | 从台账最后一条 `kind=release` 且 `result=success` 读回**版本号 + 项目备注**，不自动再 +1 | 失败记录与 `rollback` 不参与；没有成功记录时该单选禁用并提示「暂无历史发版」；不触发任何动作（§10.4） |
| 版本号 `1.16.1`（仅限字母、数字、小数点） | 白名单 `^[A-Za-z0-9.]{1,32}$`，服务端 `ValidateRelease` 逐字再验 | 🔴 **不是镜像 tag**：`IMAGE_TAG` 仍用 git 短 commit，版本号不拼进 `docker build -t` / compose `image:`（硬约束 5） |
| 项目备注「修复若干问题」 | 单行、≤200 字、无控制字符；只进本机台账与报告 | 🔴 **不写远端、不拼进任何 shell 命令**；日志 / 报告按纯文本转义展示 |
| 取消 / 上传 | 取消 = 重置表单；上传 = **正式发布** | 🔴 小程序的「上传」只到平台、还要审核发布；本工具点上传**就是直接改现网**，门禁必须更严（§10.3）；第一刀**恒禁用** |

### 10.2 数据落点（不新增配置键）

- 远端 `state.env`：**只存当前值**。发布成功后追加 / 更新 `RELEASE_VERSION`，值按 shell
  字面量转义（文件会被 `source`，`$(...)` / 反引号必须失效，口径同硬约束 23 ③）；
  失败 / 预演不写。🔴 **远端不留历史**：旧版本号被下一次成功发布覆盖，历史只在本机台账。
- 本机配置目录 `deploy-releases.jsonl`（0600，append-only）：每行一条 JSON，字段
  `ts / server / scope / kind / online_version / release_version / bump / note /
  image_tag / result / failed_stage / task_id`。
  - `kind`：`release`（正式发布尝试）/ `rollback`（P4 回滚）。
  - `result`：`success` / `failed`（`kind=rollback` 时表示回滚动作自身结果）；失败必填
    `failed_stage`（预检 / 配置同步 / 构建 / 传输 / 拉起 / 健康门），成功时留空。
    历史视图的徽标按 `kind` 优先：`rollback` 单列「回滚」，不混进成功数。
    🔴 **初版「只有正式发布成功才追加」已作废**：
    那样 `result` 恒为 `success`，失败的发布在历史里完全无痕，字段本身也没有意义。
  - 🔴 **入账界线是「有没有真正开始执行」**，不是「有没有点过按钮」：
    **不写** —— 预演（`--dry-run`）、`ValidateRelease` 校验失败、预检不通过、连不上、
    409 并发被挡（这些连远端都没碰，不许出现「预演也留了一条发版记录」）；
    **要写** —— 过了门禁真正开跑的正式发布，无论成功还是撞锁 / 构建失败 / 健康门失败 /
    超时，都留一条并停在失败阶段；P4 的回滚另追加一条 `kind=rollback`。
  - 台账**不删、不改、不覆盖**已有行；回滚不改发布记录，也不删自己的记录（§3.7）。
  - `task_id` 关联界面任务日志；本工具**无登录 / 认证体系，不记操作人**，追溯只到
    任务与本机时间。不存凭证、不存私钥路径、不存 `.env` / `secrets/` 全文。
- 🔴 本节**不新增 `PASS_UP_OPS_*` 键**：§8 的 12 个方案键原样保留，
  `opsEnvKeys` / `retiredOpsEnvKeys` 与 `opsenv_test.go` 的数量断言一行不动；
  版本号与备注是**每次发布的输入与运行态记录**，不是配置；保留策略也**不做成配置键**
  （见 §10.4）。

### 10.3 门禁与校验（服务端是唯一判据）

1. 前端只做格式提示与自动推算；`ValidateRelease` 在服务端**逐字再验**版本号与备注，
   非法值拒绝生成计划（`available=false`），不落台账、不改远端。
2. 校验失败（`release-invalid`）与预检不通过 / 连不上 / 409 同属**全局阻塞**；
   撞锁、构建失败、健康门失败仍是**运行期结果**，不因发版信息改写（§9）。
3. P3b 的二次确认弹窗必须回显「线上 `1.16.0` → 本次 `1.16.1`（修订补丁）」+ 项目备注
   + 影响清单；`yes` + 勾选 + 服务端先跑 `--dry-run` + 任务锁 409 + **无 sudo 密码框**
   （沿用 P0 清单 `user/key` + 免密 `sudo -n`）。
4. 第一刀：`--dry-run` 报告只**回显**发版信息并固定带「本次仅预演、未改动远端；
   发版信息未落台账」；表单可填写、上传恒禁用。**预演不是执行凭证**。
5. 报告口径：成功只写「发版号 `x.y.z` 已记录」，不写「服务已恢复正常」；
   失败停在失败阶段、不写「发版成功」。Flyway 单向与「回滚只回滚镜像」不变（§3.7），
   **回滚不回滚台账、不删记录**：台账是追加的历史，不是可回滚的状态；回滚这件事本身
   另追加一条 `kind=rollback`（P4）。
6. 台账由**服务端执行链路**在任务结束时一次性 append 一行完整记录，不由界面按钮写，
   也没有事后补记 / 编辑 / 删除入口：中途异常退出可能没有记录，界面如实提示
   「该次任务无台账记录」，**不猜、不补写**。预演路径完全不碰台账文件。

### 10.4 版本历史（2026-11-11 10:0x 补齐）

#### 10.4.1 保留策略

- **保留，且不做静默截断**：无保留期限、无条数上限、不自动轮转 / 归档 / 清理。
  单行 JSON + 备注 ≤200 字，体积增长很慢；真要归档由人手工复制原文件再改名，
  **原件不删**，工具不提供自动清理入口。保留策略**不做成配置键**。
- 台账与 `servers.json` 同在本机配置目录；配置页保存 / 同步远端 / 重装配置都**不得删台账**
  —— 它不是配置项，不进 `ops.env`，也不参与 `backup.env` 同步。
- 🔴 **代价如实写清**：台账是运维机本机文件，本轮**不接备份能力**（`ops backup` 面向远端
  数据）、**不上送远端**（多机上送会互相覆盖、把历史改乱）；换机 / 重装系统会丢，
  是否纳入运维机自身备份由人决定，界面不假装「已备份」。一份台账混装多台机器，
  靠 `server` 字段区分。
- 远端 `state.env` 只留**当前** `RELEASE_VERSION`，不是历史源；历史视图只读本机台账。

#### 10.4.2 只读接口与视图

- 草案接口 `GET /api/deploy/releases?server=<name>`（**未实现**）：只读本机台账，
  `server` 省略 = 全部，按 `ts` 倒序；不连远端、不触发任务、不写台账。
  CLI 同源 `ops deploy releases`（§2）。
- 🔴 **失败响应红线**（本仓事故口径，`ui.md` §11.4-5 / §12.5-3）：文件不存在 / 读失败 /
  解析出错，一律回 `ok=true` + `data.error` + **`items: []`**；**数组恒为 `[]`、不能是
  `null`** —— Go nil slice 编 JSON 是 `null`，前端 `.find` 会整页白屏；也**不能回
  `ok:false`**（前端会抛成 HTTP 错误）。服务端空视图 + 前端 normalize，双层挡。
- 视图默认折叠、只读：列为 `时间 / 目标机 / 发版号（线上 → 本次）/ 更新类型 /
  镜像 tag / 结果 / 失败阶段 / 备注 / 任务 id`；按 `server` 筛选，可选「全部」。
  结果徽标按 `kind` 优先区分「成功 / 失败 / 回滚」，失败行显示 `failed_stage` 与如实文案，
  **不写「服务已恢复正常」**。备注按纯文本转义展示，不进 HTML、不拼命令。
- 🔴 **没有**编辑 / 删除 / 重发 / 上送远端按钮；表格只读展示，行不触发任何动作。
  原型对应 `card-history` 折叠区与第 9 个场景 `release-history`（静态数据、不发请求、
  不读文件），并带一个「模拟只读接口失败 → 空数组」的判据开关。

### 10.5 本轮边界

只改 `docs/deploy.md`（§2 / §3.7 / §5 / §6 / §7 / §9 / §10 含新增 §10.4）与
`docs/deploy-prototype.html`，并同步分区索引、`prototype-conventions.md` 清单、
`docs/ui.md` 的原型指针与 `AGENTS.md` 文档速查口径。**没有**：注册命令、写
`internal/deploy/release.go` / `history.go`、加 `GET /api/deploy/releases`、创建
`deploy-releases.jsonl`、改 `web/`、改 `opsEnvKeys`、连真机、构建镜像、真实发布。
评审通过后随 P3b 一起落地；若要把版本号接进镜像 tag，另开决策（本方案明确否掉，
理由见 §7）。
