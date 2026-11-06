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

**不做**：重写 `install.sh` 的安装逻辑；数据恢复；应用部署（见 [deploy.md](deploy.md)）。

## 2. 与监控的边界

| | 备份监控（只读） | 本文（安装） |
| :--- | :--- | :--- |
| 动作 | 只读采集 | 写目录 / crontab / logrotate |
| 账号 | 清单的 `monitor`（只读） | 清单的 `user` + `sudo`（安装账号） |
| 入口 | `status`（P2 规划）、界面默认视图、预检 `--dry-run`、`backup verify` | `ops backup deploy`、界面「备份能力部署」里输过 `yes` 的安装 |

🔴 **绝不自动触发安装**：双击落地页只读、`status` 只读；界面安装要人点按钮 + 输 `yes`
+ 服务端预检通过。**安装账号与只读账号绝不复用**。

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
    --password-stdin
                    从 stdin 读初始 sudo 密码（**没有 --password 参数**）；
                    清单里已配 sudo.password 时以清单为准，界面部署走这条

ops backup verify [pg|minio|all] [--server <name>] [--password-stdin]
    只跑远端 preflight_check.sh，不安装、不备份

ops backup env [pg|minio|all]
    把嵌入的 backup.env.example 落到配置目录 backup/{postgres,minio}.env
    （已存在不覆盖；脚本树里不放真实凭证，所以模板必须由这条命令给出）
```

## 4. 部署流程

### 4.1 预检

- 本机：嵌入的 `deploy/backup/**` 完整（缺 `install.sh` / `preflight_check.sh` /
  `lib/common.sh` / `*.logrotate` 时在连远端之前就失败）；本机 ssh 可用；**不要求本机有 `rsync`**。
- 远端：目标机由 `--server` 从 [servers.json](servers.md) 选择；安装提权用该条目的
  `user` + `sudo`（已免密走 `sudo -n`；否则用清单 `sudo.password` 或界面/`--password-stdin`
  经 **ssh stdin** 走 `sudo -S -p ''`，密码不出现在命令行/日志）；依赖命令 `ssh` / `scp` / `pg_restore` /
  `mc` / `logrotate` / `crontab` 逐项报告；缺失时**默认只报告**，加 `--install-deps` 才安装
  （`--dry-run` 永不安装）；
- 磁盘余量、`/data` 与日志目录可写；
- **目录漂移检查**：`crontab -l` 里带 `#PG_BACKUP` / `#MINIO_BACKUP` 的行会包含脚本绝对路径。
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

- 依次执行远端 `bash <deploy_dir>/postgres/install.sh` 与 `minio/install.sh`（root 身份，
  **stdin 关闭**：脚本里的 `read` 会走默认分支，不会卡住）。
- 复用脚本已有的幂等逻辑：`backup.env` 存在就不覆盖、cron 按标签先删后加。
- 🔴 `install.sh` 对 logrotate **只提示不安装**：工具在安装前把
  `pg_backup.logrotate` / `minio_backup.logrotate` 落到
  `/etc/logrotate.d/{pg,minio}-backup`（权限 644），否则「一键部署」会漏掉这一项。

### 4.5 自检与首跑

- 执行 `bash <deploy_dir>/../preflight_check.sh pg|minio|all`：
  - `0` 通过；`2` 有警告（如尚未首次备份）→ 继续但输出警告；
  - `1` 有错误 → **恢复 `.old` 目录并重跑 install.sh**，然后失败退出。
- `--run-now` 才执行 `pg_backup.sh` / `minio_backup.sh`；成功后
  `backup-monitor` 的 `status` 立刻能看到心跳。

### 4.6 交付监控

安装成功后打印需要填进 `ops.env` 的监控键（`PASS_UP_OPS_BACKUP_*`），
并提醒：**监控改用只读账号，不要继续用 root**。

## 5. 幂等、升级与失败恢复

- 重复执行 `backup deploy` = 升级：脚本换新，配置默认保留，cron 重写为当前路径。
- 已有安装升级时，`PASS_UP_OPS_BACKUP_DEPLOY_DIR` **必须等于现有路径**
  （工具从 cron 标签行反查并校验），否则拒绝执行。
- 失败恢复：`.old` 目录保留；`preflight` 失败自动回滚脚本并重跑 install.sh。
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
| 用了监控的只读账号 | 必然在写 crontab 时失败；预检先判 root / `sudo -n`，并提示改用该服务器的 `user` |
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

1. `mode=deploy` 必须带 `confirm:"yes"`，前端要手输 `yes`；
2. 服务端先自己跑一遍 `--dry-run`，非 0 就不安装 —— 前端有没有点过预检都一样；
3. `name` 只认 `servers.json`（未知返回 404），`component` 白名单 `all|pg|minio`；
4. 初始 sudo 密码只在单次请求内存，经子进程 stdin 交给 CLI；日志按行脱敏成 `***`，任务结束清空；
5. 任务脱离 HTTP 请求（**不用 `r.Context()`**）：刷新 / 关标签页不会掐断已开始的远端安装；
   单任务互斥（并发 409），日志上限 256 KB；
6. 界面不开放 `--force` / `--run-now` / `--install-deps`，需要时仍走 CLI 或 `--menu`。

**为什么用子进程**：`CmdBackup` 的输出全是 `fmt.Print*` 打到 `os.Stdout`，
网页要拿日志就得改 30 多处输出、或临时替换全局 stdout（并发不安全）。
再起一个自己既隔离了输出、又让密码天然走 stdin，还保住了依赖方向
（执行器 `BackupRunner` 由 `main.go` 注入，`ui` 不 import `backup`）。见 [ui.md](ui.md) §9。

**验收要点**：预检失败时日志里必须有「预检没过」且**只调用了一次**命令；
日志里搜不到明文密码；安装途中刷新页面，回来仍能接着看日志直到完成。
