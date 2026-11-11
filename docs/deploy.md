> 状态：**P3a 只读预演（`ops deploy --dry-run`）已落地；14:4x 已在 k2 装好
> Docker 29.9.3 / Compose 5.7.0；15:2x 用户确认拓扑：k1=备份服务器、
> k2=应用部署目标（§9.6）；✅ 16:4x 手工端到端冒烟**链路已跑通**
> （6 容器 Running、三个健康门各连续 2 次 200，§9.8）**。
> 🔴 `172.16.0.222:5000/passup` 只是 compose 的**镜像仓库前缀**，
> `172.16.0.222:2221` 是运维机本机 WSL2 转发，**都不是部署目标**。
> 🔴 上面跑通的是**手工链路 + 全测试值配置**，不是工具发布：
> `ops deploy` 仍只有 `--dry-run`，P3b 真实发布 / P4 回滚仍未实现、未授权。
> ✅ **20:3x §11 的 9 条待拍板已按推荐结论拍板、评审稿转「已拍板定稿」**（§11.10），
> 当时**定稿 ≠ 开工**：P3b-1 未开工、每批次单独授权、代码零改动。
> ✅ **21:2x 用户授权测试环境开工 → P3b-1 CLI 主链路已落地并真机验收**（§9.9）：
> `ops deploy release ... --confirm yes` 六道门 + 六阶段状态机 + 落盘续传 +
> 两个 compose 单元 + 150 s 健康门；k4 测试环境 rc=0 跑通（三 URL 各连续 2 次 200）。
> 🔴 测试环境用全测试值最小冒烟栈；生产 `.env` 52 键一字未动、没碰 `prod`、
> 没做正式发布；P3b-2 台账 / P3b-3 界面 / P4 回滚仍未实现、未授权。
> 现行判据见 §2 / §5 / §9.1–§9.8；
> 🔴 第一刀不构建镜像、不 `compose up`、不写远端、不落台账、不改 `web/`、
> 不启用 §8 的任何配置键。以下为演进记录（带时间戳的「命令未注册 / 代码零改动」
> 均指**当时**，不是现行状态）。
> 2026-11-10 23:4x 按当前代码基座刷新方案并补交互原型，进入「P3 第一刀」的
> **评审准备**（按 11-07 拍板：只做 `--dry-run` 与 `deploy.sh` 逐条对齐，**不真实发布**）。
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
> **2026-11-11 19:5x 用户选「P3b 实现方案先评审」→ 新增 §11 评审稿**
> （门禁链 / 阶段状态机 / 落盘流转 / 配置备份 / 拉起与健康门 / 台账入账点 /
> 0 新键建议 / 分批文件计划 / 9 条待拍板），原型加第 10 个场景 `p3b-review` 与
> `card-p3b` 评审要点区；🔴 **仍只改文档与原型**：代码零改动、不带 `--dry-run`
> 仍 rc=2、没连真机、没真实发布、一个配置键都没启用。
> ✅ **2026-11-11 20:3x 9 条待拍板按推荐结论拍板 → §11 由评审稿转「已拍板定稿」**
> （逐条结论与理由见 §11.10）：授权 = **一次明确指令 + 当次有效**（每次执行仍过六道门）；
> 暂存 tar.gz **成功即删 / 失败保留由人清**；生产 `.env` 52 键**由人核对**、结论只落在
> 当次发布前检查项；健康门失败 **P3b 不自动回滚**（`rollback` 仍属 P4）；
> 启动窗口统一 **150 s 内置默认**、不启用 `HEALTH_TIMEOUT` 方案键；台账接受
> 「崩溃丢一次尝试」、不加 `running` 起始事件；**P3b 首刀仍 0 新键**；
> **CLI-first 拆 P3b-1 / P3b-2 / P3b-3**；**默认每轮构建**、`--no-build` 才走
> §9.8 的复用镜像快路径。结论已回写 §2 / §3.3 / §3.4 / §3.6 / §5 两刀表 / §6 / §7 /
> §8 / §11 与原型（28 锚点 / 1513 行 / 十场景）、分区索引、`prototype-conventions.md`、
> `ui.md` 指针、本文速查表；
> §3.6 与 §3.7 / §5 的「失败自动回滚」矛盾按结论 C 修掉。
> 🔴 **本刀仍只改文档与原型**：代码零改动、不带 `--dry-run` 仍 rc=2、没连真机、
> 没真实发布、没启用配置键；**P3b-1 按 §11.8 另需单独授权**（一句「继续」不算），
> 正式发布仍要一次当次有效的明确授权、**未授权**。
> **2026-11-11 12:3x 评审通过，落 P3a 第一刀**：按 §9 的顺序先修订本文事实偏差
> （§3.1 锁 / §3.2 CRLF 判据 / §4 与真实 `deploy.sh` 的对齐），再拍板范围（§5 / §9）。
> 🔴 **P3a 仍是只读**：只注册 `ops deploy ... --dry-run`，不带 `--dry-run` 直接拒绝；
> 不构建镜像、不 `compose up`、不写远端任何文件、不落台账、不改 `web/`、
> **一个 `ops.env` 方案键都不启用**（§8 12 键原样，`opsenv_test.go` 数量断言不动）。
> 真实发布（P3b）仍要单独授权。

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

🔴 **已注册的只有两条路径**（`main.go` 的 `commandHandler` 是动词唯一注册表）：
`ops deploy ... --dry-run`（P3a 只读预演，12:3x）与
`ops deploy release ... --confirm yes`（P3b-1 CLI 主链路，21:2x，见 §9.9）。
其余命令仍是草案：`rollback` / `ps` / `logs` / `releases` **未注册**，不要照抄执行。
只读预演模式**不接受** `--no-build` / `--no-sync` / `--release-version` 等参数，
CLI 会回「未知参数」；这些参数只在 `release` 动词后可用。

