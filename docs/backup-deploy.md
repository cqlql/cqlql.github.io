> 状态：**方案（未实现）**（2026-11-05）

# 备份能力部署（安装与升级）

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)；配置键见 [config.md](config.md)。

## 1. 要解决什么

把 `pass-up.backend/deploy/backup/**` 的脚本、配置、cron、logrotate 一次性装到备份服务器。

现状是两步手工：

1. `bash deploy/backup/backup_sync.sh` 用本机 `rsync` 同步脚本；
2. `ssh` 上服务器 `sudo bash postgres/install.sh`、`sudo bash minio/install.sh`。

目标：`ops backup deploy` 一条命令完成「预检 → 上传 → 配置 → 安装 → 自检 → 交付监控」。

它是**监控的前置**：`last_success.txt` 由备份脚本写入，装好之后
[backup-monitor.md](backup-monitor.md) 才有数据可读。

**不做**：重写 `install.sh` 的安装逻辑；数据恢复；应用部署（见 [deploy.md](deploy.md)）。

## 2. 与监控的边界

| | 备份监控 | 本文 |
| :--- | :--- | :--- |
| 动作 | 只读采集 | 写目录 / crontab / logrotate |
| 账号 | 专用只读账号 | 安装账号（root 或免密 sudo） |
| 命令 | `status` / `ui` | `backup deploy` / `backup verify` |

🔴 **`status` / `ui` 绝不触发安装**；安装只走显式的 `ops backup deploy`。

## 3. 命令

```
ops backup deploy [pg|minio|all] [--dry-run] [--force] [--run-now]
    all（默认）：postgres → minio
    --dry-run  只预检并打印将执行的远端命令，不改远端任何文件
    --force    用本机 backup.env 覆盖远端配置（覆盖前先备份）
    --run-now  安装成功后立刻跑一次备份（默认关闭：这是写操作，且可能很重）

ops backup verify [pg|minio|all]
    只跑远端 preflight_check.sh，不安装、不备份
```

## 4. 部署流程

### 4.1 预检

- 本机：`deploy/backup/**` 存在；本机 ssh 可用；**不要求本机有 `rsync`**。
- 远端：`id -u` 或 `sudo -n true` 通过；依赖命令 `ssh` / `scp` / `pg_restore` /
  `mc` / `logrotate` / `crontab` 逐项报告（缺失给安装命令，但**不自动装**，见 §9）；
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
     （除非 `--force` 且本机提供了配置）；
  3. `mv` 换名。cron 里引用的绝对路径不变。
- Windows 开发机不一定有 `rsync`，因此不用 `backup_sync.sh` 的 rsync 路径；
  tar 流由 Go 标准库生成。

### 4.3 配置

- 本机配置来自 `PASS_UP_OPS_BACKUP_PG_ENV_FILE` / `..._MINIO_ENV_FILE`
  （默认指向 `pass-up.backend/deploy/backup/{postgres,minio}/backup.env`，**不入 Git**）。
- 上传前校验：文件存在、无 `CHANGE_ME` / `YOUR_` 占位符、键名与
  `backup.env.example` 对得上（**字段定义只在 backend 仓库维护，本文不复制**）。
- 远端必须存在有效配置才允许安装：
  - 有本机配置 → 上传（`--force` 才覆盖远端已有配置，且先备份）；
  - 无本机配置但远端已有有效配置 → 保留，继续；
  - 两者都没有 → 失败，提示先按 `backup.env.example` 准备。
- 远端 `backup.env` 权限 `600`；凭证与私钥路径**不打印**。
- 🔴 `PG_SSH_KEY` 是**备份服务器上**的私钥路径，工具不搬运私钥；部署前需已存在。

### 4.4 安装

- 依次执行远端 `sudo -n bash <deploy_dir>/postgres/install.sh` 与
  `minio/install.sh`，**stdin 关闭**（脚本里的 `read` 会走默认分支，不会卡住）。
- 复用脚本已有的幂等逻辑：`backup.env` 存在就不覆盖、cron 按标签先删后加、
  logrotate 装到 `/etc/logrotate.d/{pg,minio}-backup`。
- 安装前已校验配置，避免「占位符还在就装 cron」——脚本本身不会拦这种情况。

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

## 6. 与现有脚本的关系

| 现有 | 新工具 | 关系 |
| :--- | :--- | :--- |
| `backup_sync.sh` + `sync.env` | `ops backup deploy` 的上传段 | 取代；脚本保留到 `--dry-run` 对齐后再议 |
| `postgres/install.sh` | 原样调用 | **不复制**其 cron / logrotate / 配置生成逻辑 |
| `preflight_check.sh` | 原样调用 | 自检结果直接作为部署门 |
| `Makefile` 的 `*-install` | 不调用 | Makefile 依赖仓库在本机；工具直接跑脚本 |

## 7. 文件与阶段

```
ops/
  backup_deploy.go   预检、tar 流上传、目录切换、install/preflight 调度
  backup_deploy_test.go  命令拼装、占位符校验、cron 路径解析单测（不碰真实 ssh）
```

| 阶段 | 内容 | 验收 |
| :--- | :--- | :--- |
| P1 | `backup deploy`（pg/minio/all）+ `backup verify` | 空机器一键装好；重复执行幂等；`--dry-run` 与手工步骤一致 |
| P1+（可选） | `--install-deps`（apt/yum）、卸载步骤 | 按需 |

P1 先于监控：装好后 `last_success.txt` 才会出现，`status` 才有东西可读。

## 8. 风险与硬约束

| 风险 | 说明与对策 |
| :--- | :--- |
| 用了监控的只读账号 | 必然在写 crontab 时失败；预检先判 root / `sudo -n`，并提示换 `PASS_UP_OPS_BACKUP_ADMIN_USER` |
| 目录被静默迁移 | cron 里是绝对路径；工具按标签行反查并拒绝不一致（§4.1） |
| 覆盖了远端配置 | 默认不覆盖；`--force` 前先备份到 `.deploy/backup/<ts>/` |
| 凭证泄露 | `backup.env` 只上传不回显；权限 `600`；私钥不搬运 |
| 装完立刻跑全量备份 | `--run-now` 默认关闭；只在大盘/低峰时显式开启 |
| 依赖缺失 | 只报告不自动装；避免在未知发行版上乱动包管理器 |
| 卸载误删历史备份 | 本期不提供卸载命令，只给人工步骤 |

## 9. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| 新开本文，不并入监控 | 写进 `backup-monitor.md` | 写权限与只读不变量冲突；合并会让监控文档的「只读」失真 |
| 复用 `install.sh` | 在 Go 里重写安装逻辑 | cron / logrotate / 配置生成只能有一份，否则两套逻辑漂移 |
| tar 流上传 | 本机 `rsync` | Windows 开发机不一定有 rsync；tar 走 ssh stdin 更稳 |
| 配置默认保留 | 每次都用本机配置覆盖 | 远端可能已人工修过；默认覆盖会造成静默变更 |
| 依赖只报告 | 自动 apt/yum 安装 | 发行版与网络不确定；自动装包的风险高于省一步 |
