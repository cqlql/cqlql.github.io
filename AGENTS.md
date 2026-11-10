# AGENTS.md

> 状态：**P0 服务器管理（含一键免密 sudo）已实现并真机验证**；
> P1 备份能力部署已实现并真机验证；一键启动与桌面快捷方式（S2/S3/S5 + 图标同源）已实现，
> **双击 `启动运维.cmd` 直接开网页面板**（隐藏守护 / 单实例 / 自动开浏览器 / 关闭界面），
> S4 真机人工验收待做；**P2a 备份监控 CLI 与 P2+ 界面均已实现（真机验收待做）**；
> P3–P4 应用部署仍为方案、代码未实现（2026-11-08 更新）。
> ✅ **2026-11-10 手动备份按 §8 七场景完成真机验收（`docs/backup-once.md` §8.1）**：
> `ready`（预演前后快照一致 / 正常一次 rc=0）、`locked`（持 MinIO flock 被挡）、
> `failed`（`pg 0 / minio 1` 分组件汇总）、`busy`（并发 409）真机跑通；
> `blocked` / `timeout` / `offline` 由代码判据 + 单测覆盖，未造故障 / 断网。
> 前置 §7.1 已闭环（21:4x 重新部署后远端两脚本都带 `flock -n 9`）。
> ✅ 验收发现的 preflight 弱凭证回显 `12345678` 已于 22:4x **修好并重新部署真机验证**
> （`preflight_minio.sh` 只改告警一行不回显值，判据 / 退出码未动；任务日志已无该串），
> 见 `docs/backup-once.md` §8.2。
> 原型 `docs/backup-once-prototype.html`（19 个锚点，分区见 `backup-once-prototype-map.md`）
> 留作交互回归基线：七场景 = 验收用例集，钉死「定时状态恒不采集 / 预演不是执行凭证 /
> 弹窗无 sudo 密码框 / 撞锁·失败·超时是运行期结果、不是预演阻塞」，冲突时改原型。
> 原型不连远端、不发请求、不执行任何动作；界面见 `docs/ui.md` §15 / 硬约束 32。
> **2026-11-08 备份恢复已实现（真机只读 + 写演练均已跑，§7.3 / §7.4）**：`ops restore list/plan/run` 顶层动词 +
> 界面第 7 个导航项「备份恢复」+ 只读 `GET /api/restore/candidates` / `/api/restore/plan` +
> `POST /api/backup/run` 的 `mode=restore` / `restore-dry`；复用已部署的 `*_restore.sh`
> 与同一把任务锁，不提权（弹窗无 sudo 密码框）、不读 crontab、不另选生产主机、
> 不收任意路径；库名两次逐字比对 / `YES` / 三项前置 / 覆盖生产额外勾，服务端逐字再验；
> 报告只报脚本结果、失败停在当前阶段。原型六场景 = §5.7 验收用例集；
> **19:43 只读链路已连真机跑通**（候选 / 两级阻塞 / 计划 / PG+MinIO 预演 / 门禁拒绝 /
> 界面端到端，见分册 §7.3）；演练修掉「预演管道吞退出码」「find 小数 epoch」两个缺陷，
> 并确认「备份机 pg_restore 16.15 ≠ 容器内 18.6」的误挡。
> **20:09 用户声明测试数据可覆盖并授权写演练（§7.4）**：MinIO 工具正式恢复全链路 rc=0
> （3 桶、同名覆盖 / 多余对象保留已实证）、界面写任务失败阶段与报告已验证、
> PG 用容器内 18.6 恢复到临时库（60 表 / Flyway 9 与生产库一致）；产物已清理、环境回基线。
> ✅ **2026-11-10 工具侧 PG 正式恢复全链路已跑通（分册 §7.5 / §7.6）**：本仓修
> `pg_restore.sh` 的 stdin 坑（`remote_exec` 加 `-n`、`remote_docker_stdin` 保留转发，
> 加源码断言 + 真实 ssh 对照实证）+ k4 手工装 PGDG `postgresql-client-18` 解除归档误挡
> → 21:06 重新 `ops backup deploy` → 21:07 `ops restore run` 到临时库 `restore_test`
> rc=0（`PHASE 1→5`、二次确认串真机读到、60 表 / Flyway 47 与生产库一致）
> → 删临时库、环境回基线。判据与 `ops backup deps` 的「只补缺失」语义一行未改。
> ✅ **2026-11-10 21:30 本仓修掉 `psql` 吞错（分册 §7.7）**：globals 分支捕获输出逐行判
> `ERROR:`，「对象已存在」白名单放行并醒目告警、其余错误 / 链路失败 `exit 1`；业务库 `.sql`
> 分支加 `ON_ERROR_STOP=1`。🔴 **globals 故意不开 `ON_ERROR_STOP`** —— `pg_dumpall` 的
> `CREATE ROLE postgres` 在目标端必然已存在，开了会截断后续 `SET` / `ALTER ROLE`；
> `backupdist_test.go` 加嵌入产物断言、五种改坏方式实测全红、还原全绿，
> 另做五种运行期输出的行为冒烟全绿（§7.7 ③′，脚本片段 + 桩函数，不是真机）。
> ✅ **21:4x 已重新 `ops backup deploy` 并真机验证（分册 §7.8）**：远端脚本
> 9336 B → 11163 B、`cql:cql`、crontab 4 条未改；临时库 `restore_test` 恢复 rc=0
> （`PHASE 1→5`、真机读到「⚠️ …对象已存在…被跳过」、60 表 / Flyway 47）
> → 删临时库、环境回基线。**两端同源、闭环**，值守仍需逐行看告警行。
> 报告里「装回两条 cron」是固定提醒，crontab 全程 4 条未改，**别照它去动 cron**。
> 🔴 仍未覆盖：脚本中途失败 / 失败桶运行期场景（不破坏环境去造故障）；globals 分支
> 「致命 ERROR 中止」只有桩函数冒烟、没在真机造过；换机器仍需人工装 18 客户端
> （deps 版本对齐未做）。
> MinIO 对象数不采集（显示 `—`）、脚本固定恢复 `SRC_BUCKETS` 全部桶、只读预演不连 MinIO
> （三条实现差异见分册 §5.2 / §7.1）。界面见 `docs/ui.md` §16 / 硬约束 33。
> **2026-11-07 深夜界面新增「备份监控」**（第 5 个导航项，纯只读）：
> `GET /api/monitor/status` + 30s 缓存 + 四张卡，与 `ops status --json` 共用
> `monitor.CollectForServer` / `Status`；见 `docs/ui.md` §14 / `docs/backup-monitor.md` §12 / 硬约束 31。
> **2026-11-08 改口径：不再单设只读账号**。`ops status` 与「备份监控」页统一用
> 清单 `user/key` 登录，只读由远端脚本保证（不写文件、不提权、target 不带 sudo 密码）；
> `monitor` 字段、`MonitorSSHTarget()` 强制校验与配置页账号区块已整体移除，
> 旧清单里的历史字段被忽略。见 `docs/backup-monitor.md` §6 / §11.2、硬约束 9。
> **2026-11-06 界面新增「重启」**（顶部工具栏）：可选「先重建」（npm test / typecheck /
> build → `go build -o ops.next.exe .`）、换 exe、同端口同 token 接手、`boot_id` 判定，
> 见 `docs/ui.md` §11 / 硬约束 22。
> **仍未做**退出码 75 / `ops.exe.new` / cmd 守护换身那套：改走 detached 接手进程，
> `启动运维.cmd` 一行未改（见 `docs/one-click-launch.md` §4.2）。
> **2026-11-05 已按能力竖切 Go 包**：`main.go` 薄入口 + `internal/{shared,servers,backup,ui,launcher}`。
> **2026-11-05 界面迁到 Vite + TS + React + antd**：源码在 `web/`，产物嵌进二进制（见 `docs/ui.md`）。
> **2026-11-05 界面新增「备份能力部署」页（预检 / 安装 / 自检）**：红线已从
> 「`ui` 只读」改为「**双击落地页只读，写操作必须显式二次确认**」，见 `docs/ui.md` §9。
> **2026-11-05 备份脚本迁入本仓**：`deploy/backup/**` 从 `pass-up.backend` 整体搬来并
> `//go:embed` 进二进制，`ops.exe` 不再依赖兄弟仓（见 `docs/backup-scripts.md`）。
> **2026-11-06 界面清单路径可直接点开 VSCode**：`POST /api/open-servers-file` 是纯本机动作，
> 路径由服务端解析、接口不读请求体，见 `docs/ui.md` §10。
> **2026-11-06 导航新增全局顶部工具栏**：左侧 Sider + Menu 不变，工具栏放全局动作
> （现为快捷方式 / 重启 / 关闭界面），窄屏与横向导航合成同一条；
> 访问过的页面仍保持挂载（见 `docs/ui.md` §7）。
> **2026-11-06 界面新增「配置」页**：本机可编辑 `servers.json` 与 `backup/{postgres,minio}.env`，
> 远端 `backup.env` 走显式「同步到远端」（新增 CLI `ops backup sync-env`），
> 见 `docs/ui.md` §12 / 硬约束 23。
> **2026-11-06 远端运行身份改为非 root**：安装期才 sudo 提权到 root（写系统目录 / 清旧
> crontab），定时备份、preflight 自检、首跑一律以清单 `user` 运行，`known_hosts` /
> `~/.mc` 与备份机手工 ssh 同源；升级会迁移 root crontab 与目录属主。
> 见硬约束 24 / `docs/backup-deploy.md` §4.4。
> **2026-11-06 环境组件能力落地**：`ops component list/install/image-load` + 界面第 3 项
> 「环境组件」（组件目录 + 详情）；Docker 走官方 apt 仓库，MinIO 走**离线镜像 tar**
> 与本机 `backup/minio.env` 运行时注入的 root 凭证，见 `docs/components.md` /
> `docs/ui.md` §13 / 硬约束 25。
> **2026-11-07 更新 / 卸载落地**：`ops component update/uninstall` + 界面三个写动词
> 共用一个确认弹窗；动作计划（能否执行 / 阻塞原因 / 影响清单 / 附加勾选 / 候选镜像）
> 由 Go 侧 `BuildActions` 按注册表与体检结果算、随 status 下发，**前端只渲染**。
> 删数据独立勾选且默认不勾、卸引擎的连带影响必勾，界面不开放 `--force`；
> MinIO 更新的新镜像同样只能来自人导入的 tar。见 `docs/components.md` §8 / 硬约束 25。
> **2026-11-07 追加 `image-copy`**：镜像也可以直接从另一台已登记服务器
> （典型是跑着 MinIO 的主服务器 `prod`）复制到目标机 ——
> `ops component image-copy minio --server k4 --from-server prod [--image-ref]`，
> 链路是「源机 `docker save` → 本机 pipe 中转（**不落盘**）→ 目标机 `docker load`」，
> 不经镜像仓库、**不是 `docker pull`**；源机同样只认 `servers.json` 的 name（源 ≠ 目标），
> 候选镜像只来自源机只读清单。界面在「离线镜像」区多了「从服务器复制…」。
> 见 `docs/components.md` §9 / 硬约束 25 ⑩。
> **2026-11-06 换电脑零手工 + 配置不全不挡路**：`启动运维.cmd` **先**问
> `ops.exe __dist-check` —— 二进制里已有页面就零构建（磁盘 `web/dist` 被删也只补占位目录）；
> 只有没页面才自动 `node.exe npm-cli.js run build` + `go build -o ops.exe .`，
> 见 `docs/one-click-launch.md` §4.1 / 硬约束 26；
> `ops ui` 配置缺失时**照常返回 SPA**，`/api/servers` 回 200 + `setup_error`（空清单 +
> 默认路径），落地页给「去配置页 / 打开清单」引导；配置页新增「新增服务器」（`mode=add`），
> 空清单自动进该模式，保存后服务器管理页自动刷新。见 `docs/ui.md` §12 / 硬约束 26。
> **2026-11-06 顶部工具栏收齐三个全局动作**：「创建桌面快捷方式」「关闭界面」从
> 服务器管理页页头移进工具栏、与「重启」同列，「检查全部」留在页头；判据是
> 「作用对象是整个工具还是这一页的数据」，见 `docs/ui.md` §7。
> `/api/shortcut` / `/api/shutdown` 的接口归属同步移到 `features/system/api.ts`；
> 关界面后整壳换成静态说明页，窄屏三个按钮只留图标。
> **2026-11-07 晚界面补上「卸载依赖」**：`ops backup deps-uninstall --target mc|pg_client`
> + `/api/backup/run` 的 `mode=deps-uninstall`，供「卸了再装」复测；只删工具装的
> mc / PG 客户端，不卸系统基础包、不 autoremove、不碰数据与定时任务；
> 卸载计划由 Go 侧下发、勾选项默认全不勾且至少选一个，门禁与安装完全相同。
> 见 `docs/backup-deploy.md` §10.3 / `docs/ui.md` §9.7 / 硬约束 30。
> **2026-11-07 界面可安装「缺少依赖」**：新增独立 CLI `ops backup deps`
> （`--json` 只读状态 / `--dry-run` 只报告 / 正式只装命令，不部署脚本），界面在
> 「备份能力部署」与「环境组件」两页各加一个只读依赖清单 + 显式「安装缺少依赖」；
> 走 `POST /api/backup/run` 的 `mode=deps`，同样要 `confirm=yes` 与服务端 `--dry-run`。
> PG 客户端可选按官方 PGDG apt 仓库装版本化包（`--pg-major`），mc 补上官方文档地址；
> 见 `docs/backup-deploy.md` §10.2 / `docs/ui.md` §9.7 / 硬约束 30。
> **2026-11-07 配置页显示 schema 默认值 + 显式「填入推荐默认值」**：换电脑后一片
> 「未配置」的真因是 `GET /api/config` 不带 `env-schema.json` 的 `default`；现在只提示、
> 不自动写文件，凭证与 `default` 为空的键恒空，落盘仍要点保存 + `yes`。
> 🔴 灰字不许承诺「留空可用」：默认值只在脚本运行时兜底，预检按 `backup.env` 有没有
> 显式这一行判定，留空会报「未配置」；见 `docs/ui.md` §12.7 / 硬约束 23 ⑧。
> **2026-11-07 夜配置页可显式「清空」已配置字段**：`POST /api/config/backup-env` 增
> `clear` 列表，空值仍恒为「保持不变」，凭证填错不必再手改文件；`PG_SSH_KEY` 保存时
> 只认私钥文件绝对路径，`preflight_pg.sh` 不再把路径打进日志。
> 见 `docs/ui.md` §12.8 / 硬约束 23 ⑨。
> **2026-11-07 晚 P2a 备份监控 CLI 落地**：`ops status --server <name> [--json]`
> + `internal/monitor/{config,status,cli}.go` + 红线单测（远端 epoch / `-` 不是 0 /
> 连不上仍回完整快照）；8 个 `ops.env` 键从 retired 接进 `opsEnvKeys`，键表搬回
> `docs/config.md` §3，`docs/servers.md` §3 的 `monitor` 改「P2a 必填」。
> `shared.SSHTarget.RunScript` 走 stdin `sh -s`、stdout/stderr 分离；
> 当时的 `MonitorSSHTarget()` 曾强制专用只读账号（2026-11-08 已撤销，改为单账号）。
> `main.go` 注册 `status`，菜单第 7 项按 `probe("status")` 条件出现。
> P2+ 界面随后另起一刀（已落地，见下条状态）；P3–P4 仍为方案；
> **真机连备份机验收待做**。
> **2026-11-08 备份恢复：分册 → 原型评审 → 同日落地代码**（`docs/backup-restore.md` /
> `docs/backup-restore-prototype.html`，分区索引见 `backup-restore-prototype-map.md`）：
> 人工 SOP 仍是分册 §3（脚本真实行为），工具侧 CLI / 界面 / 只读接口 / 门禁全部已实现（§7），
> §5.0 六条评审结论仍是判据：工具不读 crontab、停没停由人确认；`--server` 只认备份机、
> 生产端由备份机 `backup.env` 决定；阻塞分两级、预演不是执行凭证、报告只报脚本结果、
> 验收以原型六场景为用例集。原型留作交互回归基线、不连远端不执行动作；
> 「恢复脚本禁止入 Crontab / 必须有人值守」**一行未改**；只读（§7.3）与写演练（§7.4）均已跑。
> 🔴 只放「每次动代码都要遵守」的红线：一句结论 + 一个指针。判据、流程、踩坑都在 `docs/`。
> 通用文档规则以 `cqlql-notes/docs/工程/文档约定.md` 为准。

