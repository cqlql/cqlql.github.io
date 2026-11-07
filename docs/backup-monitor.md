> 状态：**P2a CLI 与 P2+ 界面均已实现（2026-11-07 夜）；真机验收仍待做**。
> `ops status --server <name> [--json]`、红线单测、只读账号强制、8 个 `ops.env` 键，
> 以及界面的 `GET /api/monitor/status` + 四张卡页已落地；键表在 [config.md](config.md) §3，
> 本文 §10 只留指针。§11 是 P2a、§12 是 P2+ 的施工图与同步记录。
> **真机验收待做**：本机 `go vet` / `go test` / `go build` 全绿，断网与错密钥用假 runner 覆盖，
> 尚未在备份机上跑过真实 `ssh`。

# 备份监控

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)；现行 `ops.env`（含 P2a 的 8 个监控键）
> / `backup.env` 的键表见 [config.md](config.md) §3 / §4。
> 本文只覆盖**只读监控**；备份能力的安装/升级（写 crontab、logrotate）见
> [backup-deploy.md](backup-deploy.md)。

## 1. 要解决什么

备份体系见 [backup-scripts.md](backup-scripts.md)（脚本已迁入本仓 `deploy/backup/`）：

| 备份对象 | 心跳文件 | 定时 |
| :--- | :--- | :--- |
| PostgreSQL | `/var/log/pg-backup/last_success.txt` | 每天 3:00 |
| MinIO | `/var/log/minio-backup/last_success.txt` | 每天 2:00 |

失败会推钉钉，但日常想知道「最近一次成功是什么时候、备份多大、磁盘还剩多少」，
仍然只能登录备份服务器手工敲命令。

目标：`ops status --server <name>`（P2a）或 `ops ui` 的「备份监控」页（P2+）直接看到这些事实，**只读**。

**前提**：备份能力已安装（见 [backup-deploy.md](backup-deploy.md)）。
若尚未安装，`status` 返回「心跳文件不存在」属于正确结果，先跑 `ops backup deploy`。

## 2. 边界

**做**：PG / MinIO 最后一次成功、最新备份文件、占用、磁盘余量；CLI（含 `--json`）与
本地网页共用同一份快照；**目标机与连接参数走 [servers.json](servers.md)**，只读账号用
该条目的 `monitor`。🔴 **P2a 已强制 `monitor`，不再复用 `user/key`**（口径见 §6 / §11）；
`MonitorSSHTarget()` 要求 `monitor.user` / `monitor.key` 齐全、不等于安装账号、不是 root，
旧的 `MonitorTarget()` 复用兜底已删除。

**不做**：触发 / 重跑 / 恢复备份（恢复脚本必须有人值守）；修改备份服务器任何文件；
内嵌终端；定时告警（本机工具不适合常驻）。

## 3. 采集

### 3.1 远端脚本

工具生成一段固定 POSIX sh，经 `ssh -T ... sh -s` 从 **stdin** 执行
（不拼 `ssh host '命令'`：多行 + 引号 + 路径的转义只有一层才不容易出错）。
🔴 走 `shared.SSHTarget.RunScript`：**stdout 与 stderr 分开收**，不用现有 `Capture()`
（`CombinedOutput()` 会把远端警告混进分节文本被误解析）；只读账号不提权、不占
sudo 密码的 stdin。路径拼进脚本前统一 `shQuote`，生成逻辑见 §11 的 `probeScript()`。
远端输出**分节纯文本**，不在远端拼 JSON：以 `==XXX` 开头分节，块内**每行一个字段、
顺序固定**；**没采到就写一行 `-`**。分节之间顺序可乱，缺行即该块 `collected=false`。

- `==META`：① hostname ② 远端 `date +%s` 的 `now_epoch`
- `==PG`：① 心跳原文 ② 远端 `date -d` 解析出的 epoch ③ 最新 dump 的
  `mtime|size|path` ④ 备份根 `du -sk` 的 KB
- `==MINIO`：① 心跳原文 ② 远端 epoch ③ 日志目录 KB ④ 数据目录 KB（未配置恒 `-`）
- `==DISK`：`df -P -m` 的 `total_mb|avail_mb|used_pct`

