# AGENTS.md

> 状态：**P0 服务器管理（含一键免密 sudo）已实现并真机验证**；
> P1 备份能力部署已实现并真机验证；一键启动与桌面快捷方式（S2/S3 + 图标同源）已实现，
> S4 真机人工验收待做；P2 监控、P3–P4 应用部署仍为方案（2026-11-05）。
> 只放「每次动代码都要遵守」的红线：一句结论 + 一个指针。判据、流程、踩坑都在 `docs/`。
> 通用文档规则以 `cqlql-notes/docs/工程/文档约定.md` 为准。

## 项目概述

- 本地单二进制运维工具：`ops servers list/check/apply-sudo` 管服务器与免密 sudo；
  `ops backup deploy` 安装/升级备份能力；`ops status/ui` 只读查看备份；
  `ops deploy/rollback` 单机一键 Docker 部署。
- 服务器（备份端 / 应用端）只在 `servers.json` 登记一处，命令用 `--server <name>` 选目标。
- 仅 Go 标准库；所有动作在本机执行，经本机 `ssh` 到目标机。
- 🔴 不改 `pass-up.backend` / `pass-up.ai` / `pass-up.frontend` 的任何代码。
  例外（2026-11-05 真机验证）：只修了 `deploy/backup/**` 自身的两个缺陷
  （`pg_restore` 版本低于服务端时误判 dump 损坏、`install.sh` 把空值 `""` 当占位符），
  未改业务代码。

## 硬约束

1. 🔴 **备份采集只读**：远端脚本不含 `rm` / `mv` / `>` / `sudo`，也不调用会写日志、推钉钉的
   `pg_backup_status.sh` / `minio_backup_status.sh`。详见 `docs/backup-monitor.md`。
2. 🔴 **时间新鲜度只在远端算**：心跳文件是无时区的本地时间，拿回本机解析会差 8 小时。
   详见 `docs/backup-monitor.md`。
3. 🔴 **`-` 不是 0**：没采到必须标记 `collected=false`，禁止用 0 兜底。
   详见 `docs/backup-monitor.md`。
4. 🔴 **`docker/.env` 是 CRLF**：部署同步时必须转 LF，否则会伪装成 PG 认证 /
   Lettuce 握手 / `invalid header value` 三类故障。详见 `docs/deploy.md`。
5. 🔴 **镜像引用必须逐字等于 compose 的 `image:` 前缀**，远端注入 `IMAGE_TAG`。
   详见 `docs/deploy.md`。
6. 🔴 **部署不 `down -v`、不删 `/data`、默认不加 `--remove-orphans`**。详见 `docs/deploy.md`。
7. 🔴 **Flyway 单向**：镜像可回滚，数据库不回滚；回滚后起不来要如实说明。
   详见 `docs/deploy.md`。
8. 🔴 **私钥路径不打印**：可以写进配置，但不出现在任何输出、错误与日志。
9. 🔴 **安装与监控分离**：`status` / `ui` 只看与检查；写 crontab / logrotate / 目录 /
   sudoers 只走 `ops backup deploy` 或 `ops servers apply-sudo`，**不复用只读账号**。
   sudo 密码只经 **stdin**（CLI `--password-stdin` / 界面单次请求内存），
   清单可选的 `sudo.password` 用完建议删除；**禁止 `--password` 参数**。
   详见 `docs/backup-deploy.md`、`docs/servers.md`。
10. 🔴 **`--dry-run` 不改远端**：即使同时给 `--install-deps` 也不安装，只报告缺失项。
11. 🔴 **整目录切换必须保留未部署组件的 `backup.env`**：只部署 `pg` 时，`minio/backup.env`
    也要从旧目录搬进 `.new`，否则重部署单组件会丢另一组件配置（已踩过）。
12. 🔴 **主机只来自 `servers.json`**：命令只接受 `--server <name>`，不接受任意 host；
    旧 `PASS_UP_OPS_*_HOST/_PORT/_USER/_KEY` 已删除，不保留第二套来源。
