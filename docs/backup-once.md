> 状态：**已实现 · 2026-11-10 22:1x 按 §8 七场景完成真机验收（逐条见 §8.1）**

# 手动备份（立即跑一次）

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)。脚本本体见 [backup-scripts.md](backup-scripts.md)，
> 安装与首跑见 [backup-deploy.md](backup-deploy.md)，只读监控见 [backup-monitor.md](backup-monitor.md)，
> 恢复分册（2026-11-08 已实现 CLI + 界面）见 [backup-restore.md](backup-restore.md)。
> 界面原型见 [backup-once-prototype.html](backup-once-prototype.html)（分区索引
> [backup-once-prototype-map.md](backup-once-prototype-map.md)）：**七个场景就是 §8 的验收用例集**，
> 原型是静态速览，不连远端、不发请求、不执行任何动作。
>
> ✅ 2026-11-08 已落地：`ops backup once` 已注册、`internal/backup/once.go` 与界面第 6 项
> 「手动备份」已实现、`POST /api/backup/run` 支持 `mode=once` / `once-dry`，
> 另有只读的 `GET /api/backup/once/plan`（动作计划）与 `/once/source`（备份对象回显）。
> 同日按界面反馈把「目标服务器 = 备份机、生产端由 backup.env 决定」说清、并精简了页面布局。
> 落地记录见 §7，界面见 [ui.md](ui.md) §15。
> ✅ **真机前置已闭环**（§7.1）：21:4x 重新 `ops backup deploy` 时补锁版已推到备份机，
> 22:1x 只读复核两脚本都带 `flock -n 9`。§8 七场景已验收：`ready` / `locked` / `failed` /
> `busy` 真机跑通，`blocked` / `timeout` / `offline` 由代码判据 + 单测覆盖（未造故障 / 断网）；
> 逐条证据与三处判据修正见 §8.1。✅ 验收发现的 preflight 弱凭证回显已于 22:4x
> 修好、重新部署并真机验证（只改告警一行，判据 / 退出码未动），见 §8.2；
> `common.sh` / 两个 `install.sh` 的前 3 后 3 也已统一成 `***`（§8.3）。

## 1. 现状与缺口（落地前）

「备份」这件事本身是齐的，缺的是**工具侧一个受控的触发入口**。

| 今天已有的 | 为什么不等于手动备份 |
| :--- | :--- |
| 远端脚本可手工跑：`deploy/backup/{postgres,minio}/Makefile` 的 `pg-backup` / `minio-backup` 目标，注释就写着「立即手动执行一次」 | 要人 ssh 上备份机、自己记住部署目录、自己用对身份、自己翻日志；没有预演、没有门禁、没有报告，工具与监控都对这次动作无感知 |
| `ops backup deploy --run-now` | 它是**安装流程的最后一步**：前面必然走「上传脚本 → 换目录 → install.sh（写 crontab / logrotate）→ preflight」。想单独跑一次备份却顺带重部署一遍，语义与代价都不对；界面明确不开放这个开关（硬约束 21 ⑥ / 30） |
| `ops backup verify` | 只跑 preflight，不跑备份；可作为前置，但不是入口 |
| `ops status` 与「备份监控」页 | 纯只读，只看 `last_success.txt` / dump / 心跳；硬约束 31 与 [ui.md](ui.md) §14.1 都不允许它带写动作 |
| 界面五个导航项 | 服务器管理（看）/ 备份能力部署（**装**）/ 环境组件（装）/ 配置（改）/ 备份监控（**看**），没有「**用**」。恢复当时也仍是方案（同日已落地，见 [backup-restore.md](backup-restore.md) §7） |

一句话：**不缺备份逻辑，缺的是「预演 → 显式确认 → 执行 → 如实报告」这条编排**。
因此本能力不新增备份脚本，只在工具侧接一根线到已经躺在备份机上的两个脚本。

> 本节记录的是 **2026-11-08 落地前**的缺口；下表「今天已有的」对脚本与只读监控仍然成立，
> 但「CLI / 界面都没有独立触发入口」已不复存在（见 §7）。

## 2. 加在哪里（2026-11-08 已按此落地）

四层各只加一处，`main.go` 的顶层动词注册表**一行不改**。下表「加什么」已全部实现，
「明确不加什么」是后续改代码时仍要守的边界。

| 层 | 加什么 | 明确不加什么 |
| :--- | :--- | :--- |
| CLI | `internal/backup/once.go`；`CmdBackup` 的 switch 加 `case "once"`，`backupUsage()` 加一行；`deploy.go` 抽出 `streamPreflight` / `runBackupScripts` 给 `deploy --run-now` 与 `once` 共用。`ops backup once [pg\|minio\|all] --server <name> [--dry-run]` | 不新增顶层动词、不给 `deploy` 加新开关、不把 `once` 做成 `deploy` 的子模式 |
| 远端 | `c.backupPath(cfg.DeployDir)` 拼出 `postgres/pg_backup.sh` / `minio/minio_backup.sh`，`t.Stream(..., root=false)` 以清单 `user` 执行；执行前用 `RunScript`（stdin `sh -s`）只读确认脚本已部署 | 不新增 / 不改写备份脚本的备份逻辑、不接收任意路径、不提权（active target 连 sudo 密码都清掉）、不读 crontab |
| 界面 | 第 6 个导航项「手动备份」；`web/src/features/backup/pages/OncePage.tsx` 复用同 feature 的 `api.ts` / `service.ts` / `BackupLog` / 抽出的 `WriteConfirmModal`；`POST /api/backup/run` 增加 `mode=once`（写）与 `mode=once-dry`（只读预演），`GET /api/backup/once/plan` 只读下发动作计划，`GET /api/backup/once/source` 只读回显**备份对象（生产端）** | 不塞进备份监控页、不塞进备份能力部署页、不新增第二个任务锁 / 第二套日志轮询、前端不算指标、不让人猜「到底备份哪台机器」 |
| 文档 | 新建本分册 + 单文件原型与 map + [AGENTS.md](../AGENTS.md) 速查表 | 原型不连远端、不发请求；判据权威仍是本分册（§2.4 / §9） |