示例（PG 心跳没采到，其余正常）：

    ==META
    backup-01
    1762500000
    ==PG
    -
    -
    1762495200|130000000|/data/backups/postgres/daily/passup_20261107.dump
    820000
    ==MINIO
    2026-11-07 02:00:11
    1762483211
    3200
    -
    ==DISK
    102400|20480|80

`parseSections()` 按 `==XXX` 切块、块内按上面列出的行序取值；
`age_hours = (META.now_epoch - last_success_epoch) / 3600`，
**Go 侧只做减法**，不碰本机时钟（对应单测见 §11）。
KB / 字节统一按 `1024` 换算成 MB 并保留 1 位小数；段的 `collected` 判据是
「分节齐全 + 至少一个字段成功解析」，缺行或全 `-` 都是 `false`，但已采到的字段仍保留
（例如心跳没采到、dump 采到了，仍显示 dump 并在问题清单里报心跳异常）。

三条硬规则：

1. 🔴 **时间新鲜度只在远端算**。`last_success.txt` 是 `YYYY-MM-DD HH:MM:SS`
   **无时区**的本地时间；拿回本机按本地时区解析会差 8 小时。
   远端用 `date -d "<内容>" +%s` 得到 epoch，与远端 `date +%s` 相减。
2. 🔴 **没采到输出 `-`**，解析后 `collected=false`，界面显示 `—`。
   **禁止用 0 兜底**：「0」与「没采到」长得一样，而后者往往才是异常那一项。
3. 🔴 **防注入**：路径拼进脚本前统一 `shQuote`（POSIX 单引号转义）；
   配置加载时再校验绝对路径。

### 3.2 不检查 crontab

定时任务由 `install.sh` 装进**备份运行用户**（清单 `user`）的 crontab。
只读监控账号是另一个人，`crontab -l` 只会返回空，结果是假的「定时任务未安装」。

因此**不查 cron**，用 `last_success.txt` 的新鲜度间接判断。要真查得切到运行用户
（`crontab -u <user> -l`）或放开 `sudo -n`，两者都超出「只读账号」的设定。

### 3.3 超时与失败

- `ConnectTimeout=10`、`ServerAliveInterval=5`、`BatchMode=yes`；
- 整段脚本上限 **30s**；
- **绝不在中途等密码**：缺密钥立刻失败，错误里只说 `user@host`，不打印私钥路径；
- 主机密钥 `StrictHostKeyChecking=accept-new`（首次收录，变化即拒绝）。

**注意：还有另一条 ssh 链路。** 上面说的是 `ops` 自己连服务器做只读采集
（`internal/shared/remote.go`）；备份脚本每天从**备份端连主服务器拉 dump** 走的是
`pg_backup.sh` / `pg_restore.sh` 里的 `${PG_SSH_OPTS:-...}`，不受前者管。这条链路的
默认值也必须含 `accept-new`，四处逐字一致（`pg_backup.sh` / `pg_restore.sh` /
`backup.env.example` / `preflight_pg.sh`）：

```
-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new
```

`BatchMode=yes` 禁掉了交互提示，不带 `accept-new` 时 cron 首次连一台没进 `known_hosts`
的主机必然失败；换成 `no` 又等于关掉主机密钥校验。`accept-new` 要求远端 OpenSSH ≥ 7.6。
四处默认值由 `go test` 的 `TestEmbeddedBackupSSHDefaultsAligned` 锁住（含界面 placeholder）。
🔴 这条链路现在跑在**清单 `user`** 名下，读的是该用户的 `~/.ssh/known_hosts`；
`install.sh` 的连通探测与 `preflight` 都降到同一身份，别再把它们套回 sudo。

## 4. 状态结构与判定

CLI 表格、`--json`、网页用的都是这一份（**不许前端自己再算一套指标**）：

