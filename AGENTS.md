# AGENTS.md

> 状态：**P0 服务器管理（含一键免密 sudo）已实现并真机验证**；
> P1 备份能力部署已实现并真机验证；一键启动与桌面快捷方式（S2/S3/S5 + 图标同源）已实现，
> **双击 `启动运维.cmd` 直接开网页面板**（隐藏守护 / 单实例 / 自动开浏览器 / 关闭界面），
> S4 真机人工验收待做；P2 监控、P3–P4 应用部署仍为方案、代码未实现（2026-11-05）。
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
> `docs/ui.md` §13 / 硬约束 25。界面更新 / 卸载仍未接入。
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
> 只放「每次动代码都要遵守」的红线：一句结论 + 一个指针。判据、流程、踩坑都在 `docs/`。
> 通用文档规则以 `cqlql-notes/docs/工程/文档约定.md` 为准。

## 项目概述

- 本地单二进制运维工具，**已实现**：`ops servers list/check/apply-sudo` 管服务器与免密 sudo；
  `ops backup deploy/verify/env/sync-env` 安装、升级、预检备份能力、生成配置模板、
  单独同步配置到远端
  （备份脚本本体就在本仓 `deploy/backup/`，编进二进制）；
  `ops component list/install/image-load` 管备份端环境组件（Docker 引擎与 MinIO 服务，
  只读体检 / 安装 / 离线镜像导入，脚本在 `deploy/component/` 编进二进制，见 `docs/components.md`）；
  `ops ui` 默认只读查看服务器清单与检查结果；「备份能力部署」页另有预检 / 安装 / 自检
  三个显式入口（安装要输 yes，服务端先跑 `--dry-run`，见 `docs/ui.md` §9）；
  顶部工具栏另有「重启」（本机动作，可选先重建 + 换 exe，见 `docs/ui.md` §11）
  （前端是 React 工程，源码 `web/`，构建后嵌入二进制）；
  双击 `启动运维.cmd` 直接开这个网页面板（后台隐藏守护 + 自动开浏览器 + 单实例）；
  `ops menu` 是显式的交互菜单入口，`ops shortcut` 建桌面 `.lnk`。见 `docs/one-click-launch.md`。
