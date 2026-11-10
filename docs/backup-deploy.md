> 状态：**已实现（P1，2026-11-05 已在测试机验证）**

# 备份能力部署（安装与升级）

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)；配置键见 [config.md](config.md)。

## 1. 要解决什么

把本仓 `deploy/backup/**` 的脚本、配置、cron、logrotate 一次性装到备份服务器。

脚本本身随二进制分发（`//go:embed all:deploy/backup`，见 [backup-scripts.md](backup-scripts.md)），
所以 `ops.exe` 单独拷到任何机器上都能部署，**不再依赖当前工作目录或兄弟仓**。

历史上是两步手工：`backup_sync.sh`（rsync 推目录）+ `ssh` 上服务器跑 `install.sh`。
那条路径已在 2026-11-05 删除（Windows 开发机没有 rsync、且不注入配置/不装 logrotate/不跑 preflight）。

目标：`ops backup deploy` 一条命令完成「预检 → 上传 → 配置 → 安装 → 自检 → 交付监控」。

它是**监控的前置**：`last_success.txt` 由备份脚本写入，装好之后
[backup-monitor.md](backup-monitor.md) 才有数据可读。

**不做**：重写 `install.sh` 的安装逻辑；数据恢复（见 [backup-restore.md](backup-restore.md)）；
应用部署（见 [deploy.md](deploy.md)）。

## 2. 与监控的边界

| | 备份监控（只读） | 本文（安装） |
| :--- | :--- | :--- |
| 动作 | 只读采集 | 写目录 / crontab / logrotate |
| 账号 | 清单的 `user`/`key`（与安装同一个账号） | 安装期 `user` + `sudo`；运行期就是 `user` 本人 |
| 入口 | `status`（P2a 已实现）、界面默认视图、预检 `--dry-run`、`backup verify` | `ops backup deploy`、界面「备份能力部署」里输过 `yes` 的安装 |

🔴 **绝不自动触发安装**：双击落地页只读、`status` 只读；界面安装要人点按钮 + 输 `yes`
+ 服务端预检通过。2026-11-08 起监控与安装**共用清单里的同一个账号**，
「只读」由远端采集脚本保证（不写文件、不提权），不靠换账号降权。

🔴 **远端分两层身份（2026-11-06 起）**：安装期（写 `/etc/logrotate.d`、建系统级目录、
清理旧 crontab）才由 `sudo -n sh -c` 提权到 root；装出来的 crontab、定时备份脚本、
`preflight` 自检、`--run-now` 首跑**一律以清单 `user` 运行**。这样 `~/.ssh/known_hosts`、
`~/.mc`、私钥、目录权限与备份机上手敲的 ssh 是同一套，杜绝「手工能连、自检说连不上」
和「自检过了、cron 却失败」。详见 §4.4 与 [backup-scripts.md](backup-scripts.md) §4.1。

> **2026-11-05 改红线**：旧表述「`status` / `ui` 绝不触发安装」已作废 ——
> `ui` 现在有**显式**安装入口（见 §10），但「绝不自动触发」这条不变。
> 判据与新边界见 [ui.md](ui.md) §9 与 [AGENTS.md](../AGENTS.md) 硬约束 9/15/21。

## 3. 命令