```
ops deploy [all|infra|ai|backend|web] [--server <name>] [--dry-run] [--no-build] [--no-sync]
    all（默认）：按 §3.5 两个 compose 单元（backend/infra/web 合并视图 + ai 独立视图）
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
🔴 **P3a 是 CLI-only**：不带 `--dry-run` 的 `ops deploy` 由服务端**直接拒绝**并回一句
「第一刀只开放只读预演，正式发布待 P3b 单独授权」，不生成计划、不碰远端 —— 门禁钉在
代码里，比只写在文档里更硬。界面第 8 个导航项本刀不加（§5 / §9），`web/` 一行不动。

**P3b 实现方案（§11，2026-11-11 20:3x 已拍板定稿）**：门禁链、六阶段状态机、
落盘流转、配置备份、健康门启动窗口、台账入账点与分批文件计划已通过评审，
9 条待拍板按推荐结论拍板（§11.10）；构建**默认每轮执行**、显式 `--no-build` 才复用
现成镜像（§9.8 实证快路径），健康门窗口取 **150 s 内置默认**。
🔴 **21:2x 起新增 `ops deploy release` 一条注册路径**（见 §9.9）：
上面其余草案命令依然「不要照抄执行」；P3b-2 / P3b-3 / P4 每批次单独授权，
真实环境的正式发布仍未授权。

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
- 🔴 **第一刀 `--dry-run` 不拿锁**：拿锁会在远端写文件，与「不改远端任何文件」直接冲突。
  只读计划里**只打印**这条命令并标注「属于正式发布路径（P3b）」，实际不执行；
  只读预检也不 `mkdir -p`、不 `touch`、不写 `state.env`。撞锁是运行期结果，
  不是预演阻塞（原型 `locked` 场景已标「判据预置 · P3b / P4」）。
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
- 🔴 **CRLF 是待探测的历史故障，不是写死的前提**：同一根因会伪装成三个不相干故障
  （PG 认证失败 / Lettuce 握手断开 / api-key `invalid header value`）。
  2026-11-11 复核本机 `pass-up.backend/docker/.env` 检出为 **LF（CR 计数 0）**，
  说明「是 CRLF」多半来自远端手工编辑 / git 换行转换，**不能拿本机文件当判据**。
  实现口径：只读预检先对**远端** `.env` 做一次换行探测（只读 `od` / `grep -c $'\r'`
  等价命令，不落盘），把「检出 CR / 未检出 CR / 文件不存在」写进报告；
  正式发布路径**只在检出 CR 时**才做 `sed -i 's/\\r$//'` 归一化。
  P3a 的 `--dry-run` 只打印这条探测命令、不执行任何归一化。
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
- 🔴 **拍板 9（§11.10 第 9 条，20:3x）**：**默认每轮构建**（保持「一键」语义与
  §11.2 六阶段状态机），显式 `--no-build` 才复用现成镜像（§9.8 的实证快路径）；
  构建是本机动作，失败停在 `构建` 阶段、**不碰远端**。backend / ai / web 三条构建链
  **无真机证据**（§9.8 用的是运维机现成 6 镜像），首次真实发布前必须人工确认
  本机构建链可用，工具不擅自替人判定「构建已验证」。

### 3.4 传输

🔴 **2026-11-11 按 §9.7 / §9.8 真机实证修订**：原来的「默认流转不落盘」
已被证伪，不再是默认，也不能作为唯一路径。三种模式：

- **默认「落盘 + 断点续传」（实证可用）**：本机逐镜像
  `docker save <完整引用> | gzip -1 > <name>.tar.gz`，逐个传到远端暂存目录
  （如 `/opt/passup/.images`，按远端文件大小跳过已传完的），再逐个
  `gunzip -c <file> | docker load`，每个 load 后看内存 / 磁盘余量再继续。
  🔴 一次只处理一个镜像、每个文件独立可重传；暂存文件由发布流程在成功后清理，
  不要自动 `rm` 整个目录。§9.8 实测 6 个镜像 **651.7 MB** 全部到位。
- 「流转不落盘」：`docker save ... | ssh ... 'docker load'`，沿用现有 `deploy.sh`
  的免仓库思路，**只适合链路稳、内存余量足的目标机**：§9.7 实测原约 2 GB
  在 **81.3 s** 后 `Connection reset by peer`、随后 k2 整机失联
  （未取到 dmesg / OOM 证据，不断言因果）。降为可选快路径。
- 配了 `PASS_UP_OPS_DEPLOY_REGISTRY`：`docker push` + 远端 `compose pull`。

三种模式都使用**与 compose 中一致的完整镜像引用**，不做「load 后再 tag」的绕路
（真实 `deploy.sh` 里也没有 `docker tag`，见 §4）。

- 🔴 **拍板 A（§11.10 第 2 条，20:3x）**：暂存 tar.gz **成功后按本次清单逐个删除**
  （不 `rm -rf` 整个暂存目录）；**失败则保留现场供排障、由人清理** —— 不设定时清理、
  不引入新配置键、不让工具自动删失败现场（与结论 C「保留现场」一致）。

### 3.5 拉起

- 🔴 **拉起单位由 compose 文件决定，不是四个服务逐个起**（§9.8 实测）：
  backend / infra / web 在 `-f docker-compose.base.yml -f docker-compose.yml`
  合并视图里一次 `up -d`；ai 是独立 compose（`passup-network` 为 external），
  单独 `up -d`。先跑合并视图再跑 ai，6 容器 Running。
  旧表述「`infra → ai → backend → web` 四段顺序」是草案、与真实 compose 结构
  不符（合并视图一次就全拉起，插不进 ai 这一步），**已作废，别按它去拆 `up` 命令**。
- 🔴 不使用 `down -v`，不删除 `/data`，默认**不加** `--remove-orphans`
  （同机可能还有别的 compose 项目）。

### 3.6 健康门

- backend：远端 `curl 127.0.0.1:8009/actuator/health/readiness`，连续 2 次 200；
- ai：`127.0.0.1:8006/resume/health`；web：`127.0.0.1:80/`；
- 🔴 **必须给启动窗口**（§9.8 实证）：`compose up -d` 返回只代表容器已启动，
  Java / AI 服务还要初始化 —— ai 首次立刻查是 `000`、约 30 s 后才 200。
  口径改为「在超时窗口内每 5 s 轮询、**必须连续 2 次 200** 才算过」，
  不是起来立刻连查两次。
- 🔴 **拍板 D（§11.10 第 5 条，20:3x）**：总上限统一 **150 s 内置默认**
  （§9.8 `run-flow.py` 的实测判据），每 5 s 轮询、必须连续 2 次 200；
  **不启用** `PASS_UP_OPS_DEPLOY_HEALTH_TIMEOUT` 方案键（§8 的 12 键原样保留、
  `opsenv_test.go` 数量断言不动）。以后要调窗口走显式 CLI 参数、单开一刀。
- 🔴 **拍板 C（§11.10 第 4 条，20:3x）**：失败 **P3b 不自动回滚** ——
  停在当前阶段 + 如实报告 + 输出失败日志尾部 + **保留现场**；
  `ops rollback` 回到 `:previous` 仍属 **P4**、本轮不实现。
  原「失败 → 自动回滚到 `:previous` 并重建」与 §3.7 / §5「rollback 属 P4」
  自相矛盾，本条按拍板结论修掉；Flyway 单向、半成品回滚的口径不变（§7）。
- **P3a 第一刀不真实发布**，健康门只做「判定单测 + 预演文本」：连续 2 次 200 的判据，
  以及 200/404/超时/「第一次 200、第二次失败」都要有单测（§5），不在真机造故障。
  §9.8 的手工冒烟虽在 k2 真机跑通了三个健康门，但那是**测试环境 + 全测试值**的
  一次性脚本，不是工具发布，也没有故意造故障；P3b 的判定单测仍待补。
- 失败报告只报检查结果与日志尾部，**不写「服务已恢复正常 / 部署成功」**；
  `ops rollback` 属 P4（结论 C：P3b 不做自动回滚），§3.7 的如实报告口径本轮先钉死。

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
- **2026-11-11 实读 `pass-up.backend/docker/deploy.sh` 后的差异**（旧表把脚本写错了两处，
  已按代码校正；P3a 逐条对齐以真实脚本为准，不能以旧描述为准）：
  - **拉起范围**：脚本 Step 5 只 `up -d --no-build backend-java`，失败再
    `rm -s -f backend-java` 重来；新工具按 §3.5 的两个 compose 单元发布
    （旧稿「`infra → ai → backend → web` 四段顺序」已被 §9.8 证伪，作废）。
  - 🔴 **脚本里没有 `docker tag`**：旧表述「load 后再按 compose 引用补 tag」**作废**。
    Step 5 只 `export IMAGE_TAG` 然后 `up -d --no-build backend-java`；注释里提到的
    「补 tag」并未实现，靠 compose 的 `${IMAGE_TAG:-latest}` 与本地同名镜像兜底。
  - 🔴 **镜像引用本来就不一致**：`deploy.env.example` 是 `IMAGE_NAME=passup/backend-java`，
    compose 写的是 `172.16.0.222:5000/passup/backend-java:${IMAGE_TAG:-latest}` ——
    这正是脚本那段回退的根因，也是 §3.3「前缀必须逐字等于 compose」的现实依据。
    新工具用 `docker save <完整引用> | ssh docker load` 流转，不做二次 tag。
  - **配置同步范围**：脚本 Step 4 是 `rsync -avz --delete` **整个 `docker/`**
    （排除 `deploy.env*` / `deploy.sh` / `.env.example` / `Dockerfile.dev` /
    `docker-compose.dev.yml`），并不是「只发 backend」；整目录 `--delete` 会连带删掉
    `secrets/` 里远端独有文件，与 §3.2「`secrets/` 不用 `--delete`」冲突，
    新工具按 §3.2 分目录同步。
  - **compose 合并**：脚本只用 `-f docker-compose.yml`；新工具按 §3.5
    `-f docker-compose.base.yml -f docker-compose.yml up -d`。
  - **身份与目标机**：脚本从 `deploy.env` 读 `DEPLOY_HOST=172.16.0.222` /
    `DEPLOY_USER=root`；新工具只认 `servers.json` 的 `--server <name>` + 清单 `user/key`
    + 免密 `sudo -n`（硬约束 9），私钥路径不打印。
    🔴 `DEPLOY_HOST=172.16.0.222` 是 `deploy.sh` 自己的变量，
    `172.16.0.222:5000/passup` 只是 compose 的镜像仓库前缀；**两者都不是部署目标**。
    部署目标由 `--server <name>` 决定，15:2x 用户确认为 `k2`（见 §9.6）。
  - **健康门**：脚本没有健康门与自动回滚；新工具有健康门（P3b），但**不做自动回滚** ——
    回滚是 P4 由人显式执行的 `ops rollback`（结论 C）。
- 配置来源仍是 `pass-up.backend/docker/.env` 与 `deploy.env` 的语义；
  新工具**不重新发明**一套环境变量名，只负责搬运与校验。
- **本轮边界**：对齐只跑 `--dry-run`（真实 ssh 只读预检 + 打印命令），不改远端、
  不构建、不拉起；`deploy.sh` 保留、不删、不改，对齐完成后也不在本轮停用。

## 5. 文件与阶段

```
ops/
  ── P3a 已落（2026-11-11）────────────────────────────────────
  internal/deploy/plan.go                只读计划 / 命令草案 / 与 deploy.sh 的逐条对齐 / 空视图
  internal/deploy/preflight.go           远端只读预检脚本（sh -s）与 SEC 分节解析
  internal/deploy/cli.go                 ops deploy 动词分发 / --dry-run 硬门禁 / 人读报告与 --json
  internal/deploy/deploy_test.go        只读脚本源码断言 / 门禁 / 范围子集 / 空数组 / 镜像前缀
  main.go                                commandHandler 注册 deploy 动词 + usage
  ── P3b-1 已落（2026-11-11 21:2x，真机验收见 §9.9）────────────
  internal/deploy/deploy.go              六阶段状态机 / 双锁 / 配置备份与分目录同步 /
                                        落盘流转断点续传 / 两个 compose 单元 / 150 s 健康门 /
                                        ValidateRelease（门 5 的纯函数，不落台账）
  internal/deploy/deploy_release_test.go 六道门 / 失败停点 / 断点续跑 / 连续 2 次 200 四类判定
  internal/deploy/cli.go                 release 动词 / --confirm yes / 人读与 --json 报告
  ── 以下仍是计划，当前一个文件都不存在（P3b-2 / P3b-3 / P4）─────
  internal/deploy/release.go             发版台账 append-only 读写（P3b-2，§10）
  internal/deploy/history.go             台账只读投影 / 按 server 筛选 / 空视图（P3b-2，§10.4）
  internal/deploy/rollback.go            :previous 回滚与 state.env + rollback 留痕（P4）
  web/src/features/deploy/               界面视图（按 ui.md §7 触发条件，P3b-3 再加）