```jsonc
{
  "host": "user@host:22",
  "checked_at": "2026-11-05T10:00:00+08:00",
  "remote_host": "backup-01",
  "connection": { "ok": true, "latency_ms": 180, "error": "" },
  "pg": {
    "collected": true, "has_success": true,
    "last_success_raw": "2026-11-05 03:00:12",
    "last_success_age_hours": 7.0,
    "has_latest": true,
    "latest_path": "/data/backups/postgres/daily/passup_20261105_030012.dump",
    "latest_size_mb": 123.4, "latest_age_hours": 7.0, "total_mb": 800
  },
  "minio": { "collected": true, "has_success": true, "last_success_age_hours": 8.0,
             "log_size_mb": 3.2, "data_size_mb": null },
  "disk": { "collected": true, "total_mb": 102400, "free_mb": 20480, "used_pct": 80 },
  "problems": [ { "level": "danger", "text": "..." } ]
}
```

问题判定（阈值只在 `assess()` 里定义一次）：

| 项 | danger | warn |
| :--- | :--- | :--- |
| 连接 | 不可达 / 认证失败 / 主机密钥变化 | — |
| PG | 读不到心跳（从未成功或目录不可读）；超过 `PASS_UP_OPS_PG_STALE_HOURS` | 有成功记录但找不到 `.dump`；最新 dump 为 0 字节 |
| MinIO | 读不到心跳；超过 `PASS_UP_OPS_MINIO_STALE_HOURS` | 配了数据目录却读不到 |
| 磁盘 | `df` 失败（**不是**「剩 0MB」）；达到 `PASS_UP_OPS_DISK_WARN_PCT` | — |

连接失败时仍然输出完整快照（`connection.ok=false` + 问题清单），
不把「备份服务器连不上」变成一个只有一行报错的异常。

Go 侧类型约定（P2a 定稿，CLI `--json` 与 P2+ 网页共用同一份 `Status`）：
数值字段一律 `*float64`，未采到是 `null` 不是 `0`；每段带 `collected`；
`problems` 恒初始化为空 slice（Go 的 nil slice 编成 `null`，前端 `.map` 会白屏，
见 `internal/component/status.go` 顶部注释）；`checked_at` 才用本机时间，新鲜度不用。
退出码 `0` 无 danger / `1` 有 danger（含连不上）/ `2` 用法·配置错；`--json` 三种情况
都输出完整快照。

## 5. 本地网页（P2+ 已实现）

- 鉴权与其它页同一套：仅监听 `127.0.0.1`；页面与 `/api/*` 校验 token + `Origin`，
  静态产物不过 token（[ui.md](ui.md) §4）。页面地址带 `?token=...`。
- 页面：顶部问题清单（danger 红 / warn 黄）、四张卡（连接、PG、MinIO、磁盘）、
  底部元信息（远端主机 / 采集时间 / 缓存年龄 / 本机 `ops.env` 与 `servers.json` 路径 /
  只读展示的三个判定阈值）。60s 自动刷新（只在当前页激活时）、另有显式「立即刷新」。
- 服务端缓存 **30s**、强制刷新最小间隔 **5s**、同一时刻只跑一次采集：
  多标签页同时刷新会把并发 SSH 合并掉；人点「立即刷新」被限流时页面给一句提示，
  不是静默复用旧数据。
- 接口：`GET /api/monitor/status?name=<清单里的 name>[&force=1]`。
  🔴 要连远端就走严格 `LoadConfig`（不许拿 `FallbackConfig` 的默认路径冒充目标机）；
  `name` 只认 `servers.json`，未知 404；只读账号强制在 `monitor` 包。
  🔴 连不上 / 没配好一律 **200 + 完整快照**（`connection.ok=false` + problems），
  不把「备份服务器连不上」变成一行 HTTP 错误把整页打白。
- **本期不做网页内改配置**：服务器清单与阈值在 `servers.json` / `ops.env`，
  页面只显示路径与只读阈值；没有重跑 / 恢复 / 改账号的入口。

## 6. 安全