```
ops backup deploy [pg|minio|all] [--server <name>] [--dry-run] [--force] [--run-now] [--install-deps]
    all（默认）：postgres → minio
    --server        目标机（来自 servers.json，见 docs/servers.md）；省略用清单的 default
    --dry-run       只预检并打印将执行的远端命令，不改远端任何文件
    --force         用本机 backup.env 覆盖远端配置（覆盖前先备份）
    --run-now       安装成功后立刻跑一次备份（默认关闭：这是写操作，且可能很重）
    --install-deps  安装缺失依赖（apt/dnf/yum；mc 官方下载失效时从本机 minio 镜像提取）；
                    --dry-run 下只报告不安装
    --pg-major      只用于下面的 backup deps
    --password-stdin
                    从 stdin 读初始 sudo 密码（**没有 --password 参数**）；
                    清单里已配 sudo.password 时以清单为准，界面部署走这条

ops backup deps [pg|minio|all] --server <name> [--json] [--dry-run] [--pg-major <n>]
    只安装缺失依赖（mc / pg_restore / cron / nc / ...），不上传脚本、不写 crontab /
    logrotate / backup.env、不跑备份；装完自动复查
    --json          只读结构化状态（界面 GET /api/backup/deps 的数据源）
    --dry-run       只报告缺失项与安装计划，不改远端任何文件
    --pg-major <n>  按 PostgreSQL 官方 PGDG apt 仓库装 postgresql-client-<n>；
                    不给则装发行版仓库的 postgresql-client
    --password-stdin 同 deploy

ops backup deps-uninstall --server <name> --target <mc|pg_client> [--target ...] [--dry-run]
    只卸载工具装的 mc / PG 客户端，供「卸了再装」复测；界面同款动作，要输 yes
    --target mc         只删 /usr/local/bin/mc（不碰 ~/.mc / 容器 / 镜像）
    --target pg_client  apt remove postgresql-client / postgresql-client-<n>
                        / postgresql-client-common（不 autoremove / purge、不删 PGDG 源、不动服务端）
    --dry-run           只打印将执行的远端命令，不改远端任何文件
    不提供卸载 cron / nc / ssh / scp / tar / logrotate（系统基础包）

ops backup verify [pg|minio|all] [--server <name>] [--password-stdin]
    只跑远端 preflight_check.sh，不安装、不备份

ops backup env [pg|minio|all]
    把嵌入的 backup.env.example 落到配置目录 backup/{postgres,minio}.env
    （已存在不覆盖；脚本树里不放真实凭证，所以模板必须由这条命令给出）

ops backup sync-env [pg|minio|all] --server <name>
    只把本机填好的配置推到远端 <组件>/backup.env（0600，旧文件留 .bak）
    不重跑 install.sh、不动脚本与 crontab；占位符配置会拒绝同步
    界面「配置」页的「同步到远端」走这条，见 ui.md §12

ops backup compare-env [pg|minio|all] --server <name>
    只读：一条 cat 抓远端 backup.env，输出脱敏后的键值（JSON）
    凭证只给掩码 + 指纹（shared.EnvFingerprint），明文不进 stdout；失败如实回原因
    界面「配置」页的远端值对照走这条，见 ui.md §12.5
```

## 4. 部署流程

### 4.1 预检

- 本机：嵌入的 `deploy/backup/**` 完整（缺 `install.sh` / `preflight_check.sh` /
  `lib/common.sh` / `*.logrotate` 时在连远端之前就失败）；本机 ssh 可用；**不要求本机有 `rsync`**。
- 远端：目标机由 `--server` 从 [servers.json](servers.md) 选择；**安装期**提权用该条目的
  `user` + `sudo`（已免密走 `sudo -n`；否则用清单 `sudo.password` 或界面/`--password-stdin`
  经 **ssh stdin** 走 `sudo -S -p ''`，密码不出现在命令行/日志），**运行期固定为同一个
  `user`，不提权**；依赖命令 `ssh` / `scp` / `pg_restore` /
  `mc` / `logrotate` / `crontab` 逐项报告；缺失时**默认只报告**，加 `--install-deps` 才安装
  （`--dry-run` 永不安装）；只想补命令时走独立的 `ops backup deps`（§10.2），
  不会顺带重部署脚本；
- 磁盘余量、`/data` 与日志目录可写；
- **目录漂移检查**：运行用户与 root 两份 `crontab -l` 里带 `#PG_BACKUP` / `#MINIO_BACKUP`
  的行会包含脚本绝对路径（迁移期两种都要看，旧任务还留在 root 名下）。
  若与 `PASS_UP_OPS_BACKUP_DEPLOY_DIR` 不一致 → **直接失败**，提示改配置，
  不静默迁移（见 §5）。

### 4.2 上传与换目录

