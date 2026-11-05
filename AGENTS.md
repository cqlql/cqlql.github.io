# AGENTS.md

> 状态：**P0 服务器管理（含一键免密 sudo）已实现并真机验证**；
> P1 备份能力部署已实现并真机验证；一键启动与桌面快捷方式（S2/S3 + 图标同源）已实现，
> S4 真机人工验收待做；P2 监控、P3–P4 应用部署仍为方案、代码未实现（2026-11-05）。
> **2026-11-05 已按能力竖切 Go 包**：`main.go` 薄入口 + `internal/{shared,servers,backup,ui,launcher}`。
> **2026-11-05 界面迁到 Vite + TS + React + antd**：源码在 `web/`，产物嵌进二进制（见 `docs/ui.md`）。
> 只放「每次动代码都要遵守」的红线：一句结论 + 一个指针。判据、流程、踩坑都在 `docs/`。
> 通用文档规则以 `cqlql-notes/docs/工程/文档约定.md` 为准。

## 项目概述

- 本地单二进制运维工具，**已实现**：`ops servers list/check/apply-sudo` 管服务器与免密 sudo；
  `ops backup deploy/verify` 安装、升级与预检备份能力；`ops ui` 只读查看服务器清单与检查结果
  （前端是 React 工程，源码 `web/`，构建后嵌入二进制）；
  `ops shortcut` / `ops menu` / `启动运维.cmd` 是本机一键启动入口。
- **仍是方案、代码未实现**：`ops status`（P2 备份监控）、`ops deploy` / `ops rollback`
  （P3–P4 单机 Docker 部署）；设计见 `docs/backup-monitor.md` / `docs/deploy.md`。
- 代码按能力分包：`main.go` 只做命令分发，`internal/<能力>/` 放实现，
  `internal/shared/` 放配置、ssh 封装与服务器清单模型。详见「目录与边界」。
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
9. 🔴 **安装与监控分离**：只读命令（`ui`，以及 P2 规划中的 `status`）只看与检查；写 crontab /
   logrotate / 目录 / sudoers 只走 `ops backup deploy` 或 `ops servers apply-sudo`，
   **不复用只读账号**。
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
14. 🔴 **界面只监听 `127.0.0.1`**，页面与 `/api/*` 校验 token + 写操作校验 `Origin`；
    静态产物（`/assets/*`、`/favicon.ico`）**不过 token**（是代码不是数据，
    浏览器也带不上自定义头），真正的边界是 API；写操作必须 `POST`，
    且只接受清单里的 `name`（未知 name 返回 404，不代理任意主机）。详见 `docs/ui.md` §4。
15. 🔴 **双击不触发写操作**：`.lnk` 只指 `启动运维.cmd`，图标是独立 `.ico`，名字必校验；
    菜单默认只读预检，安装要「预检通过 + 输入 yes」。详见 `docs/one-click-launch.md`。
16. 🔴 **前端产物不进 Git，但 `web/dist/.gitkeep` 必须进**：`//go:embed all:web/dist`
    在目录不存在时直接编译失败；真实产物由 `npm run build` 生成，`vite.config.ts`
    用 `emitFile` 重建那个占位（`emptyOutDir` 会删它）。详见 `docs/ui.md` §3。

## 命令与验证

```
# Go 侧
go vet ./...
go test ./...
go build ./...

# 前端（改了 web/ 一律两个都跑；test/ 不在 tsconfig 的 include 里）
cd web && npm install
cd web && npm test && npm run typecheck && npm run build

ops init
ops servers list
ops servers check all
ops servers apply-sudo <name> --password-stdin
ops backup deploy --server <name> --dry-run
ops backup deploy --server <name> --install-deps
ops backup verify --server <name>
ops ui [--port 7788]
ops shortcut [--name <名字>] [--remove]
ops menu --help
```

上面只列 `main.go` 注册表里**已实现**的命令；`ops status` / `ops deploy` / `ops rollback`
尚未实现，不要照抄执行。子命令选项以各能力的 `--help` 为准。
本机二进制：`go build -o ops.exe .`（`启动运维.cmd` 按仓根 `ops.exe` 定位，不要挪）。
🔴 **改了 `web/` 就必须重新 `npm run build` 再 `go build`**：产物是编进二进制的，
只 `go build` 拿到的是上一次的页面（未构建过则是「怎么构建」的说明页）。

## 目录与边界

- **已按能力竖切 Go 包**（2026-11-05）。母本 `cqlql-notes/docs/工程/目录结构规范.md` §6
  的四项阈值（领域 ≥10 / 接口 ≥30 / ≥2 人 / 表数 ≥10 或第二存储）仍未达到，
  本次是按项目决定提前拆；代价是 41 个跨包符号导出、6 套测试归位与共用层下沉。
  `main.go` 只留 `main` / `commandHandler` / `run` / 全局 `usage`。
