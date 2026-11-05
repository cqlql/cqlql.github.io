> 状态：**方案（未实现）**（2026-11-05）

# 备份监控

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)；配置键见 [config.md](config.md)。
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

目标：`ops status --server <name>` 或 `ops ui` 直接看到这些事实，**只读**。

**前提**：备份能力已安装（见 [backup-deploy.md](backup-deploy.md)）。
若尚未安装，`status` 返回「心跳文件不存在」属于正确结果，先跑 `ops backup deploy`。

## 2. 边界

**做**：PG / MinIO 最后一次成功、最新备份文件、占用、磁盘余量；CLI（含 `--json`）与
本地网页共用同一份快照；**目标机与连接参数走 [servers.json](servers.md)**，只读账号用
该条目的 `monitor`（未填则复用 `user/key`）。

**不做**：触发 / 重跑 / 恢复备份（恢复脚本必须有人值守）；修改备份服务器任何文件；
内嵌终端；定时告警（本机工具不适合常驻）。

## 3. 采集

### 3.1 远端脚本

工具生成一段固定 POSIX sh，经 `ssh ... sh -s` 从 stdin 执行
（不拼 `ssh host '命令'`：多行 + 引号 + 路径的转义只有一层才不容易出错）。
远端输出**分节纯文本**，不在远端拼 JSON：

```
==META      hostname；date +%s
==PG        last_success.txt 原文
            last_success 对应的 epoch（date -d 解析，失败输出 -）
            最新 *.dump：mtime|size|path（find -printf，取一条）
            备份根 du -sk
==MINIO     last_success.txt 原文
            last_success 对应的 epoch
            日志目录 du -sk
            数据目录 du -sk（未配置输出 -）
==DISK      df -P -m <mount> 的 total|avail|used%
```

三条硬规则：

1. 🔴 **时间新鲜度只在远端算**。`last_success.txt` 是 `YYYY-MM-DD HH:MM:SS`
   **无时区**的本地时间；拿回本机按本地时区解析会差 8 小时。
   远端用 `date -d "<内容>" +%s` 得到 epoch，与远端 `date +%s` 相减。
2. 🔴 **没采到输出 `-`**，解析后 `collected=false`，界面显示 `—`。
   **禁止用 0 兜底**：「0」与「没采到」长得一样，而后者往往才是异常那一项。
3. 🔴 **防注入**：路径拼进脚本前统一 `shQuote`（POSIX 单引号转义）；
   配置加载时再校验绝对路径。

### 3.2 不检查 crontab

定时任务由 `install.sh` 以 **root** 装进 root 的 crontab。只读账号读不到，
`crontab -l` 只会返回空，结果是假的「定时任务未安装」。

因此**不查 cron**，用 `last_success.txt` 的新鲜度间接判断。要真查只能读
`/etc/cron.d` 或放开 `sudo -n`，两者都超出「只读账号」的设定。

### 3.3 超时与失败

- `ConnectTimeout=10`、`ServerAliveInterval=5`、`BatchMode=yes`；
- 整段脚本上限 **30s**；
- **绝不在中途等密码**：缺密钥立刻失败，错误里只说 `user@host`，不打印私钥路径；
- 主机密钥 `StrictHostKeyChecking=accept-new`（首次收录，变化即拒绝）。

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

## 5. 本地网页

- 仅监听 `127.0.0.1`；每个进程随机 token，页面地址带 `?token=...`；
- 每个请求校验 token + `Origin`（防本机浏览器里的其他站点打进来）；
- 页面：顶部问题清单（danger 红 / warn 黄）；四张卡（连接、PG、MinIO、磁盘）；
  底部显示远端主机、配置路径、`checked_at`；
- 60s 自动刷新；服务端缓存 30s（约 5s 最小强制刷新间隔），避免多标签页把 SSH 打满；
- **本期不做网页内改配置**：服务器清单与阈值在 `servers.json` / `ops.env`，页面只显示路径。

## 6. 安全

1. 备份服务器用**专用只读账号**：不给 sudo、不给写权限；sshd 侧禁 PTY / 端口转发 / agent 转发。
   账号写在 [servers.json](servers.md) 的 `monitor`，**不复用有 sudo 权限的 `user`**。
2. 私钥只放本机，路径可以写进配置，但**任何输出、错误、日志都不打印它**。
3. `accept-new` 不是 `no`：首次收录，之后变化直接拒绝。
4. 工具只读：不调用 `pg_backup_status.sh` / `minio_backup_status.sh`
   （它们会 `tee` 写日志、推钉钉，「看一眼」不该产生副作用）。
5. 本机 `ssh` 的 `known_hosts`、agent 照常复用，不额外创建凭据副本。

## 7. 文件与阶段

```
ops/
  go.mod
  main.go                                 命令分发、usage、退出码
  internal/shared/config.go               ops.env 读写、默认值、校验、init 模板
  internal/shared/remote.go               ssh 封装（BatchMode / 10s 连接 / 30s 总超时 / stdin 脚本）
  internal/monitor/status.go              Status 结构、探针脚本、解析、assess、终端渲染
  internal/ui/ui.go                       静态产物托管、loopback + token + Origin 校验、30s 缓存
  web/src/views/StatusView.tsx            P2 状态面板（四张卡 + 问题清单；构建后嵌入，见 ui.md）
  internal/monitor/status_test.go         解析与判定单测（固定文本 fixture）
  internal/shared/config_test.go          配置解析与校验单测
```

| 阶段 | 内容 | 验收 |
| :--- | :--- | :--- |
| P2 | `init` / `status --server <name>`（含 `--json`） | 本机连测试机；解析单测全绿 |
| P2+ | `ui`：页面 + 缓存 + token/Origin | 浏览器能看到四张卡与问题清单 |

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
| 不查 crontab | 读 `/etc/cron.d` 或 `sudo -n` | 只读账号读不到 root crontab，读到空会误报「未安装」 |
| `du` MinIO 数据目录可选 | 默认全量 `du` | 对象多时几十秒；「只看备份」不值得每次等 |