- 用 `tar -czf -` 从 stdin 走 ssh，stdin 解包到 `<deploy_dir>.new`；
  **排除** `backup.env`、`sync.env`、`*.log`、心跳文件、`.deploy/`。
- 换目录前：
  1. 把现有 `<deploy_dir>` 备份成 `<deploy_dir>.old`（保留一份）；
  2. 把旧目录里的 `postgres/backup.env`、`minio/backup.env` 复制进 `.new`
     （本次要「上传新配置」的组件除外；**未参与本次部署的组件配置也必须保留**——
     曾因只保留选中组件，重部署单组件把另一组件的 `backup.env` 弄丢）；
  3. `mv` 换名。cron 里引用的绝对路径不变。
- Windows 开发机不一定有 `rsync`，因此不用 `backup_sync.sh` 的 rsync 路径；
  tar 流由 Go 标准库生成。

### 4.3 配置

- 本机配置来自 `PASS_UP_OPS_BACKUP_PG_ENV_FILE` / `..._MINIO_ENV_FILE`
  （默认是配置目录的 `backup/postgres.env` / `backup/minio.env`，**不入 Git**；
  模板用 `ops backup env` 生成，键定义只在 `deploy/backup/<组件>/backup.env.example` 维护）。
- 上传前校验：文件存在、无 `CHANGE_ME` / `YOUR_` 占位符、键名与
  `backup.env.example` 对得上（**字段定义不在这份文档里复制**）。
- 远端必须存在有效配置才允许安装：
  - 有本机配置 → 上传（`--force` 才覆盖远端已有配置，且先备份）；
  - 无本机配置但远端已有有效配置 → 保留，继续；
  - 两者都没有 → 失败，提示先按 `backup.env.example` 准备。
- 远端 `backup.env` 权限 `600`；凭证与私钥路径**不打印**。
- 🔴 `PG_SSH_KEY` 是**备份服务器上**的私钥路径，工具不搬运私钥；部署前需已存在。

### 4.4 安装

- 依次执行远端 `BACKUP_RUN_USER=<user> bash <deploy_dir>/{postgres,minio}/install.sh`
  （由 `sudo -n sh -c` 包着以 root 执行，**stdin 关闭**：脚本里的 `read` 走默认分支）。
  工具显式传 `BACKUP_RUN_USER`，不依赖 `SUDO_USER` 推导。
- 🔴 `install.sh` 虽以 root 跑，装出来的东西全部归属运行用户：
  - `crontab -u <user> -` 把定时任务装进该用户的 crontab，`CRON_HOME` 取该用户的家目录；
  - 日志目录 / PG 备份根目录由 root 预建并 `chown -R <user>:<组>`，之后 cron 与自检都不再需要 sudo；
  - Step 2 的 SSH 探测、Step 6 的 preflight 用 `sudo -n -u <user> -H` 降权执行；
  - 清理旧版本留在 **root crontab** 里的同标签任务（只删带标签的行、其它条目原样保留），
    否则升级后每天会双跑；
  - cron 行只用 `/bin/sh` 语法：`>/dev/null 2>>日志`。不用 `2> >(sed ...)`（cron 默认
    不是 bash）、不写 `$(date ...)`（会在**安装期**展开成固定时间戳，Makefile 里还会被
    make 当变量吃成空）、不出现裸 `%`（crontab 特殊字符）。脚本内部已 `tee -a` 落盘
    带时间戳的业务日志，这里只兜底 stderr。
- 复用脚本已有的幂等逻辑：`backup.env` 存在就不覆盖、cron 按标签先删后加。
- 🔴 `install.sh` 对 logrotate **只提示不安装**：工具在安装前把
  `pg_backup.logrotate` / `minio_backup.logrotate` 落到
  `/etc/logrotate.d/{pg,minio}-backup`（权限 644），并把模板里的
  `su __BACKUP_USER__ __BACKUP_GROUP__` 占位符替换成运行用户与主组 ——
  日志目录属主不是 root，不带 `su` 时 logrotate 会因「目录不安全」直接跳过轮转。