1. 备份服务器用**专用只读账号**：不给 sudo、不给写权限；sshd 侧禁 PTY / 端口转发 / agent 转发。
   账号写在 [servers.json](servers.md) 的 `monitor`，**不复用有 sudo 权限的 `user`**；
   界面「配置 → 服务器清单 → 只读监控账号」可填写 / 查看状态 / 显式移除，
   保存时就按下面这份口径校验（[ui.md](ui.md) §12.9），不必手改 JSON。
   🔴 **P2a 已实现（2026-11-07）**：「必须有 monitor」只在 `status` 采集入口强制
   （`MonitorSSHTarget()` 要求 `monitor.user` / `monitor.key` 齐全、`monitor.user != user`、
   不是 root、不带 `sudo.password`、`IsRoot=false`），**不**加进 `LoadServers().normalize()`
   的全局校验 —— 否则现有 P0/P1/界面清单全部加载失败；`normalize()` 只补一条
   「`monitor.user == user` 即拒绝」的 schema 护栏。`MonitorTarget()` 复用兜底已删除。
   `SSHTarget.RunScript()` 的错误只说 `user@host:port`，不回显 ssh 的 stderr
   （里面可能带私钥路径）；`monitor.connectionError()` 再兜一层脱敏。见 §11。
2. 私钥只放本机，路径可以写进配置，但**任何输出、错误、日志都不打印它**。
3. `accept-new` 不是 `no`：首次收录，之后变化直接拒绝。
4. 工具只读：不调用 `pg_backup_status.sh` / `minio_backup_status.sh`
   （它们会 `tee` 写日志、推钉钉，「看一眼」不该产生副作用）。
5. 本机 `ssh` 的 `known_hosts`、agent 照常复用，不额外创建凭据副本。

## 7. 文件与阶段

P2a 已按下面这份清单落地，只动 CLI，**没有碰 `internal/ui/` 与 `web/`**
（`+` 新增、`~` 修改；`menu_test.go` 另补了「第 7 项只读」断言）：

    + internal/monitor/config.go          Config / ConfigFrom / probeScript
    + internal/monitor/status.go          Status / ScriptRunner / Collect / parseSections / assess
    + internal/monitor/cli.go             CmdStatus / statusUsage / 终端渲染 / --json
    + internal/monitor/status_test.go     三条红线 + 解析 fixture + assess 边界（先写先红）
    + internal/monitor/probe_test.go      只读脚本扫描 + 路径注入断言
    ~ internal/shared/opsenv.go           8 个键 retired → opsEnvKeys
    ~ internal/shared/config.go          Config.Monitor / defaultConfig / validate
    ~ internal/shared/servers.go         MonitorSSHTarget / normalize 撞车护栏；删 MonitorTarget
    ~ internal/shared/remote.go          RunScript（stdin sh -s，stdout/stderr 分离）
    ~ internal/shared/opsenv_test.go     键登记后 4 处断言（见 §11）
    ~ internal/servers/servers_test.go   MonitorTarget 回退断言 → 三组成功/失败
    ~ main.go                            commandHandler 注册 status + usage
    ~ internal/launcher/menu.go          probe("status") 条件菜单项
    ~ docs/{config,backup-monitor,servers}.md、AGENTS.md    见 §11「实现时同步」

P2+ 另起一刀（界面，已落地）：`internal/ui/monitor.go`（GET handler + 缓存 +
注入的采集缝）、`internal/ui/monitor_test.go`、`web/src/features/monitor/`（四张卡 +
问题清单 + 60s 刷新）、`web/test/monitor.test.ts`、`App.tsx` 第 5 个导航项与
`index.css` 的 `.monitor-*`。项目已按 feature 分层，不是早期方案写的
`web/src/views/StatusView.tsx`；仍是零路由（见 `docs/ui.md` §7）。
`internal/monitor/collect.go` 是把 CLI 与网页接到同一条采集链路的那块胶水。

| 阶段 | 内容 | 验收 |
| :--- | :--- | :--- |
| P2a ✅ | `status --server <name>`（含 `--json`）+ 红线单测 | `go vet` / `go test` / `go build` 全绿；断网 / 错密钥用假 runner 返回完整快照；**真机连测试机待做** |
| P2+ ✅ | `ui`：只读页 + 缓存 + token/Origin + 完整快照 | `go test ./internal/ui`（门禁 / 缓存 / 限流 / 脱敏）+ `npm test` 85/85 + build；**真机浏览器验收待做** |

**前置**：备份能力已安装（见 [backup-deploy.md](backup-deploy.md)）。
未安装时 `status` 只能返回「心跳文件不存在」——这是正确结果，不是工具故障。

测试：`go vet ./...` + `go test ./...`；解析单测覆盖正常、缺失 `-`、空输出、乱序分节、
超大数、`%` 后缀；**不写需要真实 SSH 的单测**。

