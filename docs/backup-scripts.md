> 状态：**已迁入本仓（2026-11-05，原 `pass-up.backend/deploy/backup`）**

# 备份脚本（运行在备份端的那套 shell）

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)。「怎么装到服务器」见 [backup-deploy.md](backup-deploy.md)，
> 「装完怎么看」见 [backup-monitor.md](backup-monitor.md)。

## 1. 为什么脚本在本仓

这套脚本是**运维工具链**，不是业务代码：它跑在备份服务器上，只通过 SSH / `mc` 拉取生产端数据，
与 Java 后端、AI 服务、小程序前端都没有编译或运行关系。原先放在 `pass-up.backend/deploy/backup`，
导致 `ops` 必须跨仓按相对路径取脚本（依赖当前工作目录、依赖兄弟仓存在）。

2026-11-05 整体迁入 `pass-up.ops/deploy/backup`，并**嵌进二进制**（`backupdist.go`）：
`ops.exe` 一个文件就能完成「上传 → 换目录 → 装 logrotate → 装 cron → preflight 自检」，
不再要求从仓根运行。`pass-up.backend` 侧已删除，不再保留副本（避免两份漂移）。

## 2. 目录与脚本

```
deploy/backup/
  Makefile                    自检入口（backup-preflight / pg-preflight / minio-preflight）+ include 子 Makefile
  preflight_check.sh          部署自检入口：只做调度与汇总
  preflight_pg.sh             PostgreSQL 体检子模块（可单独执行）
  preflight_minio.sh          MinIO 体检子模块
  lib/common.sh               preflight 公共库（颜色 / 日志 / env 加载 / 必填校验 / 状态计数 / 汇总）
  postgres/
    install.sh                一键安装（依赖 / 配置 / 轮转 / 定时任务 / 自检，幂等）
    pg_backup.sh              执行备份，成功后写心跳 last_success.txt
    pg_backup_status.sh       健康巡检，异常推钉钉 ALERT_WEBHOOK
    pg_restore.sh             灾难恢复（交互式二次确认）
    pg_backup.logrotate       轮转配置（由 ops 落到 /etc/logrotate.d/pg-backup）
    backup.env.example        配置模板（真实 backup.env 不进仓库）
    Makefile                  pg-backup / pg-restore / cron 管理等目标
  minio/                      同上，minio_backup.sh / minio_backup_status.sh / minio_restore.sh
```

| 备份对象 | 备份方式 | 默认时间 | 保留 |
| :--- | :--- | :--- | :--- |
| PostgreSQL | SSH 拉取 `pg_dumpall`（全局对象）+ `pg_dump`（业务库） | 每天 3:00 | 分级 `daily/weekly/monthly`（每月 1 号 → monthly，每周一 → weekly，其余 → daily） |
| MinIO | `mc mirror` 增量同步源端桶到备份端 MinIO | 每天 2:00 | 由备份端桶自身策略决定 |

两个脚本**本来就能手工跑**：`Makefile` 的 `pg-backup` / `minio-backup` 目标就是「立即手动执行一次」。
工具侧原先缺的是受控触发入口（预演 / 确认 / 报告），2026-11-08 已落地 `ops backup once`
与界面第 6 项（见 [backup-once.md](backup-once.md) §2 / §7）；本文只讲脚本本体。

🔴 **恢复脚本（`pg_restore.sh` / `minio_restore.sh`）必须有人值守，禁止入 Crontab。**
`install.sh` 只装备份与巡检两条 cron，不会装恢复。
**怎么恢复、有哪些坑、工具侧方案与落地记录**统一见 [backup-restore.md](backup-restore.md)，
本文不复述流程；恢复脚本本体在本次落地中一行未改，工具只接一根线过去。

## 3. 配置在哪

- 真实配置是各组件目录的 `backup.env`，含数据库/MinIO 凭证与备份服务器上的私钥路径。
- 本机（运维机）上的副本放在**配置目录** `backup/{postgres,minio}.env`，由
  `ops backup env` 从 `backup.env.example` 生成模板；`ops backup deploy` 打包时以 `0600`
  注入成远端的 `<组件>/backup.env`。
- 🔴 `deploy/backup/` 里**不许出现真实 `backup.env`**：`//go:embed all:deploy/backup`
  会把整个目录编进二进制。`.gitignore` 已挡，`backupdist_test.go` 会在 `go test` 时再挡一次。