### 4.5 自检与首跑

- 执行 `bash <deploy_dir>/../preflight_check.sh pg|minio|all`，`ops backup verify` 与
  deploy 收尾都走 `Stream(root=false)` —— **以清单 `user` 执行，不套 sudo**。
  它的 `known_hosts` / `crontab -l` / 目录写权限与 cron 里的备份脚本完全一致；
  `install.sh` 内部那次 preflight 也降权到同一身份。
  - `0` 通过；`2` 有警告（如尚未首次备份）→ 继续但输出警告；
  - `1` 有错误 → **恢复 `.old` 目录并重跑 install.sh**，然后失败退出。
  - 🔴 `preflight_minio.sh` 的弱凭证告警**不回显凭证值**（只报键名 +「值已脱敏，不回显」，
    2026-11-10 修，见 [backup-once.md](backup-once.md) §8.2）：preflight 输出会被
    deploy / verify / `once` 原样转进任务日志，值一旦拼进去就会落到日志里。
  - 🔴 「当前配置概览」与必填项校验对 `KEY` / `SECRET` / `PASSWORD` / `TOKEN` 一律显示 `***`
    （不再用「前 3 后 3」，2026-11-10 §8.3）；`install.sh` 与 `preflight` 输出都会进日志。
  - 🔴 弱凭证判据用**全值精确匹配**（`123456` … `1234567890` / `admin`），占位符仍用
    子串匹配（`CHANGE_ME` / `YOUR_`）；旧口径 `*123456*` 会把含 `123456` 的强凭证误报，
    精确匹配的代价是「弱前缀 + 后缀」会漏报（2026-11-10 §8.4 / L3，改判据单独一轮）。
- `--run-now` 才执行 `pg_backup.sh` / `minio_backup.sh`，同样以 `user` 运行；成功后
  `backup-monitor` 的 `status` 立刻能看到心跳。

### 4.6 交付监控

安装成功后打印需要填进 `ops.env` 的监控键（`PASS_UP_OPS_BACKUP_*`），
并提示：备份监控沿用清单里的同一个账号，装完可直接 `ops status --server <name>` 看心跳。

## 5. 幂等、升级与失败恢复

- 重复执行 `backup deploy` = 升级：脚本换新，配置默认保留，cron 重写为当前路径。
- 已有安装升级时，`PASS_UP_OPS_BACKUP_DEPLOY_DIR` **必须等于现有路径**
  （工具同时反查运行用户与 root 两份 cron 标签行并校验），否则拒绝执行。
- 失败恢复：`.old` 目录保留；`preflight` 失败自动回滚脚本并重跑 install.sh。
  🔴 回滚重跑的是**旧版** install.sh（会把任务装回 root），所以 `failAfterInstall`
  会先 `revokeRunUserCrontab` 撤掉本次写进运行用户 crontab 的标签行，避免两套任务
  每天双跑（2026-11-06 211 真机踩过）。回滚后仍建议人工核对两份 crontab。
- 🔴 **从旧版本（root 运行）升级的迁移是写操作**：`chown -R` 日志/备份目录、
  清掉 root crontab 旧任务、把任务改写到运行用户 crontab。这三步由 install.sh 在
  一次部署里完成，都是幂等的（内容没变就不写回）；升级前建议先跑一次
  `ops backup deploy --dry-run` 看计划，升级后再点一次「远端自检」核对
  `crontab`、SSH 连通与 `known_hosts` 是否都已落到同一身份。
  **不自动回滚配置**（配置回滚会让「哪版凭据生效」说不清，需人工确认）。
- 不提供 `uninstall`：删 cron / logrotate / 历史备份是破坏性操作，本期只出人工步骤。

## 6. 与脚本的关系