## 项目概述

- 本地单二进制运维工具，**已实现**：`ops servers list/check/apply-sudo` 管服务器与免密 sudo；
  `ops backup deploy/verify/env/sync-env/deps/deps-uninstall/once` 安装、升级、预检备份能力、
  生成配置模板、单独同步配置到远端、单独安装 / 卸载缺失依赖、立即手动跑一次备份
  （备份脚本本体就在本仓 `deploy/backup/`，编进二进制）；
  `ops component list/install/update/uninstall/image-load/images/image-copy` 管备份端环境组件
  （Docker 引擎与 MinIO 服务，只读体检 / 安装 / 更新 / 卸载 / 离线镜像导入 /
  从另一台已登记服务器直接复制镜像，
  脚本在 `deploy/component/` 编进二进制，见 `docs/components.md`）；
  `ops status --server <name> [--json]` 只读采集备份状态（PG 心跳 / 最新 dump /
  MinIO 心跳 / 磁盘 + 问题清单；退出码 0 无 danger / 1 有 danger / 2 配置错）；
  `ops restore list/plan/run` 只读候选 / 预演 + 显式执行恢复（复用已部署的
  `pg_restore.sh` / `minio_restore.sh`，门禁比安装更严，见 `docs/backup-restore.md` §7）；
  `ops ui` 默认只读查看服务器清单与检查结果；「备份能力部署」页另有预检 / 安装 / 自检 /
  安装缺少依赖四个显式入口（两个安装都要输 yes，服务端先跑 `--dry-run`，见 `docs/ui.md` §9）；
  「环境组件」页另有同一份「备份依赖」区（见 `docs/components.md` §10）；
  顶部工具栏另有「重启」（本机动作，可选先重建 + 换 exe，见 `docs/ui.md` §11）
  （前端是 React 工程，源码 `web/`，构建后嵌入二进制）；
  双击 `启动运维.cmd` 直接开这个网页面板（后台隐藏守护 + 自动开浏览器 + 单实例）；
  `ops menu` 是显式的交互菜单入口，`ops shortcut` 建桌面 `.lnk`。见 `docs/one-click-launch.md`。
