> 状态：**现行**（2026-11-07）。服务器清单为唯一主机来源（P0）；P1 备份部署已迁移到
> `--server`；§4 的 `backup.env` 键表 / 默认值改由 `internal/shared/env-schema.json` 生成；
> `ops.env` 的键改由 `internal/shared/opsenv.go` 的 `opsEnvKeys` 定义，未知
> `PASS_UP_OPS_*` 键报错；**2026-11-07 P2a 落地**：8 个备份监控键已登记为现行键、
> 键表接回本文 §3；P3–P4 方案键表与运行态文件仍在分册，本文只留指针。

# 配置（唯一维护处）

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)。
> 🔴 **键定义不在这份文档里**：`ops.env` 的 14 个键只在 `internal/shared/opsenv.go`
> 的 `opsEnvKeys` 定义一次（`ops init` 模板、`LoadConfig` 解析、默认值都由它驱动）；
> `backup.env` 的键只在 `internal/shared/env-schema.json`。本文是**说明**，
> 表格里的默认值是给人看的速览，冲突时一律以代码为准；其它文档只引用键名。
> 🔴 **本文只讲现行配置**：P3–P4 未实现方案的键表仍在 [deploy.md](deploy.md) §8、
> 运行态文件清单在 [one-click-launch.md](one-click-launch.md) §4.4；本文 §5 只留指针。
> P2a 备份监控的 8 个键[已落地](#3-备份监控p2a--cli-已实现)，键表在本文 §3，
> 采集协议与红线见 [backup-monitor.md](backup-monitor.md)。

## 1. 文件位置与格式

- 主配置：Windows `%AppData%\pass-up\ops.env`；macOS / Linux `~/.config/pass-up/ops.env`
- 路径规则只在 `shared.ConfigPath()` 一处：`PASS_UP_OPS_ENV` 直接给文件，否则按
  `PASS_UP_OPS_CONFIG_DIR` > `os.UserConfigDir()` > `XDG_CONFIG_HOME` > `~/.config` 取目录。
  🔴 启动器**不在 `.cmd` 里拼路径**，而是调 `ops __config-path`（内部命令，只输出一行路径）
  问 Go；否则一用覆盖变量，首次运行判定与 `ops-ui.log` 提示就指到另一份配置去了。
- `ops init` 生成模板；已存在则只打印路径，不覆盖。清单不存在时同时生成空 `servers.json` 模板
- **服务器清单**是另一个文件（见 §2），不写进 `ops.env`

`ops.env` 格式：标准 `KEY=VALUE`，允许 `#` 注释、空行、值两侧单/双引号。不进 Git。

🔴 **只认 14 个键**（键定义见 `internal/shared/opsenv.go`）：

- 基础 4 个：`PASS_UP_OPS_SERVERS_FILE`、`PASS_UP_OPS_DEFAULT_SERVER`、
  `PASS_UP_OPS_BACKUP_SRC_DIR`、`PASS_UP_OPS_BACKUP_DEPLOY_DIR`；
- 备份凭证 2 个：`PASS_UP_OPS_BACKUP_PG_ENV_FILE`、`PASS_UP_OPS_BACKUP_MINIO_ENV_FILE`；
- 备份监控 8 个：`PASS_UP_OPS_PG_ROOT`、`PASS_UP_OPS_PG_LOG`、
  `PASS_UP_OPS_MINIO_LOG`、`PASS_UP_OPS_MINIO_DATA`、`PASS_UP_OPS_DISK`、
  `PASS_UP_OPS_PG_STALE_HOURS`、`PASS_UP_OPS_MINIO_STALE_HOURS`、
  `PASS_UP_OPS_DISK_WARN_PCT`（键表见 §3）。

`ops init` 的模板由键定义生成，`LoadConfig()` 查同一张表派发；
**遇到其它 `PASS_UP_OPS_*` 键直接报错**并说明原因（拼错 / P3–P4 未实现 /
已迁移到 `servers.json` / 其实是环境变量），不再静默忽略 ——
「以为配了却没生效」比「没配」难查得多。非本项目前缀的键仍忽略；
界面配置页用 `FallbackConfig()` 兜底，报错显示在页面上，不会白屏。
`go test` 会断言模板、运行时默认值，以及 `docs/*.md` 全部分册里出现的每个
`PASS_UP_OPS_*` 键名都已在键定义或「已知但不可用」原因表里归类。

**本机路径覆盖（环境变量，主要给单测 / 验收用）**：

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_CONFIG_DIR` | 空 | 覆盖配置目录（`ops.env` / `servers.json` / `ops.ico` 所在目录） |
| `PASS_UP_OPS_DESKTOP_DIR` | 空 | 覆盖桌面目录；`ops shortcut` 与单测绝不写真桌面 |

这两个是**进程环境变量**，不是 `ops.env` 的键；写进文件会被 `LoadConfig()` 拒绝
（`PASS_UP_OPS_ENV` 同理）。

**运行态文件**（程序生成、不进 Git、**不是配置键**，别手改）：`ui.json` / `ops-ui.log` /
`ops.ico` / `servers.state.json` 的权限、内容与写入方见
[one-click-launch.md](one-click-launch.md) §4.4，本文不复述。
它们与配置同目录，但**不能**写进 `ops.env`（未知 `PASS_UP_OPS_*` 键会被拒绝）。

## 2. 服务器清单（唯一主机来源）

文件：`PASS_UP_OPS_SERVERS_FILE`
默认 Windows `%AppData%\pass-up\servers.json`、其它 `~/.config/pass-up/servers.json`。
JSON 结构、字段语义与校验规则见 [servers.md](servers.md) §3，**本文不复述字段表**。

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_SERVERS_FILE` | 见上 | 清单路径；**权限 600**，不进 Git |
| `PASS_UP_OPS_DEFAULT_SERVER` | 空 | 省略 `--server` 时用；空 = `role=backup` 唯一则取它，否则报错要求显式指定 |

🔴 **主机 / 端口 / SSH 用户 / 私钥 / sudo 凭据只出现在清单里**。
以下旧键**删除，不保留兼容**（避免两台机器共用一个 `HOST` 后说不清）：

| 已删除的旧键 | 迁移到 |
| :--- | :--- |
| `PASS_UP_OPS_BACKUP_HOST` / `_PORT` / `_USER` / `_KEY` | `servers[].host/port/user/key` |
| `PASS_UP_OPS_BACKUP_ADMIN_USER` / `_ADMIN_KEY` / `_ADMIN_PASSWORD` | `servers[].user/key/sudo.password` |
| `PASS_UP_OPS_DEPLOY_HOST` / `_PORT` / `_USER` / `_KEY` | `servers[].host/port/user/key` |

迁移窗口：P1 已实现版本仍在读旧键；P0 实现时**一次性切换**到清单，旧键随之删除。

## 3. 备份监控（P2a · CLI 已实现）

`ops status --server <name> [--json]` 的**只读全局默认**；多台备份机要不同值时，
再在清单里加 server 级覆盖（本期未做）。键定义、模板字面量、运行时默认值都只在
`internal/shared/opsenv.go` / `config.go`，采集与判定见 [backup-monitor.md](backup-monitor.md)。

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_PG_ROOT` | `/data/backups/postgres` | 备份根目录（含 daily/weekly/monthly） |
| `PASS_UP_OPS_PG_LOG` | `/var/log/pg-backup` | PG 心跳与日志目录 |
| `PASS_UP_OPS_MINIO_LOG` | `/var/log/minio-backup` | MinIO 心跳与日志目录 |
| `PASS_UP_OPS_MINIO_DATA` | 空 | 可选；填了会 `du` 整个数据目录，对象多时很慢 |
| `PASS_UP_OPS_DISK` | `/data` | 做 `df` 的挂载点 |
| `PASS_UP_OPS_PG_STALE_HOURS` | `26` | 超过即判异常（每天一次，留 2h 余量） |
| `PASS_UP_OPS_MINIO_STALE_HOURS` | `26` | 同上 |
| `PASS_UP_OPS_DISK_WARN_PCT` | `90` | 已用率达到即判异常（1–100） |

🔴 路径键必须是**远端绝对路径**且不含 `..`（`LoadConfig().validate()` 先卡一道，
`probeScript()` 再对每段 `ShQuote`）；阈值必须是正数，磁盘百分比不超过 100。
`PASS_UP_OPS_MINIO_DATA` 留空才表示「不采数据目录」；其余路径键留空用上表默认值。
监控账号来自清单的 `monitor`，**不复用**安装账号，见 [servers.md](servers.md) §3。

## 4. 备份能力部署（P1）

目标机由 `--server` 从清单选择；安装提权用该条目的 `user` + `sudo`。

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_BACKUP_DEPLOY_DIR` | `/opt/passup-backup` | 远端脚本目录；**升级已有安装必须填现有路径** |
| `PASS_UP_OPS_BACKUP_SRC_DIR` | 空 | 空 = 用**编进二进制**的脚本（`deploy/backup` 已嵌入）；只有调试才填本机目录覆盖 |
| `PASS_UP_OPS_BACKUP_PG_ENV_FILE` | 配置目录 `backup/postgres.env` | 本机已填好的配置（含凭证，不入 Git） |
| `PASS_UP_OPS_BACKUP_MINIO_ENV_FILE` | 配置目录 `backup/minio.env` | 同上 |

🔴 **`backup.env` 的键、默认值、分组、标签、凭证标记只在 `internal/shared/env-schema.json`
定义一次**。以下都是生成物，不许手改：

| 生成物 | 谁生成 | 用途 |
| :--- | :--- | :--- |
| `deploy/backup/<组件>/backup.env.example` | `ops __gen-backup-env` | `ops backup env` 模板；`install.sh` 在远端生成 `backup.env` 的蓝本 |
| `deploy/backup/**/*.sh` 里的 `${KEY:-默认值}` | 同上 | 脚本兜底值（不改执行逻辑，只写回字面量） |
| `deploy/backup/*/Makefile` 里的 `:= 默认值` | 同上 | 手工 `make` 入口的 cron / 日志目录兜底 |
| 界面配置页白名单 | 运行时直接读 schema | 字段标签、分组、凭证脱敏、`/api/config/compare` 的键顺序 |
| 下面的键表 | 同上 | 本页的只读速览 |
| [交互原型](config-compare.html) 的字段表 | `go test` 断言（子集速览，不是生成物） | 标签、分组、演示默认值不许与 schema 漂移 |

改一个键 / 默认值：**改 schema → 在仓库根跑 `ops __gen-backup-env` → `go build`**
（脚本与模板都嵌进二进制）。漏跑生成器时 `go test ./...` 会直接红，并提示该命令。
断言覆盖：两份模板、`deploy/backup/**/*.sh` 的兜底字面量、两份 `Makefile` 的 `:=` 默认值、
本页键表、交互原型的标签 / 分组 / 演示默认值，以及凭证键不带默认值。

🔴 **生成物只同步「已经写了字面量」的默认值，不改脚本执行逻辑**：远端脚本跑在生产备份机上，
本机无法真机验证，所以没有引入 `source defaults.env`、也没有删掉任何 `${KEY:-...}`。
`${KEY:-}` 是**空兜底**（`set -u` 防空 + `install.sh` / `preflight` 判断「有没有显式配置」），
填成默认值会让 `[ -z ... ]` 恒假、`[ -n ... ]` 恒真；生成器与断言都跳过它。
`sentinel` 值（`<未配置>`、`/nonexistent`）是提示文案或 `find` 哨兵，同样不参与同步。
文件里已有、模板里没有的键仍可编辑，注释与未知行原样保留。

**界面怎么用这些默认值**：`GET /api/config` 的每个字段带一份 `default`（就是本表第二列），
配置页对未配置字段显示「未写入配置（默认值：X）」，另有显式「填入推荐默认值」按钮。
🔴 灰字只陈述「文件里没有这一行」并给出建议值，**不承诺留空可用**：默认值只在备份脚本
运行时由 `${KEY:-默认值}` 兜底，而 `preflight_pg.sh` 的 `check_required_var` 按
「`backup.env` 里有没有显式这一行」判定，被列为必填的键（如 `PG_BACKUP_ROOT`）留空会报
「未配置」并让 `install.sh` 退出码 1。要让自检通过，必须显式「填入推荐默认值」→
保存本机（yes）→ 同步到远端（yes）。判据见 [ui.md](ui.md) §12.7。
凭证、本表里标「（空，必须人填）」的键、以及 `MINIO_CONTAINER_NAME` / `UPLOAD_LIMIT`
这类「留空即跳过 / 关闭」的键，`default` 恒为空，页面既不提示也不填入，避免改掉
`${KEY:-}` 的空值判定；页面也不会在打开时自动把这些值写进本机文件。

<!-- gen:env-schema -->
### pg（`deploy/backup/postgres/backup.env.example`）

| 键 | 默认值 | 分组 | 说明 | 凭证 |
| :--- | :--- | :--- | :--- | :--- |
| `PG_CONTAINER_NAME` | `postgres` | 主服务器 | 主服务器 PG 容器名 |  |
| `PG_DB_USER` | `postgres` | 主服务器 | 数据库用户 |  |
| `PG_DB_NAME` | `pass_up` | 主服务器 | 业务库名 |  |
| `PG_SSH_HOST` | （空，必须人填） | SSH 连接（备份端 → 主服务器） | 主服务器地址 |  |
| `PG_SSH_PORT` | `22` | SSH 连接（备份端 → 主服务器） | SSH 端口 |  |
| `PG_SSH_USER` | `root` | SSH 连接（备份端 → 主服务器） | SSH 登录用户 |  |
| `PG_SSH_KEY` | （空，必须人填） | SSH 连接（备份端 → 主服务器） | 备份端私钥路径 | 是 |
| `PG_SSH_OPTS` | `-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new` | SSH 连接（备份端 → 主服务器） | SSH 额外选项 |  |
| `PG_BACKUP_ROOT` | `/data/backups/postgres` | 备份端 | 备份根目录 |  |
| `PG_BACKUP_LOG_DIR` | `/var/log/pg-backup` | 备份端 | 日志目录 |  |
| `PG_LOCAL_RETENTION_DAYS` | `7` | 备份端 | 本地保留天数 |  |
| `PG_WEEKLY_RETENTION_DAYS` | `30` | 备份端 | 周备保留天数 |  |
| `PG_MONTHLY_RETENTION_DAYS` | `365` | 备份端 | 月备保留天数 |  |
| `PG_RESTORE_JOBS` | `4` | 备份端 | 恢复并发数 |  |
| `CRON_SCHEDULE_BACKUP` | `0 3 * * *` | 定时任务 | 备份定时（cron） |  |
| `CRON_SCHEDULE_HEALTH` | `0 9 * * *` | 定时任务 | 巡检定时（cron） |  |
| `BACKUP_HEALTH_THRESHOLD_HOURS` | `26` | 巡检 | 健康阈值（小时） |  |
| `BACKUP_DISK_MOUNT` | `/data` | 巡检 | 数据盘挂载点 |  |
| `BACKUP_DISK_CRIT_PCT` | `90` | 巡检 | 磁盘告警百分比 |  |
| `ALERT_WEBHOOK` | （空，必须人填） | 巡检 | 告警 Webhook | 是 |

### minio（`deploy/backup/minio/backup.env.example`）

| 键 | 默认值 | 分组 | 说明 | 凭证 |
| :--- | :--- | :--- | :--- | :--- |
| `SRC_URL` | `http://127.0.0.1:8007` | 源端 | 源 MinIO 地址 |  |
| `SRC_KEY` | （空，必须人填） | 源端 | 源端 Access Key | 是 |
| `SRC_SECRET` | （空，必须人填） | 源端 | 源端 Secret Key | 是 |
| `SRC_BUCKETS` | `passup-public passup-private passup-temp` | 源端 | 源桶列表 |  |
| `DEST_URL` | `http://127.0.0.1:9000` | 备份端 | 目标 MinIO 地址 |  |
| `DEST_KEY` | （空，必须人填） | 备份端 | 目标 Access Key | 是 |
| `DEST_SECRET` | （空，必须人填） | 备份端 | 目标 Secret Key | 是 |
| `DEST_BUCKET_PREFIX` | `passup-backup-` | 备份端 | 备份桶前缀 |  |
| `MINIO_CONTAINER_NAME` | （空，必须人填） | 备份端 | MinIO 容器名 |  |
| `UPLOAD_LIMIT` | （空，必须人填） | 备份端 | 上传限速 |  |
| `BACKUP_LOG_DIR` | `/var/log/minio-backup` | 备份端 | 日志目录 |  |
| `CRON_SCHEDULE_BACKUP` | `0 2 * * *` | 定时任务 | 备份定时（cron） |  |
| `CRON_SCHEDULE_HEALTH` | `0 8 * * *` | 定时任务 | 巡检定时（cron） |  |
| `BACKUP_DISK_MOUNT` | `/data` | 巡检 | 数据盘挂载点 |  |
| `BACKUP_HEALTH_THRESHOLD_HOURS` | `26` | 巡检 | 健康阈值（小时） |  |
| `BACKUP_DISK_CRIT_PCT` | `90` | 巡检 | 磁盘告警百分比 |  |
| `ALERT_WEBHOOK` | （空，必须人填） | 巡检 | 告警 Webhook | 是 |
<!-- /gen:env-schema -->

这两份本机文件与 `servers.json` 都可以在界面「配置」页编辑（凭证只回显「已配置」、
空值保持不变、写 0600 + `.bak`）；**保存只改本机**，远端 `backup.env` 要另外点
「同步到远端」（`ops backup sync-env`），见 [ui.md](ui.md) §12。

## 5. 应用部署（P3–P4）—— 方案，未实现

🔴 **本文不定义这一节的键**。方案期的部署键表在 [deploy.md](deploy.md) §8；
当前版本没有任何代码读它们，写进 `ops.env` 会被 `LoadConfig()` 拒绝并提示
「应用部署（P3–P4）方案尚未实现」（见 §1）。实现时先在
`internal/shared/opsenv.go` 的 `opsEnvKeys` 登记，再把键表接回本文。

## 6. 校验

- `ops.env` 里出现未登记的 `PASS_UP_OPS_*` 键直接报错（列出合法键与原因），
  非本项目前缀的键忽略；`ops init` 模板与 `LoadConfig()` 解析共用
  `internal/shared/opsenv.go` 的同一份键定义，模板字面量与运行时默认值都取
  `DefaultBackupDeployDir`；
- 清单文件必须存在且可解析；`name` 唯一、`role` 合法、`host`/`user` 必填、端口 1–65535；
  `key` 支持 `~` 展开，**文件不存在或权限过宽时明确报错**；`default` 必须指向存在的 `name`；
  含 `sudo.password` 的文件权限必须 `600`；
- 远端路径必须是绝对路径（斜杠语义，防止 Windows 路径被误填），且不含 `..`；
  P2a 的 5 个路径键同样过这一关，阈值键另验正数 / 百分比上限；
- 私钥路径**只校验存在性，不打印、不回显**；
- 命令只接受清单里的 `--server <name>`，不接受任意 host；
- sudo 密码只经 **stdin**（CLI `--password-stdin` / 界面单次请求），**不存在 `--password` 参数**；
- `backup.env` 若提供，必须存在且不含 `CHANGE_ME` / `YOUR_` 占位符；
- 已有安装时，`PASS_UP_OPS_BACKUP_DEPLOY_DIR` 必须与 cron 标签行里的绝对路径一致，否则拒绝执行。