- **仍是方案、代码未实现**：`ops status`（P2 备份监控）、`ops deploy` / `ops rollback`
  （P3–P4 单机 Docker 部署）；设计见 `docs/backup-monitor.md` / `docs/deploy.md`。
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
9. 🔴 **安装账号与只读账号分离**：`status`（P2 规划）与界面**默认视图**只看与检查；
   写 crontab / logrotate / 目录 / sudoers 只走显式动作（`ops backup deploy`、`ops servers apply-sudo`、
   或界面「备份能力部署」里输过 yes 的安装），**不复用只读账号**。
   🔴 界面**不会自动**触发安装：双击落地页仍是只读的，安装必须是人点按钮 + 二次确认
   + 服务端预检门（判据见硬约束 21）。
   sudo 密码只经 **stdin**（CLI `--password-stdin` / 界面单次请求内存 → 子进程 stdin），
   清单可选的 `sudo.password` 用完建议删除；**禁止 `--password` 参数**。
   详见 `docs/backup-deploy.md` §2、`docs/servers.md`。
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
    ① 组件 id 只认 `internal/component/registry.go`；写操作 `Runnable`、导入 tar
       `SupportsImage` 各挡一道，planned 组件一律拒绝；新增组件 = 一条声明 +
       一份只读 `check.sh`（可选 `install.sh`），导航项与页面数不变。
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
    ⑥ 界面写动作（install / image-load）照抄硬约束 21 的六道门，与备份部署共用
       同一把后台任务锁；`/api/components/image` **不接收任何本机路径**，
       临时 tar 由服务端生成、任务结束即删。
    ⑦ 改了 `deploy/component/**` 必须重编 Go（与 `deploy/backup/**`、`web/dist` 同理，
       `internal/restart/staleness.go` 已把它算作 Go 构建输入）。
    ⑧ **安装 Docker 的代理是可选入参，不是远端系统配置**：界面/CLI 只接受
       `http://host:port`（`component.ValidProxy`，禁认证 / 路径 / shell 元字符），
       只给 `install docker`，预检与正式安装带同一组 `--proxy`；脚本内 `export` +
       `apt -o Acquire::...::Proxy` 让本次 apt/curl 生效，**绝不写 `/etc/apt/apt.conf.d/`**。
    详见 `docs/components.md` §3.1 / `docs/ui.md` §13。
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
ops backup deploy --server <name> --password-stdin   # 初始 sudo 密码从 stdin 读（界面走这条）
ops backup env
ops backup verify --server <name>
ops backup sync-env pg --server <name>   # 只把本机配置推到远端 backup.env
ops component list --server <name> --json
ops component install docker|minio --server <name> --dry-run
ops component image-load minio --server <name> --image-tar <本机 .tar> --dry-run
ops ui [--port 7788] [--no-open]
ops shortcut [--name <名字>] [--remove]
ops menu --help
```

上面只列 `main.go` 注册表里**已实现**的命令；`ops status` / `ops deploy` / `ops rollback`
尚未实现，不要照抄执行。子命令选项以各能力的 `--help` 为准。
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
  `main → {servers, backup, ui, launcher} → shared`，`main → ui → restart → shared`，
  另有 `ui → servers`、`launcher → ui`。
  `shared` **不得 import 任何能力包**，也不得引用能力专属类型；出现环时先把共享常量 / 模型
  下沉到 `internal/shared/`，不要在能力包之间打补丁。
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
  `index.ts`）+ `shared/{api,ui,utils}`。现在两个 feature：`servers/` 与 `backup/`，
  用左侧 `Sider + Menu` 导航切换（窄窗口退化成顶部横向 Menu）。🔴 **没有 `router/`、顶层 `pages/`、`src/api/`、`src/lib/`**
  —— 两页仍不引路由：本机回环 + 地址栏带一次性 token，深链接没有意义，
  而路由会带来「刷新丢 token」（判据见 `docs/ui.md` §7）。
  约定（相对 import 必须写扩展名、`test/` 不在 tsconfig include、端口 5175、产物不进 Git）
  见 `docs/ui.md`；**不要在前端算指标**，那是 Go 侧的唯一真源。
- `internal/launcher/` 的 `menu_windows.go` / `menu_other.go` 靠 build tag 切平台，
  现在只是调 `shared.AcquireSingleton` 的薄包装（互斥体实现只在 shared 一份）。
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
| 界面（`ops ui` · Vite + React + antd，左侧两项导航） | `docs/ui.md` | 静态产物不过 token、API 才是边界；产物不进 Git 但 `.gitkeep` 必进；未构建要回说明页；单实例 + 配置不全也起页面；界面安装要过六道门（§9） |
| 备份脚本（`deploy/backup/**`，已迁入本仓） | `docs/backup-scripts.md` | 脚本编在二进制里，改了必须 `go build`；目录里不许有真实凭证；恢复脚本禁止入 Crontab |
| 备份能力部署（P1 ✅，监控的前置；CLI + 界面） | `docs/backup-deploy.md` | 复用 `install.sh`；不覆盖 `backup.env`；不静默迁移目录；logrotate 由工具落盘；界面安装必须 yes + 服务端预检门 |
| 备份监控（P2 · 方案，未实现） | `docs/backup-monitor.md` | 只读采集；时间差在远端算；`-` 不是 0 |
| 单机一键 Docker 部署（P3–P4 · 方案，未实现） | `docs/deploy.md` | `.env` 去 CRLF；镜像前缀必须等于 compose；Flyway 单向 |
| 一键启动与桌面快捷方式（S2/S3/S5 ✅，S4 人工验收待做） | `docs/one-click-launch.md` | 双击直达网页面板（隐藏守护 + 单实例）；`.lnk` 只指启动器；图标用独立 `.ico`；名字校验挡路径穿越；双击绝不触发写操作，页面写操作要显式确认 |
| 配置（唯一维护处） | `docs/config.md` | 所有 `PASS_UP_OPS_*` 只在这里定义一次 |
| 文档治理 | `cqlql-notes/docs/工程/文档约定.md` | 新加文档前先过 4 问；索引只有一份 |
| 目录与依赖 | `cqlql-notes/docs/工程/目录结构规范.md` + 本文「目录与边界」 | 依赖单向；`shared` 不得反向 import 能力包；跨包符号必须导出 |