## 8. 风险

| 风险 | 说明与对策 |
| :--- | :--- |
| 本机没有 `ssh` | Windows 10+ 默认带 OpenSSH Client；缺失时明确提示「找不到 ssh」 |
| 只读账号权限不足 | 目录 root 私有时「连得上但读不到」；问题清单写清是哪一项没采到 |
| `PASS_UP_OPS_MINIO_DATA` 的 `du` 很慢 | 对象多时几十秒；默认留空 |
| 主机密钥变化 | 备份服务器重装后会拒绝；按 `ssh` 提示清理旧指纹即可 |
| 本机时钟不准 | 新鲜度用「远端 now - 远端 last」算，与本机时钟无关 |

## 9. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| 独立本地 Go 工具 | 后端加 API + admin 页面 | 不建表 / 不加权限 / 不改后端；工具坏了不影响生产 |
| 本机 `ssh` CLI | 纯 Go SSH 库 | 复用 `known_hosts` / agent / ssh config，少一个依赖与一套密钥管理 |
| 不查 crontab | `crontab -u <运行用户> -l` 或 `sudo -n` | 只读监控账号读不到别人的 crontab，读到空会误报「未安装」 |
| `du` MinIO 数据目录可选 | 默认全量 `du` | 对象多时几十秒；「只看备份」不值得每次等 |

## 10. 配置键

**8 个键已实现**，键表（默认值 / 校验口径）见 [config.md](config.md) §3，
代码事实源是 `internal/shared/opsenv.go` 的 `opsEnvKeys` 与 `config.go` 的
`MonitorConfig` / `DefaultMonitor*` 常量。本文不复述键表：路径与阈值是全局默认，
多台备份机要不同值时再在清单里加 server 级覆盖；监控账号强制来自清单的 `monitor`
（见 §6 / §11）。

`retiredOpsEnvKeys()` 里只剩 P3–P4 方案键、已删除的旧主机键与「其实是进程环境变量」
的覆盖键；`go test` 的 `TestConfigDocOnlyDefinesCurrentConfig` 按 `deploy.md` §8 的
方案键表动态核对数量，不再留「20 个幽灵键」这种随阶段变化的魔法数。

## 11. P2a 实现设计与落地记录（2026-11-07 已实现）

> 本节既是施工图也是现状：P2+ 已按此复用 `Collect()` / `Status`，没有另算指标（见 §12）。
> 落地时按两个拍板决策执行（强制只读账号、三条红线单测先行），
> 退出码语义（`1` = 有 danger）与 probe 脚本放 Go 常量两处默认口径也已照做。
> 真机验收仍未做，见 §11.4。

### 11.1 分层与接口

`CmdStatus` → `Collect(ctx, runner, cfg, server) Status` → `parseSections` → `assess`。
`runner` 是接口，`*shared.SSHTarget` 隐式实现；P2+ 的 `/api/monitor/status` 复用的就是
同一个 `Status`，**前端不算指标**（网页侧的入口见 §12.1）。

    type ScriptRunner interface { RunScript(ctx context.Context, script string) (string, error) }
    func ConfigFrom(c *shared.Config) Config
    func Collect(ctx context.Context, r ScriptRunner, cfg Config, server string) Status
    func parseSections(out string) Status       // 纯函数，固定文本 fixture 可测
    func assess(s *Status, cfg Config)          // danger / warn 阈值只在这里定义一次
    func probeScript(cfg Config) string         // 路径全部 shared.ShQuote 后注入
    func (s *Server) MonitorSSHTarget() (*SSHTarget, error)   // 已替换 MonitorTarget()

`RunScript` 走 `ssh -T ... sh -s`，stdin 喂脚本，stdout / stderr 分开收，255 沿用
`sshExitTransport` 判定；30s 总超时常量 `monitor.CollectTimeout` 由 CLI 与 P2+ 共用。
`probe.sh` 不落 `deploy/` 目录：路径要动态注入，Go 常量 + `ShQuote` 比模板替换安全
（也省一套 embed 与只读扫描的接线）。

### 11.2 两个拍板决策（均已落地）