| 脚本 | 工具怎么用 | 关系 |
| :--- | :--- | :--- |
| `postgres/install.sh` / `minio/install.sh` | 原样调用 | **不复制**其 cron / logrotate / 配置生成逻辑 |
| `preflight_check.sh` | 原样调用 | 自检结果直接作为部署门 |
| `Makefile` 的 `*-install` | 不调用 | 工具直接跑脚本；Makefile 是给人手工用的 |
| ~~`backup_sync.sh` + `sync.env`~~ | 已删除 | 由本命令的上传段取代（原因见 [backup-scripts.md](backup-scripts.md) §5） |

## 7. 文件与阶段

```
ops/
  deploy/backup/**                       脚本本体（编进二进制，见 docs/backup-scripts.md）
  backupdist.go                          //go:embed all:deploy/backup
  internal/backup/deploy.go              预检、tar 流上传、目录切换、install/preflight 调度
  internal/backup/deploy_test.go         命令拼装、占位符校验、cron 路径解析、脚本包完整性单测
```

| 阶段 | 内容 | 验收 |
| :--- | :--- | :--- |
| P1 ✅ | `backup deploy`（pg/minio/all）+ `--install-deps` + `backup verify` | 已在 `172.16.0.222` 验证：重复执行幂等、单组件重部署保留另一组件配置、pg/minio 首跑成功 |
| P1+（可选） | 卸载步骤 | 按需 |

P1 先于监控：装好后 `last_success.txt` 才会出现，`status` 才有东西可读。

## 8. 风险与硬约束

| 风险 | 说明与对策 |
| :--- | :--- |
| 登录账号权限不足 | 必然在写 crontab / logrotate 时失败；预检先判 root / `sudo -n`，并提示改用清单里有免密 sudo 的 `user` |
| 目录被静默迁移 | cron 里是绝对路径；工具按标签行反查并拒绝不一致（§4.1） |
| 覆盖了远端配置 | 默认不覆盖；`--force` 前先备份到 `.deploy/backup/<ts>/` |
| 凭证泄露 | `backup.env` 只上传不回显；权限 `600`；私钥不搬运 |
| 装完立刻跑全量备份 | `--run-now` 默认关闭；只在大盘/低峰时显式开启 |
| 依赖缺失 | 默认只报告；显式 `--install-deps` 才 apt/dnf/yum 安装；`--dry-run` 永不安装 |
| 界面误触安装 | 双击落地页只读；安装要切到「备份能力部署」页 + 输 `yes` + 服务端预检门（§10） |
| 界面日志回显密码 | 只经子进程 stdin；任务日志按行脱敏、上限 256 KB；`ops-ui.log` 不记请求体 |
| 刷新页面掐断远端安装 | 任务在后台 goroutine，不绑 `r.Context()`；页面回来后接着轮询日志 |
| 卸载误删历史备份 | 本期不提供卸载命令，只给人工步骤 |

## 9. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| 新开本文，不并入监控 | 写进 `backup-monitor.md` | 写权限与只读不变量冲突；合并会让监控文档的「只读」失真 |
| 复用 `install.sh` | 在 Go 里重写安装逻辑 | cron / logrotate / 配置生成只能有一份，否则两套逻辑漂移 |
| tar 流上传 | 本机 `rsync` | Windows 开发机不一定有 rsync；tar 走 ssh stdin 更稳 |
| 配置默认保留 | 每次都用本机配置覆盖 | 远端可能已人工修过；默认覆盖会造成静默变更 |
| 依赖只报告 | 自动 apt/yum 安装 | 发行版与网络不确定；改为**显式 `--install-deps`** 才动包管理器 |
| 界面复用 CLI 命令（起子进程） | 在 `ui` 里重写部署、或临时替换全局 `os.Stdout` | 一套逻辑不漂移；输出隔离；密码走 stdin；`ui` 不必反向 import `backup`（§10） |
| 界面写操作要 `yes` + 服务端预检 | 只在前端弹窗确认 | 直接调 API 绕不过去；与 `--menu` 第 3 项同一条规则 |

## 10. 从界面部署（2026-11-05 改红线）