```

测试已覆盖：参数白名单与 `--dry-run` 门禁、预检脚本**源码级只读断言**、
CRLF 四种探测结论、scope 子集、离线完整快照、所有数组恒 `[]`、镜像前缀逐字取自
compose、与真实 `deploy.sh` 的对齐文案。**不写会真实构建镜像的单测**；
健康门「连续 2 次 200」的判定单测仍属 P3b（本刀只打印命令、不执行健康门）。

| 阶段 | 内容 | 验收 |
| :--- | :--- | :--- |
| P3 | 预检 + 配置同步 + 构建与流转 + compose up + 健康门（按 §11.8 拆 P3b-1/2/3） | P3a：`--dry-run` 与 `deploy.sh` 逐条对齐（已验）；P3b：真实环境发布须当次明确授权，健康门失败**停在当前阶段 + 如实报告** |
| P4 | `rollback` / `ps` / `logs` + web 构建同步 | 由人**显式**执行 `ops rollback` 回滚镜像并如实说明 Flyway 单向；**不自动回滚**（结论 C） |

测试（P3a + P3b-1 已落，P3b-2 待补）：命令拼装 / 分目录同步 / `--delete` 语义只
作用于 `www` / CRLF **探测** / 阶段失败停点 / 断点续跑按大小跳过 / 健康门四类判定 /
发版号白名单 / 报告数组恒 `[]` 都已有单测（`deploy_test.go` +
`deploy_release_test.go`）。台账追加与空数组仍属 P3b-2。**不写会真实构建镜像 /
真 `compose up` / 真造故障的单测**。
🔴 **§11 已于 20:3x 拍板定稿**（19:5x 评审稿 → 9 条按推荐结论拍板，见 §11.10）：
`deploy.go` / `deploy_release_test.go` 已于 **21:2x 随 P3b-1 落地**（§9.9），
`release.go` / `history.go` / `rollback.go` 仍不存在；分批顺序见 §11.8，
**P3b-2 / P3b-3 / P4 每批次单独授权**，一句「继续」不算授权。

**本轮状态（2026-11-11 12:3x 评审通过，12:5x 代码与本地链路验收闭环，
13:5x 网络恢复后补真机验收，见 §9.3）**：
`docs/deploy-prototype.html`（分区索引 `docs/deploy-prototype-map.md`）留作交互回归基线，
判据权威仍是本分册。按 §11.10 结论 8（CLI-first 分批）更新后的阶段划分：

| 刀 | 范围 | 不做 |
| :--- | :--- | :--- |
| P3a（已落） | 只读计划 + `ops deploy --dry-run`，输出与 `deploy.sh` 人工步骤逐条对齐 | 不构建镜像、不 `compose up`、不改远端任何文件；**不落台账、不写 `state.env`** |
| **P3b-1** | CLI 主链路：六阶段状态机 + 配置备份 / 同步 + 默认构建 + 落盘流转 + 两个 compose 单元 + 150 s 健康门（§11.8） | 不发版台账、不改界面、不连真机造故障；**不自动回滚**（结论 C） |
| **P3b-2** | `ValidateRelease` + append-only 台账 + 只读发版历史 / `ops deploy releases` | 不编辑 / 删除 / 重发、**不加 `running` 起始事件**（结论 E） |
| **P3b-3** | 界面步骤进度 + 实时日志 + 第 8 个导航项 + `/api/deploy/*` | 不把发布按钮做成默认可用；此前按钮恒禁用 |
| P4 | `rollback` 追加一条 `kind=rollback` 台账事件 | 不删、不改已有台账记录 |

🔴 **每批次单独授权**（§11.8）：20:3x 的 9 条拍板**只定判据、不定开工**；
21:2x 用户授权测试环境后 P3b-1 已落地（§9.9），不带任何动词仍直接拒绝，
P3b-2 / P3b-3 / P4 与真实环境的正式发布仍要单独授权。

**P3a 范围拍板（2026-11-11，对应 §9 的待拍板项）**：

- **CLI-only**：不改 `web/`、不加第 8 个导航项、不加 `/api/deploy/*` 接口。
  §9 与 `ui.md` §7 已定「本轮不改 `web/`，界面视图按 §7 触发条件随 P3b 再加」，
  且第一刀的验收是 CLI 输出与 `deploy.sh` 逐条对齐；原型是评审基线，不是本刀交付。
- 🔴 **一个配置键都不启用**：§8 的 12 键原样留在方案里，`opsEnvKeys` /
  `retiredOpsEnvKeys` / `opsenv_test.go` 的数量断言一行不动。只读计划的参数全部来自
  `--server`（`servers.json`）、兄弟仓 compose 里真实的 `image:` 前缀、兄弟仓相对路径
  与内置默认 `/opt/passup`；这样顺带满足硬约束 5「前缀逐字等于 compose」，
  不给人一个能配错的机会。配置键等 P3b 真要构建 / 流转时再分批启用。
- **只注册一个顶层动词** `ops deploy`，且只有 `--dry-run` 可用（§2）；
  `rollback` / `ps` / `logs` / `releases` 仍不注册。

## 6. 风险与硬约束

| 风险 | 说明与对策 |
| :--- | :--- |
| 首次部署缺前置 | `/data`、`.env`、`secrets/` 未就绪时，预检必须**明确指出缺哪一项**，不要开始构建 |
| Docker 权限 | 目标用户不在 `docker` 组会 permission denied；预检先 `docker info` 探一次；必要时用清单里的 `user` + 免密 sudo |
| 多台应用服务器 | 由 `--server` 逐台发布；本期不做并行批量（锁与端口冲突都按单机设计） |
| 镜像很大 / 链路弱 | Java 镜像 1GB+；§9.7 实证 `docker save \| ssh docker load` 流转 81.3 s 被 RST 且 k2 失联，§9.8 改逐镜像 gzip 落盘 + 断点续传（651.7 MB）后成功。**默认走落盘模式**，registry / `--no-build` 只是可选加速（§3.4）；每个 load 之间看内存 / 磁盘 |
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
| 「继续」被当成发布授权 | 正式发布要一次明确授权且只对当次任务有效，不落配置、不缓存；默认拒绝仍是兜底，未过 §11.1 六道门不得进入执行段。**20:3x 结论 1 维持此口径**：操作层的 `--confirm yes` / 勾选是每次执行路径上的固定门禁，不是可缓存的授权 |
| 崩溃丢一次发布尝试 | append-only 台账只在执行结束时追加一条，则进程被 kill / 断电时「已动过远端」的尝试无痕；**结论 E（20:3x 已拍板）**：接受该代价并如实写进报告，不加 `running` 起始事件、不改 §10.4 的结果枚举 |
| 生产凭证被测试值带进现网 | §9.8 全程用全测试值配置，真 `.env` 52 键没同步 / 没打印 / 地址未核对；**结论 B（20:3x 已拍板）**：由人在首次真实发布前逐项核对 DB / Redis / MinIO 地址与凭证，结论只落在当次发布前检查项与当次任务日志，不落盘成可复用的「已核对」标记；工具不读值 / 不打印 / 不擅自同步 |
| 拍板被当成开工 / 发布授权 | 20:3x 的 9 条拍板**只定判据、不定开工**：P3b-1 / 2 / 3 每批次单独授权（§11.8），正式发布另要一次当次有效的明确授权；21:2x 用户明确授权测试环境后 P3b-1 才落地（§9.9），不带任何动词仍 rc=2 |

## 7. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| **默认逐镜像落盘 + 断点续传**（2026-11-11 §9.8 修订） | 强制走 registry / 只用 `save \| ssh load` 流转 | 同样不要求目标机访问镜像仓库，且弱链路 / 小内存机上可断点续跑、一次只 load 一个镜像；原「默认流转不落盘」在 §9.7 真机失败，降为可选快路径 |
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
| **P3b 健康门失败不自动回滚**（结论 C，20:3x 已拍板） | 把 `rollback` 提前到 P3b 一起做 | §3.6 的「失败自动回滚」与 §3.7 / §5「rollback 属 P4」自相矛盾；先停在当前阶段 + 如实报告 + 保留现场，回滚单独一刀，避免半成品回滚遇上 Flyway 单向；§3.6 的矛盾已按结论修掉 |
| **P3b 首刀仍 0 新键**（结论 F = 推荐 A，20:3x 已拍板） | 分批启用 §8 的 12 键 | P3a 已验证参数可全部来自 `--server` / 真实 compose / 内置默认；少一个能配错的机会，也不动 `opsenv_test.go` 数量断言 |
| **默认每轮构建、`--no-build` 才复用镜像**（结论 9，20:3x 已拍板） | 默认复用现成镜像、`--build` 才构建 | 保持「一键」语义与 §11.2 六阶段状态机，§2 草案参数不用改；§9.8 唯一实证（运维机现成 6 镜像）保留为**显式快路径**。三条构建链无真机证据，失败停在本机 `构建` 阶段、不碰远端，首次真实发布前人工确认 |
| **启动窗口 150 s 内置默认**（结论 D，20:3x 已拍板） | 启用 `PASS_UP_OPS_DEPLOY_HEALTH_TIMEOUT`（旧稿默认 120 s） | 与 §9.8 `run-flow.py` 的实测判据一致、与 0 新键一致；要调窗口以后走显式 CLI 参数、单开一刀 |
| **配置同步用 Go 内建 tar 流**（21:2x 落地性调整） | 依赖本机 rsync 做分目录同步 | 运维机没有 rsync；tar 流实现等价语义（`www` 先清后传 = `--delete`、`secrets` 不清且 600），不引入新依赖 / 新配置键，命令拼装单测仍锁死判据 |

## 8. 配置键（方案，未实现）

> 2026-11-07 从 [config.md](config.md) §5 移来：未实现方案不该在「现行配置」文档里
> 占一节，也不该让人照着填进 `ops.env`。

🔴 **本节是设计稿**：当前版本**没有任何代码读这些键**，写进 `ops.env` 会被
`LoadConfig()` 直接拒绝并提示「应用部署（P3–P4）方案尚未实现」（原因表见
`internal/shared/opsenv.go` 的 `retiredOpsEnvKeys`）。实现时先在 `opsEnvKeys` 登记，
再删掉本节提示；`opsenv_test.go` 会断言本节键名数量与 `retiredOpsEnvKeys` 一致，
改键表要同步两处。🔴 **2026-11-10 本轮校准未改动任何键名**（12 个键原样保留）；
**2026-11-11 借鉴发版信息同样一个键都没加**（§10.2），`opsenv_test.go` 的数量断言不动。
🔴 **2026-11-11 P3a 第一刀同样一个键都不启用**（§5）：只读预演不读 `ops.env` 里的
部署键，参数来自 `--server`、真实 compose 与内置默认；本节 12 行表格、
`retiredOpsEnvKeys` 的「尚未实现」标记、测试里 12 == 12 的断言**全部保持原样**。
「实现时先在 `opsEnvKeys` 登记」这句话从 P3b 分批启用时才开始生效。
🔴 **19:5x §11 评审稿同样一个键都没动**（推荐 A：P3b 首刀仍 0 新键）；
**20:3x 结论 F 已拍板选 A**：P3b 首批仍 0 新键，本节 12 行表格、
`retiredOpsEnvKeys` 的「尚未实现」标记、`opsenv_test.go` 的 12 == 12 断言
**全部保持原样**；结论 D 同时明确健康门窗口取 **150 s 内置默认**、
**不启用** `PASS_UP_OPS_DEPLOY_HEALTH_TIMEOUT`（本表默认 120 s 仍是设计稿值，
不是实现值）。若以后要分批启用键表，另开一刀改键表与数量断言。

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

## 9. 本轮交付与评审口径（2026-11-10；2026-11-11 补发版信息 + 评审通过）

- 交付：本文按当前代码基座校准 + `docs/deploy-prototype.html`
  （分区索引 `docs/deploy-prototype-map.md`）。原型是**交互速览 + 验收用例集**：
  **十个场景**（2026-11-11 借鉴小程序发版信息新增 `release-invalid`，同日补齐版本历史
  再增 `release-history`；19:5x 为 §11 的 P3b 评审稿再增 `p3b-review`）
  = 第一刀与后续刀的判据基线；不连远端、不发网络请求、不执行任何动作。
  原型另加「发版信息」区（线上版本号 / 更新类型 / 版本号 / 项目备注 /
  取消·上传）与只读折叠的「发版历史」区（按 server 筛选 / 成功·失败·回滚徽标 /
  模拟接口失败回空数组），以及 `card-p3b` 的要点与 **9 条拍板结论**（20:3x 定稿，§11.10）。
- 🔴 **判据权威仍是本分册**：原型与分册不一致时**改原型，不是改分册**。
  界面视图按 `ui.md` §7 触发条件再加，本轮不改 `web/`。
- 🔴 **2026-11-10 23:4x 当时没有**：注册 `ops deploy` / 回滚命令、改 `opsEnvKeys` /
  `retiredOpsEnvKeys`、写 `internal/deploy/`、改前端、连真机、构建镜像、真实发布
  （P3a 已于 12:3x 注册 `ops deploy --dry-run`，见 §9.1；其余项至今仍未做）。
- 🔴 前九个场景钉死六条口径（第 10 个 `p3b-review` 是 §11 **已拍板定稿**的静态判据快照，
  同样不改门禁）：① 第一刀只有 `--dry-run`，**没有正式发布按钮**；
  ② 预演不是执行凭证；③ 撞锁 / 构建失败 / 健康门失败 / 已有任务是运行期结果，
  不写成预演阻塞；④ 不 `down -v`、不删 `/data`、Flyway 单向且回滚后如实说明；
  ⑤ 发版信息（§10）只是元信息、**不是镜像 tag**，校验失败挡住计划、预演不落台账、
  上传恒禁用，线上版本号未采集不猜 `0`；
  ⑥ **版本历史 append-only**：预演 / 门禁阻塞不入账，过了门禁真正执行的成功 / 失败 /
  回滚都留痕，历史只读、不自动清理、失败接口回 `items: []` 不白屏（§10.4）。
- **2026-11-11 10:0x 当时两刀都仍未碰代码**（P3a 已于 12:3x 落地，见 §9.1）：
  没注册 `--release-version` / `--release-note` /
  `ops deploy releases`，没写 `internal/deploy/release.go` / `history.go`、
  没加 `GET /api/deploy/releases`、没改 `web/` / `opsEnvKeys` / `retiredOpsEnvKeys`；
  只同步了分册、原型、分区索引、`prototype-conventions.md` 清单与文档速查的口径。
- 评审通过后先落 P3a（§5），只跑真机只读对齐；**真实发布要等 P3b 单独授权**。

### 9.1 评审结论与 P3a 落地记录（2026-11-11 12:3x）

**评审通过（附条件）**，条件就是下面三条遗留项，均不阻塞第一刀代码：

1. **落地前先修事实偏差**：§3.1 锁 / §3.2 CRLF / §4 与真实 `deploy.sh` 的差异已按
   2026-11-11 实读结果修好（本轮完成）；原型 `PLAN_BASE` / `WARN_BASE` 里写死的
   「`.env` 是 CRLF」与无条件 `sed -i` 同步改成「远端探测 → 检出 CR 才归一化」，
   按 `deploy-prototype-map.md` 的约定**冲突时改原型、不改分册**。
2. **范围按 §5 拍板**：CLI-only、12 键不启用、只有一个 `--dry-run` 动词。
3. **真实发布仍不授权**：P3b 单独授权，本刀无正式发布按钮、不连生产做写动作。

**遗留项（P3b 前置，需人确认后手工处理）**：

- ✅ **拓扑已由用户确认（15:2x，本条关闭）**：
  `k1`（`cql@172.16.0.211:22`）= **备份服务器**，
  `k2`（`cql@172.16.0.212:22`）= **应用部署目标**。
  已据此把 `servers.json` 里 k2 的 `role` 从 `backup` 改成 `app`、两台 `note` 同步，
  `default` 仍是 `k1`，备份 / 监控的默认目标不受影响（改前留了 `.bak`，见 §9.6）。
  🔴 **旧推断作废**：13:5x 曾据 `deploy.env.example` 的 `DEPLOY_HOST=172.16.0.222`
  与 compose 前缀推断「真实应用主机 172.16.0.222 未登记」；实测
  `172.16.0.222:2221` 的 `hostname=DESKTOP-KMO5NDN` / `172.30.147.179`
  与运维机本机 WSL2 完全相同，是宿主机 LAN IP + 2221 转发，不是独立服务器。
  `172.16.0.222:5000/passup` 只是**镜像仓库前缀**，`PG_SSH_HOST/PORT` 是备份脚本
  从备份机连主服务器的参数，都与「部署到哪台机器」无关。
  **`ops deploy --server k2` 直连本来就成立**（清单条目一直在），
  不需要登记 222、不需要搬运密钥；此前「直连不成立」只针对 2221 那个入口。
- ✅ **14:1x 提议 → 15:2x 正式确认以 `k2` 为目标**：`--server k2` 天然可用，
  14:1x 已跑通只读预演（§9.4）、14:4x 已装好 Docker（§9.5）。
  🔴 但两条门槛没变：P3b 的构建 / 流转 / 拉起 / 健康门**未实现且未授权**；
  配置前置（`/opt/passup`、`.env`、`secrets/`、compose、镜像）仍全缺。
  现阶段「部署到 k2」只能等于「以 k2 为目标跑只读预演」。
- 🔴 **身份口径**：`deploy.sh` 用 `DEPLOY_USER=root` 直连，本仓统一清单
  `user/key` + 免密 `sudo -n`（硬约束 9）。k2 上 `sudo -n true` 已验证可用、
  14:4x 装 Docker 后 `cql` 已在 docker 组（新会话 `docker info` 拿到 29.9.3）。
  13:5x 在 2221 上用 k1 凭据 `docker info` 拿到 29.7.2 只是跳板实测，
  **不再是登记前置**。
- **CRLF 远端实测值（13:5x 采集，结论「文件不存在」）**：k1、k2 与 2221 的
  只读探测都回 `env=missing` / `env_cr=—`，报告按 §3.2 显示「文件不存在（不猜）」，
  **没有把本机 LF 的检出结果冒充远端结论**。等部署前置 `/opt/passup/docker/.env`
  就绪后再跑一次才能给出 LF / CRLF 实测值。

### 9.2 P3a 只读预演验收记录（2026-11-11 12:5x）

**已真跑通过**（本机 Windows + WSL Ubuntu-24.04，均为只读）：

| 项 | 命令 / 判据 | 结果 |
| :--- | :--- | :--- |
| 硬门禁 | `ops deploy all --server k1`（不带 `--dry-run`） | rc=2，直接拒绝并说明「没有生成计划、没有连接远端」 |
| 离线完整快照 | `ops deploy all --server k1 --dry-run` | ssh exit 255 → `collected=false`、九项检查值恒 `—`、rc=1；人读报告仍打印对齐表 / 命令草案 / 影响清单 |
| `--json` 契约 | `ops deploy infra --server k2 --dry-run --json` | `collected=false` / `available=false` / 9 checks / 4 commands / 1 blocker；数组恒 `[]`，退出码与人读路径同为 1 |
| 真实 sh 执行预检脚本 | 在 WSL 用 `sh -s` 跑 `preflightScript()` 原文（base64 传入，避开 Windows→WSL 的 stdin 换行转换） | rc=0、12 条 SEC 分节；`parsePreflight` 能吃下，输出已固化成 `TestParsePreflightRealShellSnapshot` |
| 远端零写入 | 同一轮前后探测 `/opt/passup` | 前后均 `missing`，一致；单测另有源码级只读断言锁住写动作 |
| 全量回归 | `go test ./... -count=1` | 11 个包全绿 |
| 二进制 | `go build -o ops.exe .` | 12:54 重建（此前是 11-09 旧版），界面下次启动生效 |

**顺带修掉的缺陷**：预检脚本原来用行尾锚点匹配 `ss -ltn` 的端口，而该行尾是 Peer
Address，真机上 `SEC ports` 永远采不到（WSL 实测返回空）。改成取第 4 列
`Local Address:Port` 的末段再按本项目端口白名单过滤后，真实 sh 输出
`SEC ports=:5432,:6379,:8007,:8008`；新增 `TestPreflightPortProbeUsesLocalAddress`
与真实 sh 快照 fixture 两条单测锁住，不许退回行尾锚点。

🔴 **12:5x 当时的限制**（13:5x 网络恢复后已在 §9.3 补验）：三台目标机 22 端口
全部不可达（`Test-NetConnection` 三个 `False`），`ops servers list` 里的「可达」
是 **11-06 13:35 的缓存时间戳**、不是实时探测；所以当时只对齐了代码里的真实脚本
内容，没在真实目标机上跑过预检。别把 12:5x 的本地链路读成真机结论。

全程没造故障、没真实发布、没写远端任何文件、没落台账、没写 `state.env`、
没构建镜像、没 `compose up`、没改 `web/`、没启用 §8 的任何方案键。

### 9.3 真机补验（2026-11-11 13:5x，网络恢复后）

用户告知 `172.16.0.211:22`、`172.16.0.222:2221` 恢复可达后补跑，**全部只读**。
Python socket 实测：`.211:22` OPEN、`.212:22` OPEN、`.222:2221` OPEN，
`.222:22` ConnectionRefused；用户原文 `172.16.0.2222:2221` 是笔误（该串 DNS 都解析不了）。

| 项 | 结果 |
| :--- | :--- |
| k1 真机只读预演 | `ops deploy all --server k1 --dry-run` → rc=0、`collected=true` / `available=true`、`blockers=0`；九项真实采集（docker / compose 未装、`/opt/passup` 缺失、`.env` 不存在、compose `0/3`、端口 `:80`、磁盘 `—`、线上版本号 `—`） |
| `--json` 契约 | 同一台：9 checks / 7 commands / 7 alignments / 6 impact / 12 warnings / `blockers: []`，`note` 仍带「预演通过 ≠ 可以发布」；数值没采到恒 `—`，不猜 0 |
| 远端零写入 | 跑 `--dry-run` 前后各抓一次只读快照（6 个路径 `stat` + `crontab -l` md5 + `docker ps` md5），**diff 0 处变化**；全部路径前后均 `MISSING` |
| 2221 入口只读状态（**非部署目标**） | 经 k1 跳板把 `preflightScript()` 原文 base64 传到 `cql@172.16.0.222:2221` 的 `sh -s`，rc=0 / 12 条 SEC；`docker=29.7.2`、`compose=5.4.0`、`SEC ports=:5432,:6379,:8007,:8008`、`dir=missing`、`env=missing` |
| CRLF 远端实测 | k1 与 2221 都回 `env=missing` / `env_cr=—` → 结论「文件不存在（不猜）」，**没拿本机 LF 冒充远端**；§9.1 该条待采集项关闭 |

🔴 **拓扑结论（13:5x 当时；15:2x 已确认部署目标是 k2，见 §9.6）**：
`172.16.0.222:2221` 的 `hostname` 是 `DESKTOP-KMO5NDN`、`172.30.147.179`，
与运维机本机 WSL2 **完全相同**；它是工作机宿主机的 LAN IP + 2221 转发到本机 WSL，
不是独立生产服务器，且该机 `/opt/passup` 同样不存在、容器列表是
gitea / postgres / minio / registry 等开发环境。
`backup/postgres.env` 的 `PG_SSH_HOST/PORT/USER` 与它互证，但 `PG_SSH_KEY` 指向
**备份机**上的文件、运维机没有；运维机用 k1/k2 的 key 直连 2221 对 `cql` / `root`
都是 `Permission denied (publickey)`。**没有擅自登记清单、没有搬运密钥。**

🔴 **15:2x 修正「仍未闭环」**：上面「`ops deploy` 直连应用主机不成立」的结论
只对 **2221 那个入口**成立；用户确认部署目标是 `k2` 后，`ops deploy --server k2`
本来就能直连（清单条目一直在），**不需要登记 222、不需要分发密钥**。
k1 是备份服务器，它的 `collected=true` 只证明链路与零写入，不证明应用目标就绪。
§5 的逐条对齐表已在 §4 按真实 `deploy.sh` 校正过，k1 / k2 的报告都完整打印 7 行对照。
P3b 真实发布仍需单独授权。

### 9.4 改以 k2 为目标（2026-11-11 14:1x，用户提议）

用户提议「部署到 ssh k2」。`k2` 已在清单里，`--server k2` 直接可用，本轮只做只读验证：

| 项 | 结果 |
| :--- | :--- |
| k2 只读预演 | `ops deploy all --server k2 --dry-run --json` → rc=0、`collected=true` / `available=true` / `blockers=0`；9 checks / 7 commands / 7 alignments / 12 warnings；镜像前缀仍逐字取自 compose（`172.16.0.222:5000/passup`）、远端目录内置默认 `/opt/passup` |
| 九项实况 | **8 项不合格**：Docker `—`、compose `—`、`/opt/passup` 缺失、目录不可写、`.env` 不存在、compose/Caddyfile `0/3`、端口 `—`、磁盘 `—`、线上版本号 `—`。缺前置只是 warnings、不是 blockers（第一刀不构建不发布） |
| 远端零写入 | 前后只读快照（5 路径 `stat` + `crontab -l` md5 + `docker ps` md5）**diff 0 处变化**，全部 `MISSING`、crontab 空 |
| 环境实况 | `cql@k2` / hostname `k2`；`/opt` 空、`/data` 空、**没有 docker**、无 passup 目录、crontab 空 —— 与 k1 同类的空白测试机，不是现成应用主机 |
| `ops component list --server k2`（只读） | Ubuntu 24.04 x86_64、免密 sudo OK、apt-get/curl OK、根分区 32146 MB；Docker 引擎 `missing`、compose 插件无、官方 apt 仓库未配且 `download.docker.com` 探测失败（WARN：安装可能在 `apt-get update` 失败，需 `--proxy` 或内网镜像源）；写计划 `docker install = 是`，`minio install` 被「Docker 未就绪」挡住 |

🔴 **两道门槛，都不是换目标机能绕开的**：

1. **代码层**：`ops deploy` 只有 `--dry-run`，不带它直接 rc=2 拒绝；构建镜像 /
   `docker save` 流转 / `docker load` / `compose up` / 健康门（P3b）**没有实现、也没有授权**，
   界面也没有正式发布按钮。当前工具**没有任何能改现网的发布动作**。
2. **环境层**：k2 首次部署前置全缺 —— Docker 引擎 + compose 插件、`/data`、
   `.env`、`secrets/`、compose / Caddyfile、`/opt/passup`（§3.1）。
   即便 P3b 写好了，这台机器也起不来。

**14:1x 当时没有**：改 `servers.json`、改 k2 的 `role`、执行 `component install`、
装 Docker、写远端任何文件、构建镜像、真实发布。当时 k2 的 `role=backup` 会在报告里
多一条备份机警告，不影响 `--server` 选择（15:2x 已改成 `app`，见 §9.6）。
**14:4x 已按用户「按你的建议继续」装了 Docker 引擎（唯一一次写远端），见 §9.5。**

### 9.5 k2 Docker 前置落地（2026-11-11 14:4x）

**只读先行**：`ops component install docker --server k2 --dry-run` rc=0，计划是
「卸载冲突包 → ca-certificates/curl → 官方 GPG key → deb822 docker.sources →
apt install 5 个包 → `systemctl enable --now docker` → `usermod -aG docker`」，
明确不做 hello-world、不动容器/镜像、不删 `/var/lib/docker`、不改 crontab / `backup.env`。
唯一风险是 `download.docker.com` 探测不到，只读查实：

| 探测 | 结果 |
| :--- | :--- |
| k2 直连官方 `InRelease` | `curl (35) Connection reset by peer`，http=000 |
| k2 → aliyun / tuna / ustc 的 docker-ce 镜像、`archive.ubuntu.com`、aliyun ubuntu | **全部 http=200**：有外网，只是官方域名被 reset |
| 代理 | 运维机 `127.0.0.1:7897` 在听、LAN IP `172.16.0.222`；k2 能连该端口，经它访问官方 `InRelease` 与 `gpg` 都 http=200 |
| 带 `--proxy http://172.16.0.222:7897` 复跑 `--dry-run` | 「apt 仓库可达：是」，计划不变，只剩「docker 组需重新登录」一条警告 |

**写动作（本轮唯一一次）**：
`ops component install docker --server k2 --proxy http://172.16.0.222:7897` → rc=0，
Docker **29.9.3** / Compose **v5.7.0**、`docker.service` active、`cql` 已加入 docker 组。

**装后复核**：`ops component list --server k2` → docker `ok`（29.9.3）、compose 插件 ok、
service active、用户组 ok、官方 apt 仓库 ok、根分区 31673 MB；
`ops deploy all --server k2 --dry-run --json` 九项里 **Docker / compose 两项转 ok**，
其余 7 项仍不合格（`/opt/passup` 缺失、目录不可写、`.env` 不存在、compose `0/3`、
端口 `—`、磁盘 `—`、线上版本号 `—`）——这些是**配置同步前置**，不是引擎问题。
crontab md5 与装前一致（仍为空）、`/opt/passup` 仍 `MISSING`，与安装计划承诺一致；
新 ssh 会话 `docker info` 能拿到 29.9.3，说明组变更已生效。

🔴 **剩余前置（工具不能凭空造，等人确认）**：

- `/opt/passup`、`/data` 目录（第一刀不 mkdir）；
- `docker/.env`：本机兄弟仓现成，8614 B / **52 个键**，含 DB 密码、JWT secret、
  微信支付私钥路径、豆包 API key 等生产凭证 —— 🔴 **不擅自同步、不打印值**，
  且其中的 DB / Redis / MinIO 地址是否指向 k2 要人逐项核对；
- `docker-compose.base.yml` / `docker-compose.yml` / `Caddyfile` / `secrets/` /
  `www/{client,admin}`：本机兄弟仓现成（§3.2 的同步清单），等 P3b 配置同步；
- 镜像 `172.16.0.222:5000/passup/*:<tag>`：P3b 才构建 / 流转。
- 🔴 `ops component install minio` 装的是**备份端本机 MinIO（9000）**，
  与应用栈 compose 里的 minio（8007 / 8008）不是一回事，别顺手去装。

⚠️ 已知噪音：`component list` 仍报「仓库可达性 err / 探测不到 download.docker.com」，
那是不带代理的直连探测；引擎已装好、apt 源已写入，不影响现状，
但下次 `update docker` 仍要带 `--proxy`。
P3b 真实发布依旧**未实现、未授权**。

### 9.6 拓扑确认与清单角色落地（2026-11-11 15:2x）

用户明确：**`cql@172.16.0.211:22`（k1）= 备份服务器；
`cql@172.16.0.212:22`（k2）= 应用部署目标**。这关闭了 §9.1 的第一条遗留项，
也作废了 13:5x「真实应用主机 172.16.0.222 未登记」的推断。

**配置改动**（`servers.json`，改前留 `servers.json.bak-20261111`）：

| 字段 | 改前 | 改后 |
| :--- | :--- | :--- |
| k1 `note` | 测试机（备份端，ssh 别名 k1） | 备份服务器（ssh 别名 k1） |
| k2 `role` | `backup` | **`app`** |
| k2 `note` | 测试机（备份端，ssh 别名 k2） | 应用部署目标（ssh 别名 k2） |
| `default` | `k1` | `k1`（不变） |

`role` 合法值是 `backup` / `app` / `db` / `other`（`internal/shared/servers.go` 的
`validRoles`，`docs/servers.md` 的示例里本来就有 `app`）。`default=k1` 明确指定，
不依赖「唯一 `role=backup`」的退化逻辑，所以备份 / 监控的默认目标不受影响；
`ops servers list` 已复读校验，k2 显示 `app`。

**代码改动**（`internal/deploy/cli.go`）：早期版本在备份机警告里硬编码
「真实应用主机 172.16.0.222 尚未登记（docs/deploy.md §9.1）」，`deployUsage()`
也写了同一句 —— 拓扑确认后是明确错误信息。改成纯函数
`roleWarning(name, role)`：只对 `role=backup` 出中性提示，文案不含任何硬编码 IP；
部署目标只由 `--server <name>` 决定。`deploy_test.go` 新增 `TestRoleWarning`
（`app` / `db` / `other` / 空角色不出警告，`backup` 出警告且不含 IPv4）。
`ops.exe` 15:24 重建。

**真机复核**：

- `ops deploy all --server k2 --dry-run --json` rc=0，warnings 从 12 条降到 **11**，
  备份机提示 0 条、含 222 的 0 条；Docker `29.9.3` / compose `5.7.0` 仍 ok，
  `collected=true` / `blockers=0`。
- `ops deploy all --server k1 --dry-run --json` rc=0，保留 1 条
  「role 是 backup（备份服务器）… 不是应用主机就绪结论」，同样不含 222。
- `ops deploy help` 文案同步成「k1=备份服务器、k2=应用部署目标；
  `172.16.0.222:5000/passup` 只是镜像仓库前缀」。

🔴 只改了清单角色 / note 与上面两处文案（15:2x 当时），**没动任何凭证、
没改 `sudo`、没装新东西、没写远端**；P3b 真实发布依旧未实现、未授权。

### 9.7 测试环境端到端冒烟 · 第一次（2026-11-11 16:2x，卡在镜像传输）

> 🔴 **本节是第一次尝试的失败记录，保留原貌**；16:4x k2 恢复后链路已跑通，
> 见 §9.8。下面「恢复后的改进路径」已在 §9.8 实际执行并验证。

用户授权「现在都是测试环境，随便造，目前只想把流程跑通」。本轮目标是
**手工端到端验证一次部署链路**（§3 的六段），不是实现 P3b —— 工具侧
`ops deploy` 仍然只有 `--dry-run`，不带它 rc=2，界面也没有发布按钮。

**已完成的（可复现）**：

1. 造了一份**全测试值**的独立配置 `.tmp-deploy-smoke/`（已加进 `.gitignore`）：
   52 个键名取自兄弟仓真实 `docker/.env`、但值全部替换成 `smoke_only_*` /
   容器内服务名（`postgres` / `redis` / `minio` / `ai`），**LF、无 CRLF**；
   `secrets/` 里两个微信支付 PEM 是占位文本、不是真密钥；compose 三件套、
   Caddyfile、`www/{client,admin}`、`ai/docker-compose.yml` 从兄弟仓复制。
   🔴 **兄弟仓原 `.env` 一字未动、真实凭证没有同步到 k2**。
2. k2 上 `sudo -n mkdir -p /opt/passup/{docker,ai} /data/{postgres,minio/data}`
   + `chown cql:cql`，再用 `tar czf - | ssh 'tar xzf - -C /opt/passup'` 同步，
   `SYNC_OK`，属主 `cql:cql`、`.env` 2742 B。
3. 本机 `docker compose -f docker-compose.base.yml -f docker-compose.yml
   --env-file .env config --quiet` rc=0，解析出的 5 个镜像
   （`backend-java:latest` / `caddy:2.11.1` / `postgres:18` / `redis:7` /
   quay.io minio）与 ai 的 `ai:latest` 正好是流转清单。
4. 镜像**不需要构建**：运维机 Docker Desktop / WSL 里这 6 个镜像现成
   （`backend-java:latest` 896 MB、`ai:latest` 298 MB），可直接 `docker save`。

🔴 **失败点**：按 §3.4 的「流转不落盘」跑
`docker save <6 镜像> | ssh k2 'docker load'`，**81.3 s 后**
`Read from remote host 172.16.0.212: Connection reset by peer`，
远端 `docker load` rc=255、本机 `docker save` rc=0。紧接着 k2 **整机失联**：
本机 TCP 22 超时、从 k1 `ping` 100% 丢包、`ip neigh` 显示 `FAILED`，
而 k1(`172.16.0.211:22`) 与 `172.16.0.222:2221` 同期正常；16:33 复查仍超时。

- 时间点与大流量 `docker load` 重合，但**没拿到 k2 的 dmesg / OOM 日志，
  没有证据确定因果**，不写「是 load 把机器打挂了」，只记录现象。
- 🔴 **本次流程没有跑通**：`compose up`、健康门、真实发布**全都没执行**，
  `ops deploy --server k2 --dry-run` 在 k2 失联后回 `collected=false` + rc=1
  （完整九项快照，值恒 `—`），符合离线红线。不假装成功。

**恢复后的改进路径**：已把 6 个镜像逐个 `docker save | gzip -1` 成本地
tar.gz（合计 **651.7 MB**，原来约 2 GB），并写好可断点续跑的
`.tmp-deploy-smoke/run-flow.py`：k2 回来后跑
`python .tmp-deploy-smoke/run-flow.py`，会自动检查可达性 → 按远端大小跳过
已传完的文件 → 逐个传输 + `gunzip -c ... | docker load` → 每个 load 后打印
内存/磁盘 → `compose up`（backend+infra+web，再 ai）→ 三个健康门连续 2 次 200。
🔴 脚本在 k2 不通时直接退出、不做任何动作；任何一步失败都停在失败阶段，
不写「部署成功」。
🔴 这条实证要回喂 P3b：§3.4 的「`docker save | ssh docker load` 流转不落盘」
在弱链路 / 小内存目标机上不稳，实现时**应同时提供落盘 + 断点续传模式**，
并且一次只 load 一个镜像、每个之间看资源余量。

### 9.8 恢复后链路跑通 + 部署文档落地性确认（2026-11-11 16:4x–17:0x）

> 🔴 本节是**手工冒烟**的结论，不是工具发布：`ops deploy` 仍只有 `--dry-run`，
> P3b / P4 未实现、未授权。全链路用**全测试值** `.tmp-deploy-smoke/`，
> 兄弟仓真实 `.env` 一字未动、真凭证没有上 k2。§9.7 的失败记录保留原貌，
> k2 是怎么恢复的、上次失联的原因**没有取证**（没拿到 dmesg / OOM 日志），不断言因果。

**续跑做法**：k2 恢复后执行 `python .tmp-deploy-smoke/run-flow.py`，
改走「本机逐镜像 `docker save | gzip -1` 落盘（6 个 tar.gz，**651.7 MB**，
原约 2 GB）→ 逐个 `cat >` 传到 `/opt/passup/.images`，按远端大小跳过已传完的
→ 逐个 `gunzip -c ... | docker load`，每个 load 后打印内存 / 磁盘 →
`compose up`（backend+infra+web 合并视图，再 ai）→ 三个健康门」。
脚本每一步可断点续跑、任何一步失败都停在失败阶段，k2 不通时直接退出不动作。

**本次（17:0x）在 k2 上重新复核的实测值**：

| 项 | 实测 |
| :--- | :--- |
| 容器 | `backend-java` / `ai` / `postgres` / `frontend-web` / `redis` / `minio` **6 个 Running** |
| 健康门 | `8009/actuator/health/readiness` = **200**、`8006/resume/health` = **200**、`80/` = **200** |
| 镜像 | 6 个引用与 compose 的 `image:` **逐字一致**，没有 `docker tag` 绕路 |
| 暂存 | `/opt/passup/.images/` 6 个 tar.gz 齐全，可重传、可由发布流程成功后清理 |
| 身份 / 写入 | 清单 `user` + 免密 `sudo -n`；没写 crontab、没写 `backup.env`、没写真实凭证 |

🔴 表中健康门是本次 17:0x 的**单次复核**；`run-flow.py` 的正式判据仍是
「150 s 启动窗口内每轮连续 2 次 200」，两者不矛盾。
🔴 `run-flow.py` 是**一次性冒烟脚本**，不是产品代码；本轮没写台账、没走远端锁、
没做配置备份 / rsync、没构建镜像、没执行回滚、没接界面。

**「部署文档是否可以落地」逐条核对**（判据 = 有没有真机证据，不是文档写没写）：

| §3 段 | 方案口径 | 本轮真机证据 | 结论 |
| :--- | :--- | :--- | :--- |
| 3.1 预检 | 远端只读探测 + 加锁 | P3a 的九项只读 `--dry-run` 在 k1 / k2 跑过（§9.2 / §9.3 / §9.6）；**加锁从未执行** | 只读部分可落地；锁仍待 P3b |
| 3.2 备份 + 同步 | 备份 `.env` 到 `.deploy/backup/<ts>`、rsync 两处、远端 CRLF 探测 | 手工 `tar czf - \| ssh tar xzf -` 一次同步**测试值**配置；没建备份目录、没跑 rsync、没跑归一化 | 仍是方案，未验证 |
| 3.3 构建 | backend / ai `docker build` + web `pnpm build` | **没构建**：运维机 Docker Desktop 已有 6 个现成镜像，直接 save/load | 本轮跳过，未验证 |
| 3.4 传输 | 默认「流转不落盘」 | ❌ §9.7：81.3 s 后 RST + k2 失联；✅ §9.8：落盘 + 分批 + 断点续传后 651.7 MB 全到位 | **原默认口径被证伪**，已按 §3.4 修订 |
| 3.5 拉起 | `infra → ai → backend → web` 四段 | 实际是 backend/infra/web 合并 compose 一次 `up -d` + ai 单独 compose，6 容器 Running | 结果达标；**顺序口径与真实 compose 结构不符**，已按 §3.5 修订 |
| 3.6 健康门 | 三个 URL 连续 2 次 200 | 三个 200 全绿；ai 首次立刻查是 `000`、约 30 s 后才好 | 判据成立；**必须补启动窗口**，已按 §3.6 修订 |
| 3.7 回滚 | `:previous` + `ops rollback` | 没执行 | 未验证、未实现（P4） |
| §10 发版 / 台账 | append-only 事件流、只读历史 | 没执行（代码零改动） | 未验证 |

**结论（可以落地，但带四条限制）**：

1. **主链路可落地**：配置就位 + 镜像以「落盘分批」方式送达后，`compose up` +
   健康门在 k2 真机跑通，§3.5 / §3.6 的判据成立，**不需要目标机访问镜像仓库**。
2. **文档原样不能直接照抄进代码**：§3.4 默认流转、§3.5 四段顺序、§3.6 缺启动窗口
   三处已被实证纠正；§6 风险表与 §7 决策表同步回喂，别再按旧口径实现。
3. **一半流程仍无真机证据**：预检加锁、配置备份 / rsync、构建、回滚、发版台账
   都只是方案；且本轮用的是**全测试值**配置，生产 `.env` 的 52 键（含 DB 密码 /
   JWT secret / 微信支付私钥路径 / 豆包 API key）**没有同步、没有打印、地址未核对**。
4. 🔴 **确认可落地 ≠ 授权发布**：P3b 真实发布 / P4 回滚仍要单独授权，
   工具侧不带 `--dry-run` 的 `ops deploy` 依旧 rc=2 拒绝，界面没有发布按钮。

### 9.9 P3b-1 CLI 主链路落地 + 测试环境真机验收（2026-11-11 21:2x）

> 🔴 用户口径：「目前是测试环境，随便弄，无需授权，流程跑通最重要，跑通了没问题才敢上正式」。
> 本节的「跑通」是**测试环境冒烟**，不是正式发布：生产 `.env` 52 键一字未动、
> 没碰清单里的 `prod`、没上任何真实业务镜像、没写发版台账、没启用配置键。

**目标机选择（当前网络与 §9.6 的旧拓扑不同）**：文档里的 k2（`172.16.0.212`）、
ssh 别名 k1 / k2（`192.168.1.201/202`）现在都超时不可达；清单里的 `prod`
（`192.168.1.221:2226`，hostname `ASUS-PC`）跑着 postgres / minio / redis /
cqlql-notes / registry 等业务容器，**不拿来写**。选清单内的 `k4`
（`192.168.1.204`，role=backup）：免密 sudo、Docker 29.9.3 / compose 5.7.0、
应用端口 80 / 8006 / 8009 / 5432 / 6379 / 8007 / 8008 全空闲、磁盘约 15 GB 可用。
🔴 用备份机做测试目标只因它安全可达；别把结果读成「应用主机就绪」。

**代码（0 新键、`web/` 一行未动）**：`internal/deploy/deploy.go`（六阶段状态机 /
双锁 / 配置备份 / 分目录同步 / 落盘流转断点续传 / 两个 compose 单元 / 150 s 健康门 /
可注入 Runner）、`deploy_release_test.go`（20 项判据，全 fake，不真构建 / 真 `up` /
真造故障）、`cli.go`（`release` 动词 + `--confirm yes` 门禁 + 人读与 `--json` 报告）、
`main.go`（usage）。`go test ./...` 11 包全绿。

**测试值准备**：`.tmp-deploy-smoke/`（gitignore，全测试值）造最小冒烟栈 ——
`nginx:1.27-alpine` 起 3 个容器（80 / 8009 / 8006，`nginx.conf` 对任意路径回 200），
两个 compose 单元（合并视图 + ai 独立 external 网络）；假 `.env` / `secrets/fake.pem` /
`www/` / `Caddyfile`。k4 上预置 `/opt/passup/{docker,ai,.deploy,.images}` 与 `/data`
（sudo -n 建目录后 chown 给清单 user），并把同一份测试值配置用 tar 流预置到远端
（门 3 会在同步前点名缺项，所以首次前置仍由人准备，工具不擅自造）。

**命令**（`ops-p3b1.exe`，`go build -o` 生成，未覆盖运行中的 `ops.exe`）：

```
ops-p3b1.exe deploy release --server k4 --confirm yes \
  --config-dir .tmp-deploy-smoke/docker --ai-config-dir .tmp-deploy-smoke/ai \
  --release-version 1.0.0 --release-note "P3b-1 测试环境冒烟" \
  --image-prefix 192.168.1.221:5000/passup --image-tag latest --no-build --json
```

**结果**：rc=0；三道运行期门禁（只读预检门 / 双锁 / 发布前留退路）全过；
六阶段 `预检 → 配置同步 → 构建(跳过) → 传输 → 拉起 → 健康门` 全部通过；
`nginx:1.27-alpine` 落盘 **21,129,659 B** → 上传 → `docker load` →
两个 compose `up -d` → 3 容器 Running → 三个 URL 各**连续 2 次 200**。
远端复核：`.images/` 已按本次清单清空（没 `rm -rf` 目录）、
`.deploy/backup/<ts>/` 留下 4 个配置文件、`secrets/fake.pem` 权限 `600`、
`www/client/index.html` 已同步。随后两次完整复跑 rc=0，验证 `up -d` 幂等。

**失败语义实证**：

- 门 3 注入：临时移走远端 `.env` → rc=1、`failed_stage=预检`、
  错误点名「缺前置：远端 docker/.env 不存在」，只跑了预检一个阶段；随后恢复。
- 第二次跑在 CRLF 只读探测那条 ssh 上遇到一次 **exit 255 瞬时超时**
  （`Timeout, server ... not responding`）→ 停在 `配置同步`、rc=1、如实报告，
  没假装成功、没跨阶段自动修复；紧接着两次复跑 rc=0 全绿，**未稳定复现**。
  🔴 没有为此加自动重试：重试会掩盖弱链路，还会让 `cat >` / `docker load`
  这类写命令被重复执行；要补可靠性应另开一刀做「可重入命令 + 明确重试预算」。

**落地性调整（回喂 §3 / §7）**：本机没有 rsync，配置同步改用 **Go 内建 tar 流**
实现等价的分目录语义（`www` 先清后传 = `--delete`、`secrets` 不清且 `chmod 600`、
`.env` / compose / Caddyfile / nginx.conf 覆盖），命令拼装单测仍锁死判据；
`ValidateRelease` 作为门 5 的纯函数落在 `deploy.go`，台账文件仍不写。

🔴 **仍未验证 / 未做**：三条构建链（本次按结论 9 的 `--no-build` 显式快路径跳过）、
真实 6 容器业务栈（用的是最小冒烟栈）、生产 `.env` 52 键人工核对、
发版台账 / 只读历史（P3b-2）、界面步骤进度与 `/api/deploy/*`（P3b-3）、
`rollback`（P4）。**正式发布仍未授权**，界面「上传 / 正式发布」按钮恒禁用。

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

### 10.5 本轮边界（2026-11-11 10:0x 当时口径）

当时只改 `docs/deploy.md`（§2 / §3.7 / §5 / §6 / §7 / §9 / §10 含新增 §10.4）与
`docs/deploy-prototype.html`，并同步分区索引、`prototype-conventions.md` 清单、
`docs/ui.md` 的原型指针与 `AGENTS.md` 文档速查口径。**当时没有**：注册命令、写
`internal/deploy/release.go` / `history.go`、加 `GET /api/deploy/releases`、创建
`deploy-releases.jsonl`、改 `web/`、改 `opsEnvKeys`、连真机、构建镜像、真实发布。
🔴 **12:3x 起 P3a 已注册 `ops deploy --dry-run`**（CLI-only，见 §5 / §9.1），
但上述发版台账 / 历史接口 / 界面 / 配置键**至今仍一行未动**，
评审通过后的发版信息部分随 P3b 一起落地；若要把版本号接进镜像 tag，另开决策
（本方案明确否掉，理由见 §7）。

## 11. P3b 实现方案（已拍板定稿 · 2026-11-11 20:3x）

> ✅ **本节已于 2026-11-11 20:3x 拍板定稿**：§11.10 的 9 条待拍板按推荐结论逐条拍板，
> 结论已回写 §2 / §3.3 / §3.4 / §3.6 / §5 阶段划分 / §6 / §7 / §8 与
> `docs/deploy-prototype.html`（第 10 个场景 `p3b-review` + `card-p3b`）。
> 🔴 **定稿 ≠ 开工 ≠ 发布**：本刀**仍只改文档与原型**，代码零改动 ——
> `ops deploy` 仍只有 `--dry-run`、不带它仍 rc=2；没新增 / 启用任何配置键、
> 没加接口 / 导航项 / 台账文件、没连真机、没真实发布。
> 🔴 **P3b-1 / 2 / 3 每批次单独授权**（§11.8），正式发布另要一次当次有效的明确授权；
> 一句「继续」不算授权。
> ✅ **21:2x 状态更新**：用户已明确授权测试环境开工，P3b-1 落地并真机验收（§9.9）；
> P3b-2 / P3b-3 / P4 仍需单独授权，正式发布仍未授权。判据权威仍是 §3 / §5 / §9 / §10，
> **本节与既有判据冲突处以拍板结论为准**（结论 C 已修 §3.6 的自动回滚矛盾）。
> 输入是 §9.7 / §9.8 的手工冒烟实证与四条限制，不是照抄 §3 旧稿 ——
> §9.8 结论 2 已明确「文档不能原样照抄进代码」。

### 11.1 授权链与门禁

| # | 门 | 位置 | 判据 | 没过时 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 显式发布动词 | CLI / 服务端 | 只带 `--dry-run` = 只读预演；正式发布要一个独立的显式动词与确认标志 | 默认走预演或直接拒绝，不生成写计划 |
| 2 | 二次确认 | 界面 / CLI | 输 `yes` + 勾选确认（CLI 为 `--confirm yes`），**服务端逐字再验** | 不发请求、不写远端 |
| 3 | 只读预检门 | 服务端 | P3a 九项只读预检逐项过；缺 `/data` / `.env` / `secrets/` 要**明确指出缺哪一项** | 不开始构建、不开始同步（§3.1 / §6） |
| 4 | 双锁 | 本机 + 远端 | 界面唯一后台任务锁 + 远端 `flock -n /opt/passup/.deploy/lock`，拿不到立刻失败、不排队 | 409 / 撞锁是**运行期结果**，不写成预演阻塞 |
| 5 | `ValidateRelease` | 服务端 | 版本号白名单逐字再验、备注单行转义、**不拼进任何命令**；线上版本未采集不猜 0 | 校验失败挡住计划生成（§10.3） |
| 6 | 发布前留退路 | 执行第一段 | 配置备份到 `.deploy/backup/<ts>/` + 记录当前镜像 tag 为 `:previous` | 没备份成功就不往下走 |

- 🔴 **一句「继续」不算授权**（§9.1 条件 3 / §9.8 结论 4）：正式发布要一次明确授权，
  授权只在**当次任务**有效 —— 不落盘成配置、不写进 `ops.env`、不变成「授权过一次以后就能发」。
- ✅ **结论 1（20:3x 拍板）**：授权形态就按「**一次明确指令 + 当次有效**」，
  不加更严的授权串、也不把授权落盘；本节的 `yes` + 勾选 / CLI `--confirm yes`
  是**每次执行路径上的固定门禁**（门 2，服务端逐字再验），不是可缓存的授权。
  理由：把授权做成可复用状态，反而会演变成「授权过一次以后就能发」。
- 🔴 **默认拒绝仍是兜底**：即使 P3b 代码落地，缺少 1/2/3/5 任一项都不得进入执行段；
  `--dry-run` 报告固定带「本次仅预演、未改动远端」，**预演通过 ≠ 可以发布**。
- 🔴 第 4 道门的远端锁**只在正式发布路径拿**（§3.1）：P3a 只读预演不拿锁、
  不 `mkdir -p`、不 `touch`、不写 `state.env`，否则「零写入」验收（§9.3 diff 0）就失效。

### 11.2 阶段状态机与失败语义

| 阶段 | 写远端 | 失败阶段名 | 可续跑点 | §9.8 真机证据 |
| :--- | :--- | :--- | :--- | :--- |
| ① 预检（只读） | 否 | `预检` | — | P3a 九项只读在 k1 / k2 跑过（§9.3 / §9.6）；**加锁从未执行** |
| ② 配置备份 + 同步 | 是 | `配置同步` | 每轮一个 `<ts>` 备份目录；rsync 可重跑 | 手工 `tar czf - \| ssh tar xzf -` 一次同步**测试值**；没建备份目录、没跑 rsync、没跑 CRLF 归一化 |
| ③ 构建 | 否（本机） | `构建` | 复用已有镜像 / 断点续构建 | **没构建**：用运维机现成 6 镜像 |
| ④ 流转 | 是 | `传输` | 按远端文件大小跳过已传完的 tar.gz | 落盘 651.7 MB 全部到位；不落盘流转失败（§9.7） |
| ⑤ 拉起 | 是 | `拉起` | 重复 `up -d` 幂等 | 两个 compose 单元，6 容器 Running |
| ⑥ 健康门 | 否（只读） | `健康门` | 重新轮询，不重启服务 | 三个 URL 各 200；ai 约 30 s 才就绪 |

- 🔴 **失败一律停在当前阶段**：不跨阶段自动修复、不写「部署成功 / 服务已恢复正常」；
  报告只报脚本结果、失败阶段与日志尾部（§3.6 / §10.2）。
- 🔴 **台账入账界线是「有没有真正开始执行」**：预演 / 校验失败 / 预检 / 撞锁 / 409
  一律不入账；成功、失败都留一条，回滚另追加 `kind=rollback` 不改旧记录（§10.4）。
- 阶段 ② 是**唯一一段仍完全无真机证据的写动作**，且它碰的是配置与凭证：
  P3b 首刀应先补这段的只读计划与真机演练，再谈自动发布。

### 11.3 流转：默认落盘 + 断点续传（§9.7 / §9.8 实证口径）

1. 本机逐镜像 `docker save <完整引用> | gzip -1 > <name>.tar.gz`，**一次只出一个文件**；
2. 逐个传到 `/opt/passup/.images`，传前比对远端大小，已完整的**直接跳过**（断点续跑）；
3. 逐个 `gunzip -c <file> | docker load`，**一次只 load 一个镜像**；
4. 每个 load 后采集内存 / 磁盘余量并写进任务日志，余量不足立即停在 `传输` 阶段；
5. 成功后**按本次清单删除这 6 个 tar.gz 文件**，不 `rm -rf` 整个暂存目录（§3.4）；
6. 「流转不落盘」与 registry 只保留为**可选快路径**，默认不变（§7 决策表）。

- 🔴 与 compose 的 `image:` **逐字一致**，不做 `docker tag` 绕路（§4 已按真实
  `deploy.sh` 校正：脚本里没有 `docker tag`）。
- 🔴 §9.7 的 `81.3 s` RST + k2 失联**没拿到 dmesg / OOM 证据**，不断言因果；
  但「每步看余量 + 一次只 load 一个」是实现里必须保留的保守判据。
- ✅ **结论 A（20:3x 拍板）**：**成功即删、失败保留由人清** —— 成功后按本次清单
  逐个删除 6 个 tar.gz（不 `rm -rf` 暂存目录）；失败时**保留现场供排障**，
  不设 N 小时定时清理、不引入新配置键，由人决定何时清。
  理由：「保留 N 小时」要定时器 + 新键（与结论 F 的 0 新键冲突），
  自动清理还会毁掉结论 C 要求保留的失败现场。

### 11.4 配置备份 + 同步（真机证据缺口最大）

- 备份：远端现有 `.env` / compose / `Caddyfile` → `/opt/passup/.deploy/backup/<ts>/`，
  每轮新时间戳，**不覆盖上一份**；备份没成功就不进入 rsync。
- 同步：按 §3.2 **分目录** rsync —— `docker/www/` 用 `--delete`（纯构建产物），
  `secrets/` **不用** `--delete`、权限 `600`、内容不打印；不照抄 `deploy.sh` Step 4
  的整目录 `rsync --delete`（会连带删掉远端独有的 secrets 文件，§4）。
- CRLF：先对**远端** `.env` 做只读换行探测，结论（检出 CR / 未检出 / 文件不存在）
  写进报告；**只在检出 CR 时**归一化。本机 LF 不作判据（§3.2）。
- 🔴 **生产 `.env` 52 键**（含 DB 密码 / JWT secret / 微信支付私钥路径 / 豆包 API key）
  在 §9.8 全程**没同步、没打印、地址未核对**；P3b 首次发布前必须人工核对
  DB / Redis / MinIO 地址与凭证，**工具不擅自造、不擅自同步、不把测试值带进现网**。
- ✅ **结论 B（20:3x 拍板）**：由**人（发布人）**在首次真实发布前逐项核对
  DB / Redis / MinIO 地址与凭证；结论只落在**当次发布前检查项 + 当次任务日志 / 报告**，
  不落盘成可复用的「已核对」标记、不写进配置、不做人工签字流程。
  工具只把「生产 `.env` 52 键未核对」列为一条明确的发布前检查项，
  **不读值 / 不打印 / 不擅自同步 / 不自动放行**。理由：核对结论一旦落盘，
  就变成一次性授权被永久复用，与结论 1「当次有效」冲突。

### 11.5 拉起与健康门（按 §3.5 / §3.6 修订口径）

- 拉起单位是**两个 compose 单元**：backend / infra / web 在
  `-f docker-compose.base.yml -f docker-compose.yml` 合并视图里一次 `up -d`，
  ai 是独立 compose（`passup-network` 为 external）单独 `up -d`；
  先合并视图、再 ai。🔴 旧稿 `infra → ai → backend → web` 四段顺序已作废，
  §2 / §4 里残留的这行文字本轮同步改掉，别据此拆 `up` 命令。
- 不 `down -v`、不删 `/data`、默认不加 `--remove-orphans`。
- 健康门：`8009/actuator/health/readiness`、`8006/resume/health`、`80/`，
  在**启动窗口内每 5 s 轮询、必须连续 2 次 200** 才算过；`compose up -d` 返回
  只代表容器起来了，ai 首次立刻查是 `000`、约 30 s 后才 200（§9.8）。
- 判定单测四类：200 / 404 / 超时 /「第一次 200、第二次失败」；**不写真构建、
  真 `compose up`、真造故障的单测**（§5 红线）。
- ✅ **结论 C（20:3x 拍板，采纳建议）**：**P3b 健康门失败不自动回滚** ——
  只停在当前阶段 + 如实报告 + 保留现场；`ops rollback` 仍属 **P4**。
  §3.6 的「失败 → 自动回滚到 `:previous` 并重建」与 §3.7 / §5 的自相矛盾
  已按本结论修掉；Flyway 单向、「镜像已回滚但服务可能起不来，需要前向修复」
  的口径不变。半成品回滚遇上单向 schema 只会把现场弄得更乱。
- ✅ **结论 D（20:3x 拍板，采纳建议）**：启动窗口统一 **150 s 内置默认**
  （§9.8 `run-flow.py` 的实测判据），**不启用** `PASS_UP_OPS_DEPLOY_HEALTH_TIMEOUT`
  方案键（§8 的 12 键与 `opsenv_test.go` 数量断言原样不动）；
  与结论 F 的 0 新键一致。以后要调窗口走显式 CLI 参数、单开一刀。

### 11.6 发版信息与台账入账点

- `--release-version` / `--release-note` 仍是**草案参数**，随 P3b 才接受；
  服务端 `ValidateRelease` 是唯一判据，前端只做格式提示（§10.3）。
  发版号只是人读元信息，**不是镜像 tag**（`IMAGE_TAG` 仍是 git 短 commit，§7）。
- 台账：过完 §11.1 的门、**真正开始执行后**才可能有记录；结束时追加一条
  `kind=release`（成功 / 失败，失败带 `failed_stage`），回滚另记 `kind=rollback`。
  远端 `state.env` 只留**当前** `RELEASE_VERSION`，不是历史源（§10.4）。
- ✅ **结论 E（20:3x 拍板，按建议 ①）**：**接受「崩溃丢一次发布尝试」** ——
  只在执行结束时追加一条，进程被 kill / 断电时「已动过远端」的尝试可能无痕，
  这个代价要在报告里如实写明；**不加 `result=running` 起始事件**，
  不扩 `RESULT_LABEL` 的成功 / 失败 / 回滚三枚举、不扩徽标、不改原型静态数据。
  理由：② 要改 §10.4 已评审过的字段与枚举，还会引入需要清理的半成品记录。
- 只读 `GET /api/deploy/releases` 与 `ops deploy releases` 仍属 P3b 后半段；
  失败响应恒回 `ok=true` + `data.error` + **`items: []`**（§10.4.2 白屏红线）。

### 11.7 配置键：P3b 首刀仍 0 新键（结论 F 已拍板选 A）

| 方案 | 做法 | 代价 |
| :--- | :--- | :--- |
| **A（推荐 · 20:3x 已拍板选 A）** | 沿用 P3a：参数来自 `--server`、真实 compose 前缀、兄弟仓相对路径与内置默认；健康门窗口 / 目录等取内置常量，或用显式 CLI 参数 | 想调超时得改代码或加参数；但**少一个能配错的机会** |
| B | 分批启用 §8 的 12 键（如 `DEPLOY_DIR` / `HEALTH_TIMEOUT`） | 要同步 `opsEnvKeys` / `retiredOpsEnvKeys` / `opsenv_test.go` 数量断言，且方案键一启用就要写进现行 `config.md` |

- 🔴 推荐 A 的理由：P3a 已用零新键跑通只读预演（§5 / §9.1）；
  52 键生产凭证不进 `ops.env`，配置越少年夜越安全。若评审要 B，
  **必须单开一刀**改键表与测试断言，本轮一个键都不动。
- ✅ **结论 F（20:3x 拍板）**：选 **A（0 新键）**。§8 的 12 键原样、
  `opsEnvKeys` / `retiredOpsEnvKeys` / `opsenv_test.go` 的 12 == 12 断言一行不动；
  结论 D 的 150 s 窗口也取内置常量。若以后要选 B，**另开一刀**改键表与数量断言。

### 11.8 文件与测试计划（分批，不是一次摊完）

| 批次 | 文件（§5 计划树） | 单测 | 不做 |
| :--- | :--- | :--- | :--- |
| P3b-1 ✅ 21:2x 已落（§9.9） | `deploy.go`：阶段状态机 + 落盘流转 + 两个 compose 单元 + 健康门判定 | 阶段失败停点、断点续跑按大小跳过、连续 2 次 200 四类判定、命令拼装 | 不发版台账、不改界面、不连真机造故障 |
| P3b-2 | `release.go` / `history.go`：`ValidateRelease` + append-only 台账 + 只读投影 | 白名单、备注转义、空数组恒 `[]`、按 server 筛选、追加不覆盖 | 不做编辑 / 删除 / 重发、不自动清理 |
| P3b-3 | 界面步骤进度与实时日志 + `POST /api/deploy/*` + 第 8 个导航项 | 门禁 401/400/409、任务锁、报告如实 | 不把发布按钮做成默认可用 |
| P4 | `rollback.go`：`:previous` + `kind=rollback` 留痕 | 回滚不改旧记录、Flyway 单向文案 | 不改台账旧行 |

🔴 每批次**单独授权**；P3b-1 落地前，不带 `--dry-run` 仍然直接拒绝。
🔴 `deploy.go` / `release.go` / `history.go` / `rollback.go` **当前一个文件都不存在**，
§5 的文件树是计划，不是现状。
- ✅ **结论 8（20:3x 拍板）**：范围维持 **CLI-first**，P3b 就按上表的
  **P3b-1 / P3b-2 / P3b-3** 三批走，界面步骤进度 / 实时日志 / 第 8 个导航项 /
  `/api/deploy/*` 全部归 P3b-3；P3b-3 之前正式发布按钮恒禁用。
- ✅ **结论 9（20:3x 拍板）**：**默认每轮构建**（阶段 ③ 是主链路的一环），
  显式 `--no-build` 才复用现成镜像（§9.8 的实证快路径）；
  构建失败停在 `构建` 阶段、不碰远端。🔴 这是 9 条里**唯一无真机证据**的一条：
  三条构建链没跑过，首次真实发布前必须人工确认本机构建链可用。

### 11.9 验收用例集与真机证据缺口

| 环节 | 现有证据 | 缺口 | 由哪刀补 |
| :--- | :--- | :--- | :--- |
| 只读预演 / 零写入 | k1（§9.3）/ k2（§9.6）diff 0 | — | 已闭环 |
| 主链路（落盘 → up → 健康门） | §9.8 手工 6 容器；§9.9 工具侧 k4 测试环境 rc=0 | 真实业务 6 容器栈未跑（用最小冒烟栈） | ✅ P3b-1 已验（测试值最小栈） |
| 预检加锁 | §9.9：远端 `flock -n` + 本地单例均通过 | 并发撞锁未真造 | ✅ P3b-1 已验 |
| 配置备份 / 分目录同步 / CRLF | §9.9：备份目录 4 文件、secrets 600、远端探测 LF 不归一化 | 本机无 rsync（改 Go tar 流）；检出 CR 的归一化路径未真跑 | ✅ P3b-1 部分已验 |
| 构建 | 命令拼装 + 构建失败停点单测已锁 | 三条构建链无真机证据（本次 `--no-build` 快路径跳过） | 首次真实发布前人工确认 |
| 失败停点 / 断点续跑 / 健康门四判据 | §9.9：门 3 点名缺项、ssh 255 停在配置同步；单测锁死按大小跳过与 200/404/超时/先好后坏 | 真机断点续跑未造（成功后按清单清理） | ✅ 单测已闭环 |
| 回滚 / 台账 / 只读历史 | 无 | 整段 | P4 / P3b-2 |
| 生产凭证 52 键核对 | 无（没同步 / 没打印 / 地址未核对） | 人工核对 | 首次真实发布前 |
| k2 失联取证 | 无 dmesg / OOM | 时间点与因果均未证实 | 不阻塞，但别写成结论 |

- 原型第 10 个场景 `p3b-review` 与 `card-p3b` 评审要点区，是**静态判据快照**：
  不发请求、不读文件、不执行任何动作；「正式发布 / 上传」按钮仍恒禁用。
- 🔴 **确认可落地 ≠ 授权发布**（§9.8 结论 4）：本节不产生任何发布权限。
- 🔴 **拍板 ≠ 开工**（20:3x 当时）：9 条结论只定判据；P3b-1 已于 21:2x 获测试环境
  授权并落地（§9.9），P3b-2 / P3b-3 / P4 仍需按 §11.8 单独授权。

### 11.10 拍板结论（2026-11-11 20:3x，9 条按推荐定稿）

| # | 问题 | 拍板结论 | 为什么（推荐口径） |
| :--- | :--- | :--- | :--- |
| 1 | 授权形态 | **一次明确指令 + 当次有效**；每次执行仍过 §11.1 六道门，`--confirm yes` / `yes` + 勾选是固定门禁、不是可缓存授权 | 更严的「授权串」若落盘成状态，会演变成「授权过一次以后就能发」；当次有效 + 每次过门更硬 |
| 2 | A · 暂存 tar.gz | **成功即删**（按本次清单逐个删、不 `rm -rf` 目录）；**失败保留现场、由人清**，不设定时清理 / 新键 | 「保留 N 小时」要定时器 + 新键（与结论 7 冲突），自动清理还会毁掉结论 4 要保留的失败现场 |
| 3 | B · 52 键核对 | **由人（发布人）**在首次真实发布前逐项核对 DB / Redis / MinIO 地址与凭证；结论只落在**当次发布前检查项 + 当次任务日志 / 报告**，工具不读值 / 不打印 / 不擅自同步 | 核对结论落盘就变成可复用的永久授权，与结论 1 冲突；测试值带进现网的风险由人把关（§9.8） |
| 4 | C · 自动回滚 | **P3b 不自动回滚**：停在当前阶段 + 如实报告 + 保留现场；`rollback` 仍属 P4，§3.6 矛盾按此修掉 | §3.6 与 §3.7 / §5 自相矛盾；Flyway 单向，半成品回滚会把现场弄得更乱 |
| 5 | D · 启动窗口 | 统一 **150 s 内置默认**（每 5 s 轮询、连续 2 次 200），**不启用 `HEALTH_TIMEOUT`** | 与 §9.8 `run-flow.py` 实测判据一致、与 0 新键一致；要调以后走显式 CLI 参数、单开一刀 |
| 6 | E · 台账边界 | 按 ①：**接受「崩溃丢一次尝试」**、报告如实写；不加 `running` 起始事件、不改结果三枚举 | ② 要改 §10.4 已评审的字段与枚举，还引入需要清理的半成品记录 |
| 7 | F · 配置键 | 选 **A：0 新键**（推荐），12 键 / `retiredOpsEnvKeys` / `opsenv_test.go` 数量断言原样 | P3a 已用零新键跑通只读预演；少一个能配错的机会，52 键生产凭证也不进 `ops.env` |
| 8 | 范围 | **CLI-first**，P3b 拆 **P3b-1 / P3b-2 / P3b-3**；界面步骤进度 / 实时日志 / 第 8 导航项 / `/api/deploy/*` 全归 P3b-3，**每批次单独授权** | 与 §11.8 分批计划一致；P3b-3 之前发布按钮恒禁用，避免把界面和主链路绑在一刀里 |
| 9 | 构建来源 | **默认每轮构建**，显式 `--no-build` 才复用现成镜像（§9.8 实证快路径）；失败停在 `构建`、不碰远端 | 保持「一键」语义与六阶段状态机、§2 草案参数不用改；🔴 唯一无真机证据的一条，三条构建链首次真实发布前人工确认 |

> ✅ 结论已回写 §2 / §3.3 / §3.4 / §3.6 / §5 阶段划分 / §6 / §7 / §8 / 本节各小节，
> 以及原型 `card-p3b` / `p3b-review`、分区索引、`prototype-conventions.md`、
> `ui.md` 指针与 `AGENTS.md` 速查表。
> 🔴 **拍板只定判据、不定开工**：本刀仍只改文档与原型，代码零改动、
> 不带 `--dry-run` 仍 rc=2；**P3b-1 按 §11.8 另需单独授权**，
> 正式发布仍要一次当次有效的明确授权（§11.1），**未授权**。
> ✅ **21:2x 状态更新**：P3b-1 已在测试环境落地并真机验收（§9.9）；上面
> 「另需单独授权」指当时未授权，现已由用户明确授权测试环境开工。