| 决策 | 落地口径 | 为什么不那么做 |
| :--- | :--- | :--- |
| 强制只读账号 | 「必须有 monitor」只在 `status` 采集入口 `MonitorSSHTarget()` 强制；`normalize()` 只补 `monitor.user == user` 拒绝；删 `MonitorTarget()` 兜底 | 放进 `normalize()` 全局校验会让现有 P0/P1/界面清单全部加载失败，它们不需要 monitor |
| 三条红线单测先行 | `status_test.go` 先写、先红；采集与判定靠 `ScriptRunner` 注入假输出分离 | 不写需要真实 SSH 的单测（全项目惯例） |

红线单测：`TestFreshnessUsesRemoteEpochs`（固定 epoch fixture，换 TZ 结果不变）、
`TestDashMeansNotCollected`（`-` → `null` / `collected=false`，绝不 0）、
`TestConnectionFailureReturnsFullSnapshot`（假 runner 报 ssh 错，仍四段齐全 + danger）；
另加空输出 / 乱序分节 / 超大数 / `%` 后缀 / CRLF fixture，以及 assess 边界
（stale 阈值、0 字节 dump 是 warn、`df` 失败是 danger 而不是「剩 0MB」）。
`probe_test.go` 按 `componentdist_test.go` 同口径扫只读脚本禁用 token，并断言不出现
`pg_backup_status.sh` / `minio_backup_status.sh`。

### 11.3 联动护栏（已同步，回归时别再改回去）

| 测试 | 原因 | 落地后的改法 |
| :--- | :--- | :--- |
| `opsenv_test.go` 幽灵键用例 | P2 键变合法 | 删 P2 用例，保留 P3；另加「P2 键可加载 / 非法值被拒」两个正向用例 |
| `opsenv_test.go` `AppliesEveryKey` | 新键没给值直接 `Fatalf` | `values` + `checks` 各补 8 个 |
| `opsenv_test.go` `ConfigDocOnly...` | `ghosts` 20→12，`< 20` 断言红 | 改成按 `deploy.md` §8 的 P3 键表动态核对，别留魔法数 |
| `opsenv_test.go` 文档键归类 | 键表搬回 config.md | 不用改；`seen >= 20` 仍绿（去重后约 40 个键） |
| `servers_test.go` `MonitorTarget` 回退断言 | 方法删除 | 改成五组：缺 monitor / 缺 key / 撞车 / root / 正常，并断言 target 无 sudo 密码 |
| `launcher/menu_test.go` | 新增第 7 项 | `testProbe` 认 `status`，断言第 7 项存在且只发只读 `status --server <name>` |

### 11.4 顺序与验收

已按「单测（红）→ `monitor` 三个实现文件 → `shared` 四处 → `main.go` / 菜单接线 →
护栏同步 → 文档同步」落地；P2a **没有改** `internal/ui/*` 与 `web/*`。

**已验**：`go vet ./...` + `go test ./...` + `go build ./...` 全绿；断网 / 错密钥路径
由 `fakeRunner` 覆盖（完整 JSON + 退出码 1）；`ops init` 模板含 8 个新键，旧 `ops.env`
不含新键仍走默认值；未配 `monitor` 明确报错；输出里没有私钥路径。

**待真机验收**：`ops status --server <备份机>` 出四段卡片、`--json` 字段与 §4 一致；
真实断网 / 错密钥仍返回完整 JSON 且退出码 1；备份机上确认只读账号能读到心跳、
日志与 `.dump`，且远端没有任何文件被写。

**落地时已同步**：`docs/config.md` §1 键数 6→14、§3 接回键表；
`docs/servers.md` §3 的 `monitor` 行改「P2a 必填」并删「缺省复用」；
`AGENTS.md` 状态行 / 硬约束 9 / 命令表 / 文档速查表；本文件状态行、§10 与本节标题。

## 12. P2+ 界面实现设计与落地记录（2026-11-07 夜已实现）

> 本节是施工图也是现状：CLI 与网页共用同一份 `Status`，改判据只改 `assess()`。
> 页面细节见 [ui.md](ui.md) §14；真机验收仍未做，见 §12.4。

### 12.1 分层与共用入口

    ops status ─────────┐
                        ├→ monitor.CollectForServer(cfg, list, name)
    GET /api/monitor/status ─┘        ↓
                        Resolve → MonitorSSHTarget → Collect
                                      ↓
                        parseSections → assess → Status（完整快照）