- `ops ui` 的「备份监控」页（P2+）已实现：只读快照 + 30s 缓存 + 四张卡 +
  60s 自动刷新，与 CLI 共用一份 `Status`；见 `docs/ui.md` §14 / `docs/backup-monitor.md` §12。
- **仍是方案、代码未实现**：`ops deploy` / `ops rollback`（P3–P4 单机 Docker 部署，
  设计见 `docs/deploy.md`）。草案命令未注册、不要照抄执行。
- **手动备份已实现且真机验收已跑（2026-11-10，§8.1）**：`ops backup once` + 界面第 6 项，
  见 `docs/backup-once.md` / `docs/ui.md` §15；§7.1 补锁前置已闭环，七场景逐条结论见 §8.1，
  心跳已被手动备份刷新（**不代表定时任务正常**）。
- **备份恢复已实现（真机只读 + 写演练 + 工具侧 PG 正式恢复全链路均已跑，§7.3 / §7.4 / §7.6）**：
  `ops restore list/plan/run` + 界面第 7 项 + `internal/restore/` + `web/src/features/restore/`，
  见 `docs/backup-restore.md` §7 / `docs/ui.md` §16 / 硬约束 33；写演练在用户声明
  「测试数据可覆盖」后执行，产物已清理、环境回基线。🔴 以后改了 `deploy/backup/**`
  仍必须重新 `ops backup deploy`（21:06 已部署带 `-n` 的新版）才生效。
- 代码按能力分包：`main.go` 只做命令分发，`internal/<能力>/` 放实现，
  `internal/shared/` 放配置、ssh 封装与服务器清单模型。详见「目录与边界」。
- 服务器（备份端 / 应用端）只在 `servers.json` 登记一处，命令用 `--server <name>` 选目标。
- 仅 Go 标准库；所有动作在本机执行，经本机 `ssh` 到目标机。
- 🔴 不改 `pass-up.backend` / `pass-up.ai` / `pass-up.frontend` 的任何代码。
  例外（2026-11-05）：备份脚本已整体迁入本仓 `deploy/backup/`，backend 侧只做了
  「删目录 + 改引用指向」，未改业务代码；同日真机验证时也只修过 `deploy/backup/**` 自身
  的两个缺陷（`pg_restore` 版本低于服务端时误判 dump 损坏、`install.sh` 把空值 `""` 当占位符）。

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
9. 🔴 **只读动作不写远端，且只有一个账号**：`status`（P2a 已实现）与界面**默认视图**
   只看与检查；写 crontab / logrotate / 目录 / sudoers 只走显式动作
   （`ops backup deploy`、`ops servers apply-sudo`、或界面「备份能力部署」里输过 yes 的安装）。
   🔴 **2026-11-08 起安装 / 检查 / 备份监控共用清单 `user/key`**，不再分设只读账号：
   `StatusSSHTarget()` 基于 `NewSSHTarget()` 但清空 sudo 密码，远端脚本只读、不提权；
   「只读」不是给账号降权。旧 `monitor` 字段被忽略，**不许**把「必须有 monitor」
   加回 `normalize()` 或采集入口（会打挂现有清单）。
   🔴 界面**不会自动**触发安装：双击落地页仍是只读的，安装必须是人点按钮 + 二次确认
   + 服务端预检门（判据见硬约束 21）。
   sudo 密码只经 **stdin**（CLI `--password-stdin` / 界面单次请求内存 → 子进程 stdin），
   清单可选的 `sudo.password` 用完建议删除；**禁止 `--password` 参数**。
   详见 `docs/backup-deploy.md` §2、`docs/servers.md`、`docs/backup-monitor.md` §6 / §11.2。
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
    且只接受清单里的 `name`（未知 name 返回 404，不代理任意主机）；
    `POST /api/backup/run` 启动备份任务、`GET /api/backup/task` 轮询增量日志，两者同样要 token；
    `POST /api/shutdown`（只结束界面进程）与 `POST /api/open-servers-file`
    （只起编辑器打开 `servers.json`）是纯本机动作，不涉及远端：后者**路径由服务端从
    `ops.env` 解析、接口不读请求体**，不变成「打开任意本机文件」的代理。
    详见 `docs/ui.md` §4 / §9 / §10。
15. 🔴 **双击不触发写操作，写操作一律显式确认**：双击直接开**只读落地页**（服务器管理页）；
    页面里的写动作——一键免密 sudo、安装 / 升级备份能力、配置页保存 / 同步——都要人点按钮；
    后两类每次写请求还要带 `confirm=="yes"`（安装另需过服务端预检门，见硬约束 21；
    配置页见硬约束 23）。
    点清单路径用编辑器打开是**本机动作**（不写清单、不碰远端），不算这里的写动作，
    但同样要人点一下；见 `docs/ui.md` §10。
    顶部工具栏的「重启」也是**本机动作**（只换本机的进程与 exe，不碰远端），
    但仍要显式点击 + 二次确认；备份任务在跑时服务端直接 409 拒绝（硬约束 22）。
    环境组件页的四个写动作（安装 / 更新 / 卸载 / 导入镜像）同样要点按钮 +
    `confirm=="yes"` + 服务端先跑 `--dry-run`，删数据 / 卸引擎另有独立勾选
    （硬约束 25 / `docs/ui.md` §13）。
    命令行与 `启动运维.cmd --menu` 仍是等价入口，菜单第 3 项的「预检通过 + 输入 yes」不变。
    `.lnk` 只指启动器，图标是独立 `.ico`，名字必校验。详见 `docs/one-click-launch.md`。
16. 🔴 **前端产物不进 Git，但 `web/dist/.gitkeep` 必须进**：`//go:embed all:web/dist`
    在目录不存在时直接编译失败；真实产物由 `npm run build` 生成，`vite.config.ts`
    用 `emitFile` 重建那个占位（`emptyOutDir` 会删它）。
    🔴 **换电脑 / 全新 clone 时启动器自动补齐**（不要求人手敲构建命令）：判据是
    `__dist-check` 看**二进制里**有没有 `index.html` + `assets/`，不是看磁盘目录 ——
    「磁盘 dist 已构建、exe 却是旧的」正是最常见的坏状态。详见硬约束 26 / `docs/ui.md` §3。
17. 🔴 **后台界面只起一个、配置不全也得起、端口被占要避让**：单实例只认
    `internal/shared` 的命名互斥体（不靠 `tasklist`），**互斥体名带配置目录指纹**
    （配置目录可被覆盖，机器级名字会互相挡）；`ui.json` 0600 只存 port+token；
    默认端口 7788 被占**自动递增**（同机 `suikouji ops` 也占 7788），显式 `--port` 才严格绑定；
    `ops init` 生成的空 `servers.json` 不能让 `ops ui` 静默退出，**也不能用一页 503 说明
    把人挡在界面外**（界面里就有补配置的入口），要照常回 SPA 并给可操作的引导；
    守护起不来必须回退前台。详见 `docs/ui.md` §4 / `docs/one-click-launch.md` §4.4。
18. 🔴 **桌面快捷方式只有一份实现**：`launcher.CreateShortcutOnDesktop` 是唯一入口，
    `ops shortcut` 与页面按钮（`POST /api/shortcut`）都调它；ui 通过 main 注入，
    不反向 import launcher。该按钮**不依赖配置是否齐全**（只碰本机桌面）。
19. 🔴 **备份脚本编在二进制里**：改了 `deploy/backup/**` 必须重新 `go build`，
    只跑旧 `ops.exe` 部署出去的还是旧脚本（与「改了 `web/` 必须 `npm run build`」同理）。
    嵌入点是仓库根 `backupdist.go`（embed 路径不能有 `..`，`internal/backup` 自己嵌不了），
    `backup.CmdBackup(args, fs.FS)` 由 `main.go` 注入。详见 `docs/backup-scripts.md`。
20. 🔴 **`deploy/backup/` 里不许出现真实凭证**：`//go:embed all:deploy/backup` 会整目录编进
    二进制，`backup.env` 一旦放回去就等于把数据库/MinIO 密码打进 exe。真实配置在配置目录
    `backup/{postgres,minio}.env`（模板 `ops backup env` 生成），打包时以 0600 单独注入；
    `.gitignore` 与 `backupdist_test.go` 各挡一道。