### 2.1 为什么是独立子命令，而不是放开 `--run-now`

与硬约束 30「`deps` 是独立子命令，绝不顺带重部署」**完全同构**：
一个动词绑在一次完整安装上，就没法表达「只跑一次备份」。
部署会改 crontab、logrotate、目录属主（[backup-deploy.md](backup-deploy.md) §4），
而手动备份只该产生「一份新 dump / 一次镜像同步」。两者的失败回滚、影响清单、
确认文案都不一样，共用一条命令只会让「我点的到底是哪一个」变成新的事故源。

实现上没有重写：`deploy.go` 的 `streamPreflight` 与 `runBackupScripts` 是两边共用的执行段。
`deploy --run-now` 传 `stopOnFailure=true`（首跑遇错即停的旧语义），
`once` 传 `false`（跑完所有组件再分组件汇总）；`runBackupScripts` 一律 `root=false`。
`deploy_test.go` 的 `TestDeployRunsBackupAsNonRoot` 从源码锁住这两处不提权。

### 2.2 为什么界面是独立页

| 备选 | 判据 | 结论 |
| :--- | :--- | :--- |
| 「备份监控」页加一个「立即备份」按钮 | 该页是纯只读（[ui.md](ui.md) §14.1），且手动备份成功后会写心跳 —— 同一页上的数字会因这次点击而变，读与写混在一屏，最容易让人把「刚刚手动成功」读成「定时任务正常」 | ❌ 与 [backup-restore.md](backup-restore.md) §5.1「恢复不塞进监控页」同一判据 |
| 「备份能力部署」页加一个分区 | 那页是**一次性的装机动作**（安装 / 自检 / 依赖）；手动备份是日常高频运维动作，混排会让「装好了没」和「这次跑成功没」互相干扰。但它复用的门禁、任务锁、日志组件在 `features/backup/` 里，**不放在同一页也能复用** | ❌ 代码省不了多少，语义先乱了 |
| 独立导航项 | 与恢复方案同构；代价只是 `App.tsx` 的 `PageKey` / `NAV_ITEMS` / 一个 `hidden` pane，Go 侧单页回退一行不用改（[ui.md](ui.md) §7） | ✅ **选这个** |

已落地：`App.tsx` 的 `PageKey` / `NAV_ITEMS` / `hidden` pane 加第 6 项，
恢复已落地为第 7 项（2026-11-08，见 [backup-restore.md](backup-restore.md) §7）；
[backup-restore.md](backup-restore.md) §5.3 只钉死「独立导航项」，编号以 `App.tsx` 当期顺序为准。

### 2.3 命名为什么是 `once`

`ops backup run` / `--now` 都会撞上现有三层 `run`：
`deploy --run-now`、`POST /api/backup/run`（任务入口）、恢复的 `ops restore run`
（2026-11-08 已注册；恢复自己的写模式也叫 `mode=restore`，仍复用同一个任务入口）。
`once` 精确表达「**跑一次、不进 crontab、不改定时任务**」，界面 `mode=once` 与之同名，
不引入第三套词。

### 2.4 原型先定下的四条口径（2026-11-08）

原型 [backup-once-prototype.html](backup-once-prototype.html) 的七个场景同时是 §8 的用例集
（分区索引 [backup-once-prototype-map.md](backup-once-prototype-map.md)）。首版把四件最容易在
评审里被写歪的事钉死：

| # | 口径 | 原型里的落点 |
| :--- | :--- | :--- |
| O1 🔴 | 「定时任务状态」恒为**不采集**，不是「运行中 / 已停」；工具不读 crontab | 上下文卡固定标签 + 常驻红线 + 注记 |
| O2 🔴 | 预演只是给人看的只读动作，**不是执行凭证**；服务端每次写动作前自己跑 `--dry-run` | 「预演」按钮的报告 + 弹窗脚注；前端不传「预演通过」令牌 |
| O3 | 撞锁 / 组件失败 / 超时**不是预演能挡住的**：这三个场景的计划仍是 `available=true`，差异只在运行期日志与报告 | `locked` / `failed` / `timeout` 三个 chip；不在计划投影里改成全局阻塞 |
| O4 🔴 | 弹窗**没有 sudo 密码框**（不提权）；`yes` + 两项勾选默认全不勾；每份报告固定带「手动触发不代表定时任务正常」 | 确认弹窗 + 报告底部提示行 |