`ops ui` 的「备份能力部署」页与 CLI 走**同一条命令**，不是第二套实现：
界面 → `POST /api/backup/run` → 根包 `backuprun.go` 再起一个自己执行
`ops.exe backup deploy <组件> --server <name> [--dry-run] [--password-stdin]`，
stdout/stderr 汇成任务日志，页面用 `GET /api/backup/task?after=N` 轮询增量。

三个按钮：**备份部署预检**（`--dry-run`，只读）、**远端自检**（`verify`）、
**安装 / 升级备份能力**（`deploy`，红色 + 二次确认）。

🔴 六道门（[AGENTS.md](../AGENTS.md) 硬约束 21）：

1. `mode=deploy` / `mode=deps` / `mode=deps-uninstall` 必须带 `confirm:"yes"`，前端要手输 `yes`；
2. 三个写模式服务端都先自己跑一遍 `--dry-run`，非 0 就不执行 —— 前端有没有点过预检都一样；
3. `name` 只认 `servers.json`（未知返回 404），`component` 白名单 `all|pg|minio`；
4. 初始 sudo 密码只在单次请求内存，经子进程 stdin 交给 CLI；日志按行脱敏成 `***`，任务结束清空；
5. 任务脱离 HTTP 请求（**不用 `r.Context()`**）：刷新 / 关标签页不会掐断已开始的远端安装；
   单任务互斥（并发 409），日志上限 256 KB；
6. 界面不开放 `--force` / `--run-now` / `--install-deps`，需要时仍走 CLI 或 `--menu`；
   `mode=deps` 跑的是独立子命令 `ops backup deps`，不是 `deploy --install-deps`（§10.2）。

**为什么用子进程**：`CmdBackup` 的输出全是 `fmt.Print*` 打到 `os.Stdout`，
网页要拿日志就得改 30 多处输出、或临时替换全局 stdout（并发不安全）。
再起一个自己既隔离了输出、又让密码天然走 stdin，还保住了依赖方向
（执行器 `BackupRunner` 由 `main.go` 注入，`ui` 不 import `backup`）。见 [ui.md](ui.md) §9。

**验收要点**：预检失败时日志里必须有「预检没过」且**只调用了一次**命令；
日志里搜不到明文密码；安装途中刷新页面，回来仍能接着看日志直到完成。

### 10.1 改配置不等于生效（2026-11-06）

`deploy` 在「远端 `backup.env` 已是 OK」时默认**保留远端配置**（日志里的
`远端=OK 保留远端配置`），只有 `--force` 才覆盖，而界面按硬约束 21 ⑥ 不开放 `--force`。
于是「在页面改完本机配置、保存成功」并不代表定时任务会用新值。

界面「配置」页因此把保存与同步拆成两个显式动作：`POST /api/config/backup-env` 只写本机
`backup/{postgres,minio}.env`，`POST /api/config/sync-env` 才经 `ops backup sync-env`
推到远端。同步是**独立的远端写操作**：要输 `yes`、只认清单里的 `name`、组件白名单、
占位符拒绝、备份任务在跑时 409；输出里不含配置内容。见 [ui.md](ui.md) §12。

CLI 上等价的两种做法：`ops backup sync-env pg --server <name>`（只换配置，推荐），
或 `ops backup deploy pg --server <name> --force`（会重装一遍脚本并跑自检）。

### 10.2 界面安装「缺少依赖」（2026-11-07）

**判据**：`deploy --install-deps` 是为了「部署时顺手补齐」，它会走完上传脚本、换目录、
logrotate、install.sh、preflight 自检。预检只报 `ERROR: 缺少依赖: mc, pg_restore` 时，
人不该为了装两个命令行工具而重部署一整套。所以依赖安装独立成 `ops backup deps`：

| | `backup deploy --install-deps` | `backup deps` |
| :--- | :--- | :--- |
| 上传 / 换目录 / install.sh / crontab / logrotate | 会 | **不碰** |
| 跑 preflight / 备份 | 会（preflight） | 不跑 |
| 装完复查依赖 | 复查一次后继续部署 | 复查一次即结束 |
| 界面入口 | 无（CLI / `--menu` 专属） | 「备份依赖」区（两个页面） |

