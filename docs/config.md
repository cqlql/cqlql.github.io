> 状态：**方案（未实现）**（2026-11-05）

# 配置（唯一维护处）

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)。
> 所有 `PASS_UP_OPS_*` 键只在这里定义一次；其它文档只引用键名。

## 1. 文件位置与格式

- Windows：`%AppData%\pass-up\ops.env`
- macOS / Linux：`~/.config/pass-up/ops.env`
- 可用 `PASS_UP_OPS_ENV` 覆盖路径
- `ops init` 生成模板；已存在则只打印路径，不覆盖

格式：标准 `KEY=VALUE`，允许 `#` 注释、空行、值两侧单/双引号。
不进 Git。

键名按目标机分组，避免两台机器共用一套 `HOST` 后说不清连的是哪台：

- 备份服务器：`PASS_UP_OPS_BACKUP_*`
- 部署目标：`PASS_UP_OPS_DEPLOY_*`

## 2. 备份服务器（只读监控）

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_BACKUP_HOST` | 无（必填） | 可写 `~/.ssh/config` 里的别名 |
| `PASS_UP_OPS_BACKUP_PORT` | `22` | |
| `PASS_UP_OPS_BACKUP_USER` | 空 | 留空 = 走 ssh 默认用户 / ssh config |
| `PASS_UP_OPS_BACKUP_KEY` | 空 | 私钥路径；**不会出现在任何输出与日志里** |
| `PASS_UP_OPS_PG_ROOT` | `/data/backups/postgres` | 备份根目录（含 daily/weekly/monthly） |
| `PASS_UP_OPS_PG_LOG` | `/var/log/pg-backup` | 心跳与日志目录 |
| `PASS_UP_OPS_MINIO_LOG` | `/var/log/minio-backup` | 心跳与日志目录 |
| `PASS_UP_OPS_MINIO_DATA` | 空 | 可选；填了会 `du` 整个数据目录，对象多时很慢 |
| `PASS_UP_OPS_DISK` | `/data` | 做 `df` 的挂载点 |
| `PASS_UP_OPS_PG_STALE_HOURS` | `26` | 超过即判异常（每天一次，留 2h 余量） |
| `PASS_UP_OPS_MINIO_STALE_HOURS` | `26` | 同上 |
| `PASS_UP_OPS_DISK_WARN_PCT` | `90` | 已用率达到即判异常 |

## 3. 备份能力部署（安装与升级）

主机与端口复用上面的 `PASS_UP_OPS_BACKUP_HOST` / `PASS_UP_OPS_BACKUP_PORT`；
安装需要 root，**不要复用只读监控账号**。

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_BACKUP_ADMIN_USER` | `root` | 安装账号；非 root 时走 `sudo -n` |
| `PASS_UP_OPS_BACKUP_ADMIN_KEY` | 空 | 与监控私钥不同时才填；不打印 |
| `PASS_UP_OPS_BACKUP_DEPLOY_DIR` | `/opt/passup-backup` | 远端脚本目录；**升级已有安装必须填现有路径** |
| `PASS_UP_OPS_BACKUP_PG_ENV_FILE` | `../pass-up.backend/deploy/backup/postgres/backup.env` | 本机已填好的配置（不入 Git） |
| `PASS_UP_OPS_BACKUP_MINIO_ENV_FILE` | `../pass-up.backend/deploy/backup/minio/backup.env` | 同上 |

`backup.env` 的键名与默认值属于 `pass-up.backend` 仓库，本工具**不复制**，只上传与校验。

## 4. 部署目标（应用）

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_DEPLOY_HOST` | 无（必填） | 可写 ssh 别名 |
| `PASS_UP_OPS_DEPLOY_PORT` | `22` | |
| `PASS_UP_OPS_DEPLOY_USER` | 空 | 建议非 root 但加入 `docker` 组；`root` 仅首次装机用 |
| `PASS_UP_OPS_DEPLOY_KEY` | 空 | 私钥路径；不打印 |
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

## 5. 校验

- 备份：`PASS_UP_OPS_BACKUP_HOST` 必填；部署：`PASS_UP_OPS_DEPLOY_HOST` 必填；
- 端口 1–65535；阈值与超时 > 0；
- 远端路径必须是绝对路径（`path.IsAbs`，斜杠语义，防止 Windows 路径被误填）；
- 私钥路径支持 `~` 展开；文件不存在时在命令里明确报错；
- `PASS_UP_OPS_DEPLOY_IMAGE_PREFIX` 为空或与 compose 不一致时，`deploy` 预检直接失败；
- `backup deploy` 要求 `PASS_UP_OPS_BACKUP_ADMIN_USER` 可用；非 root 时先验证 `sudo -n true`；
- `backup.env` 若提供，必须存在且不含 `CHANGE_ME` / `YOUR_` 占位符；
- 已有安装时，`PASS_UP_OPS_BACKUP_DEPLOY_DIR` 必须与 cron 标签行里的绝对路径一致，否则拒绝执行。