- 🔴 **依赖方向只许单向**：
  `main → {servers, backup, ui, launcher} → shared`，另有 `ui → servers`、`launcher → ui`。
  `shared` **不得 import 任何能力包**，也不得引用能力专属类型；出现环时先把共享常量 / 模型
  下沉到 `internal/shared/`，不要在能力包之间打补丁。
- `internal/shared/`：`config.go`（配置与 `ConfigDirEnv`）、`remote.go`（`SSHTarget` 与 ssh 封装）、
  `servers.go`（服务器清单、状态与 `CheckRow` 展示模型）。`configDirEnv` 曾定义在
  `shortcut.go`，导致 shared 反向依赖 launcher，已下沉，别再挪回去。
- 🔴 **跨包不能给共享类型挂方法**：`SSHTarget` 的 backup 专属操作只能是
  `internal/backup/deploy.go` 里的自由函数（`checkAccess(t, ctx, ...)` 等），
  首参为 `*shared.SSHTarget`；`SSHTarget` 的字段（`Host` / `User` / `Key` / `SudoPassword` 等）
  因跨包访问而导出，不要改回小写。
- 🔴 **动词注册表只有一份**：`commandHandler` 在 `main.go`。菜单不反向依赖入口，
  `launcher.CmdMenu(args, exec, probe)` 由 `main.go` 注入 `run` 与
  `func(n string) bool { _, ok := commandHandler(n); return ok }`；不要再抄一份动词表。
- 🔴 **前端在 `web/`，不在 `internal/ui/`**：`//go:embed` 的路径不能出现 `..`，
  所以嵌 `web/dist` 的文件只能是仓库根的 `webdist.go`（`package main`），
  `ui.CmdUI(args, static fs.FS)` **接收**它 —— `internal/ui/` 不再嵌页面。
  别为了「放得整齐」把 `web/` 挪进 `internal/`：那样 `main.go` 就得反向依赖 `ui` 的私有目录。
- `internal/ui/` 只剩 `ui.go`（服务端）与 `ops.ico`；图标字节经 `ui.IconBytes` 导出给
  `launcher` 写快捷方式，两处同源。`/favicon.ico` 直接读内存，不走 `dist`。
- `web/` 按母本 `cqlql-notes/docs/工程/目录结构规范.md` 与 `前端/前端目录结构规划.md` §二 排：
  `features/<能力>/`（`api.ts` / `service.ts` / `types.ts` / `utils/` / `components/` / `pages/` /
  `index.ts`）+ `shared/{api,ui,utils}`。🔴 **没有 `router/`、顶层 `pages/`、`src/api/`、`src/lib/`**
  —— 不是漏了，是只有一页时不该有（母本 §2「目录是长出来的」）。
  约定（相对 import 必须写扩展名、`test/` 不在 tsconfig include、端口 5175、产物不进 Git）
  见 `docs/ui.md`；**不要在前端算指标**，那是 Go 侧的唯一真源。
- `internal/launcher/` 的 `menu_windows.go` / `menu_other.go` 靠 build tag 切平台实现。
- 命令入口统一 `Cmd<动词>`（如 `backup.CmdBackup`、`servers.CmdServers`）；
  能力的 CLI 分发与 usage 归各自包，测试文件也随能力归位。
- `docs/backup-monitor.md` §7 与 `docs/deploy.md` §5 的文件树是 P2/P3–P4 的**计划**，
  `status.go` / `deploy.go` / `rollback.go` 目前都不存在；落地时在 `internal/<能力>/` 下建包。

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
| 界面（`ops ui` · Vite + React + antd） | `docs/ui.md` | 静态产物不过 token、API 才是边界；产物不进 Git 但 `.gitkeep` 必进；未构建要回说明页 |
| 备份能力部署（P1 ✅，监控的前置） | `docs/backup-deploy.md` | 复用 `install.sh`；不覆盖 `backup.env`；不静默迁移目录；logrotate 由工具落盘 |
| 备份监控（P2 · 方案，未实现） | `docs/backup-monitor.md` | 只读采集；时间差在远端算；`-` 不是 0 |
| 单机一键 Docker 部署（P3–P4 · 方案，未实现） | `docs/deploy.md` | `.env` 去 CRLF；镜像前缀必须等于 compose；Flyway 单向 |
| 一键启动与桌面快捷方式（S2/S3 ✅，S4 人工验收待做） | `docs/one-click-launch.md` | `.lnk` 只指启动器；图标用独立 `.ico`；名字校验挡路径穿越；双击绝不触发写操作 |
| 配置（唯一维护处） | `docs/config.md` | 所有 `PASS_UP_OPS_*` 只在这里定义一次 |
| 文档治理 | `cqlql-notes/docs/工程/文档约定.md` | 新加文档前先过 4 问；索引只有一份 |
| 目录与依赖 | `cqlql-notes/docs/工程/目录结构规范.md` + 本文「目录与边界」 | 依赖单向；`shared` 不得反向 import 能力包；跨包符号必须导出 |