21. 🔴 **界面备份部署必须过六道门**（2026-11-05 改红线后新增）：
    ① `POST /api/backup/run` 的 `mode=deploy` 必须带 `confirm=="yes"`；
    ② 服务端自己先跑一遍 `--dry-run`，非 0 就不安装（前端点了不算数）；
    ③ `name` 只认 `servers.json`、`component` 只认 `all|pg|minio`；
    ④ sudo 密码只在单次请求内存 → 子进程 stdin（`--password-stdin`），日志按行脱敏、任务结束清空；
    ⑤ 任务**脱离 HTTP 请求**（禁用 `r.Context()`），刷新页面不打断已开始的远端安装；
       单任务互斥（并发 409）、日志 `?after=` 增量轮询、上限 256 KB；
    ⑥ 界面不开放 `--force` / `--run-now` / `--install-deps`，这些仍走 CLI。
       `mode=deps` / `mode=deps-uninstall` 跑的是**独立子命令** `ops backup deps` /
       `ops backup deps-uninstall`（同样过 ①–⑤），不是 `deploy --install-deps`：
       绝不顺带重部署脚本（硬约束 30）。
    `ui` **不 import `backup`**：执行器 `BackupRunner` 由 `main.go` 注入，根包 `backuprun.go`
    再起一个自己执行同一条 CLI 命令（输出接任务日志）。详见 `docs/ui.md` §9。
22. 🔴 **界面重启必须过六道门**（2026-11-06 新增）：
    ① `POST /api/restart` 必须带绑「进程实例 + 端口 + token」的 `confirm_token`
       （页面是上一个进程打开的就 409，必须刷新重确认）；
    ② 备份预检 / 安装 / 自检在跑时 **409 拒绝**（远端正在写，拦腰截断会留半状态）；
    ③ 勾「先重建」时服务端按 `npm test` → `npm run typecheck` → `npm run build` →
       `go build -o ops.next.exe .` 重建，**失败就地停、服务照旧在跑**；过期检测要算
       `deploy/backup/**` 与 `web/dist/index.html`（两者都 embed 进二进制）；
    ④ 接手进程复用 `ui.json` 的 port+token（**不换新 token**，否则前端轮询
       `/api/health` 会一直 401、把成功误报成失败；令牌也不进命令行）；
       单实例互斥体带重试拿锁，新进程输出进 `ops-ui.log`；
    ⑤ 响应必须显式 `Content-Length`（chunked 结束块在进程退出后永远发不出去），
       先回 200 再 Shutdown + 退出；**拉起接手进程失败就不退出**；
    ⑥ 判据只有 `/api/health` 的 `boot_id` 变了，传输层失败不是失败；
       不重建时不跑 `ReplaceBinary`，同路径换二进制必须拒绝。
    `__restart` / `__takeover` 是内部标记，不进 usage / 菜单；详见 `docs/ui.md` §11。
23. 🔴 **界面配置页必须过六道门**（2026-11-06 新增）：
    ① `GET /api/config` 凭证字段只给 `configured` 标记、不回显明文；
       `POST /api/config/{servers,backup-env,sync-env}` 必须带 `confirm=="yes"`；
    ② 路径全部由服务端从 `ops.env` / 配置目录解析，**接口不接收任何路径**；
       `name` 只认 `servers.json`、组件只认 `pg|minio|all`；
    ③ 字段白名单：编辑已有清单时不改 `name`（主键）；`mode=add` 新增时 `name` 必填、
       不许重名，其余字段仍只认同一份白名单，写前同样过 `shared.LoadServers` 全量校验；
       env 只改「模板定义过或文件里已有」的键；
       值按 shell 字面量转义（env 会被远端 `source`，`$(...)` / 反引号必须失效）；
    ④ 写 0600 + 先留 `.bak` + 原子替换；清单写前用 `shared.LoadServers` 全量校验，
       校验失败原文件一字不动；私钥路径不进任何输出 / 日志；
    ⑤ **保存本机 ≠ 生效**：deploy 在远端 `backup.env=OK` 时默认保留旧配置，
       界面又不开放 `--force`，所以必须另有显式「同步到远端」动作，
       走 `ops backup sync-env`（只传 env，不重跑 install.sh、不动 crontab）；
       占位符配置拒绝同步；备份任务在跑时 409；
    ⑥ 「远端执行身份」是 `user + sudo.mode` 推导的**结果**，不是可配项，页面只读展示；
       改了 `user` / `sudo.mode` 要提示重新一键免密 sudo（drop-in 按用户名写）并清掉检查缓存。
    ⑦ 远端值对照是**只读**：`ops backup compare-env` 只发一条 `cat`，不写文件、不跑脚本；
       凭证只回掩码 + 指纹（`shared.EnvFingerprint`），明文既不进 HTTP 响应也不进日志；
       失败如实回原因、不猜空值、不缓存。页面默认在「编辑本机配置」的每个输入框下方
       就地显示，另有「对比远端配置」次入口兜住「仅远端有」的键；同步是整份覆盖，
       远端独有项会消失，必须显式提示。
    ⑧ 配置页的默认值**只来自 `env-schema.json`**：`GET /api/config` 下发 `default`，
       凭证键、schema `default` 为空的键（含「留空即关闭」的开关）、文件里的未知键
       一律空串；页面只在 placeholder 提示，**不自动写文件**，要落盘必须人点
       「填入推荐默认值」→ 保存 + `confirm=="yes"`。见 `docs/ui.md` §12.7。
    ⑨ 清空已配置字段必须走**显式 `clear` 列表**（字段旁「清空」按钮 + 保存 + `yes`），
       不许靠「输入框留空」猜意图；`clear` 同样过白名单、只清文件里已有的键、写 `KEY=""`、
       留 `.bak`。`PG_SSH_KEY` 是私钥文件路径、保存时拒绝非绝对路径，
       路径不进任何输出 / 日志。见 `docs/ui.md` §12.8。
    详见 `docs/ui.md` §12。
24. 🔴 **远端运行身份不是 root**（2026-11-06 新增；`docs/ui.md` §12.4 里
    「非 root 安装另立方案」的旧结论作废）：
    安装期才由 `sudo -n sh -c` 提权到 root（写 `/etc/logrotate.d`、建并 `chown`
    日志/备份目录、清理旧 root crontab）；**cron 定时备份、preflight 自检、
    `--run-now` 首跑、install.sh 里的 SSH 连通探测一律以 `servers.json.user` 运行** ——
    同一个 HOME / `~/.ssh/known_hosts` / `~/.mc` / 私钥，与备份机上手敲的 ssh 一致。
    ① `runBackupVerify` 与 deploy 收尾的 preflight、`--run-now` 都走 `Stream(root=false)`；
       install.sh 仍走 `root=true`，但命令要带 `BACKUP_RUN_USER=<user>`（不靠 SUDO_USER）；
    ② install.sh 用 `crontab -u <user> -` 装任务、`CRON_HOME` 取该用户家目录，
       并只删 root crontab 里带 `#PG_BACKUP` / `#MINIO_BACKUP` 标签的旧行（防双跑）；
    ③ 日志轮转配置必须带 `su <user> <组>`（占位符由 `installLogrotate` 替换），
       否则目录属主非 root 时 logrotate 直接跳过轮转；
    ④ 迁移期目录漂移检查要同时看运行用户与 root 两份 crontab；
       `TestEmbeddedInstallRunsAsNonRoot` 与源码级断言一起挡回归；
    ⑤ **不要把 install.sh 整体降成普通用户**：它内部的 `chown` 会依赖免密 sudo，
       只配 `sudo.password` 的机器会回归失败；
    ⑥ 部署失败回滚时 `failAfterInstall` 必须撤销运行用户 crontab 里本次装的任务
       （`revokeRunUserCrontab`）：旧 install.sh 会把任务装回 root，不撤销就双跑。
    详见 `docs/backup-deploy.md` §2 / §4.4 / §5、`docs/backup-scripts.md` §4.1。