- 只读探测一条远端命令：逐项 `command -v`，另取 `pg_restore --version` / `mc --version`；
  没有 `DEPS_CHECK_OK=yes` 结束标记就是 `collected=false`，**绝不拿空输出当「依赖齐全」**。
  `--json` 输出 `items / missing / optional / plan / docs`，界面状态与安装计划和 CLI 同源。
- `--dry-run` 只打印缺失项、安装计划与官方文档；正式安装才提权，装完自动复查，
  仍缺就如实报错。只读探测本身不提权、不写远端文件。
- **安装源按官方文档**（用户给的两份）：
  - PostgreSQL：<https://www.postgresql.org/download/linux/debian/>。默认装发行版仓库的
    `postgresql-client`（内网机器不额外依赖公网）；指定 `--pg-major 16` 时按「Manual
    Repository Configuration」写 `/etc/apt/sources.list.d/pgdg.sources`（导入
    `ACCC4CF8.asc`、`${VERSION_CODENAME}-pgdg`）、装 `postgresql-client-16`，
    避免 `pg_restore` 版本低于服务端时误判 dump 损坏。主版本只接受 1..99 纯数字，
    CLI 与界面各验一次。dnf/yum 没有等价的版本化包名保证，仍用系统包并在文档里说明。
  - MinIO mc：<https://min.io/docs/minio/linux/reference/minio-mc.html#install-mc>。
    官方文档当前给 `dl.min.io/aistor/mc/release/linux-<arch>/mc`；社区版
    `dl.min.io/client/...` 实测 410，官方中国镜像 `dl.minio.org.cn` 可连通。
    **顺序是「离线优先」**：先 `docker images` 找目标机已导入的 MinIO 镜像
    （镜像名带私有仓库前缀 `192.168.1.221:5000/minio/minio:...` 也要认，
    旧脚本只匹配 `^minio/minio:` 会漏掉），`docker create` + `docker cp` 取出
    `/usr/bin/mc` 或 `/usr/local/bin/mc`；没有镜像才依次试
    「中国镜像 → 官方 AIStor 地址 → 社区版地址」。全程**绝不 `docker pull`**。
  - 🔴 **2026-11-07 k4 假死踩坑**：中国镜像 HEAD 200（0.09s）但 GET 传了 110 KB
    后不再动；`curl -fsSL` 默认没有总超时，任务挂了 7 分钟，界面日志停在
    apt 的 needrestart 输出，看起来像「卡死」。现在每个下载都有
    `--connect-timeout 8 --max-time 90`（wget 同样包 `timeout 90`），
    `apt-get update` / `install`、`docker images/create/cp` 也各有硬超时，
    且每一步 `echo '==> …'` 打印进度；apt 另加 `NEEDRESTART_MODE=l`，
    装客户端不重启 `docker.service` / `systemd-logind.service`。
  - 🔴 **同一场的第二个坑：假阳性**。那个半截文件是 110 KB 截断 ELF、权限 0644，
    远端 `sh`（dash）的 `command -v mc` **仍返回路径**，于是只读状态报「依赖齐全」、
    安装脚本也直接跳过 mc，备份真跑起来才会失败。    现在探测与安装共用同一判据：
    `command -v` 拿到路径后还要 `[ -x "$p" ]`，`pg_restore` / `mc` 另要求
    `--version` 真能跑通；不满足就当缺失，由 `curl -o` / `docker cp` 覆盖那个坏文件。
  - 🔴 **同日晚第三个坑：pg_wrapper 空壳**。用户勾「卸载 PostgreSQL 客户端」后，
    `postgresql-client[-<n>]` 确实被卸掉了，但 `postgresql-client-common` 还在，
    它提供 `/usr/bin/pg_restore -> ../share/postgresql-common/pg_wrapper`。
    `pg_restore --version` 实际报 `Error: You must install at least one
    postgresql-client-<version> package`（exit 1），而旧探测只看文件可执行 →
    「已安装」假阳性、卸载复查失败、界面显示「卸不掉」。修法：探测加 `--version`
    实跑，卸载包名正则纳入 `postgresql-client-common`（`-common` 分支），
    影响清单里写明它为什么必须一起卸。