只有 `blocked` / `offline` / `busy` 才有全局阻塞。四条口径在实现里的落点：
O1 = `oncePlanContext.cron_status` 恒「不采集」+ 页面常驻红线；
O2 = `mode=once-dry` 只读预演 + `isBackupWriteMode` 的服务端预检门；
O3 = 计划接口的 `available` 只看清单与任务锁，运行期结论由 `appendOnceReport` 从任务日志给；
O4 = `WriteConfirmModal` 的 `showPassword=false` + `onceConfirmEnabled`（yes + 两项勾选）。
**原型与本文冲突时改原型**，与 [backup-restore.md](backup-restore.md) §5.0 同规矩。

## 3. 执行契约（已实现）

```
ops backup once [pg|minio|all] --server <name> [--dry-run]
```

退出码：`0` 全部组件成功 / 预演放行，`1` 任一组件失败或 preflight 阻塞，
`2` 参数 / 配置 / 脚本未部署。实现见 `internal/backup/once.go`；
界面另有 `mode=once-dry`（只读预演）与 `GET /api/backup/once/plan`（纯本机动作计划），
两者都不需要 confirm，也不占任务锁（预演本身仍走同一个后台任务）。

🔴 **目标服务器 ≠ 备份对象**（2026-11-08 界面评审后补的口径）：`--server` / 界面下拉选的是
**备份机** —— 脚本执行地、`backup.env`、日志、心跳、dump / 桶都在它上面；被备份的**生产端**
由这台机上的 `PG_SSH_HOST` / `SRC_URL` / `SRC_BUCKETS` 决定，接口不接受另行指定主机（硬约束 12）。
只写一句「生产端由 backup.env 决定」人还是不知道备份谁，所以追加
`GET /api/backup/once/source`：复用只读的 `ops backup compare-env`，只回**白名单非凭证字段**
（PG 主机 / 端口 / 库名 / dump 目录，MinIO 源端地址 / 桶列表 / 备份端地址），URL 去掉
userinfo 与 path，`*_KEY` / `*_SECRET` / `PG_SSH_KEY` 一律不进响应，错误里也滤掉私钥路径；
连不上回 `collected=false` + 完整空快照，**不猜主机、不用 0 兜底**（硬约束 3 / 8）。
要改生产端去「配置」页编辑本机 `backup/{postgres,minio}.env` 并同步到远端，本页只读。

- **`--dry-run` 是只读预演**：跑一次 `preflight_check.sh`（与 `ops backup verify` 同一入口），
  回显将执行的脚本路径、运行身份、组件顺序与**影响清单**（§4.3）；**不执行备份脚本、不改远端**。
  🔴 预演不是执行凭证：服务端每次写动作前自己再跑一遍 `--dry-run`，
  前端拿不到也传不了「预演通过」这个令牌（同 [backup-restore.md](backup-restore.md) R4）。
- **正式执行**：预检 → 按 `pg → minio` **串行** → 分组件汇总。串行是为了两路脚本的锁、
  日志、心跳互不搅在一起，也方便报告里逐项说清哪个组件失败。
- preflight 退出码沿用 [backup-deploy.md](backup-deploy.md) §4.5：`1` 阻塞、`2` 警告放行、
  `0` 放行。🔴 「尚未首次备份」是 `2`，**不能反过来把第一次手动备份挡在门外**。
- `--server` **只认备份机**（同恢复 R2）：它是脚本执行地、`backup.env` 来源、日志与心跳所在地；
  生产端由该机 `backup.env` 决定，接口不接受另行指定主机，也不接受任意脚本路径。
  组件只认 `all|pg|minio`（界面白名单与 `normalizeComponent` 同款）。
- 省略 `--server` 时沿用清单 default / 唯一 `role=backup` 的选机顺序（与 `deploy` / `status` / 监控页同序），不接受任意主机。
- **退出码**：`0` 全部组件成功；`1` 任一组件失败（分组件如实汇总，不许被后一个组件的成功盖掉）；
  `2` 参数 / 配置错。不自动重试、不自动清场；失败不改心跳（脚本本来就只在成功末尾写）。
- 🔴 **报告只报脚本结果**（同恢复 R5）：可以写「`pg_backup.sh` 退出 0，新增 `xxx.dump`」，
  **不许写「备份体系正常 / 定时任务正常 / 服务可恢复」**；也不把 `status` 的心跳当成功凭证。
  要看结果，人去只读的监控页。

界面门禁照抄硬约束 21 的六道门，逐条对齐：

| # | 门 | `mode=once` 的落点 |
| :--- | :--- | :--- |
| ① | `confirm=="yes"` | `once` 进 `isBackupWriteMode`，`handleBackupRun`（confirm 门）与 `runBackupTask`（预检门）共用同一个判据，不会漏一处 |
| ② | 服务端自己先跑 `--dry-run` | `runBackupTask` 先跑 `once <组件> --server <name> --dry-run`，非 0 就地停、不写远端；前端拿不到也传不了「预演通过」令牌 |
| ③ | `name` 只认清单、组件只认白名单 | `backupCommandArgs` 映射为 `once <组件> --server <name>` / `once … --dry-run`；`pg_major` / `targets` / `password` 对 `once` 一律 400 |
| ④ | 密码只经 stdin、日志脱敏 | 🔴 **不收 sudo 密码**：`root=false` 不提权，确认弹窗**没有密码框**（同恢复 R4）；私钥路径 / `SRC_KEY` / `DEST_SECRET` 不进响应与任务日志 |
| ⑤ | 任务脱离 HTTP、单任务锁、增量日志 | 复用 `backupTask` 锁（并发 409）、`?after=` 轮询、256 KB 上限；刷新页面不打断；与部署 / 装依赖 / 重启互斥（硬约束 22 ②） |
| ⑥ | 界面不开放危险参数 | 不发 `--force` / `--install-deps` / `--run-now`，不开放任意路径与定时配置；`parseOnceArgs` 在 CLI 侧也逐个拒绝 |