- PG 的 `PG_SSH_OPTS` 不写也有兜底默认值，`pg_backup.sh` / `pg_restore.sh` /
  `backup.env.example` / **`preflight_pg.sh`** 四处逐字一致：
  `-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new`。
  与 `ops` 自身 ssh 封装、`install.sh` 的连通性预检同口径；别改成
  `StrictHostKeyChecking=no`（关掉主机密钥校验），改默认值要连同界面 placeholder 一起改，
  `TestEmbeddedBackupSSHDefaultsAligned` 会挡住漂移。见 [backup-monitor.md](backup-monitor.md) §3.3
  与下方 §4.1。
- 日志目录：MinIO 读 `BACKUP_LOG_DIR`；PostgreSQL 读 `PG_BACKUP_LOG_DIR`（默认 `/var/log/pg-backup`）。

## 4. 部署自检（preflight）

`ops backup verify` 与 `ops backup deploy` 都调它；也能在服务器上手工跑：
`make -f deploy/backup/Makefile backup-preflight` 或 `bash deploy/backup/preflight_check.sh [pg|minio|all]`。

体检项：`backup.env` 是否齐全、必填参数是否为空、凭证是否仍为占位符、备份根目录/日志目录是否可写、
依赖命令（`pg_restore` / `mc` / `nc` / `ssh`）是否安装、SSH 与 MinIO 连通性、Crontab 是否装、
`last_success.txt` 是否新鲜。**纯只读**，不执行备份/恢复。

退出码：`0` 全部通过，`2` 仅警告（多为「尚未首次备份」），`1` 存在错误需先修复。
`ops backup deploy` 把 `1` 当部署失败（回滚脚本并重跑 install.sh），`2` 只提示。

结构上 `preflight_check.sh` 只做「调度 + 汇总」，各对象逻辑在 `preflight_<组件>.sh`；
新增备份对象 = 新增 `preflight_xxx.sh`（source 公共库、定义 `check_xxx`）并在入口 `dispatch` 注册。

`pg_restore` 深度校验要求**本地客户端版本不低于服务端 `pg_dump` 版本**
（服务端 PG 18 的 dump 头为 `1.16`，PG 16 的 `pg_restore` 会报 `unsupported version`）。
版本不足时跳过深度校验并记 `warn`，**不会误判备份失败**；要深度校验就装同版本客户端。
`ops backup deps --pg-major <n>` 现在能把「已装但主版本低」的客户端对齐到 `<n>`
（见 [backup-restore.md](backup-restore.md) §7.9），不必再手工装 PGDG 包；**归档判据本身
没有放宽**，工具仍不提供绕过开关。

### 4.1 「手工 ssh 明明能连，preflight 却报 SSH 无法连通」

`preflight_pg.sh` 第 7 项探测的是**备份端 → 主服务器**（`PG_SSH_HOST/PORT/USER/KEY`），
既不是运维机 → 备份服务器的连接，也不是你在终端里手工敲的那条 ssh。

🔴 2026-11-06 起身份已统一：安装期才由 `sudo -n sh -c` 提权到 root
（写 `/etc/logrotate.d`、建系统目录、清旧 crontab）；**定时备份、preflight 自检、
`--run-now` 首跑、`install.sh` 里的 SSH 探测都以清单 `user` 运行**，读的是同一个
`~/.ssh/known_hosts` 与同一把私钥。所以旧的 root/cql 差异已经消除，剩下三条：

| 维度 | 运维机手工 ssh | 备份端 preflight 探测 |
| :--- | :--- | :--- |
| 执行身份 / known_hosts | 运维机当前账号 | 备份机上的清单 `user`（与 cron 完全一致） |
| 交互 | 交互式，首次连接问过 `yes` 并收录 | `-o BatchMode=yes` 不问；靠 `accept-new` 收录，密钥变化即拒绝 |
| 私钥 | 默认 `~/.ssh/id_*` 或 ssh-agent | 显式 `-i "$PG_SSH_KEY"`，可能不是同一把密钥 |
| 网络出口 | 运维机 | 备份服务器（端口转发 / 防火墙可能只对运维机开放） |

