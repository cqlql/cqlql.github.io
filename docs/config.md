> 状态：**服务器清单为唯一主机来源（P0 已实现）；P1 备份部署已迁移到 `--server`**（2026-11-05）

# 配置（唯一维护处）

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)。
> 所有 `PASS_UP_OPS_*` 键只在这里定义一次；其它文档只引用键名。

## 1. 文件位置与格式

- 主配置：Windows `%AppData%\pass-up\ops.env`；macOS / Linux `~/.config/pass-up/ops.env`
- 可用 `PASS_UP_OPS_ENV` 覆盖路径
- `ops init` 生成模板；已存在则只打印路径，不覆盖。清单不存在时同时生成空 `servers.json` 模板
- **服务器清单**是另一个文件（见 §2），不写进 `ops.env`

`ops.env` 格式：标准 `KEY=VALUE`，允许 `#` 注释、空行、值两侧单/双引号。不进 Git。

**本机路径覆盖（环境变量，主要给单测 / 验收用）**：

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_CONFIG_DIR` | 空 | 覆盖配置目录（`ops.env` / `servers.json` / `ops.ico` 所在目录） |
| `PASS_UP_OPS_DESKTOP_DIR` | 空 | 覆盖桌面目录；`ops shortcut` 与单测绝不写真桌面 |

键名只在这里定义一次；其它文档只引用，不复述默认值。

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

## 3. 备份监控（P2）

路径与阈值是**全局默认**；多台备份服务器需要不同值时，再在清单里加 server 级覆盖。

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_PG_ROOT` | `/data/backups/postgres` | 备份根目录（含 daily/weekly/monthly） |
| `PASS_UP_OPS_PG_LOG` | `/var/log/pg-backup` | 心跳与日志目录 |
| `PASS_UP_OPS_MINIO_LOG` | `/var/log/minio-backup` | 心跳与日志目录 |
| `PASS_UP_OPS_MINIO_DATA` | 空 | 可选；填了会 `du` 整个数据目录，对象多时很慢 |
| `PASS_UP_OPS_DISK` | `/data` | 做 `df` 的挂载点 |
| `PASS_UP_OPS_PG_STALE_HOURS` | `26` | 超过即判异常（每天一次，留 2h 余量） |
| `PASS_UP_OPS_MINIO_STALE_HOURS` | `26` | 同上 |
| `PASS_UP_OPS_DISK_WARN_PCT` | `90` | 已用率达到即判异常 |

监控账号来自清单的 `monitor`（未填则复用 `user/key`）；**只读账号不复用有 sudo 权限的账号**。

## 4. 备份能力部署（P1）

目标机由 `--server` 从清单选择；安装提权用该条目的 `user` + `sudo`。

| 键 | 默认 | 说明 |
| :--- | :--- | :--- |
| `PASS_UP_OPS_BACKUP_DEPLOY_DIR` | `/opt/passup-backup` | 远端脚本目录；**升级已有安装必须填现有路径** |
| `PASS_UP_OPS_BACKUP_SRC_DIR` | 工具目录的 `../pass-up.backend/deploy/backup` | 本机脚本源目录 |
| `PASS_UP_OPS_BACKUP_PG_ENV_FILE` | `../pass-up.backend/deploy/backup/postgres/backup.env` | 本机已填好的配置（不入 Git） |
| `PASS_UP_OPS_BACKUP_MINIO_ENV_FILE` | `../pass-up.backend/deploy/backup/minio/backup.env` | 同上 |

`backup.env` 的键名与默认值属于 `pass-up.backend` 仓库，本工具**不复制**，只上传与校验。

## 5. 应用部署（P3–P4）

目标机同样由 `--server` 选择；以下只保留非主机类配置。

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

## 6. 校验

- 清单文件必须存在且可解析；`name` 唯一、`role` 合法、`host`/`user` 必填、端口 1–65535；
  `key` 支持 `~` 展开，**文件不存在或权限过宽时明确报错**；`default` 必须指向存在的 `name`；
  含 `sudo.password` 的文件权限必须 `600`；
- 远端路径必须是绝对路径（`path.IsAbs`，斜杠语义，防止 Windows 路径被误填），且不含 `..`；
- 私钥路径**只校验存在性，不打印、不回显**；
- 命令只接受清单里的 `--server <name>`，不接受任意 host；
- sudo 密码只经 **stdin**（CLI `--password-stdin` / 界面单次请求），**不存在 `--password` 参数**；
- `backup.env` 若提供，必须存在且不含 `CHANGE_ME` / `YOUR_` 占位符；
- 已有安装时，`PASS_UP_OPS_BACKUP_DEPLOY_DIR` 必须与 cron 标签行里的绝对路径一致，否则拒绝执行。