## 4. 四个必须先想清楚的坑

### 4.1 与 cron 撞车：PG 有锁，MinIO 没有

- `pg_backup.sh` 开头有 `flock -n`：拿不到锁就 `exit 1` 并 warn「上一次备份任务仍在运行中」。
  🔴 报告必须**如实说「被锁挡下，本次未执行」**，不能笼统显示「失败」，更不能自动重试。
- `minio_backup.sh` **没有任何锁**。cron 每天 2:00 跑，人在窗口内手动触发就是两个
  `mc mirror --overwrite` 并发写同一批对象。
- 🔴 **工具不解析 crontab**：[backup-monitor.md](backup-monitor.md) §3.2 已定「装了不等于成功、
  解析会把工具绑到安装脚本的格式」，恢复 R1 又钉死一次。而且工具侧加锁没用 —— cron 那侧不经过工具。
- **已实现的前置修复**：`minio_backup.sh` 已补与 PG 同款的 `flock -n`
  （`LOG_DIR/minio_backup.lock`），位置在 `log` 函数之后、任何实际动作之前；
  `backupdist_test.go` 的 `TestEmbeddedBackupScriptsHaveLocks` 从嵌入产物锁住两个脚本都有锁。
  锁在**脚本内部**，cron 与手动两条路径自然共用，crontab 行一行未改。
- 🔴 **真机前置仍未完成**：本仓 `ops.exe` 已重新构建（硬约束 19），但远端备份机上的脚本
  仍是旧版，必须在备份机上重新 `ops backup deploy` 才拿得到补锁版。在那之前手动与
  2:00 cron 仍有并发风险，正式执行前由人评估；工具不查 crontab、不替人判断定时窗口。
- 界面也别去算「现在几点 / cron 是不是在跑」—— 那是把 crontab 语义偷渡回来。

### 4.2 手动成功会刷新心跳，掩盖 cron 故障

两个脚本都在**全部成功**后写 `last_success.txt`，而监控页的新鲜度只看这个文件（§3.2）。
于是「cron 早就挂了、人手动点了一次」在监控页看起来是「刚刚成功」。

🔴 **不为此改采集协议**：不加「来源」字段、不改 `assess()`、不新增配置键
（[config.md](config.md) 是唯一维护处，硬约束 27 / 28）。
口径是：报告里显式写「**本次为手动触发，不代表定时任务正常**」，
界面文案也要有这一句（不能只写在文档里）；监控页仍是「最近一次成功」；
定时任务是否正常由人判断，工具不查 cron。

### 4.3 一次「手动备份」不只是多一个 dump

| 脚本 | 一次执行实际会做 |
| :--- | :--- |
| `pg_backup.sh` | 按当天日期选 `daily/weekly/monthly`（每月 1 号 → monthly、周一 → weekly）；新建 `.dump` + `globals_*.sql` + 各自 `.sha256`；`find -mtime -delete` **清理三个分级目录**；成功才写心跳 |
| `minio_backup.sh` | `mc alias set`（写 `~/.mc`）；备份端桶不存在时 `mc mb`；逐桶 `mc mirror --overwrite` **覆盖同名对象**；全部桶成功才写心跳 |

所以预演的「影响清单」必须逐条列出，不能只写「将执行一次备份」。
不做「只生成 dump 不清理」的变体 —— 那等于给同一份脚本加第二套语义，
与「不重写备份逻辑」（§2）自相矛盾。

### 4.4 时长与超时

- CLI 侧 `--run-now` 用的是 `timeoutRunNow = 6h`（`deploy.go:31`），
  而界面子进程 `backupSubprocessTimeout` 是 **30 分钟**（`backuprun.go`）。
  `pg_dump` 大库、`mc mirror` 大量对象很容易越过 30 分钟。
- **已实现**：保留界面子进程 30 分钟上限（不放宽，免得一个跑飞的任务长期占着锁）。
  `backuprun.go` 按 `isOnceSubcommand(args)` 给 `once` 定制超时提示，
  `internal/ui/backup.go` 的 `appendOnceReport` 认出这条日志后给「本机已停止等待，
  远端可能仍在执行」的报告；🔴 两者都不写「已取消」，不杀远端进程、不自动重试。
  CLI 侧仍是 `timeoutRunNow = 6h`（与 `deploy --run-now` 共用）。
- 日志：脚本自己 `tee` 到 `pg_backup.log` / `minio_backup.log`，
  工具侧 stdout 只是同一份输出的回显，两处都存在是预期，**别为了去重去改脚本**。
  输出里可能出现 `src_url` / 桶名；🔴 绝不 `cat backup.env`，凭证不进任务日志。

## 5. 与既有能力的边界