25. 🔴 **环境组件按注册表接，MinIO 不在线拉镜像、凭证只走运行时注入**（2026-11-06 新增）：
    ① 组件 id 只认 `internal/component/registry.go`；写动词 `RunnableVerb`、导入 tar
       `SupportsImage` 各挡一道，planned 组件一律拒绝；**不声明 `Verbs` 的组件只给
       `install`**，破坏性动词必须显式声明。新增组件 = 一条声明 +
       一份只读 `check.sh`（可选 install/update/uninstall.sh），导航项与页面数不变。
    ② `deploy/component/**` 整目录 embed，**不许出现凭证 / .env / 私钥 / 日志**；
       MinIO root 凭证只从本机 `backup/minio.env` 的 `DEST_KEY` / `DEST_SECRET` 读，
       运行时拼到上传脚本头部（远端 0600 临时文件，成败都删），
       不进 argv / HTTP 响应 / 任务日志；页面只回「是否已配置」与 `DEST_URL` 端口。
    ③ 🔴 **绝不 `docker pull`**：k1 实测 Docker Hub 超时 / quay.io 401 / dl.min.io 410；
       MinIO 只认人导入的离线 tar（`image-load` 先校验 `manifest.json`），
       远端没有镜像时预检直接拦下，不留半状态。
    ④ 安装幂等：Docker 已装就跳过 apt；MinIO 已有容器只做健康检查 / `docker start`，
       不重建、不删 `/data/minio`、不动引擎 / 其它镜像 / crontab / `backup.env`。
       `/data` 不存在**不硬拦**（k4 只有系统盘）：安装脚本 `mkdir -p` 自动创建，
       预检必须给「数据落在根分区、非独立数据盘」的明确警告，绝不自动挂盘。
    ⑤ `check.sh` 只读（不写文件 / 不提权 / 不装包 / 不拉镜像）；采不到就是 `unknown`，
       不用 0 兜底（硬约束 3）。
    ⑥ 界面写动作（install / update / uninstall / image-load）照抄硬约束 21 的六道门，
       与备份部署共用同一把后台任务锁；附加参数由 `ValidateActionFlags` 在服务端再验一次：
       `--image-ref` 只 update minio、`--purge-data` 只 uninstall minio（默认关）、
       `--ack-downstream` 是 uninstall docker 必填、`--proxy` 只 install/update docker。
       `/api/components/image` **不接收任何本机路径**，临时 tar 由服务端生成、任务结束即删。
    ⑦ 改了 `deploy/component/**` 必须重编 Go（与 `deploy/backup/**`、`web/dist` 同理，
       `internal/restart/staleness.go` 已把它算作 Go 构建输入）。
    ⑧ **安装 Docker 的代理是可选入参，不是远端系统配置**：界面/CLI 只接受
       `http://host:port`（`component.ValidProxy`，禁认证 / 路径 / shell 元字符），
       只给 `install` / `update docker`，预检与正式动作带同一组 `--proxy`；脚本内
       `export` + `apt -o Acquire::...::Proxy` 让本次 apt/curl 生效，
       **绝不写 `/etc/apt/apt.conf.d/`**。
    ⑨ **更新 / 卸载（2026-11-07）**：更新只动一个组件；MinIO 失败回滚只回到原镜像标签
       + 原容器配置，**数据卷从头到尾不参与回滚**；卸载默认保留数据 / 镜像 / 上游引擎，
       `rm -rf /data/minio` 只能在 `COMPONENT_PURGE_DATA=yes` 分支且路径是硬编码常量，
       卸引擎必勾连带影响、脚本再验 `COMPONENT_ACK_DOWNSTREAM=yes`。
       🔴 影响清单 / 能否执行 / 阻塞原因一律由 Go 侧 `BuildActions` 算，
       前端只渲染 `actions[id][]`；卸载后备份定时任务仍在、下一次执行失败是**预期结果**，
       不许顺手删 crontab 或改 `backup.env`。
    ⑩ **从已登记服务器复制镜像（`image-copy`，2026-11-07）**：镜像也可以不从本机 tar 来，
       而是「源机 `docker save` → 本机 pipe 中转（**不落本机磁盘**）→ 目标机 0600 临时 tar
       → `docker load` → 删临时文件」。它不是 `docker pull`，不经任何镜像仓库；
       源机只认 `servers.json` 的 name（`--from-server`，**源 ≠ 目标**，未知 404），
       候选镜像只来自源机只读清单（`ops component images` / `GET /api/components/images`），
       传 `--image-ref` 也必须在里面；源机 docker 权限「先无 sudo、再试 sudo」两路都试，
       只跑 `info` / `images` / `save` 这类只读命令。传输上限与 `image-load` 同一个 2 GiB，
       超了就地中断并删目标机临时文件；不启动 / 不重建容器、不动 `/data/minio`。
       `image-copy` 按 `OfflineImage` 授权（`SupportsImageCopy`），**不进 `Verbs`**、
       不进 `BuildActions` 的按钮计划。不做 ssh 密码认证（源机必须能免密钥登录）。
    详见 `docs/components.md` §3.1 / §8 / §9、`docs/ui.md` §13。
26. 🔴 **换电脑零手工、配置不全不挡路**（2026-11-06 新增）：
    ① `启动运维.cmd` 的 `:ensure` 段负责「这台机器能不能跑」，🔴 **顺序是红线**：
       先用内部命令 `ops.exe __dist-check` 判**二进制里**有没有 `index.html` + `assets/`；
       返回 0 就零构建直接放行（哪怕磁盘 `web/dist` 被手删，也只补回目录 + `.gitkeep`
       占位，保证以后 `go build` 的 embed 目录还在）。只有 exe 不存在 / 自检非零
       （旧 exe 不认识该命令退 2 也算缺）才需要磁盘产物：缺 `web/dist/index.html` →
       用 `where node.exe` 取**绝对路径**的 `node.exe npm-cli.js run build` 构建前端
       （🔴 不 `call npm.cmd`：项目级 / pnpm shim 的 `%~dp0` 会指到
       `web\node_modules\npm` 而报 `Cannot find module ...\npm-cli.js`）；
       只有 `.bin\vite.cmd` 缺失或首次 build 失败才先 `npm install` 修复一次并重试；
       随后 `go build -o ops.exe .`。`--bg` 隐藏守护**不做任何构建**；
       显式子命令跳过前端检查但仍要保证 exe 存在；找不到 Node / go 要停在可见窗口给提示，
       覆盖运行中 exe 失败要提示先点「关闭界面」。
    ② `__dist-check` 与 `__restart` / `__takeover` 一样是内部命令：不进 `commandHandler`、
       不进 usage / 菜单，只回退出码、不做写操作；判定函数 `embeddedWebOK` 用 MapFS 可测。
    ③ `.cmd` 保持 CRLF + 全 ASCII 注释/echo；🔴 `if (...)` 块里不许出现未转义的 `)`，
       否则块提前闭合、`pause` 变成无条件执行（隐藏守护会挂成隐形僵尸，已踩过）。
    ④ `ops ui` 在配置 / 清单读不出来时**照常返回 SPA**（`serveIndex` 不再有 503 降级页）；
       `/api/servers` 回 200 + `setup_error` + 空数组 + 默认 `servers_file`，
       让前端给「去配置页 / 打开清单」的可操作引导；需要清单的写操作仍各自回 503。
    ⑤ 本机配置编辑用 `shared.FallbackConfig()`（与 `LoadConfig` 同一套路径规则，
       不要求 `ops.env` 存在）：`GET /api/config`、`POST /api/config/backup-env`、
       `POST /api/open-servers-file`、`ui.reload()` 都走它；
       🔴 **任何要连远端的动作仍必须严格 `LoadConfig`**（sync-env / compare / CLI），
       不许拿默认路径冒充一台目标机。
    ⑥ 配置页「新增服务器」是第四个写接口：`mode=add` 同样要 `confirm=="yes"`、
       同样过字段白名单 + `.tmp` 全量校验 + `.bak` + 原子替换（0600），空清单自动进该模式；
       保存后由 `onServersChanged` 让一直挂载着的落地页重新取数。
    详见 `docs/one-click-launch.md` §4.1 / `docs/ui.md` §12。

27. 🔴 **`backup.env` 的键只在 `internal/shared/env-schema.json` 定义一次**（2026-11-07 新增）：
    模板、脚本兜底字面量、Makefile、界面白名单、文档键表、交互原型字段表全是生成物或断言对象
    （见 `docs/config.md` §4）。改一个键 / 默认值：改 schema → 仓库根跑
    `go run . __gen-backup-env`（开发期内部命令，不进 usage / 菜单）→ `go build`；
    漏跑生成器 `go test ./...` 直接红。
    🔴 生成器只同步**已经写了字面量**的默认值，绝不改远端脚本执行逻辑：
    `${KEY:-}` 是空兜底（`set -u` 防空 + `install.sh` / `preflight` 判断「有没有显式配置」），
    填成默认值会让 `[ -z ]` 恒假 / `[ -n ]` 恒真；也别把脚本改成 `source defaults.env`
    ——生产备份机的行为本机无法真机验证。
28. 🔴 **`ops.env` 的键只在 `internal/shared/opsenv.go` 的 `opsEnvKeys` 定义一次**
    （2026-11-07 新增）：`ops init` 模板、`LoadConfig` 解析、运行时默认值共用一张表，
    `docs/config.md` 只是说明。**未知 `PASS_UP_OPS_*` 键必须报错**，不能静默忽略
    ——「以为配了却没生效」最难查；`retiredOpsEnvKeys` 给 P2/P3 幽灵键、已删除旧键、
    环境变量覆盖键一句人话原因。非本项目前缀的键仍忽略；界面 `configForEditing`
    用 `FallbackConfig()` 兜底，报错显示在配置页、不白屏。
    `go test` 断言模板、默认值与 `docs/*.md` 全部分册里出现的所有键名都已归类；
    config.md 只讲现行配置（P2a 的 8 个键已接回 §3；P3–P4 方案键表与运行态文件清单仍在对应分册）。