`internal/monitor/collect.go` 是新增的那一块胶水：把「清单选机 → 强制只读账号 →
采集」从 CLI 抽出来，两个入口共用。配置 / 账号没配好时它返回
`monitor.FailureStatus`（一份字段齐全、带 danger 的快照）+ `error`：
CLI 据此退出 `2` 并照常支持 `--json`，界面据此显示「去配置页」引导且**不缓存**。

🔴 **界面直接 import `monitor` 包，不起 `ops status --json` 子进程**：
依赖方向与 `ui → component` 同构（单向、无环），省一次 exe 启动；更关键的是
`ops status` 在检测到 danger 时会往 stderr 打一行 WARN，而现有 `BackupRunner`
把 stdout / stderr 接到同一个 writer，JSON 会被那行文字污染。进程内直采没有这层
解析风险，缓存与注入缝也更好测。

`uiState` 上注入 `probeMonitor`（假采集）与 `monitorNow`（假时钟）：
`go test` 不连真实 SSH、不 `sleep` 等 TTL，全项目惯例。

### 12.2 六道门（服务端 enforce）

1. **只读**：GET、无 `confirm`、不占后台任务锁、不起写脚本；页面没有重跑 / 恢复入口。
   token 与 `Origin` 由 `ServeHTTP` 统一校验，静态产物仍不过 token。
2. **主机只认清单**：严格 `shared.LoadConfig` + `LoadServers`（要连远端，不许拿
   `FallbackConfig` 的默认路径冒充目标机），`name` 空 400、未知 404。
3. **账号强制在能力包内**：`MonitorSSHTarget()` 要求专用只读 `monitor`，
   界面拿不到安装账号，也不会因为「网页想省事」退化成有 sudo 的那个人。
4. **缓存与限流**：30s TTL、5s 最小强制刷新间隔、`monitorMu` 串行化采集；
   多标签页同时刷新合并成一次 SSH，被限流时回 `notice` + 旧快照，不是静默复用。
5. **失败也是完整快照**：连不上 / 配置错一律 `200` + `connection.ok=false` +
   `problems`（恒为数组）+ 数值 `null`；配置错不缓存（补完立刻重试），
   文案取已脱敏的 `Connection.Error`，私钥路径不进 JSON / 日志。
6. **采集脱离 HTTP 请求**：`context.Background()` + `Collect` 自带 30s 总超时，
   不用 `r.Context()`；刷新 / 关标签页不掐断正在跑的只读采集。

### 12.3 页面边界

- 四张卡 + 问题清单只渲染后端 `status`；`web/src/features/monitor/utils/format.ts`
  做的是 `null → —`（0 仍是 0）、数组兜底、单位拼接、默认机选择与缓存文案，
  **不算 danger / 阈值 / 新鲜度**。
- 默认目标机与 CLI 的 `Resolve` 同序（清单 `default` > 唯一 `role=backup`），
  都选不出来就要求人显式选，不擅自挑第一台；配置页新增服务器后靠 `version`
  重新拉清单，切去别的页时 `active=false` 停掉 60s 定时器。
- 本 feature 没有 `service.ts`：唯一的编排是「取数 + 请求竞态」，属页面 UI 状态；
  判定全在 Go 侧，不需要第二层编排。

### 12.4 验收与待做

**已验**：`go vet` / `go test -count=1 ./...` / `go build` 全绿，其中
`internal/ui/monitor_test.go` 覆盖 401 / 门禁 / 完整快照 / 30s TTL / 5s 限流 /
配置错不缓存 / 脱敏 / 连接失败仍完整快照；`internal/monitor/collect_test.go`
覆盖缺 monitor 与未知 name 两条「不连 SSH 就停下」的路径。
前端 `npm test` 85/85 + `typecheck` + `build`，产物已重建进 `ops.exe`。

**真机待做**：在备份机上跑一次 `ops status --server <name>`，并在浏览器里看
四张卡 / 问题清单 / 立即刷新 / 限流提示 / 配置错引导；确认只读账号能读到心跳、
日志与 `.dump`，且远端没有任何文件被写。