| 能力 | 关系 |
| :--- | :--- |
| `backup deploy --run-now` | 仍是「装完首跑」，不改造、不删除；与 `once` 共用抽出来的「按组件串行跑脚本」函数 |
| `backup verify` | `once --dry-run` 复用它的 preflight；`verify` 自己仍不跑备份 |
| `status` / 备份监控页 | 判据、采集协议、阈值**一行不改**；手动备份的结果由人去那页看（§4.2） |
| `restore`（2026-11-08 已实现，见 [backup-restore.md](backup-restore.md) §7） | 方向相反：备份是「生产端 → 备份端」，恢复是「备份端 → 生产端」；两者都独立成页、都不塞进监控页、都不查 crontab、共用同一把任务锁。确认弹窗复用同一个 `showPassword=false` 的组件，但**门禁内容不同**：恢复加库名两次逐字比对 / MinIO `YES` / 三项前置 / 覆盖生产额外勾 |
| `component install/uninstall` | 手动备份只要求脚本与依赖已就位；不装、不卸、不改容器与镜像 |
| `ops.env` / `backup.env` | **不新增任何键**；部署目录、组件目录、凭证仍只从既有配置读 |

## 6. 不做

🔴 定时 / 自动触发、读或改 crontab、另选生产主机、任意脚本路径、提权或收 sudo 密码、
给手动备份单设账号或凭证、自动重试、自动清理旧备份、把结果写回 `status` 的判据、
把写动作塞进监控页、`--force`、界面内嵌终端、把手动备份包装成新的调度器。

## 7. 落地记录（2026-11-08）

| # | 做了什么 | 落点 |
| :--- | :--- | :--- |
| 1 | `minio_backup.sh` 补 `flock -n`（**本仓侧已完成**）；远端的 `ops backup deploy` 见 §7.1 | `deploy/backup/minio/minio_backup.sh` + `backupdist_test.go` 的锁断言 |
| 2 | `ops backup once` 独立子命令；抽出 `streamPreflight` / `runBackupScripts` 给 `deploy --run-now` 与 `once` 共用 | `internal/backup/once.go`、`internal/backup/deploy.go`、`internal/backup/once_test.go` |
| 3 | `mode=once`（写）/ `mode=once-dry`（只读预演）；`isBackupWriteMode` 一个判据管两处门；不收 sudo 密码；超时提示与 `appendOnceReport` 报告；只读计划接口 + 只读备份来源接口 | `internal/ui/backup.go`、`internal/ui/once.go`（plan + source）、`internal/ui/ui.go`、`backuprun.go`、`internal/ui/once_test.go` |
| 4 | 第 6 个导航项「手动备份」；「目标服务器 = 备份机 / 备份对象 = 生产端」说清并回显生产端；计划由服务端下发、前端只渲染；确认弹窗抽成共用组件，`showPassword=false`；日志空态不占高度 / 有输出才显示日志框（120–240px）、去掉 Steps、计划三框加宽、命令与注释分行、日志卡补内边距 | `web/src/features/backup/pages/OncePage.tsx`、`components/WriteConfirmModal.tsx`、`components/BackupLog.tsx`、`index.css`、`App.tsx`、`types/api/service/utils`、`web/test/once.test.ts` |
| 5 | 文档与原型回改 | [ui.md](ui.md) §15、[AGENTS.md](../AGENTS.md) 状态 / 硬约束 32 / 命令表 / 速查表、[backup-scripts.md](backup-scripts.md) §6、[backup-restore.md](backup-restore.md) §5.3、原型与 map 的「交互基线」状态 |
| 6 | 重建产物 | `npm test` / `typecheck` / `build` + `go vet` / `go test ./...` / `go build -o ops.exe .`（`__dist-check` 通过）；**没有新增任何 `ops.env` / `backup.env` 键**，文档键断言仍绿 |

### 7.1 真机前置（2026-11-10 已闭环）

✅ **21:4x 重新 `ops backup deploy all --server k4` 时已把补锁版推到备份机**（那次部署是
为 `pg_restore.sh` 的 stdin 修复，见 [backup-restore.md](backup-restore.md) §7.6 / §7.8）。
22:1x 验收前只读复核：`pg_backup.sh` / `minio_backup.sh` 都含 `flock -n 9`（各 1 处），
锁文件分别是 `/var/log/pg-backup/pg_backup.lock` 与 `/var/log/minio-backup/minio_backup.lock`；
crontab 4 条属主 `cql`、远端 `backup.env` 保留。硬约束 19 仍成立：**以后改
`deploy/backup/**` 仍必须重新部署才生效**。

### 7.2 回归要点

`go vet ./...`、`go test ./...`（CLI 参数门 / 只读检查脚本 / 分组件汇总、UI 六道门 / 计划接口 / 报告措辞、
嵌入脚本锁断言 / 文档键断言）、`cd web && npm test && npm run typecheck && npm run build`、
`go build -o ops.exe .`。改了 `web/` 或 `deploy/backup/**` 两步都不能省（§3 / 硬约束 19、26）。

## 8. 验收（2026-11-10 已执行，逐条结论见 §8.1）