29. 🔴 **启动器不许自己拼配置路径**（2026-11-07 新增）：`启动运维.cmd` 用
    `ops __config-path`（内部命令，stdout 恰好一行 ops.env 路径）拿 `shared.ConfigPath()`
    的结果，再推出配置目录；`PASS_UP_OPS_ENV` / `PASS_UP_OPS_CONFIG_DIR` /
    `XDG_CONFIG_HOME` 覆盖才不会让「首次运行」判定与 `ops-ui.log` 提示漂移。
    `.cmd` 必须保持 CRLF（`.gitattributes` 的 `eol=crlf`），`go test` 会断言。
    🔴 `web/vite.config.ts` 的 dev 代理默认端口 7788 与 `internal/ui/ui.go` 的
    `defaultUIPort` 用 `go test ./internal/ui` 断言对齐；实际端口写进 `ui.json`，
    dev 用 `OPS_UI_PORT` 显式跟过去，**不读运行态文件**。
30. 🔴 **界面「安装缺少依赖」只装命令，绝不顺带部署**（2026-11-07 新增）：
    `GET /api/backup/deps` 只读（`ops backup deps --json`），写动作只走
    `POST /api/backup/run` 的 `mode=deps`（`confirm=="yes"` + 服务端 `--dry-run` +
    与 deploy 共用任务锁 409）；`name` 只认清单、组件只认 `all|pg|minio`、
    `pg_major` 只接受 1..99 纯数字（CLI 侧 `validatePgMajor` 再挡一次）。
    🔴 界面**不发** `--install-deps` / `--force` / `--run-now`；依赖清单、安装计划、
    官方文档链接由 Go 侧下发，前端只渲染；`collected=false` 是「没采到」，禁用安装按钮。
    安装源按官方文档：默认发行版 `postgresql-client`，指定 `--pg-major` 才配置 PGDG
    官方 apt 仓库；mc **先从目标机已导入的 MinIO 镜像离线提取**（私有仓库前缀的镜像名
    也要认），取不到才按官方文档地址下载，绝不 `docker pull`。
    🔴 依赖探测不能只问 `command -v`：dash 对 0644 的半截下载文件也返回路径，
    必须再验 `[ -x ]`；`pg_restore` / `mc` 还须 `--version` 真能跑通 ——
    `postgresql-client-common` 留下的 `/usr/bin/pg_restore`（pg_wrapper 壳链接）
    可执行但 `--version` 报「未安装任何客户端包」，只看文件就会误判「已安装」。
    🔴 每一步 `apt` / `curl` / `wget` / `docker` 都有硬超时且逐条打印进度：
    2026-11-07 k4 曾因 mc 下载无超时挂 7 分钟、界面假死。
    🔴 **卸载只删工具装的东西**：`targets` 白名单只有 `mc`（`/usr/local/bin/mc`）
    与 `pg_client`（`apt remove postgresql-client[-<n>]`），默认全不勾且至少一个；
    不卸 cron / nc / ssh / tar / logrotate，不 autoremove / purge，不碰 `~/.mc`、
    容器 / 镜像、PGDG 源、服务端、crontab / backup.env；卸载后自动复查。
    详见 `docs/backup-deploy.md` §10.2 / §10.3 与 `docs/ui.md` §9.7。
31. 🔴 **界面备份监控与 CLI 共用一份只读快照**（2026-11-07 夜新增）：
    `GET /api/monitor/status` 只认清单里的 `name`（要连远端必须严格 `LoadConfig`），
    账号强制 `monitor`，判据只在 `monitor.assess()`、前端不算指标；
    30s 缓存 / 5s 最小强制刷新 / 采集串行，连不上与配置错都回 **200 + 完整快照**
    （数值未采到是 `null` 不是 `0`、`problems` 恒为数组），配置错不缓存、
    私钥路径不进响应。不许让界面另起一套采集或另算一套阈值。
    账号就是清单 `user/key`（2026-11-08 起，见硬约束 9）：没有第二套账号表单，
    采集 target 不带 sudo 密码；旧 `monitor` 字段被忽略。
    详见 `docs/ui.md` §12.9 / §14 与 `docs/backup-monitor.md` §12。
32. 🔴 **手动备份是独立写动作，不是部署的开关、也不是监控的按钮**（2026-11-08 新增）：
    `ops backup once` / `mode=once` 复用已部署脚本与同一把任务锁，六道门照硬约束 21；
    不提权（弹窗没有 sudo 密码框）、不收任意脚本路径、不新增配置键；
    `--server` 是**备份机**，生产端由该机 backup.env 决定、只做白名单非凭证只读回显（凭证不进响应）；
    工具**不读 crontab**、
    不改监控采集协议，脚本内 `flock -n` 防与定时窗口撞车（远端脚本必须重新部署才生效）；
    报告只报脚本结果且固定带「手动触发不代表定时任务正常」，超时不写「已取消」。
    详见 `docs/backup-once.md` / `docs/ui.md` §15。
33. 🔴 **恢复是覆盖现网数据的写动作，门禁只许比安装更严**（2026-11-08 新增）：
    `ops restore list/plan/run` 与界面 `mode=restore` 复用同一把 `backupTask` 锁；
    `confirm=="yes"` + 服务端每次写动作先跑 `--dry-run`（界面 `restore-dry` 不是执行凭证）、
    `name` 只认**备份机**（生产端由该机 `backup.env` 决定、不许另选）、
    候选只认本次采集到的 ID（路径由 Go 侧拼，任意路径 400）、
    PG 库名两次逐字比对且等于计划回显 / MinIO 输 `YES`、
    三项前置（已停写 / 已停定时备份 / 已留现场）全必勾、覆盖生产额外勾，
    CLI 的 `restore.ValidateGate` 是唯一完整判据；**不提权、不收 sudo 密码、
    不读 / 改 crontab、不自动重试 / 清场、不改 `last_success.txt`**。
    只读采集脚本不许写远端 / 连 MinIO / 回显凭证；离线回完整快照（`—` / `null`，不许 0 兜底）；
    阻塞分全局 `blockers` 与候选行 `row_blockers` 两级、换选中行重新取计划，前端不算 `available`。
    🔴 报告只报脚本结果，不写「恢复成功，服务正常」；Flyway / 应用健康是人工步骤（硬约束 7）。
    🔴 `globals_*.sql` 走 `psql`：`psql` 默认遇 SQL 错误仍返回 0，旧脚本照打
    「✅ 全局对象恢复完成」（§7.6 真机实证）。✅ 本仓 21:30 已修（§7.7）：捕获输出逐行判
    `ERROR:`、「对象已存在」白名单放行并告警、其余错误 / 链路失败中止；`.sql` 分支开
    `ON_ERROR_STOP=1`。🔴 globals **不许**开 `ON_ERROR_STOP`（会在第一条 `already exists`
    处截断后续 `SET` / `ALTER ROLE`）；`backupdist_test.go` 锁住这些片段。
    ✅ 21:4x 已重新部署并在临时库真机验证（§7.8），两端同源；值守仍要逐行看告警行，
    工具不判断应用是否可用。「致命 ERROR 中止」只有桩函数冒烟、没在真机造过故障。
    报告里「装回两条 cron」是固定提醒，没停过 cron 就别照它去改（§7.6）。
    `minio_restore.sh` 固定恢复 `SRC_BUCKETS` 全部桶、对象数不采集、预演不跑 `mc mirror --dry-run`；
    `minio_restore.sh` 一行未改，`pg_restore.sh` 2026-11-10 先后修 stdin（§7.5）与
    `psql` 吞错（§7.7），恢复链路 / 二次确认 / 禁止入 Crontab / 必须有人值守都没动。
    🔴 真机演练（§7.3）确认：只读归档检查用的是**备份机** `pg_restore`，正式恢复用的是
    **主服务器容器内**的 `pg_restore`，两侧版本可能不同（16.15 读不了归档 1.16、18.6 能读），
    会出现「dump 实际可恢复却被 `row_blocker` 挡下」。文案必须如实说明判的是哪一侧、
    给人工复核指引，**不提供绕过开关**；也不许因此删掉归档检查或去连生产端凭证。
    解挡只能把**校验侧客户端对齐到执行侧版本**（2026-11-10 手工装 18，§7.5），不改判据。
    🔴 预演脚本不许用 `pg_restore -l ... | head`（POSIX sh 无 pipefail，失败会被吞成 0）。
    🔴 `pg_restore.sh` 内部 `remote_exec` 的 ssh 会吞掉脚本 stdin（§7.4）：只能给
    `remote_exec` 加 `-n`，`remote_docker_stdin` **必须**保留 stdin 转发 globals_*.sql，
    不许全局加 `-n`、不许绕过二次确认；`backupdist_test.go` 从嵌入产物锁住这三条。
    本仓已修、21:06 已重新部署并在正式恢复里真机跑通（§7.6）；
    **以后改脚本仍必须重新 `ops backup deploy` 才生效**。
    §7.7 的 `psql` 吞错修复 21:4x 已重新部署并真机验证（§7.8）。
    详见 `docs/backup-restore.md` §5 / §7 与 `docs/ui.md` §16。

## 命令与验证