13. 🔴 **免密 sudo 只写一个 drop-in**：`/etc/sudoers.d/90-<user>-nopasswd`，
    先 `visudo -cf` 再 `install -m 0440 -o root -g root`；验证必须
    `runuser -u <user> -- sudo -n true`（root 自己验证永远成功，等于没验）。
    详见 `docs/servers.md` §6。
14. 🔴 **界面只监听 `127.0.0.1`**，token + `Origin` 校验；写操作必须 `POST`，
    且只接受清单里的 `name`（未知 name 返回 404，不代理任意主机）。
15. 🔴 **双击不触发写操作**：`.lnk` 只指 `启动运维.cmd`，图标是独立 `.ico`，名字必校验；
    菜单默认只读预检，安装要「预检通过 + 输入 yes」。详见 `docs/one-click-launch.md`。

## 命令与验证

```
go vet ./...
go test ./...
go build ./...

ops init
ops servers list
ops servers check all
ops servers apply-sudo <name> --password-stdin
ops backup deploy --server <name> --dry-run
ops backup deploy --server <name> --install-deps
ops status --server <name> [--json]
ops ui [--port 7788]
ops shortcut [--name <名字>] [--remove]
ops menu --help
ops deploy --server <name> --dry-run
```

## 目录与边界

- **暂不竖切包**：当前只有「服务器管理 / 备份 / 部署」三个能力，按文件横切更好找。
  母本阈值是「领域 ≥10 或接口 ≥30」才竖切（`cqlql-notes/docs/工程/目录结构规范.md` §6）。
- `config.go` / `remote.go` 是共用层，不得反向依赖 `status.go` / `deploy.go` 的业务结构。
- 目录是长出来的：**不建空目录**；`ui/` 已有页面与图标，快捷方式 / 菜单按文件横切。
- 计划中的文件树见 `docs/backup-monitor.md` §7 与 `docs/deploy.md` §5。

## 文档规则

- 🔴 **唯一索引就是下面的「文档速查」表**；不新建 `docs/README.md` 或第二个索引。
- 每份 `docs/*.md` 第一行必须是 `> 状态：...`；状态过期比没有文档更危险。
- 配置键与默认值只在 `docs/config.md` 维护；其它文档只引用键名，不复述默认值。
- 「为什么这么设计 / 哪些方案被否」并进对应分册的决策节，不单独开文档。
- 新增能力 = 本表加一行 + 新建分册；**不要往已有分册里堆**。
- 本仓未建 `docs/doc-conventions.md` 全量副本（避免重复通用条款）；仓库正式初始化时按母本
  `§5` 实例化。

## 文档速查

| 能力 / 模块 | 文档 | 最硬的那条红线 |
| :--- | :--- | :--- |
| 服务器管理 + 一键免密 sudo（P0 先做） | `docs/servers.md` | 主机只来自清单；只写一个 sudoers drop-in；验证用 `runuser` |
| 备份能力部署（P1 ✅，监控的前置） | `docs/backup-deploy.md` | 复用 `install.sh`；不覆盖 `backup.env`；不静默迁移目录；logrotate 由工具落盘 |
| 备份监控（P2） | `docs/backup-monitor.md` | 只读采集；时间差在远端算；`-` 不是 0 |
| 单机一键 Docker 部署（P3–P4） | `docs/deploy.md` | `.env` 去 CRLF；镜像前缀必须等于 compose；Flyway 单向 |
| 一键启动与桌面快捷方式（S2/S3 ✅，S4 人工验收待做） | `docs/one-click-launch.md` | `.lnk` 只指启动器；图标用独立 `.ico`；名字校验挡路径穿越；双击绝不触发写操作 |
| 配置（唯一维护处） | `docs/config.md` | 所有 `PASS_UP_OPS_*` 只在这里定义一次 |
| 文档治理 | `cqlql-notes/docs/工程/文档约定.md` | 新加文档前先过 4 问；索引只有一份 |
| 目录与依赖 | `cqlql-notes/docs/工程/目录结构规范.md` | 按能力切；未过阈值先横切 |