> **状态**：§7.1 前置已闭环、七场景按 §8.1 验收完毕；下表判据仍是唯一基准，
> 其中「正常一次」一行已按 §4.2 口径修正（文案在报告里，监控页无来源字段）。
>
> **用例集 = 原型七个场景**（同为评审用例）：`ready` → 预演 / 正常一次；`blocked` → preflight 阻塞；
> `locked` → 撞锁与 cron 窗口；`failed` → 分组件汇总；`timeout` → 30 分钟超时；
> `offline` → 完整快照；`busy` → 409 任务锁。下表「门禁 / 隔离与脱敏」两条由确认弹窗与任务日志演示。

| 用例 | 判据 |
| :--- | :--- |
| 预演 | `--dry-run` 前后远端文件、`last_success.txt`、桶内容完全一致；只有 preflight 和计划输出 |
| 正常一次 | 备份端新增 dump（MinIO 为 `mc mirror --overwrite` 同名覆盖、对象数不变），脚本退出 0，报告**只报脚本结果**；两个心跳变新鲜；固定提醒「手动触发不代表定时任务正常」在**报告**里（监控页按 §4.2 只显示「最近一次成功」，无来源字段） |
| preflight 阻塞 | 自检 `1` 时不执行脚本；`2`（尚未首次备份）放行 |
| 撞锁 | 与正在跑的 PG 备份重叠时如实报「被锁挡下，本次未执行」，不重试、不改心跳 |
| 与 cron 窗口重叠 | 补锁后的 MinIO 手动与定时两路只有一路真正 `mc mirror`，另一路被锁挡下；工具**没有**跑过 `crontab -l` |
| 超时 | 超 30 分钟时报告写「远端可能仍在执行」，不写「已取消」；不自动重试 |
| 门禁 | 缺 `confirm` / 未知 `name` / 任意路径 / 越权组件 / 带 `targets` 都被服务端拒绝；弹窗无 sudo 密码框；备份期间部署与重启 409 |
| 隔离与脱敏 | 期间 `ops status` 与监控页仍只读；crontab / `backup.env` 不被改动；HTTP 响应与任务日志无私钥路径与凭证 |

### 8.1 2026-11-10 22:1x 验收记录（真机 k4）

> **范围**：沿用 21:4x 已重新部署的远端脚本（§7.1 前置已闭环）。只读动作 + 两次正式
> `once`（撞锁仿真、正常一次），以及一个本地 UI 实例的 HTTP 门禁；没有改远端配置、
> 没有动 crontab、没有造破坏性故障。原型七场景语义不变。

**① 逐条结果**

| 用例 | 结果 | 证据 |
| :--- | :--- | :--- |
| 预演 | ✅ | `--dry-run` rc=0；前后快照逐项一致（4 个备份文件、两个心跳内容 + mtime、crontab 指纹、两个 `backup.env` 指纹、三个桶对象 hash）；输出含「没执行脚本 / 没产生 dump / 没写心跳 / 不代表定时任务正常 / 工具不读 crontab」 |
| 正常一次 | ✅ | `once all` rc=0、`pg 0 / minio 0`；新增 4 个文件（dump + globals + 两个 sha256）；两个心跳刷新到 `14:19:59` / `14:20:02`；`ops status --json` 的 `problems=[]`；报告「只报脚本结果」+「这不等于备份体系正常」+ 固定手动触发提醒 |
| preflight 阻塞 | ⚠️ 未真机造 rc=1 | `internal/backup/once.go` 判据 `code==1` 停 / `code==2` 放行（§3 门②），`once_test.go` 覆盖；真机 preflight 正常路径多次实证。不为了造阻塞去改远端 `backup.env` |
| 撞锁 | ✅ | 远端短暂持住 `minio_backup.lock`（`flock -n 9`，`HELD` 探针确认），`once all` 里 MinIO 报「上一次备份任务仍在运行中，本次执行取消」退出 1；不重试、不清场、MinIO 心跳未变 |
| 与 cron 窗口重叠 | ✅ | §7.1 前置实证：远端 `pg_backup.sh` / `minio_backup.sh` 都带 `flock -n 9`；持锁仿真等价「两路只有一路真正 `mc mirror`」；工具全程没读 crontab（前后指纹一致） |
| 超时 | ⚠️ 未真机等 30 分钟 | `backuprun.go` / `internal/ui/backup.go` 的「本机已停止等待，远端可能仍在执行」、`once_test.go:298` 覆盖「不写已取消、不自动重试」；不为了造超时挂 30 分钟 |
| 门禁 | ✅ | 本地 UI 实例 11 个非法请求全被拒：缺 confirm / `YES` / 带 password / 带 `targets` / 带 `pg_major` / 越权组件 / 未知 mode / 缺 name → 400，未知 name → 404；无 token → 401；错误 Origin → 403。弹窗 `showPassword=false`（代码判据 + 前端单测） |
| 隔离与脱敏 | ⚠️ 见 ③ | crontab 与两个 `backup.env` 指纹前后一致、`ops status` / 监控页仍只读、`once/plan` / `once/source` / `monitor/status` 响应无凭证串 |
| busy | ✅ | 并发第二个 `once-dry` 任务 → 409「已有备份任务在运行，等它结束再试」 |