```
# Go 侧
go vet ./...
go test ./...
go build ./...

# 改了 backup.env 的键 / 默认值（见 docs/config.md §4、硬约束 27）
go run . __gen-backup-env   # 仓库根；生成后必须 go build（脚本与模板都 embed 进 exe）

# 前端（改了 web/ 一律两个都跑；test/ 不在 tsconfig 的 include 里）
cd web && npm install
cd web && npm test && npm run typecheck && npm run build

ops init
ops servers list
ops servers check all
ops servers apply-sudo <name> --password-stdin
ops status --server <name> [--json]   # 只读；退出码 1 = 有 danger（含连不上）
ops status --help
ops backup deploy --server <name> --dry-run
ops backup deploy --server <name> --install-deps
ops backup deploy --server <name> --password-stdin   # 初始 sudo 密码从 stdin 读（界面走这条）
ops backup env
ops backup verify --server <name>
ops backup sync-env pg --server <name>   # 只把本机配置推到远端 backup.env
ops backup once pg --server <name> --dry-run   # 只读预演：preflight + 计划
ops backup once all --server <name>            # 立即跑一次（不重装、不进 crontab）
ops component list --server <name> --json
ops component install docker|minio --server <name> --dry-run
ops component update docker --server <name> --dry-run
ops component update minio --server <name> --image-ref <已导入镜像:标签> --dry-run
ops component uninstall docker --server <name> --ack-downstream --dry-run
ops component uninstall minio --server <name> --dry-run
ops component image-load minio --server <name> --image-tar <本机 .tar> --dry-run
ops component images --server <name> [--json]
ops component image-copy minio --server <name> --from-server <源机 name> --dry-run
ops restore list --server <备份机> --component pg|minio [--json]   # 只读候选（连不上也回完整快照）
ops restore plan --server <备份机> --component pg --candidate <id> --db restore_test --dry-run
ops restore run --server <备份机> --component pg --candidate <id> --db restore_test \
    --confirm yes --db-confirm restore_test --checks 1,1,1 --cron-confirmed   # 会覆盖生产端
ops ui [--port 7788] [--no-open]
ops shortcut [--name <名字>] [--remove]
ops menu --help
```

上面只列**已实现**命令；`ops deploy` / `ops rollback`（P3–P4）尚未实现，不要照抄执行。
`ops restore run` 的 `--db` / `--candidate` / 门禁参数以 `ops restore help` 与
`docs/backup-restore.md` §5 / §7 为准；正式执行会覆盖生产端，必须有人值守。
`ops status` 与界面的「备份监控」页都用清单 `user/key`
登录（2026-11-08 起不再分设只读账号），后者走 `GET /api/monitor/status`、
不对外开放任何写动词。子命令选项以各能力的 `--help` 为准。
本机二进制：`go build -o ops.exe .`（`启动运维.cmd` 按仓根 `ops.exe` 定位，不要挪）。
双击 `启动运维.cmd` 无参 → 后台网页 + 自动开浏览器；`--fg` 前台 `ops ui`（保留窗口）、
`--menu` 交互菜单、`--bg` 后台守护专用；带子命令（`help` / `servers list` …）原样转发。
后台 stdout 在配置目录 `ops-ui.log`；停界面点页面「关闭界面」。
🔴 **改了 `web/` 就必须重新 `npm run build` 再 `go build`**：产物是编进二进制的，
只 `go build` 拿到的是上一次的页面（未构建过则是「怎么构建」的说明页）。
换电脑 / 全新 clone **不用手敲这两条**：`启动运维.cmd` 检测到产物缺失会自动补齐
（硬约束 26）；但源码改了之后的增量重建不在启动器职责内，仍走下面那句或界面「重启」勾「先重建」。
改了 `web/` 或 `deploy/backup/**` 也可以点界面顶部「重启」并勾「先重建」一键完成：
服务端按同样顺序构建，源码过期时复选框自动勾上（判据见 `internal/restart/staleness.go`）。

## 目录与边界

- **已按能力竖切 Go 包**（2026-11-05）。母本 `cqlql-notes/docs/工程/目录结构规范.md` §6
  的四项阈值（领域 ≥10 / 接口 ≥30 / ≥2 人 / 表数 ≥10 或第二存储）仍未达到，
  本次是按项目决定提前拆；代价是 41 个跨包符号导出、6 套测试归位与共用层下沉。
  `main.go` 只留 `main` / `commandHandler` / `run` / 全局 `usage`。
- 🔴 **依赖方向只许单向**：
  `main → {servers, backup, restore, component, monitor, ui, launcher} → shared`，
  另有 `ui → {restart, restore, monitor, servers}`、`launcher → ui`。
  `ui → restore` 与 `ui → monitor` 同构（只读采集器注入）；`ui` 仍**不 import `backup`**，
  恢复执行器与手动备份共用 `main.go` 注入的 `BackupRunner`。
  `shared` **不得 import 任何能力包**，也不得引用能力专属类型；出现环时先把共享常量 / 模型
  下沉到 `internal/shared/`，不要在能力包之间打补丁。
- `internal/restore/`（2026-11-08）：`types.go` 数据契约 / `collect.go` 只读采集脚本与解析 /
  `plan.go` 两级阻塞计划 / `gate.go` 唯一完整门禁 / `cli.go` 三段式 CLI 与报告。
  只依赖 `shared`；`ui` 通过 `restoreProbe` 注入假采集器做单测，不连真 SSH。
  正式执行只 `bash` 远端已部署的 `*_restore.sh`，脚本内二次确认经 `shared.SSHTarget.StreamWith`
  的 stdin 喂入；不重写恢复逻辑、不改 `deploy/backup/**`。判据见 `docs/backup-restore.md`。
- `internal/restart/`（2026-11-06）：交接机制（`WaitPortFree` / `ReplaceBinary` / `Spawn`）、
  重建（`Rebuild`）、源码过期判定（`Check`）。依赖方向 `main → ui → restart → shared`：
  `restart` **不反向 import `ui`**，接手子命令的实现放根包 `restartchild.go`（它要调 `ui.CmdUI`）；
  非 Windows 的 `Spawn` 明确报错，不假装能用。
- `internal/shared/`：`config.go`（配置与 `ConfigDirEnv`）、`remote.go`（`SSHTarget` 与 ssh 封装）、
  `servers.go`（服务器清单、状态与 `CheckRow` 展示模型）、
  `singleton_{windows,other}.go`（跨进程命名互斥体 `AcquireSingleton`，菜单与界面共用一份，
  各用不同名字）。`configDirEnv` 曾定义在 `shortcut.go`，导致 shared 反向依赖 launcher，
  已下沉，别再挪回去。
- 🔴 **跨包不能给共享类型挂方法**：`SSHTarget` 的 backup 专属操作只能是
  `internal/backup/deploy.go` 里的自由函数（`checkAccess(t, ctx, ...)` 等），
  首参为 `*shared.SSHTarget`；`SSHTarget` 的字段（`Host` / `User` / `Key` / `SudoPassword` 等）
  因跨包访问而导出，不要改回小写。
- 🔴 **动词注册表只有一份**：`commandHandler` 在 `main.go`。菜单不反向依赖入口，
  `launcher.CmdMenu(args, exec, probe)` 由 `main.go` 注入 `run` 与
  `func(n string) bool { _, ok := commandHandler(n); return ok }`；不要再抄一份动词表。
- 🔴 **前端在 `web/`，不在 `internal/ui/`**：`//go:embed` 的路径不能出现 `..`，
  所以嵌 `web/dist` 的文件只能是仓库根的 `webdist.go`（`package main`），
  `ui.CmdUI(args, static fs.FS, createShortcut, runner)` **接收**它 —— `internal/ui/` 不再嵌页面。
  别为了「放得整齐」把 `web/` 挪进 `internal/`：那样 `main.go` 就得反向依赖 `ui` 的私有目录。
- 🔴 **备份脚本在 `deploy/backup/`，同样靠根包注入**：嵌入点是仓库根 `backupdist.go`
  （`//go:embed all:deploy/backup`），`backup.CmdBackup(args, scripts fs.FS)` 接收它。
  目录结构必须与远端一致（`postgres/` `minio/` `lib/` `preflight_check.sh`）：
  `component.remoteDir()` / `installPath()` / `logrotateSrc()` 都按这个相对布局拼远端路径。
  脚本本体说明见 `docs/backup-scripts.md`，安装流程见 `docs/backup-deploy.md`。
- `internal/ui/`：`ui.go`（服务端、token、`/api/shutdown`、配置缺失仍回 SPA）、
  `backup.go`（备份任务状态、`/api/backup/*`、预检门、日志脱敏）、
  `background.go`（`--background` 调度、`ui.json`、日志轮转、开浏览器）、
  `background_{windows,other}.go`（隐藏 cmd 守护，靠 build tag 切平台）、`ops.ico`；
  图标字节经 `ui.IconBytes` 导出给 `launcher` 写快捷方式，两处同源。
  `/favicon.ico` 直接读内存，不走 `dist`。
  🔴 **后台调度放 `ui` 包、不放 `launcher`**：`launcher → ui` 已有依赖，反过来会成环。
  🔴 **跨能力一律靠注入**：`ui.CmdUI(args, static, createShortcut, runner)` 的后两参由
  `main.go` 传 `launcher.CreateShortcutOnDesktop` 与 `runBackupSubprocess`；
  别让 ui 直接 import launcher / backup。执行器实现在根包 `backuprun.go`
  （`exec.CommandContext(os.Executable(), "backup", ...)`，密码走 stdin、输出接任务日志）。