- 界面写动作：`POST /api/backup/run` 的 `mode=deps`，六道门与 `deploy` 完全相同
  （`confirm=yes`、服务端 `--dry-run`、name/组件白名单、密码 stdin + 脱敏、任务脱离请求
  + 409）；界面**不发** `--install-deps` / `--force` / `--run-now`。详见 [ui.md](ui.md) §9.7、
  [AGENTS.md](../AGENTS.md) 硬约束 30。

回归：`internal/backup/deps_test.go`、`internal/ui/deps_test.go`、
`web/test/{backup,components}.test.ts`。

### 10.3 卸载依赖（2026-11-07 晚，供「卸了再装」复测）

**动机**：修完下载假死后，要验证「重新安装」这条链路，就得先把刚装好的 mc / PG 客户端
卸掉；让人手敲 `rm` / `apt remove` 既容易误删，也绕过了界面六道门。所以卸载做成
`deps` 的镜像动作，而不是一个后台脚本。

| | `backup deps` | `backup deps-uninstall` |
| :--- | :--- | :--- |
| 远端动作 | 离线镜像提取 mc / apt 装客户端 | 删 `/usr/local/bin/mc` / `apt remove postgresql-client[-<n>]` |
| 参数 | 可选 `--pg-major` | 必填 `--target mc` / `--target pg_client`（可重复、至少一个） |
| 复查 | 每个命令可用 | 被卸的命令确实消失；仍在就如实报错并提示 `WARN` |
| 不动 | crontab / logrotate / backup.env / 脚本 | 同左，另不碰 `~/.mc`、容器 / 镜像、PGDG 源、服务端 |

- **只删工具装的东西**：`mc` 只删 `/usr/local/bin/mc` 这一个文件；PG 客户端的包名来自
  远端 `dpkg-query -W 'postgresql-client*'` 的只读输出，严格匹配
  `postgresql-client` / `postgresql-client-<数字>` / **`postgresql-client-common`**，
  不用 `purge`、不 `autoremove`（那会连带删别的包），也不删
  `/etc/apt/sources.list.d/pgdg.sources`。`postgresql-client-common` 必须一起卸：
  它单独留着会有一个可执行但跑不通的 `/usr/bin/pg_restore` 壳链接（§10.2 第三个坑）；
  若该包被其它程序依赖，`apt-get remove` 会自行拒绝，日志如实报错，**不加强制参数**。
- 🔴 **不提供卸载 `cron` / `nc` / `ssh` / `scp` / `tar` / `logrotate`**：这些是系统基础包，
  卸掉会破坏目标机；白名单 `mc|pg_client` 由 CLI 与界面后端各验一次，
  任意字符串都变不成远端 `rm` / `apt remove` 的参数。
- 界面：`GET /api/backup/deps` 随只读状态多带一份 `uninstall` 计划（标题 / 可勾选项 /
  影响清单 / 提交文案），两页弹窗只渲染；**勾选项默认全不勾、至少一个**才能提交。
  写动作是 `POST /api/backup/run` 的 `mode=deps-uninstall`，与 `deps` 共用
  `confirm=yes`、服务端 `--dry-run`、name 白名单、密码 stdin + 脱敏、任务锁 409。
- 卸载后备份定时任务下一次执行会失败是**预期结果**，不要为消掉报错去删 crontab /
  改配置；装回来点「安装缺少依赖」即可（`docs/ui.md` §9.7）。

回归：`internal/backup/deps_uninstall_test.go`（参数门 / 脚本边界 / 计划下发）、
`internal/ui/deps_test.go`（卸载的 confirm 门 / 预检门 / targets 白名单）、
`web/test/{backup,components}.test.ts`（计划归一化 / 按钮门 / targets 透传）。