**② 原型七场景对账**：`ready`（预演 + 正常一次）✅、`locked` ✅、`failed`（`pg 0 / minio 1` 分组件汇总）✅、`busy` ✅ 为真机；`blocked` / `timeout` / `offline` 未真机造故障或断网，由代码判据 + 单测覆盖（`status_test.go` 的「连不上仍回完整快照」、`once_test.go:265` 的完整快照、`once_test.go:298` 的超时报告）。三者的计划仍是 `available=true`，差异只在运行期日志与报告 —— 与原型 `data-runtime` 口径一致。

**③ 🔴 验收发现（既有行为，不是 `once` 引入）**

- §8 表格原写「监控页心跳变新鲜且文案注明手动触发」，与 §4.2「不改采集协议、监控页只显示最近一次成功」冲突：`ops status` / 监控页**没有**「手动触发」字样，这句固定在**手动备份报告**里。判据已按 §4.2 修正，原型 `data-scenes` 语义不变。
- MinIO 是 `mc mirror --overwrite` **同名覆盖**，对象数不变（87/1/0），不是「新增对象」；判据已改成「新增 dump、桶内同名对象被覆盖」。
- `preflight_minio.sh` 的「疑似占位符/弱凭证（`12345678`）」把配置里的弱凭证字面值打进了任务日志；`SRC_SECRET` / `DEST_SECRET` 的值显示 `***`（脱敏正确），`PG_SSH_KEY` / `id_rsa` 只是「未配置时用默认密钥」的提示文字。`once` 本身没有读或回显 `backup.env`（`once.go` 红线成立），回显来自既有 preflight 脚本。✅ **22:4x 已按用户选的「只改告警一行」修好、重新部署并真机验证，见 §8.2**；当时「本轮没改脚本」是验收时的瞬时状态。
- 撞锁仿真结束后，本地 ssh 断开使远端 `timeout 90 bash -s` 成为孤儿仍持锁，已按 PID 精确清理并复核 `FREE`；没有影响后续正常一次，也没有残留进程。

**④ 环境状态（验收后，不回基线）**：心跳刷新到 `2026-11-10 14:19:59`（PG）/ `14:20:02`（MinIO），`ops status` 两条 danger 消失；`daily/` 共 12 个文件（11-08 四个 + 两次手动各四个）；crontab 4 条、远端 `backup.env` 未改、桶对象数 87/1/0。🔴 **心跳新鲜是手动触发的结果，不代表定时任务正常**（§4.2）；下一次自动备份仍是 `11-11 02:00 UTC`（北京 10:00，MinIO）/ `03:00 UTC`（北京 11:00，PG），[backup-monitor.md](backup-monitor.md) §3.2.1 的关机诊断仍有效。

### 8.2 2026-11-10 22:4x：修掉 §8.1 ③ 的弱凭证回显（已部署并真机验证）

> **范围**：用户选「只改告警一行 + 立即部署」。只改 `deploy/backup/preflight_minio.sh`
> 的 `warn` 文案；判据 `*CHANGE_ME*|*YOUR_*|*123456*|admin`、循环、退出码、
> 其它脚本、`ops backup deps` 语义全部一行未动。

**① 改动**：`${val}` 仍用于 `case` 判据，但不再拼进任何输出：

```bash
warn "[${v}] 疑似占位符/弱凭证（值已脱敏，不回显），请到 backup.env 替换为真实凭证"
```

键名 + 告警类型 + 处置建议保留，人靠 `[SRC_SECRET]` 就能定位；**信息损失只有值本身**。

**② 断言**：`backupdist_test.go` 新增 `TestEmbeddedPreflightMinioWeakCredentialNotEchoed`，
从嵌入产物读源码锁住「判据仍在 / 告警仍在 / `warn` 行不含 `${val}`」；三种改坏
（改回 `（${val}）` / 删判据 / 删告警）实测全红，还原全绿。

**③ 部署**（改 `deploy/backup/**` 必须重新部署，硬约束 19）：`--dry-run` 确认保留远端配置
→ `ops backup deploy all --server k4` rc=0（未加 `--run-now` / `--force`）→
`preflight_minio.sh` **13696 B → 13961 B**、`cql:cql`、旧回显 0 处、新文案 1 处、
`*123456*` 判据 1 处；crontab 4 条、两个 `backup.env` 指纹不变、
`pg_restore.sh` 仍 11163 B、心跳与 `problems=0` 都未被扰动。

**④ 真机验证**：部署过程的 preflight 输出「通过，但有 **18 项警告**」（警告数不变，
判据与退出码一行未改）、全文 0 处 `12345678`。再起本地 UI 实例跑 `once-dry` 抓
`GET /api/backup/task` 完整日志：不含 `12345678`、含「值已脱敏，不回显」4 条、
含固定手动触发提醒、体检结论仍 18 项警告、其它凭证串无命中。

**⑤ 边界**：只保证修复后的新输出干净，**已经写进远端日志或旧任务日志里的
`12345678` 不回溯清除**（清历史日志是另一个写动作，本轮没做）。
✅ 「`common.sh` / 两个 `install.sh` 的前 3 后 3」已于 22:5x 按 L2 收干净（§8.3）；
🔴 只剩 `*123456*` 子串误报（L3）未做 —— 改判据会改变告警行为，需单独确认。

### 8.3 2026-11-10 22:5x：统一凭证展示口径（§8.2 ⑤ 的 L2，已部署并真机验证）