**历史坑（2026-11-06）**：`preflight_pg.sh` 原先硬编码
`-o BatchMode=yes -o ConnectTimeout=8`，**漏了 `accept-new` 也不读 `PG_SSH_OPTS`**，
与 `pg_backup.sh` 口径不一致；当时自检还套着 sudo 以 root 跑、读 `/root/.ssh/known_hosts`，
于是「手工能连、自检说连不上」而真实备份脚本能连。`>/dev/null 2>&1` 又把 ssh 的 stderr
全吞了，只剩一句无从排查的结论。现在：四处 `PG_SSH_OPTS` 逐字一致、自检与 cron 同身份、
失败按「主机密钥 / 认证 / 网络 / 超时 / 解析」归类回显原因（**不回显原文**，避免私钥路径进日志），
`TestEmbeddedBackupSSHDefaultsAligned` 与 `TestEmbeddedInstallRunsAsNonRoot` 一起挡回归。

排查要在**备份端**以与自检相同的身份复现（私钥路径用配置里的值替换占位符）：

```bash
ssh -p <port> -i <PG_SSH_KEY> -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new <user>@<host> "echo ok"
```

- `Host key verification failed` → 该用户的 known_hosts 没有该 host:port 条目，带 `accept-new`
  重连一次即可；`REMOTE HOST IDENTIFICATION HAS CHANGED` → 主服务器（尤其 WSL2）重装过、
  主机密钥变了，**核实指纹后**用 `ssh-keygen -R "[<host>]:<port>"` 清掉旧条目再连。
- `Permission denied` / `Load key ... invalid format` → `PG_SSH_KEY` 对应的公钥不在主服务器
  `authorized_keys`，或私钥格式/权限不对。
- `Connection refused` / `No route to host` / `timed out` → 备份端到主服务器这条网络路径不通，
  与运维机上手工 ssh 成功无关（WSL2 的 2221 常是 Windows 上的端口转发，可能没对局域网开放）。

🔴 升级迁移（从旧 root 版本）：`install.sh` 会 `chown -R` 日志/备份目录、清掉 root
crontab 旧任务、把任务改写到运行用户 crontab；`ops backup deploy --dry-run` 可先看计划。
改了 `deploy/backup/**` 后要重新 `go build`（脚本是 embed 输入），再走界面
「安装 / 升级备份能力」把新脚本推到备份端；只重建本机 `ops.exe` 不会改变远端的旧脚本。

## 5. 为什么删掉了 backup_sync.sh / sync.env

原来的同步路径是 `bash deploy/backup/backup_sync.sh`（rsync 推目录）。删掉的原因：

| 问题 | 说明 |
| :--- | :--- |
| Windows 开发机没有 rsync | 而 `ops` 的 tar 流走 ssh stdin，任何平台都能跑 |
| 不注入本机配置 | rsync 明确排除 `backup.env`，同步完还得手工上服务器改配置 |
| 不装 logrotate | `install.sh` 只提示不安装，漏了这一项备份日志会无限增长 |
| 不跑 preflight | 同步「成功」不等于能备份 |
| 不换目录 | 直接覆盖在跑脚本的目录上，中途失败就是半新半旧 |

这些现在都由 `ops backup deploy` 覆盖（见 [backup-deploy.md](backup-deploy.md) §4）。
`deploy/backup/Makefile` 因此不再有 `backup-sync` 目标。

## 6. 红线

1. 🔴 **采集只读**：备份脚本只读生产端，不 `rm` / `mv` / `>` 生产数据，也不调用会推钉钉的
   `*_backup_status.sh` 来「顺便检查」。
2. 🔴 **心跳是远端本地时间**：`last_success.txt` 无时区，新鲜度只能在远端算，
   拿回本机解析会差 8 小时（见 [backup-monitor.md](backup-monitor.md)）。
3. 🔴 **改了这里的任何文件必须 `go build`**：脚本编在二进制里，只跑旧 `ops.exe`
   部署出去的还是旧脚本。
4. 🔴 **手动触发与 cron 是两路并发入口**：两个脚本现在都有 `flock -n`
   （`minio_backup.sh` 的锁是 2026-11-08 补的，与 PG 同款、锁文件在日志目录）。
   锁在脚本内部，crontab 行不用改；🔴 本仓 `ops.exe` 已重建，但**远端脚本要重新
   `ops backup deploy` 才拿到补锁版**（见 [backup-once.md](backup-once.md) §7.1）。
   工具不查 crontab；手动成功同样写 `last_success.txt`，**不代表定时任务正常**
   （§4.2）。`backupdist_test.go` 的锁断言挡回归。