- `web/` 按母本 `cqlql-notes/docs/工程/目录结构规范.md` 与 `前端/前端目录结构规划.md` §二 排：
  `features/<能力>/`（`api.ts` / `service.ts` / `types.ts` / `utils/` / `components/` / `pages/` /
  `index.ts`）+ `shared/{api,ui,utils}`（`service.ts` 按编排复杂度决定，不是标配）。
  现在五个 feature、六页（`backup/` 拆成「部署」与「手动备份」两页）：
  `servers/` / `backup/` / `components/` / `config/` / `monitor/`，
  另有全局工具栏 `system/`；用左侧 `Sider + Menu` 导航切换（窄窗口退化成顶部横向 Menu）。
  🔴 **没有 `router/`、顶层 `pages/`、`src/api/`、`src/lib/`**
  —— 五页仍不引路由：本机回环 + 地址栏带一次性 token，深链接没有意义，
  而路由会带来「刷新丢 token」（判据见 `docs/ui.md` §7）。
  约定（相对 import 必须写扩展名、`test/` 不在 tsconfig include、端口 5175、产物不进 Git）
  见 `docs/ui.md`；**不要在前端算指标**，那是 Go 侧的唯一真源。
- `internal/launcher/` 的 `menu_windows.go` / `menu_other.go` 靠 build tag 切平台，
  现在只是调 `shared.AcquireSingleton` 的薄包装（互斥体实现只在 shared 一份）。
- 命令入口统一 `Cmd<动词>`（如 `backup.CmdBackup`、`servers.CmdServers`）；
  能力的 CLI 分发与 usage 归各自包，测试文件也随能力归位。
- `docs/deploy.md` §5 的文件树仍是 P3–P4 的**计划**，`deploy.go` / `rollback.go` 不存在；
  P2a 的 `internal/monitor/{config,status,cli}.go` 已落地（见 `docs/backup-monitor.md` §7）。
  新增能力继续在 `internal/<能力>/` 下建包。

## 文档规则

- 🔴 **唯一索引就是下面的「文档速查」表**；不新建 `docs/README.md` 或第二个索引。
- 每份 `docs/*.md` 第一行必须是 `> 状态：...`；状态过期比没有文档更危险。
- 配置键分两套，都不许复述默认值：本机 `ops.env` 的 14 个 `PASS_UP_OPS_*` 键只在
  `internal/shared/opsenv.go` 的 `opsEnvKeys` 定义（`ops init` 模板与 `LoadConfig`
  解析都由它驱动）；远端 `backup.env` 的键只在 `internal/shared/env-schema.json`
  定义（生成物见 `docs/config.md` §4）。`docs/config.md` 是说明，其它文档只引用键名。
- 🔴 `docs/config.md` **只讲现行配置**：P2a 的 8 个监控键已在 §3（代码已读），
  P3–P4 未实现方案的键表仍在 `deploy.md §8`，运行态文件清单放
  `one-click-launch.md §4.4`；config.md 的 §5 只留指针，**不许把方案键抄回来**。
  `go test` 断言 config.md 不含方案键与运行态文件表，且全部分册的键名都已归类。
- 「为什么这么设计 / 哪些方案被否」并进对应分册的决策节，不单独开文档。
- 新增能力 = 本表加一行 + 新建分册；**不要往已有分册里堆**。
- 🔴 本仓单文件原型一律按 `docs/prototype-conventions.md` 办：埋 `@section` 锚点 +
  `<主体>-map.md` 分区索引；改前先 `grep -n "@section"` 定点读，**不要通读全文**；
  新增区块要同步补锚点 + 更新该表。带锚点的原型现有三份：
  `components-prototype.html` / `backup-restore-prototype.html` / `backup-once-prototype.html`，各自分区语义见同目录
  `<主体>-map.md`（只索引该文件内部，本表仍是唯一能力索引）；
  `config-compare.html` 暂无锚点。原型清单与验收见 `docs/prototype-conventions.md` §1 / §5。
- 本仓未建 `docs/doc-conventions.md` 全量副本（避免重复通用条款）；仓库正式初始化时按母本
  `§5` 实例化。

## 文档速查

| 能力 / 模块 | 文档 | 最硬的那条红线 |
| :--- | :--- | :--- |
| 服务器管理 + 一键免密 sudo（P0 先做） | `docs/servers.md` | 主机只来自清单；只写一个 sudoers drop-in；验证用 `runuser` |
| 界面（`ops ui` · Vite + React + antd，左侧 Sider + Menu） | `docs/ui.md` | 静态产物不过 token、API 才是边界；产物不进 Git 但 `.gitkeep` 必进；未构建要回说明页；单实例 + 配置不全也起页面；界面安装要过六道门（§9） |
| 备份脚本（`deploy/backup/**`，已迁入本仓） | `docs/backup-scripts.md` | 脚本编在二进制里，改了必须 `go build`；目录里不许有真实凭证；恢复脚本禁止入 Crontab |
| 备份恢复（人工 SOP + **CLI / 界面已实现；真机只读 §7.3 + 写演练 §7.4 均已跑**） | `docs/backup-restore.md`（界面见 `docs/ui.md` §16） | 恢复必须有人值守、禁止入 Crontab / 自动触发；复用 `*_restore.sh`，不重写恢复逻辑；是「补齐 + 覆盖」不是精确回滚，不自动删多余对象；默认恢复到临时库；只认备份机、不读 crontab、候选查表、两级阻塞、预演不是执行凭证；报告只报脚本结果（§5 / §7，硬约束 33） |
| 备份恢复界面原型（**交互回归基线** · 代码已实现） | `docs/backup-restore-prototype.html`（分区见 `docs/backup-restore-prototype-map.md`） | 六场景 = 验收用例集；R1–R6 逐条对应实现；静态速览不连远端、不发请求、不执行动作，冲突时改原型；`ops restore ...` 已注册，真实参数以 `ops restore help` 为准 |
| 备份能力部署（P1 ✅，监控的前置；CLI + 界面） | `docs/backup-deploy.md` | 复用 `install.sh`；不覆盖 `backup.env`；不静默迁移目录；logrotate 由工具落盘；界面安装必须 yes + 服务端预检门 |
| 备份监控（P2a CLI ✅ / P2+ 界面 ✅；真机验收待做） | `docs/backup-monitor.md`（界面见 `docs/ui.md` §14） | 只读采集；时间差在远端算；`-` 不是 0；**单账号**（清单 `user/key`，采集不提权）；网页与 CLI 共用 `CollectForServer` / `Status`，前端不算指标；8 个键已进 `docs/config.md` §3 |
| 手动备份（立即跑一次 · **已实现，2026-11-10 按 §8 七场景真机验收**） | `docs/backup-once.md` §8.1（界面见 `docs/ui.md` §15） | 独立子命令 + 独立页，复用已部署脚本与同一把任务锁；不提权 / 无 sudo 密码框、不查 crontab、不改监控采集判据；报告只报脚本结果且**不能当成定时任务正常**；§7.1 补锁前置已闭环；验收发现的 preflight 弱凭证回显已修复并部署验证（§8.2） |
| 手动备份界面原型（**交互回归基线** · 代码已实现） | `docs/backup-once-prototype.html`（分区见 `docs/backup-once-prototype-map.md`） | 七场景 = 验收用例集；定时状态恒「不采集」、预演不是执行凭证、弹窗无 sudo 密码框、报告固定带手动触发提示；静态速览不连远端、不执行动作，冲突时改原型 |
| 单机一键 Docker 部署（P3–P4 · 方案，未实现） | `docs/deploy.md` | `.env` 去 CRLF；镜像前缀必须等于 compose；Flyway 单向；方案键表在本文 §8，不进 config.md |
| 一键启动与桌面快捷方式（S2/S3/S5 ✅，S4 人工验收待做） | `docs/one-click-launch.md` | 双击直达网页面板（隐藏守护 + 单实例）；`.lnk` 只指启动器；图标用独立 `.ico`；名字校验挡路径穿越；双击绝不触发写操作，页面写操作要显式确认 |
| 配置（唯一维护处） | `docs/config.md` | `ops.env` 的键只在 `internal/shared/opsenv.go`（未知 `PASS_UP_OPS_*` 直接报错）；`backup.env` 的键只在 `internal/shared/env-schema.json`，模板 / 脚本兜底 / 白名单 / 键表都是生成物，漏跑生成器 `go test` 会红 |
| 单文件原型（分区锚点约定 · 本仓实例） | `docs/prototype-conventions.md` | 改前先 grep 锚点定点读、不通读全文；锚点只能是注释、行号不写进 map；新增区块同步补锚点 + 更新 map 表 |
| 文档治理 | `cqlql-notes/docs/工程/文档约定.md` | 新加文档前先过 4 问；索引只有一份 |
| 目录与依赖 | `cqlql-notes/docs/工程/目录结构规范.md` + 本文「目录与边界」 | 依赖单向；`shared` 不得反向 import 能力包；跨包符号必须导出 |