> **范围**：用户选 L2。只把 `deploy/backup/lib/common.sh` 的 `check_required_var` 与两个
> `install.sh` 的 `print_var` 从「前 3 后 3」改成恒 `val="***"`；敏感键名单、空值判定、
> 退出码、其它脚本一行未动。L3（`*123456*` 子串误报）仍未做。

**① 改前后对照（真脚本函数 + 假长凭证 `SuperSecret-Value-987654321`）**

| 位置 | 改前 | 改后 |
| :--- | :--- | :--- |
| `common.sh:check_required_var` | `Sup...321` | `***` |
| `postgres/install.sh:print_var` | `Sup...321` | `***` |
| `minio/install.sh:print_var` | `Sup...321` | `***` |

短凭证（≤8）改前改后都是 `***`；🔴 **当前远端凭证 `admin` / `12345678` 都 ≤8，
所以真机 preflight / 部署输出看不出差异** —— 修复效果由长凭证函数级对照实证与
嵌入产物断言保证，不是靠「输出没变」假装通过。改后又用**远端部署后的真脚本**
（source `common.sh` + 抽出两个 `print_var`）各喂一次长凭证，三处都返回 `***`。

**② 断言**：`backupdist_test.go` 新增 `TestEmbeddedBackupScriptsNeverShowCredentialFragments`，
从嵌入产物锁住三份脚本恒 `val="***"`、禁止 `${val:0:3}` / `${val: -3}`、
敏感键名单仍在；三种改坏（改回前 3 后 3 / 丢统一脱敏 / 丢敏感键名单）全红、还原全绿。

**③ 部署与落地**：全套验证 + `go build -o ops.exe .` + `__dist-check`；
`--dry-run` 确认保留远端配置 → `ops backup deploy all --server k4` rc=0
（未加 `--run-now` / `--force`）。远端三份脚本 `OLD_FRAG=0 / MASKED=1`，
`preflight_minio.sh` 仍 13961 B 带 §8.2 的新告警（没被覆盖）；crontab 4 条、
两个 `backup.env` 指纹不变、心跳与 `problems=0` 未扰动。
部署输出里 install 的「当前配置概览」与 preflight 的必填校验都显示 `***`，
体检结论仍是「通过，18 项警告」，全文 0 处凭证片段。

**④ 🔴 仍未做**：L3 —— `*CHANGE_ME*|*YOUR_*|*123456*|admin` 里的 `*123456*` 是子串匹配，
任何含 `123456` 的真实强凭证都会误报；改判据会改变告警行为，需单独确认。
另外「当前配置概览」现在对凭证只显示 `***`，人无法从输出区分两个不同的凭证值
（这是刻意的信息损失，定位靠键名）。

## 9. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| 先补文档、不动代码 | 直接做 `ops backup once` | 它是远端写动作，且和 cron、心跳、清理三件事纠缠；先把脚本的真实行为与口径写清，代码阶段照 §8 逐条验收 |
| 独立子命令 `once` | 复用 / 放开 `deploy --run-now` | 一个动词绑在完整安装上就没法表达「只跑一次」；与硬约束 30 同构（§2.1） |
| 复用已部署的 `*_backup.sh` | Go 里重写备份逻辑 | 两个脚本已在备份机上、已 embed、cron 也在跑它们；重写会造出第二套备份语义，且工具侧这套无法真机验证（同恢复 §6） |
| 界面独立页 | 监控页加按钮 / 部署页加分区 | 读与写不混屏；与恢复方案同判据；Go 侧零路由改动（§2.2） |
| 不查 crontab，改为**脚本内补锁** | 解析 crontab 避开定时窗口 | 工具侧加锁管不到 cron 那一路；解析会把工具绑到安装脚本的格式（[backup-monitor.md](backup-monitor.md) §3.2 / 恢复 R1） |
| 不改采集协议，靠文案区分手动/定时 | 给心跳加「来源」字段 | 心跳文件是无时区本地时间、由脚本写，加字段要同时改脚本 / 采集 / 前端，且仍解释不了「cron 挂没挂」（§4.2） |
| **补单文件原型**（2026-11-08，用户要求「先补原型」） | 只靠一张契约表评审 | 单文件可双击、> 500 行且会反复局部改，命中 [prototype-conventions.md](prototype-conventions.md) §2 三条判据；原型真正要评的不是候选清单（本能力没有），而是**确认弹窗门禁、影响清单、四种失败报告的措辞**。七个场景直接当 §8 用例集，评审与验收闭环（同恢复 §5.7） |
| **把备份对象只读回显出来**（2026-11-08 界面反馈） | 只在文案里写「生产端由 backup.env 决定」，或干脆开放「另选生产主机」 | 「不能指定」不等于「不用说明」：人不看 backup.env 就不知道备份谁；开放另一套主机会撞硬约束 12 并造出第二套配置来源。用 `compare-env` 的白名单非凭证投影回答，既不改配置模型也不泄漏凭证 |
| **按原型落地，原型不删**（2026-11-08，用户要求「落地」） | 把原型当一次性草图丢掉 / 只落 CLI | 四条口径（§2.4）与七场景就是实现与验收的共同基线：实现里 `oncePlanContext.cron_status`、`mode=once-dry`、`appendOnceReport`、`WriteConfirmModal(showPassword=false)` 逐条对应；原型留作交互回归基线，状态从「方案 / 未实现」改为「已实现 / 交互基线」 |
