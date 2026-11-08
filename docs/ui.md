> 状态：**现行**（2026-11-05 起；2026-11-06 导航由顶部 Tabs 改为左侧 Sider + Menu，
> 同日新增全局顶部工具栏与「重启」能力，见 §11；当晚把「创建桌面快捷方式」
> 「关闭界面」也从服务器管理页页头收进同一条工具栏，见 §7）。界面已从
> 「单文件 `index.html` + 原生 JS」迁到 Vite + TypeScript + React + antd，产物构建后嵌入二进制；鉴权模型没变。
> 同日起双击 `启动运维.cmd` 直接开这个页面（隐藏后台守护 + 单实例），形态见
> [one-click-launch.md](one-click-launch.md) §4.4，本文只讲界面与接口。
> **同日新增「备份能力部署」页（第二个 feature）**：预检 / 安装 / 自检。
> 🔴 红线由「界面只读」改为「**双击落地页只读 + 写操作显式二次确认 + 服务端预检门**」，
> 见本文 §9；[AGENTS.md](../AGENTS.md) 硬约束 9/15/21 与
> [backup-deploy.md](backup-deploy.md) §2/§10 已同步。
> **2026-11-06 追加「换电脑零手工」**：产物缺失由 `启动运维.cmd` 自动补齐（§3、
> [one-click-launch.md](one-click-launch.md) §4.1）；配置 / 清单读不出来时**照常返回 SPA**，
> 落地页给可操作引导，配置页可直接新增第一台服务器（§12.6）。
> **2026-11-07 追加**：配置页显示 `env-schema.json` 的默认值、另有显式「填入推荐
> 默认值」按钮，换电脑后不必逐项填（§12.7）。
> **2026-11-07 夜追加**：配置页可显式「清空」已配置字段（`clear` 列表），
> `PG_SSH_KEY` 保存时只认私钥文件绝对路径、日志不再回显路径（§12.8）。
> **2026-11-07 深夜追加第 5 个导航项「备份监控」**（P2+，纯只读）：四张卡 +
> 问题清单 + 60s 自动刷新，与 `ops status` 共用一份快照（§14 / [backup-monitor.md](backup-monitor.md) §12）。
> **2026-11-08 改口径**：备份监控不再分设只读账号，安装与采集共用清单的
> `user`/`key`；配置页没有第二套账号表单（§12.9），旧 `monitor` 字段被忽略。
> 未实现的 P3–P4 视图按本文件 §7 的触发条件再加。

# 界面（`ops ui`）

默认只读查看服务器清单与检查结果；会改远端的写操作有**两个**：「一键免密 sudo」与
「安装 / 升级备份能力」（后者要输 `yes` 且过服务端预检门，见 §9）。
另有 `GET /api/health` / `GET|POST /api/restart`（重启自己，见 §11）、
`POST /api/shortcut`（建桌面快捷方式）与 `POST /api/shutdown`（只关本机界面进程）；
四者都不碰远端，统一放在顶部工具栏。
「备份监控」（§14）是第 5 个导航项，也是纯只读：不触发备份、不恢复、不改配置。
接口、清单与 sudo 的规则分别见 [servers.md](servers.md) 与 [config.md](config.md)，本文只讲界面本身。

## 1. 为什么不再用单文件 HTML

2026-11-05 之前是 339 行的 `internal/ui/index.html`：手写 DOM、原生 JS、零构建。
它对「一张表 + 两个按钮」是合适的，但 P2 的 `ops status`（四张卡 + 问题清单）与
P3 的 `ops deploy`（步骤进度 + 实时日志）一定会来，届时这个文件会破千行，
而它既没有类型、也没有一处可测的判定逻辑。

迁移的判断是**成本随时间上升**：现在搬是搬一张表，晚点搬是搬一张表加两个复杂视图。
P1 的「备份能力部署」比 P2/P3 先落地，正好验证了这个判断：第二个 feature 直接按同一套
`api / service / utils / components / pages` 长出来，`node --test` 当天就多了 7 个用例。

| 被否的方案 | 为什么不选 |
| :--- | :--- |
| 继续单文件，拆成 `index.html` + `app.js` + `app.css` | 零构建，但 P3 的步骤表格 / 日志流仍要手写，判定逻辑依旧没有测试 |
| 服务端 `html/template` 渲染 | 模板只能出静态 HTML，弹窗与行内 loading 仍要 JS，等于两套渲染 |
| Svelte / Vue（体积更小） | 与同机另一个本地工具 `wsl-manager/web` 技术栈不一致，跨项目复用的收益归零 |
| 立刻加 `react-router` + `zustand` | 当时只有一页。加了只会多一个「刷新时 URL 上没有 token」的问题（见 §7；五页后仍只用一个选中态外壳） |

## 2. 目录

按 `cqlql-notes/docs/工程/目录结构规范.md`（母本）与 `前端/前端目录结构规划.md` §二
（React 子篇）排：**一个能力一个 `features/<能力>/`，跨能力的才进 `shared/`**。

```
web/                             前端源码（不在 internal/ 下，见 §3 的 embed 限制）
  index.html                     Vite 唯一模板；favicon 指向 /favicon.ico（由 Go 回）
  package.json                   scripts: dev / build / preview / typecheck / test
  tsconfig.json                  strict + erasableSyntaxOnly + allowImportingTsExtensions
  vite.config.ts                 outDir=dist；keepDistPlaceholder 重建 dist/.gitkeep
  dist/                          构建产物：**不进 Git**，仓库里只有 .gitkeep
  src/
    main.tsx                     先接令牌，再挂载（顺序反了会先闪一次 401）
    App.tsx                      ConfigProvider + ErrorBoundary + 左侧 Sider/Menu 导航外壳
    index.css                    全局样式（只此一份，没建 styles/ 目录）
    features/
      servers/                   服务器管理（P0）
        api.ts                   只发请求：list / check / applySudo
        service.ts               编排：先检查 → 问密码 → apply → 失败回查
        types.ts                 与 Go 的 ServerInfo / ServerStatus 逐字对齐
        utils/status.ts          状态 → {text, tone}；按钮能不能点
        utils/server.ts          user@host:port、role 中文、私钥/密码提示
        components/ServersTable.tsx   表格（只渲染，判定全在 utils/）
        pages/ServersPage.tsx    取数 + 拼装 + UI 状态（loading / busy / 弹窗）
        index.ts                 对外只导出 ServersPage
      backup/                    备份能力部署（P1，同构的第二个 feature）
        api.ts                   run / task / targets
        service.ts               启动任务 + 增量日志轮询 + 页面重载后接回
        types.ts                 与 Go 的 backupRunRequest / backupTaskView 对齐
        utils/format.ts          阶段 → {text, tone}；组件中文；能否开始
        components/BackupLog.tsx 日志容器（只渲染 + 自动滚动）
        pages/BackupPage.tsx     表单 + yes/密码弹窗 + 任务状态
        index.ts                 对外只导出 BackupPage
      components/                环境组件（§13）：api / types / service / utils / pages
      config/                    配置页（§12）：api / types / utils/draft / pages
      monitor/                   备份监控（P2+，§14，纯只读）
        api.ts                   targets（/api/servers）+ status（/api/monitor/status）
        types.ts                 与 Go 的 monitor.Status / monitorStatusView 对齐
        utils/format.ts          只格式化：null → —、0 仍是 0、数组兜底、默认机
        pages/MonitorPage.tsx    目标机 + 问题清单 + 四张卡 + 60s 刷新
        index.ts                 对外只导出 MonitorPage
      system/                    全局顶部工具栏（§7 / §11）：api / restartFlow / components
    shared/
      api/http.ts                唯一请求底座：令牌、信封、401、ApiError
      ui/ErrorBoundary.tsx       跨能力的渲染兜底
      utils/time.ts              formatShortTime（业务无关）
  test/*.test.ts                 node --test：utils + service + shared/utils
webdist.go                       //go:embed all:web/dist（根包，package main）
```

🔴 **没有 `router/`、顶层 `pages/`、`shared/domain/`、`hooks/`、`store/`** ——
不是漏了，是母本第二节那条「目录是长出来的」：五个 feature 各管各的状态、
零个跨页面共享状态，多页用 `Sider + Menu` 的选中态切换即可（判据见 §7）。
出现跨页面共享状态时才建目录，别为了结构完整先铺空壳。

`features/servers/` 里为什么有 `service.ts`：`applySudo` 是「先检查 → 判断是否已配好 →
问密码 → apply → 失败回查」的五步编排，属业务细节，不该写在页面里；
而 `api.ts` 只做「一个函数一个接口」，不写判断。判据见母本 §4 那张表。
反过来 `features/monitor/` 没有 `service.ts`：它唯一的编排是「取数 + 请求竞态」，
属页面 UI 状态，判定全在 Go 侧；硬凑一层编排只会多一个空壳（§14）。

## 3. 产物怎么进二进制

- 🔴 **`//go:embed` 的路径不能出现 `..`**，所以嵌 `web/dist` 的 Go 文件必须和 `web/` 同级 ——
  那就是仓库根的 `webdist.go`。`internal/ui/` 拿不到它，只能**接收**一个 `fs.FS`
  （`ui.CmdUI` 的 `static fs.FS` 参数，另有两项能力注入见下）。副作用是好的：测试可以塞 `fstest.MapFS`，
  `go test ./...` 因此在全新 clone 上也绿，不依赖「前端构建了没有」。
- 🔴 **`web/dist` 的真实产物不进 Git**，仓库里只有 `web/dist/.gitkeep`。
  原因有二：产物是构建输出（review 噪声、冲突无意义）；而目录**必须存在**，
  否则 `embed` 直接编译失败（`pattern all:web/dist: no matching files found`）。
  `vite.config.ts` 用 `emitFile` 在每次构建后重建这个占位 —— `emptyOutDir: true` 会把它删掉，
  不重建的话它永远提交不上去（`wsl-manager` 那边踩过）。
- **未构建时仍然能 `go build`**：`distFS()` 发现 `index.html` 不在就返回 nil，
  页面回 **503 + 构建命令**（不是 500、不是白屏），CLI 启动时也打一行 `WARN`。
  这一页是最后的兜底，**正常路径不该走到它**：`启动运维.cmd` 双击时先用内部命令
  `ops.exe __dist-check` 看**二进制里**有没有 `index.html` 与 `assets/` —— 有就零构建
  直接放行（磁盘 `web/dist` 被手删也无所谓）；只有没页面才自动 `npm run build` +
  `go build`（顺序本身是红线，见 [one-click-launch.md](one-click-launch.md) §4.1），
  见 [one-click-launch.md](one-click-launch.md) §4.1 / [AGENTS.md](../AGENTS.md) 硬约束 26。
- 🔴 **`/assets/*` 长缓存、`index.html` 不缓存**：产物文件名带内容哈希，
  `Cache-Control: immutable` 是安全的；而 `index.html` 决定引用哪一组哈希文件名，
  缓存住它就会在重新构建后继续引用已经不存在的旧文件。

## 4. 鉴权模型（谁能拿到什么）

| 路径 | 要 token | 说明 |
| :--- | :--- | :--- |
| `/assets/*` | **否** | 是代码不是数据；`<script src>` 带不上自定义头，也拿不到地址栏的 `?token=` |
| `/favicon.ico` | **否** | 图标字节与桌面快捷方式同源（`ui.IconBytes`），不含任何信息 |
| 其它 `GET`（页面） | 是 | 401 回**中文说明页**：该用 CLI 打印的带 `?token=` 的地址打开 |
| `/api/*` | 是 | 401 回 JSON 信封 `{"ok":false,"error":"token 无效"}` |
| `/api/backup/run` | 是 | `POST`，额外校验 `Origin`；`mode=deploy` / `deps` / `deps-uninstall` 必须带 `confirm:"yes"` 且过服务端预检门；只认清单 name（见 §9 / §9.7） |
| `/api/backup/deps` | 是 | `GET`，只读依赖状态（`ops backup deps --json`），不占任务锁、不需要 confirm（见 §9.7） |
| `/api/backup/task` | 是 | `GET`，只读任务状态与增量日志；日志已脱敏，不含密码 |
| `/api/shortcut` | 是 | `POST`，额外校验 `Origin`；只碰本机桌面（建 `.lnk`），**不依赖配置是否齐全** |
| `/api/open-servers-file` | 是 | `POST`，额外校验 `Origin`；本机动作：用 VSCode（找不到回退系统默认程序）打开 `servers.json`；**路径由服务端从 `ops.env` 解析，接口不读请求体** |
| `/api/health` | 是 | `GET`，只回 `ok` + `boot_id`（**这个进程实例**的标识，重启判据，见 §11），不含任何数据 |
| `/api/restart` | 是 | `GET` 回确认视图；`POST` 额外校验 `Origin` + `confirm_token`，重建失败就地停、备份任务在跑时 409（见 §11） |
| `/api/shutdown` | 是 | `POST`，额外校验 `Origin`；只结束**本机**界面进程（退出码 0），不改远端 |

- 静态产物不过 token 是**有意的**：真正的边界是 API —— 拿不到 token 就调不通任何接口，
  页面本身只是空壳。服务只监听 `127.0.0.1`，见 AGENTS.md 硬约束 14。
- 写操作额外校验 `Origin`：有 `Origin` 头且不等于本服务源 → 403（挡别的网页借浏览器打本机）。
  `POST /api/backup/run` / `POST /api/apply-sudo` / `POST /api/shortcut` /
  `POST /api/open-servers-file` / `POST /api/restart` / `POST /api/shutdown`
  都走这条，所以别的网页既关不掉这个面板、也借它装不了备份能力、重启不了服务。
- `POST /api/open-servers-file` 与 `/api/shortcut` 同属**本机动作**：只起一个进程，不写配置、不碰远端。
  它不收任何路径参数，目标固定为服务端解析出的 `servers.json`，所以拿到 token 也借它打不开任意文件
  （见 §10）；实际用的编辑器原样回给页面，找不到 VSCode 不冒充成功。
- token 只活在**内存 + 地址栏 + 配置目录的 `ui.json`（0600）**，不写 `localStorage`：
  `ops ui` 每次**常规启动**都换新 token，存进 localStorage 只会让人分不清「当前这个后端」和「上一个」。
  `ui.json` 是给第二次双击「把浏览器指回已有实例」用的，运行态文件清单见
  [one-click-launch.md](one-click-launch.md) §4.4（2026-11-07 从 config.md 移来）。
  ⚠️ 例外：`__takeover`（重启接手）**复用** `ui.json` 里的 token，不换新 ——
  前端 token 没落盘，换掉之后页面轮询 `/api/health` 会一直 401，把成功的重启误报成失败。
  见 §11.4。
- 🔴 配置 / 服务器清单读不出来时**照常返回 SPA**，不再回 503 说明页：界面里本来就有
  「配置」页与「打开 servers.json」入口，把人挡在外面反而进不去能补配置的地方。
  `GET /api/servers` 回 200 + `setup_error` + 空数组 + 默认 `servers_file`，落地页据此给
  「去配置页 / 打开清单 / 重新加载」引导；需要清单的写操作（check / apply-sudo / 部署）
  仍各自 503。每次请求重读配置，补完**刷新即可**；本机配置编辑走
  `shared.FallbackConfig()`（`ops.env` 缺失也不挡），远端动作仍严格 `LoadConfig`。
  详见 §12.6。
- 旧的 `__OPS_TOKEN__` 占位符已删除。以前 favicon 也要 token，只能在 HTML 里拼占位符
  再由 Go 替换；favicon 公开之后这条链路整段消失了。

## 5. 判定、编排、渲染三层

| 层 | 在哪 | 只做什么 |
| :--- | :--- | :--- |
| 判定 | `features/servers/utils/*.ts`、`shared/utils/*.ts` | **纯函数**：不 import antd / react、不碰 DOM，返回 `{text, tone}`（tone 是语义色） |
| 编排 | `features/servers/service.ts` | 多接口串起来、分支（先检查？问密码？失败回查？），依赖**注入** |
| 渲染 | `components/`、`pages/` | 把 tone 映射成 antd `Tag` 的 color；页面只管取数、拼装、loading / 弹窗 |

这样 `node --test test/*.test.ts` 能直接覆盖前两层，不需要 jsdom、也不需要 mock 模块
（`service.ts` 的 `ServersApi` / `FlowHooks` 都是参数，测试塞假实现即可）。

🔴 但这不等于「前端可以自己算指标」：**指标计算在 Go 侧**
（终端表格、`--json`、网页共用一份，见 [backup-monitor.md](backup-monitor.md) §7）。
前端只做「状态码 → 文案 + 颜色」这一层展示映射。

## 6. 命令

```
cd web && npm install
npm test && npm run typecheck && npm run build
cd .. && go build -o ops.exe .

ops ui                    # 前台：打印带 token 的地址并自动开浏览器（默认服务器管理页）
ops ui --no-open          # 不自动开浏览器（验收 / 脚本）
启动运维.cmd               # 双击：隐藏后台托管 + 自动开浏览器 + 单实例
启动运维.cmd --fg         # 前台跑 ops ui，保留窗口看 stdout
启动运维.cmd --menu       # 交互菜单（预检 / 安装 / 自检；与界面同一条 CLI 命令）

npm run dev        # 5175；/api 代理到 127.0.0.1:7788（先起 ops ui）
```

- **每次进程启动换一把 token**：`ops ui` 写 `ui.json`（port + token，0600）后自动开浏览器；
  再双击一次（或再敲一次 `ops ui`）只会把浏览器指回同一个实例，不启第二个服务。
  单实例靠 Windows 命名互斥体，进程被强杀也会自动释放。
- 🔴 **默认端口 7788，被占用时自动往后递增**（最多 20 个）。同机的 `suikouji ops`
  也默认 7788，两个工具经常同时开着——绑死端口的结果是隐藏窗口里 bind 失败、
  浏览器永远不开，表现为「双击没反应」。显式 `--port` 则严格绑定，被占直接报错，
  不偷偷换端口。**实际端口**写进 `ui.json`，浏览器地址、Origin 校验、单实例复用都用它。
- 🔴 **后台启动失败要回退前台**：`--background` 父进程 spawn 后等守护把新的 `ui.json`
  写出来（上限 6 秒），超时就返回非 0，启动器改在前台跑 `ops ui`——错误直接显示在
  可见窗口里，不再只躺在 `ops-ui.log`。
- 🔴 **顶部工具栏放三个全局动作**（宽屏在内容区顶部、窄屏与横向导航同一条，
  不随页面卸载）：创建桌面快捷方式 / 重启 / 关闭界面。
  - **「创建桌面快捷方式」**：`POST /api/shortcut` → 与 `ops shortcut`
    **同一份实现**（`launcher.CreateShortcutOnDesktop`，由 `main.go` 注入；ui 不反向依赖
    launcher）。只碰本机桌面，配置还没准备好时也能用；非 Windows 回一句明确错误。
    成功用 `message` 把完整 `.lnk` 路径弹出来 —— 工具栏不属于任何一页，
    没有 Alert 容器；且必须走 `AntApp.useApp()`，静态 message 在 antd v6 + React 19
    下拿不到主题（见 §11 那个坑）。
  - **「重启」**：可选「先重建」并换掉 `ops.exe`，源码过期时复选框自动勾上；
    详见 §11。后台守护本身**没有**换身逻辑，接手进程是独立的 detached 进程。
  - **「停」**：点「关闭界面」（`POST /api/shutdown` → 退出码 0），或前台模式下 Ctrl+C。
    显式二次确认仍走 Popconfirm。后台模式的窗口是隐藏的，没有这个按钮就只能去
    任务管理器杀进程。服务端「先回 200、300ms 后退出」，所以正常路径拿得到响应；
    关掉后**整个外壳**换成一张「怎么再打开」的静态说明页，不再留一屏能点的按钮。
  - 🔴 判据见 §7：这三个都是**对这个工具本身**的纯本机动作，与当前看哪一页无关、
    也不依赖清单是否配好。原来挂在服务器管理页 `page-head`，切到配置页就找不到
    「关闭界面」，关掉后的提示也只替换那一页；「检查全部」只作用于服务器清单，
    是页面动作，留在页头。窄屏（< 860px）三个按钮只留图标，文字交给
    Tooltip / Popconfirm，别把横向导航挤换行。

- ⚠️ **改完 `web/` 一律 `npm test` 与 `npm run typecheck` 两个都跑**：
  `test/` 故意不在 `tsconfig.json` 的 `include` 里（不想为一个测试引 `@types/node`），
  所以 tsc 看不到测试文件，类型错误只能靠跑一遍发现。
- 🔴 **`src` 内部的相对 import 一律写扩展名**（`./x.ts`、`./x.tsx`）。
  因为测试是 `node --test` 直接 import 源码跑的，**Node 的 ESM 解析不会补扩展名**；
  不写扩展名时只有「纯 type-only import」碰巧能过，一旦模块里有运行时 import 就
  `ERR_MODULE_NOT_FOUND`。由 `tsconfig.json` 的 `allowImportingTsExtensions` 放行。
- 推论：**能被测试覆盖的模块，运行时依赖链上不能出现 `.tsx`**（Node 不认 JSX）。
  这正是 `utils/` 与 `service.ts` 不 import 组件的原因 —— 分层顺带把可测性保住了。
- 端口 5175 是刻意的（避开 `console` 5173、`wsl-manager` 5174）；后端 7788 只是**起点**：
  `wsl-manager` 用 8788、`suikouji ops` 也用 7788，所以 `ops ui` 被占时会自动递增。
  dev 代理用 `OPS_UI_PORT` 对齐实际端口：`OPS_UI_PORT=7789 npm run dev`。

## 7. 什么时候才加路由 / 状态库

| 加什么 | 触发条件 | 现在为什么没有 |
| :--- | :--- | :--- |
| `react-router` | 出现**第二页**，且需要「刷新后停在那页」或「把链接发给别人」 | 第二页（备份能力部署）早已出现、现在共 5 页，但两个条件都不满足：本机回环 + 地址栏带一次性 token，链接发给别人也用不了；「刷新后停在哪个导航项」没有业务价值。用 `Sider + Menu` 的选中态切换，还顺带躲开「刷新时 URL 丢了 token」 |
| `zustand`（或别的 store） | 三个以上视图共享异步状态 | 五个 feature 各管各的 `useState` + `useCallback`；任务日志是单视图内部状态，没有跨视图共享 |

单页回退已经在 Go 侧做好了（非 `/api`、非 `/assets` 的 GET 都回 `index.html`），
加视图、加导航项都**不用动 Go 的路由**（该能力自己的 API 另算，见 §14.2）。

**2026-11-06 起导航放左侧**：`Layout.Sider + Menu`（窗口 < 860px 退化成顶部横向 Menu）。
视图就是导航项（2026-11-07 夜已 5 个，含 P2+「备份监控」），以后 P3 部署加视图
不用再往顶部标签栏里挤；
窄窗口只是布局变化，切换仍是一次点击。访问过的页面保持挂载、非当前页用 `hidden` 藏起来，
语义与原 `Tabs` 一致：切回来不重新取数，检查结果和备份任务日志都不丢。
仍是**零路由**：选中态只在内存里，刷新回默认的服务器管理页。

- **顶栏不重复页面标题**（2026-11-06）：宽屏顶部工具栏只放右侧那组全局动作，
  左侧导航的选中项已指名当前页，各页 `page-head` 里还有 `<h1>` + 清单路径 / 操作按钮。
  别再把 `PAGE_TITLE` 那份加回来，否则同一屏出现三次同样的字。

**按钮归属的判据（2026-11-06 晚追加）**：一个按钮放全局工具栏还是某一页的
`page-head`，只看「它的作用对象是整个工具，还是这一页的数据」。
创建桌面快捷方式 / 重启 / 关闭界面作用的是 `ops ui` 自己，**任何页面**都该能点，
且都不碰远端、不依赖 `servers.json`；检查全部 / 预检 / 安装 / 保存配置作用于具体
清单或远端，留在各自页面。跟着这条走，也顺带修掉了「从配置页关界面后，屏幕上
还留着三页能点的按钮」这种假活着的状态。接口归属同理：`/api/shortcut` 与
`/api/shutdown` 已从 `features/servers/api.ts` 挪到 `features/system/api.ts`。

## 8. 已知代价

- 二进制约 +1007 KB（gzip 后 321 KB），几乎全来自 antd。
- 构建从 1 步变 2 步；全新 clone 未构建时页面是「怎么构建」的说明页。
- 多了一条 npm 依赖链，需要偶尔 `npm audit`。
- 界面进程多了一份**内存里的任务日志**（上限 256 KB，不落盘、不进 `ops-ui.log`）；
  一个界面同时只跑一个备份任务。
- 换来的是：类型约束、组件现成、P3 的 `Steps` / `Progress` / 日志容器不用手写，
  以及**判定与编排第一次有了测试**（`web/test/` 85 个用例，其中 7 个覆盖备份监控的展示层）。

---

## 9. 备份能力部署（界面里的第二个写操作）

> 2026-11-05 改红线。旧表述「`ops ui` 只读 / 安装只走 CLI 或 `--menu`」**已作废**；
> 新边界是「**双击落地页只读，写操作必须显式二次确认 + 服务端门**」。
> 同步改过的还有 [AGENTS.md](../AGENTS.md) 硬约束 9/15/21、
> [backup-deploy.md](backup-deploy.md) §2/§10、[one-click-launch.md](one-click-launch.md) §1/§4.4/§5。

### 9.1 为什么改，以及没改什么

P1 的 `ops backup deploy` 早已实现并真机验证，却只能从命令行 / `--menu` 触发；
双击打开的页面只能看清单，装机时还得另开一个窗口。把入口搬进页面是可用性问题，
不是权限模型问题——只要**入口依旧是显式的**，就不该拦着。

没改的三条：① 双击**不自动**触发任何写操作，落地页仍是服务器管理（只读）页；
② 安装与只读采集共用清单里的同一个账号（只读由脚本保证）；③ 主机只来自 `servers.json`。
变的只有一条：界面**允许**有安装入口，但它必须比 CLI 更严，而不是更松。

### 9.2 六道门（服务端 enforce，前端只是交互）

| # | 门 | 在哪 | 绕过会怎样 |
| :--- | :--- | :--- | :--- |
| 1 | `mode=deploy` / `deps` / `deps-uninstall` 必须 `confirm:"yes"` | `handleBackupRun` | 直接调 API 返回 400，一次命令都不跑 |
| 2 | 三个写模式服务端先跑 `--dry-run`，非 0 不执行 | `runBackupTask` | 前端没点预检也拦得住；日志写「预检没过」 |
| 3 | `name` 只认清单、`component` 只认 `all/pg/minio` | `handleBackupRun` | 未知 name → 404；不代理任意主机 |
| 4 | 密码单次内存 → 子进程 stdin；日志按行脱敏 | `BackupRunner` / `backupLogWriter` | 明文不进命令行、不落盘、不进 `ops-ui.log` |
| 5 | 任务脱离 `r.Context()`，单任务互斥，日志上限 256 KB | `backupTask` | 刷新页面不打断远端安装；并发 409 |
| 6 | 不发 `--force` / `--run-now` / `--install-deps` | `backupCommandArgs` | 这几个仍是 CLI 专属；`deps` / `deps-uninstall` 走独立子命令，不是 `deploy --install-deps`（§9.7） |
| 7 | `targets` 只给 `deps-uninstall`，白名单 `mc\|pg_client`、至少一个 | `normalizeUninstallTargets` | 任意字符串不会变成远端 `rm` / `apt remove` 的参数 |

另外所有写 `POST` 都过 token + `Origin`（§4）；部署期间点「一键免密 sudo」返回 409，
避免两个写动作同时改远端、出事分不清是谁。

### 9.3 接口与任务模型

```
POST /api/backup/run
  { mode: "preflight"|"deploy"|"verify"|"deps"|"deps-uninstall", name, component,
    password?, confirm?, pg_major?, targets? }  pg_major 只给 deps（1..99 纯数字）；
                                              targets 只给 deps-uninstall（mc / pg_client，至少一个）
  → { started, mode, server, component }        立刻返回，任务在后台 goroutine

GET  /api/backup/deps?name=<清单 name>&component=all|pg|minio[&pg_major=<n>]
  → { server, component, collected, items[], missing[], optional[], plan[], docs[],
       uninstall{ title, description, targets[], impacts[], submit_label }, error? }
    只读（`ops backup deps --json`）；失败也回 ok=true + data.error，数组一律 []

GET  /api/backup/task?after=N
  → { running, done, mode, server, component, exit_code, log, next, started_at?, ended_at? }
    log 是 after 之后的**增量**，next 原样喂给下一次请求（字节偏移，中文不会切坏）
```

`preflight` = `backup deploy --dry-run`（只读）、`verify` = `backup verify`，
`deploy` = 服务端先 `--dry-run` 再 `backup deploy`，
`deps` = 服务端先 `--dry-run` 再 `backup deps`，
`deps-uninstall` = 服务端先 `--dry-run` 再 `backup deps-uninstall`（§9.7）。
任务状态只在**内存**里，进程一退就没了；不做取消接口——杀本机进程不等于远端会回滚，
给一个「取消」按钮只会让人误以为远端停了。

### 9.4 为什么不重写部署逻辑

`CmdBackup` 的输出全是 `fmt.Print*` 打到 `os.Stdout`。网页要日志，可选路径只有三条：

| 方案 | 判定 |
| :--- | :--- |
| 给 `backup` 包加可注入 `io.Writer`，改 30 多处输出 | 侵入太大，动的是已真机验证的部署代码 |
| 临时替换全局 `os.Stdout` 为 pipe | HTTP 并发下不安全，且会污染后台日志 |
| **再起一个自己执行同一条 CLI 命令**（选中） | 输出天然隔离成任务日志；密码走 stdin；`ui` 不必 import `backup` |

依赖方向仍是 `main → {ui, backup} → shared`：`main.go` 把
`runBackupSubprocess`（根包 `backuprun.go`）作为 `BackupRunner` 函数值注入 `ui.CmdUI`，
`ui` 只持有签名 `(args, password, out) → int`，测试塞假实现即可，不连 SSH、不起进程。

### 9.5 刷新页面不会打断远端安装

任务 goroutine 不绑 `r.Context()`：浏览器关标签页、切导航项、刷新，服务端照跑。
页面重新挂载时 `resumeBackupTask` 先 `?after=0` 拿全量历史，发现 `running`
就从 `next` 继续追增量（`web/src/features/backup/service.ts`）。
StrictMode 下 effect 会跑两次，用递增的 `pollId` 让旧轮询自己退出，不会双份日志。

### 9.6 验收 / 回归要点

- `go test ./internal/ui`：确认门、预检门、未知 name 404、密码脱敏、并发 409、
  apply-sudo 与部署互斥、增量日志；
- `npm test`：`watchTask` 按 `next` 续传、`shouldStop` 只停轮询不停任务、重载后接回；
- 真机：预检失败时远端文件没变；日志里搜不到明文密码；安装途中刷新，回来能看到完成。

### 9.7 界面安装「缺少依赖」（2026-11-07）

**动机**：预检日志里一句 `ERROR: 缺少依赖: mc, pg_restore` 之后，人得另开终端跑
`ops backup deploy --install-deps`——而这个开关会顺带**重部署整套脚本**。装两个命令行工具
不该有这种副作用，所以新增独立子命令 `ops backup deps`（见
[backup-deploy.md](backup-deploy.md) §10.2），界面在两页提供同一个能力：

| 页面 | 位置 | 数据源 / 写动作 |
| :--- | :--- | :--- |
| 备份能力部署 | 按钮区下方的「备份依赖」卡片 | `GET /api/backup/deps` + `mode=deps` |
| 环境组件 | 组件目录下方新增「备份依赖」区（不属于组件目录） | 同上，任务日志仍走 `/api/components/task`（同一把锁） |

- 状态卡片只读：`items[]`（命令 / 用途 / 已装 / 版本 / 安装来源）、`missing[]`、
  `plan[]`（这次会装什么）、`docs[]`（PGDG 与 mc 官方文档）**全部由 Go 侧算好下发**，
  前端只渲染 + 一个 busy 门。`collected=false` = 没采到，安装按钮直接禁用（硬约束 3）。
  「已安装」判据是 `[ -x ]` 且 `pg_restore` / `mc` 的 `--version` 真能跑通：
  半截下载文件、`postgresql-client-common` 留下的 pg_wrapper 壳链接都不算已装。
- 写动作与 `deploy` 共用六道门：`confirm=="yes"`（人输 `yes`）、服务端 `--dry-run`、
  `name` 只认清单、组件白名单、密码单次内存→stdin + 日志脱敏、任务脱离请求 + 409。
  **不发** `--install-deps` / `--force` / `--run-now`。
- `pg_major`（可选，1..99 纯数字）只属于 `deps`：给了就按 PostgreSQL 官方 PGDG apt 仓库
  装 `postgresql-client-<n>`，不给则装发行版仓库的 `postgresql-client`。服务端与 CLI
  各验一次字符集，绝不让它变成任意字符串拼进远端 apt 包名。
- 安装完自动复查每个命令、任务结束自动刷新只读状态；预检日志里出现「缺少依赖」时，
  备份页额外给一条可直接点的引导。
**卸载（2026-11-07 晚追加，供「卸了再装」复测）**：`mode=deps-uninstall` +
`targets: ["mc" | "pg_client"]`，同样六道门，另加一条 `targets` 白名单门。
只读状态里多带一份 `uninstall` 计划（标题 / 可勾选项 / 影响清单 / 提交文案），
两页弹窗都只渲染它；**勾选项默认全不勾、至少选一个**才能提交。
只删 `/usr/local/bin/mc` 与 `postgresql-client[-<n>]` 包，不卸 cron / nc / ssh / tar /
logrotate，不 autoremove / purge，不碰 `~/.mc`、容器 / 镜像、PGDG 源、服务端、
crontab / backup.env；卸载后自动复查命令是否真的消失。判据见
[backup-deploy.md](backup-deploy.md) §10.3、[components.md](components.md) §10。

- 回归：`internal/backup/deps_test.go` / `deps_uninstall_test.go`（参数门 / 只读探测 /
  官方源 / 卸载边界 / 采不到≠已装）、`internal/ui/deps_test.go`（GET 只读与白名单、
  deps 与 deps-uninstall 的 confirm 门 / 预检门 / targets 白名单 / 409）、
  `web/test/{backup,components}.test.ts`（归一化、按钮门、请求参数）。

## 10. 点清单路径直接用 VSCode 打开（2026-11-06）

服务器管理页页头那行 `清单：C:\...\servers.json` 本身就是链接：点一下打开编辑，
不必再去 `%AppData%` 里翻路径。这是**低频辅助入口**，所以不加按钮、不给主路径添步骤。
路径只保留蓝色虚线下划线的链接样式（hover 变实线、focus 有描边），**不挂常驻图标、
不写「点击用 VSCode 打开」提示文字**：链接样式本身已经说明能点，页头不需要额外说明噪音。
`title` 写「用编辑器打开」而不写死 VSCode，因为后端可能回退到系统默认程序。
仍是一个 button、一次点击，键盘可达；打开中 disabled + `cursor: wait` 防重复点击。

### 10.1 为什么不让前端拼 `vscode://` / `file://` 链接

| 方案 | 判定 |
| :--- | :--- |
| `file://` 链接 | 浏览器从 `http://127.0.0.1` 页面跳本地文件会被拦，直接不可行 |
| 前端拼 `vscode://file/...` | 依赖 VSCode 注册协议、依赖浏览器放行外部协议；失败时页面无从得知，只能干等 |
| **`POST` 让后端拉起进程**（选中） | 能返回「用的是哪个程序」，找不到 VSCode 还能回退系统默认程序；路径不用暴露给前端去拼 |

### 10.2 边界

- 接口**不读请求体**：路径只来自 `shared.LoadConfig()` 解析出的 `ServersFile`，
  并先 `os.Stat` 确认是普通文件。前端塞 `{"path": ...}` 会被忽略（有单测挡着）。
- 只起进程，不写文件、不碰远端；`POST` + token + `Origin` 与「创建桌面快捷方式」同级，
  必须人点，双击落地页不会自己开编辑器。不进 `opMu`，不用等 SSH 检查跑完。
- `openFileInEditor` 优先 VSCode（用户级 / 系统级 / `code.cmd` 同目录的 `Code.exe`），
  找不到或起不来回退 `rundll32 url.dll,FileProtocolHandler`（其它平台 `open` / `xdg-open`）；
  只拼 argv、不拼 shell 命令行，避免路径里的空格 / `&` / `^` 变成命令注入。
  单测通过 `openInEditor` 这个测试缝，不会真弹一个 VSCode 窗口。
- 🔴 **Windows 上不能直接 `Code.exe -r <file>`**：那是 Electron 主程序而非 CLI 入口，
  `Start()` 会成功、进程也确实起来，但文件不会打开（真机验证：窗口标题不变）。
  `bin/code.cmd` 的做法是 `ELECTRON_RUN_AS_NODE=1` + `Code.exe <版本目录>/resources/app/out/cli.js -r <file>`，
  本实现照抄这条 argv，版本哈希目录用通配符找（升级会变，不能写死），从而避开
  `cmd.exe` 黑窗口与额外一层转义。
- 返回值 `editor` 是**实际**程序名，页面提示写「已用 X 打开」而不是写死 VSCode。

### 10.3 回归要点

- `go test ./internal/ui -run TestOpenServersFile`：401 / 403 / GET 404 / 请求体路径无效 /
  配置缺失 503 / 清单缺失 404 / 拉起失败 500；
- 真机：点路径后 VSCode 在当前窗口打开 `servers.json`；把 VSCode 挪走（或改环境变量）
  再点，提示应变成「系统默认程序」而不是假装成功。

---

## 11. 重启自己（2026-11-06）

> 判据与踩坑在这里，一句话结论在 [AGENTS.md](../AGENTS.md) 硬约束 22。
> 启动器形态与「为什么不做退出码 75」见 [one-click-launch.md](one-click-launch.md) §4.2。

### 11.1 为什么改了，以及没改什么

开发时「改 Go / 改前端 / 改 `deploy/backup` → 重新构建 → 关界面 → 重新双击」是纯手工五步，
漏掉任何一步的症状都是同一句「我明明改了，界面怎么没变」。
[one-click-launch.md](one-click-launch.md) §9 当初否决「一键重启」的理由是
「Vite 重建链路长且出错时无人看见」——现在这条被三条硬约定解决了：
**重建失败就地停**（服务照旧在跑）、**构建输出回 HTTP 响应并进日志**、
**新进程的输出写进 `ops-ui.log`**（detached 进程没有控制台，不重定向就静默丢掉）。

仍然**不做**参考项目那套「退出码 75 → `.cmd` 守护把 `.new` 换身 → `--takeover` 重拉」：
本仓改走 detached 接手进程，`启动运维.cmd` 一行未改（避开 CRLF / ASCII 注释 /
隐藏窗口 `pause` 那些红线）。名字也叫 `__takeover`，但它是 `ops ui` 的**内部标记**，
不是启动器的循环分支。

### 11.2 接口与六道门

```
GET  /api/health            → {ok:true, boot_id:"<这个进程实例>"}
GET  /api/restart           → 影响面 / confirm_token / binary_stale / build_command / log_path / note
POST /api/restart           → {"rebuild":bool,"confirm":"sha256:…"}
                            200 {restarting:true, build_output, boot_id}（显式 Content-Length）
                            409 confirm_stale / 备份任务在跑 / ui.json 读不到
                            500 重建失败（服务照旧在跑）
```

六道门见 AGENTS.md 硬约束 22。要点：确认令牌绑「进程实例 + 端口 + token」；
**不要求输 `yes`**（重启是本机动作，二次确认弹窗已经把影响面逐条摊开）；
备份任务在跑时硬拒绝（它正在写远端 crontab / 目录，拦腰截断会留半状态）。

### 11.3 交接链路

```
页面点「重启」→ 二次确认（影响面 5 条 + 可选「先重建」）
  → 服务端：可选重建到 ops.next.exe（失败就地停）
  → 先回 200（显式 Content-Length）→ 拉起 __restart 接手进程（detached，输出进 ops-ui.log）
  → 旧进程 srv.Shutdown（让出端口）→ exit 0（隐藏 cmd 守护随之结束）
  → 接手进程：WaitPortFree → ReplaceBinary(next → ops.exe)
  → ops ui __takeover --port <原端口>：从 ui.json 复用 token、带重试拿单例互斥体、不新开浏览器
  → 前端轮询 /api/health，boot_id 变了才 location.reload()
```

⚠️ **判据只有 `boot_id`**。交接失败时旧进程会**原地活着**（刻意的 —— 用一次看不见的
失败换掉整个服务更糟），那时「服务还在」与「重启成功」在界面上完全一样；
同理服务端「先回 200 再退出」使传输层失败成为**预期形态**，不是失败。
判定抽在 `web/src/features/system/restartFlow.ts`（单测 `web/test/restartFlow.test.ts`）。

### 11.4 五条本仓特有的坑

1. 🔴 **不能换新 token**。前端 token 只在内存 + 地址栏（`adoptTokenFromUrl`，见 §4），
   每次 `ops ui` 启动都 `randomToken()`。换了之后页面轮询 `/api/health` 一直 401，
   `boot_id` 永远拿不到，界面会把一次**成功**的重启误报成「没重启成」。
   → `__takeover` 从 `ui.json`（0600）复用 port + token；令牌**不进命令行**（任务管理器看得到）。
   `GET /api/restart` 会先确认 `ui.json` 可读且与当前进程一致，不一致就不给按钮。
2. 🔴 **单实例互斥体要带重试拿**。旧进程 `srv.Shutdown`（关监听）在 `exit` 之前，
   而命名互斥体是**进程退出时**由内核释放；接手进程的 `WaitPortFree` 看到端口空了，
   锁可能还差几毫秒。不重试就会误判「已有界面在跑」，只开一个浏览器标签页、服务却没起来。
3. 🔴 **构建顺序比一般 Vite 项目多两步**：`npm test` → `npm run typecheck` →
   `npm run build` → `go build -o ops.next.exe .`。`test/` 不在 `tsconfig` 的 include 里，
   类型错误只能靠跑一遍发现，少了它等于放行一个前端类型错误。
   `go` 那条**直接 exec 不走 cmd.exe**：Go 按 CommandLineToArgvW 组装参数，cmd 不认那套，
   含空格的 `go.exe` 路径必然坏掉（症状像「go 没装」）。只有 npm（`.cmd`）需要 `cmd.exe /d /c`。
4. 🔴 **过期检测要算 `deploy/backup/**` 与 `web/dist/index.html`**：两者都 embed 进二进制，
   漏掉就是「脚本改了但部署出去的还是旧的」/「界面看着变了、其实跑的是旧 Go」。
   运行态文件（`ops.exe~` / `servers.json` / `*.log` / `backup.env`）一律不算输入，
   否则「先重建」会永远勾着 —— 一个永远为真的告警等于没有告警。
5. 🔴 **`ReplaceBinary` 同路径必须拒绝**。「从哪个文件起来」与「换到哪个文件」是两个值：
   混填会变成 `next.exe → next.exe` 的空操作，表面成功、正式 exe 永远停在旧版本。
   另外 `os.Executable()` 在 Windows 上返回**进程映像加载时**的路径：一个「从 next.exe
   起来、再改名成 ops.exe」的进程仍返回 next.exe，所以 `TargetExe()` 必须走
   `NormalizeExePath`（按 `.next.exe` 后缀判，不靠探测文件在不在）。
   ⚠️ 同一个坑不止影响重启自己：`backuprun.go` 的 `runBackupSubprocess` 也按
   `os.Executable()` 起 CLI 子进程，换身后不归一化就会让 `compare-env` /
   `deploy` / `verify` / `sync-env` 全部报「找不到 ops.next.exe」（2026-11-06 真机，
   症状是配置页白屏）。现在由    `resolveBackupExe` 优先用仍在的原路径、原路径没了
   才按后缀落到正式 exe；单测在 `backuprun_test.go`。
   ⚠️ 同一个接手进程还是 `DETACHED_PROCESS`，**没有控制台**：它拉起的 ssh / ops.exe /
   powershell 都会各自新建一个可见黑窗口（点「检查」时最明显，一台机器闪两次）。
   现在所有后台子命令统一走 `shared.HideConsole`（`CREATE_NO_WINDOW + SW_HIDE`），
   口径与隐藏守护一致，判据见 [one-click-launch.md](one-click-launch.md) §4.2。

### 11.5 回归要点

- `go test ./internal/restart ./internal/ui .`：过期判定（含 embed 脚本）、重建顺序与失败停、
  `ReplaceBinary` 同路径拒绝、确认令牌绑实例、409 拒绝任务、重建失败不交接、
  响应 Content-Length、拉起失败不退出、单例重试；
- `cd web && npm test && npm run typecheck && npm run build`：4 个 `restartFlow` 用例；
- 真机（Windows）：起界面 → 点「重启」勾「先重建」→ 等页面自己回来 →
  核对 `/api/health` 的 `boot_id` 变了、`ops.exe` 的 mtime 变了、`ops.next.exe` 不在了、
  `ops-ui.log` 里有「新二进制已就位」；再点一次**不重建**的重启，确认同样能回来。

## 12. 配置页（2026-11-06）

### 12.1 为什么改

一次真机安装失败暴露的不是 bug，是**三处「用户」被混为一谈**：

1. `servers.json.user`（如 `cql`）：本机 SSH 登录**备份端**的账号；
2. 远端执行身份：2026-11-06 起分两层 —— **安装期** `rootWrap` 用 `sudo -n sh -c`
   提权到 root（写 `/etc/logrotate.d`、建系统目录、清旧 crontab）；**运行期**
   （cron / 备份脚本 / preflight 自检 / 首跑）固定回落为 `servers.json.user`，**都不是可配项**；
3. `backup/{postgres,minio}.env` 的 `PG_SSH_USER` / `*_KEY`：备份脚本每天从**备份端
   连主服务器**拉 dump 用的账号与私钥，跟前两者无关。

`printDryRun` 只打印裸命令、`install.sh` 打印「安装期以 root 身份执行」，页面看不到
sudo 包装层，于是「配置了 cql，日志却说 root」看起来像配置被读错。配置页用
`exec_chain` 把两层身份摆到同一页说清楚，同时解决「不想开编辑器手改配置文件」。
判据见 [backup-deploy.md](backup-deploy.md) §2 / §4.4。

新增左侧菜单「配置」作为**次入口**：不占主路径（服务器管理 / 备份部署）的点击，
双击落地页仍是只读的。

### 12.2 接口与六道门

| 接口 | 作用 | 写哪里 |
|---|---|---|
| `GET /api/config` | 清单字段 + 两份 env 字段 + `exec_chain` | 只读 |
| `POST /api/config/servers` | 保存清单里的白名单字段；`mode=add` 时**追加一台服务器**（§12.6） | 本机 `servers.json` |
| `POST /api/config/backup-env` | 保存一份本机备份配置 | 本机 `backup/*.env` |
| `POST /api/config/sync-env` | 显式同步到远端 | 远端 `<组件>/backup.env` |

六道门（服务端 enforce，前端只是交互，对应 AGENTS.md 硬约束 23）：

1. 凭证字段（含 `PASSWORD|SECRET|TOKEN|KEY`）**只回显 `configured` 标记**；提交时
   空值 = 保持不变，填新值才覆盖；**清空必须走独立的 `clear` 列表**（§12.8），
   同样过白名单与 `confirm=="yes"`。四个写动作（`servers` / `add` / `backup-env` /
   `sync-env`）都要 `confirm=="yes"`，`POST` + token + Origin。
2. 路径全部由服务端从 `ops.env` / 配置目录解析，**接口不接收任何路径**；`name` 只认清单，
   组件只认 `pg|minio|all`。
3. 字段白名单：编辑已有清单时不改 `name`（主键，`servers.state.json` 与 default 都按它
   索引）；`mode=add` 时 `name` 必填、不许重名，其余字段仍只认同一份白名单；
   env 只改「模板定义过或文件里已有」的键，注释与未知行原样保留。
4. 🔴 **值按 shell 字面量转义**：env 会被远端 `install.sh` / 备份脚本 `source`，
   `$(...)`、反引号、双引号、反斜杠不转义就是命令注入。`quoteEnvValue` 统一处理。
5. 写 0600 + 先留 `.bak` + 原子替换；清单写前把 `.tmp` 交给 `shared.LoadServers`
   做全量校验（字段格式、`sudo.mode` 组合、default 指向、私钥存在性），失败原文件一字不动。
   改了 `user` / `sudo.mode` 会提示重新「一键免密 sudo」并清掉该 name 的检查缓存——
   drop-in 是 `/etc/sudoers.d/90-<user>-nopasswd`，按用户名写的。
6. 备份预检 / 安装 / 自检在跑时 **409**；占位符（`CHANGE_ME` / `YOUR_`）配置拒绝同步。

### 12.3 保存本机 ≠ 生效

`deploy` 在「远端 `backup.env` 已是 OK」时默认**保留远端配置**（日志里的
`远端=OK 保留远端配置`），只有 `--force` 才覆盖，而按硬约束 21 ⑥ 界面不开放 `--force`。
所以「保存成功」若不同步就是假成功。配置页把两者拆成两个显式动作，中间用
`本机已改 · 远端未同步` 标记提示。

同步走新增 CLI：

```
ops backup sync-env [pg|minio|all] --server <name>
```

只把本机 env 内容经 stdin 推到远端 `<DeployDir>/<组件>/backup.env`（0600，旧文件留
`.bak`），**不重跑 install.sh、不动脚本与 crontab**。走 `root=false`：部署目录由
`prepareDir` 以登录账号属主创建，stdin 才能整份留给配置内容，不必和 sudo 密码抢管道。
凭证内容既不进命令行也不打印到输出。

### 12.4 明确不做

- **「远端执行身份」下拉框**：它是 `user + sudo.mode` 推导的结果，再开一个字段只会造出
  「登录 cql 却填执行账号 root」这种自相矛盾；页面用 `exec_chain` 只读展示。
- **去掉 root 运行**（2026-11-06 已做，原「另立方案」作废）：`install.sh` Step 0 仍要求
  `id -u = 0`，因为安装期要写 `/etc/logrotate.d` 与建系统级目录；但它装出来的
  crontab（`crontab -u`）、日志/备份目录属主、preflight 与首跑全部归 `servers.json.user`。
  所以**仍不做**「让 install.sh 整体以普通用户跑」：那会让它内部的目录 `chown` 依赖
  免密 sudo，只配 `sudo.password` 的机器会回归失败。见 [backup-deploy.md](backup-deploy.md) §4.4。
- **删除服务器**：仍不做（主键与 `servers.state.json` / default 的一致性处理没必要为
  低频动作引入）。**新增服务器已于 2026-11-06 补上**（§12.6）：空清单是首次使用的
  必然状态，只让编辑已有条目等于半个功能。
- **不「自动」把脚本内置默认值写进本机 env**：默认值只显示在 placeholder / 一键填入的
  表单里，落盘仍要人点「填入推荐默认值」→「保存本机配置」→ 输入 `yes`（§12.7）。
  `PG_SSH_OPTS` 是旧 exe 没下发 `default` 时唯一的兼容兜底，这串与
  `pg_backup.sh` / `pg_restore.sh` / `backup.env.example` 逐字一致，
  口径见 [backup-monitor.md](backup-monitor.md) §3.3。
  🔴 页面**不猜**默认值：一律读 `env-schema.json`；凭证与 `default` 为空的键不给默认值。

### 12.5 远端值对照（2026-11-06 追加）

**为什么**：`servers.json` / 本机 env / 远端 env 是三份不同的东西，只看本机配置无法判断
「改了到底生效没有」。抓一次远端现值，在**编辑本机配置的每个输入框下方**就地显示，
比单独开一个对比页少一次跳转；另留「对比远端配置」次入口，兜住表单里没有输入框的键。

**接口**：`GET /api/config/compare?component=&name=` → 只读，走
`ops backup compare-env <组件> --server <name>` 子进程（与 sync-env 同一条注入链路）。

- 服务端只回**掩码**：凭证字段的 `remote` / `local` 都是 `已配置 · /ro…est`；
  是否变化由 `state` 表达，页面拿不到明文。
- `state` 四种：`consistent` / `changed` / `remote-only` / `local-only`。
  凭证的一致性用指纹（`shared.EnvFingerprint`）判断，不比较明文。
- 失败（远端未安装 / 无读权限 / ssh 不通）回 `ok=true` + `data.error`，
  页面只在状态条给一条集中提示，本机表单照常可编辑，不往 13 个输入框下面各刷一条错误。
- 不缓存、不写任何文件；不进 `opMu`（只读抓取不该把「检查全部」堵在后面）。

**两个必须提示的坑**：

1. 「仅远端有」的键在编辑表单里**没有输入框**（如 `PG_LOCAL_RETENTION_DAYS`），
   收进底部折叠区；且 `sync-env` 是**整份覆盖**，这些项会随同步从远端消失。
2. 凭证只能看出「变了」，看不出「变成了什么」——私钥路径/密码永远不回显。
3. 🔴 **失败响应的数组字段必须是 `[]`，不能是 `null`**。Go 把 nil slice 编成 `null`，
   而抓取失败时视图只填了 `error`、`components` 还是 nil；页面一句
   `compare.components.find(...)` 就抛 `Cannot read properties of null (reading 'find')`，
   配置页整个白屏（2026-11-06 真机，正是「远端抓不到」时最容易撞上）。
   所有返回路径都从 `emptyCompareView()` 起，`component.fields` 同理；前端在
   `configApi` 的请求边界再用 `normalize*View` 挡一层（旧 dist / 旧 exe 混跑时也要活着）。
   失败原因照旧放 `data.error`，页面显示「远端值暂不可用」而不是白屏。
   顺带把 `ErrorBoundary` 下沉到每个页面：一页崩了顶部工具栏（重启 / 关闭界面 /
   快捷方式）还在，白屏时才有自救的入口。

**交互原型**：[config-compare.html](config-compare.html) 是本节设计阶段的静态交互原型
（单文件 HTML，双击即可打开，无需构建），用假数据演示四种 `state`、输入框下方的就地对照
与「仅远端有」折叠区，可切换组件、场景与视图。**保留并同步维护**：原型读起来比文档快，
改了实现或判据时一起回改；**它是设计稿不是实现**——以 `web/src/features/config/` 与本节
判据为准，原型与判据不一致时一律以本节为准。环境组件页的同款处置见 §13 /
[components.md](components.md) §8。

🔴 原型 `META` 里的字段标签 / 分组名、以及 `PG_REMOTE` / `MINIO_REMOTE` 里少数几个
**演示默认值**，判据是 [internal/shared/env-schema.json](../internal/shared/env-schema.json)
（见 [config.md](config.md) §4），不是原型自己定；它只演示部分键，其余 IP / 库名 / 凭证是
刻意造的「远端与本机不同」假数据。`go test ./...` 的 `TestEnvSchemaPrototypeAligned`
会逐项比对，改了 schema 忘了回改原型会直接红。

### 12.6 配置不全不挡路 + 在界面里加第一台服务器（2026-11-06 追加）

**为什么**：换电脑后 `ops init` 生成的是空 `servers.json`，原来的 `serveIndex` 会回一页
503「配置还没准备好」把人挡在界面外 —— 可界面里恰好就有「配置」页和「打开清单」的入口。
而配置页当时只能**编辑已有**服务器，空清单时保存按钮是灰的，最后还得去编辑器手敲 JSON。
两处叠起来，等于「为了省事做的工具，第一次用反而最费事」。

**服务端**：

- `serveIndex` 一律返回 SPA；`setupErr` 只用于启动日志，不再拦页面。
- `GET /api/servers` 配置缺失时回 **200 + `setup_error` + `servers: []` + 默认
  `servers_file`**（不是 503），前端才拿得到路径去给「打开清单」按钮；真正需要清单的
  写操作（check / apply-sudo / 部署）仍各自回 503。
- 本机配置编辑走 `shared.FallbackConfig()`（与 `LoadConfig` 同一套路径规则，不要求
  `ops.env` 存在）：`GET /api/config`、`POST /api/config/backup-env`、
  `POST /api/open-servers-file`、`ui.reload()` 都走它。
  🔴 **远端动作（sync-env / compare / CLI）仍严格 `LoadConfig`**，不许拿默认路径冒充目标机。
  2026-11-07 起 `LoadConfig` 对未知 `PASS_UP_OPS_*` 键直接报错（拼错 / P2·P3 幽灵键 /
  旧主机键 / 环境变量误写进文件都会给出原因，见 [config.md](config.md) §1）：
  `configForEditing()` 把这条错误原文带进配置页展示，`reload()` 仍回退默认值，
  所以人能在界面里看到原因、手工改完刷新即可，**不会白屏**。
- 新增 `POST /api/config/servers` 的 `mode=add`：字段白名单多一个必填 `name`、不许重名；
  `addServersFile()` 与编辑模式共用 `.tmp` 全量校验 + `.bak` + 原子替换（0600），
  **不新增第二条写入路径**；同样要 `confirm=="yes"`，同样受备份任务在跑时 409 的门。

**前端**：

- 落地页把 `setup_error` 渲染成一条**可操作**的引导卡片：「去配置页新增服务器」、
  「打开 servers.json」、「重新加载」，而不是一条红色报错 + 一张空表。
- 配置页在 `servers: []` 时自动进「新增」模式（表单多一个 `name` 输入框），顶部显示
  `setup_error`；保存成功后 `onServersChanged()` 让一直挂载着的服务器管理页重新取数，
  不用刷新、不用重启界面。
- 页面间只传一个 `version` 计数，不引状态库 / 路由（§7 的触发条件仍未达到）。

**没变**：双击落地页仍只读；新增服务器是**本机写操作**，不连任何远端；四个写动作一律
`POST` + token + Origin + `confirm=="yes"`。

### 12.7 换电脑后的默认值提示（2026-11-07 追加）

**为什么**：换电脑后配置页一片「未配置」，看着像 20 个字段都要重新填。其实默认值
**早就存在**：`ops.env` 的 4 个路径键由 `FallbackConfig()` 按配置目录推导、
`DEPLOY_DIR=/opt/passup-backup`、`SRC_DIR` 留空＝用编进二进制的脚本；`backup.env`
每个键的 `default` 在 `internal/shared/env-schema.json`，已生成进
`backup.env.example`、脚本 `${KEY:-默认值}`、Makefile 与文档；新增服务器的
`port=22` / `role=backup` / `sudo_mode=nopasswd` 也已预填。
断掉的只有一环：`GET /api/config` 的 `envField` 不带 `default`，前端
`envInputPlaceholder()` 对所有未配置字段一律写「未配置」（原来只有 `PG_SSH_OPTS`
一个特例）。截图里那行红字「远端配置不存在…设备可能还没安装备份能力」是
`compare-env` 抓取失败，与默认值无关。

**接口**：`envField` 增加 `default`，由 `envDefaultFor(defs, key, secret)` 只查 schema。
🔴 三类键恒为空串，不许猜：凭证键（否则凭证跟着 exe 跑）、schema `default` 为空的键
（`PG_SSH_HOST` / `PG_SSH_KEY` 等人填项，以及 `MINIO_CONTAINER_NAME` 跳过检查、
`UPLOAD_LIMIT` 不限速、`ALERT_WEBHOOK` 不推送这类「留空即关闭」开关）、
文件里冒出来的未知键。空值语义由 `${KEY:-}` 兜底判定承担，见
[config.md](config.md) §4 与 §12.4。

**前端**：`normalizeConfigView` 对旧 exe 缺字段补 `''`、凭证强制清空（旧 dist / 旧 exe
混跑不白屏）；未配置输入框的灰字改成「未写入配置（默认值：X）」——只陈述状态、
**不承诺留空可用**；新增 `fillableDefaults()` 与「填入推荐默认值」按钮，**只改表单**，
仍要走「保存本机配置」+ `confirm=="yes"` 才落盘。已配置、人已填过、凭证、无默认值的项
一律不动；没有可填项时按钮置灰。

**为什么不「打开页面就自动写满文件」**：① 空值是有语义的，写满会静默改掉
`install.sh` / `preflight` 的 `[ -z ]` 判定；② 凭证键不许有默认值；③ 默认值写进
每台电脑的本地 env = N 份副本，以后改 schema 一处，已有文件不跟随 ——
`PG_LOCAL_RETENTION_DAYS`「模板 7 / 脚本 3」的漂移就是这么来的。
反过来，远端 `preflight_pg.sh` 的 `check_required_var` 要求 `backup.env` 里真有
`PG_BACKUP_ROOT` 等键，所以显式「一键填入 + 保存」让本机配置更接近安装期的
`backup.env.example`，同步到远端后反而少一处漂移；这是人的显式选择，不是页面偷偷写。

**2026-11-07 晚文案修正（真机踩坑）**：第一版灰字写「留空即用默认：X」，底部说明还写
「留空即可生效，不必逐项填写」。装 k4 时被截图打脸：远端 `backup.env` 没写
`PG_BACKUP_ROOT`，预检照报「未配置」，`install.sh` 退出码 1。默认值确实存在，但那是
**备份脚本运行时**的 `${KEY:-默认值}` 兜底；预检是**配置完整性**门禁，按「文件里有没有
显式这一行」判定，两者判据不同，页面却把前者说成了「整机可用」。
现在：灰字只说「未写入配置（默认值：X）」+ 建议值；配置页用一条 warning 说明条讲清
后果与动作链（填入推荐默认值 → 保存本机 + yes → 同步远端 + yes）；「填入推荐默认值」
按钮补 hover 说明；保存确认弹窗再补「留空的字段不会写入文件，预检仍会判未配置」。
🔴 不改 `preflight_pg.sh` 的必填判据，也不在前端硬编码「哪些键必填」第二份清单：
唯一事实源仍是 `env-schema.json`，说明条只举 `PG_BACKUP_ROOT` 为例。
`config.test.ts` 用 `doesNotMatch(/留空即用|即可生效|不必.*填写/)` 锁住文案不再回退。
`ops init` 的 CLI 提示同步改掉「模板里的键留空即用默认路径」：那说的是 `ops.env`
路径键（留空由 `FallbackConfig()` 推导，确实生效），与 `backup.env` 正好相反，
同款措辞留在仓库里会继续误导，现在一句里点明两套的区别。

**没变**：双击落地页只读；四个写动作仍 `POST` + token + Origin + `confirm=="yes"`；
`sync-env` 仍整份覆盖，远端独有项仍要显式提示；路径仍由服务端解析、接口不收路径。

### 12.8 显式清空已配置字段（2026-11-07 夜追加）

**为什么**：「凭证不回显 + 空值 = 保持不变」少了反向的一环 —— 字段填错后
（真机把 `PG_SSH_KEY` 填成了口令 `12345678`），页面只显示「已配置」，既看不到错值
也没有清空入口，只能绕开工具手工改文件；而这个错值又被 `preflight_pg.sh` 原样打进
界面日志，等于「页面不许看、日志随便看」。`PG_SSH_KEY` 是**私钥文件路径**不是口令，
密码框让人更容易填错，所以保存时还要挡一道格式。

**契约**：`POST /api/config/backup-env` 增加可选 `clear: string[]`。空值仍恒为
「保持不变」（老前端不发 `clear`，行为完全不变）；只有 `clear` 里显式列出、且文件里
确实有这一行的键，才写成 `KEY=""` 并计入 `changed`，其余行 / 注释原样保留。
同一键既有新值又在 `clear` 里时以新值为准。前端 `envSavePayload()` 负责去重与互斥，
页面只在**已配置**字段右侧给「清空 / 撤销清空」按钮，勾选后输入框禁用、提示
「保存后将清空此项」，确认弹窗点明有几项被清空。四个写动作仍 `POST` + token +
Origin + `confirm=="yes"`，0600 + `.bak` + 原子替换照旧。清空只写本机，
**仍要显式「同步到远端」**才生效 —— 清掉 `PG_SSH_KEY` 后，远端脚本会退回 ssh
默认密钥，不再指向一个不存在的路径。

**私钥路径的三处收敛**：

- `env-schema.json` 的 notes 写清「填备份端机器上的私钥文件绝对路径，不是口令；
  工具不搬运私钥；留空用 ssh 默认密钥」，`ops __gen-backup-env` 同步进
  `postgres/backup.env.example`；
- `validateEnvValueFor("PG_SSH_KEY", v)` 保存时拒绝非绝对路径，错值不再藏进
  不回显的凭证里等部署才暴露；
- `preflight_pg.sh` 的「存在 / 不存在」两行**都不再回显路径**（硬约束 8），
  失败时只说「`PG_SSH_KEY` 指向的文件在备份端找不到」并给出修复提示。

**没变**：双击落地页只读；同步仍整份覆盖；路径仍由服务端解析、接口不收路径；
`clear` 不是「删除这一行」，写成空值才能让 `configured=false` 且脚本走 `${KEY:-}` 兜底。

### 12.9 单账号口径（2026-11-08）

曾短暂引入的「配置 → 服务器清单 → 只读监控账号」区块、`monitor_*` 白名单字段、
保存时的 `MonitorSSHTarget()` 强校验与跳转定位，**已整体移除**。

- 2026-11-08 起安装、检查与备份监控共用清单里的 `user`/`key`；
  配置页「服务器清单」只编辑这一套账号，没有第二套表单。
- 「只读」指远端采集脚本不写文件、不提权（`StatusSSHTarget()` 清空 sudo 密码），
  不是给账号降权；账号与边界见 [backup-monitor.md](backup-monitor.md) §6 / §12.1。
- 旧 `servers.json` 里残留的 `monitor` 对象是历史字段：JSON 反序列化忽略，
  不删、不报错、不参与校验；配置页用 map 解码保存时会原样保留它。
- 🔴 别再把「必须有 monitor」加回 `normalize()` 或采集入口：那会让现有清单
  全部加载失败，也让「一个账号」这件事重新变复杂。

### 12.10 回归要点

- 单账号（§12.9）：`TestStatusSSHTargetUsesSingleAccount`（复用清单 user/key、
  不带 sudo 密码、历史 `monitor` 字段被忽略、root 登录也能加载）与
  `TestLoadServersValid` 里的 status target 断言；
- 配置缺失 / 空清单：`TestIndexServedWithoutConfig`（页面仍回 SPA）、
  `TestConfigViewWorksWithoutConfig`（配置页 200 + `setup_error` + 两份 env）、
  `TestConfigEnvSaveWorksWithoutConfig`、`TestAddServerIntoEmptyList` /
  `TestAddServerCreatesMissingList` / `TestAddServerRejectsBadFields`、
  `TestConfigRecoversAfterConfigFixed`（补完刷新即可）；
  前端 `config.test.ts` 的 `newServerInitial` 与 `setup_error` 归一化；
  端到端记录见 [one-click-launch.md](one-click-launch.md) §8；
- `go test ./internal/ui ./internal/backup .`：凭证脱敏、值转义（含 `$(id)`）、
  未知键 / 换行拒绝、清单保留未知字段、非法 `sudo.mode` 不落盘、`.bak`、二次确认、
  未知 name 404、任务忙 409、占位符拒绝同步、runner 参数 `sync-env pg --server <name>`、
  **对照接口失败/解析失败时数组仍是 `[]`**、**`resolveBackupExe` 换身后落到正式 exe**；
- `go test ./...` 的 `TestEmbeddedBackupSSHDefaultsAligned`：锁住 `pg_backup.sh` /
  `pg_restore.sh` / `backup.env.example` 与界面 placeholder 的 `PG_SSH_OPTS` 默认值
  逐字一致（含 `accept-new`），防止三处漂移；
- `cd web && npm test && npm run typecheck && npm run build`：`config.test.ts` 的
  「空值 = 保持不变」「只提交改动字段」「保存本机 ≠ 同步远端」、
  「`PG_SSH_OPTS` 未配置时只提示默认值、不写进表单」、
  「`components: null` / `fields: null` 不白屏」；
- 默认值（§12.7）：Go 侧 `TestReadEnvFieldsExposesSchemaDefaults` /
  `TestReadEnvFieldsNoMinioSecretDefaults` 锁住「目录/数值有默认、凭证与
  留空即关闭的开关恒空、未知键不猜值」；前端 `config.test.ts` 锁住
  「灰字只说状态 + 默认值、不含『留空即用 / 即可生效 / 不必填写』承诺词」
  「保存确认弹窗点明留空过不了预检」「旧 exe 缺 `default` 归一化补空串」与
  `fillableDefaults` 不覆盖人填的值、不碰凭证；
  `TestEmbeddedBackupSSHDefaultsAligned` 仍锁 `PG_SSH_OPTS` 四处逐字一致；
- 显式清空（§12.8）：Go 侧 `TestEditEnvFileClear`（清空 / 空值不变 / 新值优先 /
  未知键与文件里没有的键）、`TestConfigEnvClearViaAPI`（`clear` 走 HTTP + `confirm` 门）、
  `TestEditEnvFileRejectsBadInput`（口令当私钥路径被拒）；前端 `config.test.ts` 锁住
  `envSavePayload` 的去重 / 互斥与确认文案；`go run . __gen-backup-env` 后
  `backup.env.example` 与 schema 的 notes 一致；
- 真机：临时配置目录起实例 → 点「配置」→ 改一项非凭证值保存，核对文件与 `.bak` →
  改 `user` 后确认提示重新免密 sudo → 点「同步到远端」后到目标机核对 `backup.env`
  内容与 0600 权限，且 crontab / 脚本 mtime 没变。

## 13. 环境组件页（2026-11-06；2026-11-07 接入更新 / 卸载）

第 3 个导航项「环境组件」，一个**组件目录 + 选中详情**页（`web/src/features/components/`）。
判据与完整设计见 [components.md](components.md)（§8 的更新 / 卸载**已落地**）；
这里只记界面相关的边界。交互原型
[components-prototype.html](components-prototype.html) 按 §12 的约定**保留并同步维护**
（2026-11-07 已按实现回改 CLI / 注册表 / 接口 / 代理 / `/data`，并去掉全部
「设计态 · 未接入」标注；同夜补齐「备份依赖」区与 `image-copy` 的来源机清单门禁，
见 `components-prototype-map.md`），读的时候以本节与 `components.md` 的判据为准。

**为什么是一个页而不是两个**：Docker → MinIO → mc mirror 是同一条引导链路，
依赖门、任务锁、增量日志都是同一份状态；拆成两个导航页会第一次引入跨页共享状态，
且以后每加一个组件就多一项，窄屏退化成横向 Menu 时先撑不住（§7）。
新增组件只加一条后端注册表声明，目录自动多一行、按钮按声明的 `Verbs` 自动出现。

**接口**：

| 方法与路径 | 作用 |
|---|---|
| `GET /api/components/status?name=` | 只读体检：组件状态、按组件 `preflight`、`images`、`local`（本机凭证标记）、**`actions`（Go 侧算好的写动作计划）** |
| `POST /api/components/run` | `{verb:"install"\|"update"\|"uninstall"\|"image-copy", component, name, confirm:"yes", password?, proxy?, image_ref?, from_server?, purge_data?, ack_downstream?}` |
| `GET /api/components/images?name=` | 只读：某台服务器**本地**的 MinIO 镜像清单（「从服务器复制」的来源候选；失败回 `collected=false` + `error`） |
| `POST /api/components/image` | multipart：`verb=image-load` + `component=minio` + `name` + `confirm=yes` + `password?` + `image`（.tar） |
| `GET /api/components/task?after=` | 与备份部署共用同一个后台任务 / 增量日志 |

- 全部要 token；写操作 `POST` + `Origin` 校验（§4）。
- `run` 的附加参数各归其位并由服务端 `component.ValidateActionFlags` 再验一次：
  `proxy` 只 `install` / `update docker`；`image_ref` 只 `update minio`（必须是体检采到的
  已导入镜像）；`purge_data` 只 `uninstall minio`（默认 false）；
  `ack_downstream` 是 `uninstall docker` 的**必填**确认。
  `image-copy` 不走 `ValidateActionFlags`：`from_server` 必填且必须是清单里的另一台
  （源 ≠ 目标，未知 404），`image_ref` 只需过字符集——「必须在源机本地存在」
  由 CLI 侧的只读清单再验（`components.md` §9）。
- `/api/components/image` **不接收任何本机路径**：临时 tar 由服务端 `os.CreateTemp`
  生成、multipart 文件名只用于提示；任务结束（含预检失败 / 409）一律删除。
- 失败响应的数组仍是 `[]` 不是 `null`（§11.4 的同款坑），前端
  `normalizeStatusView` / `normalizeActions` 再兜一层。

**六道门**（照抄 §9，五个写动作各一套，见 `components.md` §6）：
`confirm=="yes"` → 服务端先跑 `--dry-run` → `name` 只认清单、组件/动词只认注册表
（`RunnableVerb` / `SupportsImage` / `SupportsImageCopy`）+ 附加参数门 → 密码只经 runner 的 stdin →
任务脱离请求、单任务 409、增量日志 → 🔴 **不开放 `--force`**；
删数据是独立勾选项且默认不勾，卸引擎的连带影响必须勾选才能提交。
预检与正式动作带**同一组**附加参数，否则「预检过了」不代表正式动作会这么跑。
`image-copy` 的门多一条：来源服务器也必须是清单里的 `name`（未知 404、等于目标机 400），
候选镜像只来自 `GET /api/components/images` 的源机只读清单（`components.md` §9）。

**安装 / 更新 Docker 的可选代理**：确认弹窗多一个「本次走代理」勾选 + 地址输入，
只认 `http://host:port`，由服务端 `component.ValidProxy` 二次校验（前端仅用于禁用按钮）；
`runComponentTask` 把 `--proxy` 同时加进预检与正式动作，临时作用于远端 apt/curl，
**不落任何远端系统配置**。详见 `components.md` §3.1。

**页面判定（2026-11-07 改）**：🔴 能否执行、阻塞原因、影响清单、附加勾选项全在
`actions[组件id][]` 的 `ActionPlan` 里，由 Go 侧 `BuildActions` 按注册表与体检结果算；
前端只做 `plan.available && !busy`，**不在前端复算指标**。
六个场景（都未装 / 仅引擎 / 两者正常 / MinIO 有新版 / 引擎有新版 / 检查失败）的
按钮门见 `components.md §8.1`。详情里的检查项与阻塞项随选中组件切换。

**统一确认弹窗**：三个写动词共用一个 Modal，标题 / 说明 / 影响清单 / 提交按钮文案 /
必勾项 / 目标镜像下拉全部取 `ActionPlan`；提交条件是「手输 `yes` + 勾齐 `required`
项 + 选好候选镜像」。删数据默认不勾、卸引擎必勾，打开弹窗时所有附加勾选一律重置。
旧二进制没下发 `actions` 时回退到静态安装文案，且按钮因 `available=false` 恒禁用。

**离线镜像区（两条取镜像的路，2026-11-07 追加第二条）**：上半是
「选择本机 .tar → 导入到远端」（`image-load`，multipart），下半是
「来源服务器 + 从服务器复制…」（`image-copy`）。后者打开弹窗时现拉
`GET /api/components/images?name=<源机>` 做镜像下拉，`collected=false` 时按钮禁用并
提示「没采到 ≠ 没有镜像」——判据在 `utils/format.ts` 的 `copyReady`，
Go 侧 `component` 包再按源机清单验一次引用。两条路都不 online pull。

**界面样式**（2026-11-06 修）：本页最早整页写 inline style，跟另外三页脱节：
`.card` 本身没有内边距，5 个 `section` 直接塞内容会贴边、彼此还连成一条白条；
日志用了深色底，与全站 light 主题（`.backup-log`）冲突；`.hint` 自带 12px
下外边距，作为 flex item 会把同一行的按钮 / Select 挤歪；表格末行与外层边框
叠成双线，目录行只有 `cursor:pointer` 而没有 hover / 键盘反馈；详情区在
「没采到版本」时会把 `installHint` 同一句话显示两遍。
现在统一收敛到 `src/index.css` 的 `.component-*`：面板内边距与卡片间距、
表格（选中 / hover / 焦点）、浅底日志、行内与块级说明、可选代理块；
原生 file input 换成 antd 按钮 + 隐藏 input（重复选同一个文件也能触发）。
新增区块照抄这套 class，不要再写整页 inline；目录行是 `tabIndex` +
Enter/Space 键盘可达的，不只靠鼠标。改完 `web/` 仍需 `npm run build`，
且**只有重建 `ops.exe` 后界面才吃到新产物**（见 §11 / 硬约束 26）。

**回归**：`go test ./internal/ui ./internal/component ./internal/restart .` 的组件接口、
六场景按钮门、四份写脚本边界与过期检测用例，`web/test/components.test.ts`，
`cd web && npm test && npm run typecheck && npm run build`。
真机只读验证（都不改远端）：`ops component list --server k1 --json`、
`ops component install minio --server k1 --dry-run`、
`ops component update docker|minio --server k1 --dry-run`（minio 要带 `--image-ref`）、
`ops component uninstall docker --server k1 --ack-downstream --dry-run`、
`ops component uninstall minio --server k1 --dry-run`、
`ops component image-load minio --server k1 --image-tar <本机 .tar> --dry-run`、
`ops component images --server <源机>`、
`ops component image-copy minio --server k1 --from-server <源机> --dry-run`。

---

## 14. 备份监控页（P2+，2026-11-07 夜）

> 能力的采集协议、单账号口径与阶段划分在
> [backup-monitor.md](backup-monitor.md) §5 / §12；本节只讲界面这一层。
> **真机浏览器验收待做**：本机 `go test` / `npm test` / build 全绿，尚未连过真实备份机。

### 14.1 第 5 个导航项，仍然是零路由

`App.tsx` 的 `PageKey` 加 `monitor`、`NAV_ITEMS` 加「备份监控」（放在「备份能力部署」
之后，一个是装、一个是看），`Layout.Content` 里加一个 `hidden` 的 pane：
访问过的页面保持挂载（§7），切回来不重新取数。Go 侧的**单页回退一行没改**——
导航项本来就不用动服务端；这次动的是新增了一个 API（下表）。

页面是纯只读的：没有重跑 / 恢复 / 装依赖 / 改配置的入口，也没有确认弹窗
（恢复是独立能力，见 `docs/backup-restore.md`；界面侧仍是方案、未实现）。
「立即刷新」只重新采集，不算写操作（不改远端、不写本机配置）。

### 14.2 接口与缓存

| 项 | 口径 |
| :--- | :--- |
| 接口 | `GET /api/monitor/status?name=<清单里的 name>[&force=1]`；`force=1` 只由「立即刷新」发 |
| 鉴权 | 与其它 API 同一套：只听回环、token + `Origin`；静态产物仍不过 token（§4） |
| 门禁 | 严格 `LoadConfig` + `LoadServers`（要连远端，不许用 `FallbackConfig` 冒充目标机）；`name` 空 400、未知 404 |
| 账号 | 清单的 `user`/`key`（`StatusSSHTarget()`），与安装同一个账号；不带 sudo 密码，只读由远端脚本保证 |
| 采集 | `context.Background()` + `Collect` 自带 30s 超时，不用 `r.Context()`；刷新页面不掐断 |
| 缓存 | 服务端 30s TTL、强制刷新 5s 最小间隔、`monitorMu` 串行：多标签页刷新合并成一次 SSH |
| 失败 | 连不上 / 配置错一律 **200 + 完整快照**（`cached`、`config_error`、`notice` 是页面提示位）；配置错不缓存 |

🔴 **没有走 `ops status --json` 子进程**：`BackupRunner` 把 stdout / stderr 接进同一个
writer，而 CLI 在 danger 时会往 stderr 打一行 WARN，JSON 会被污染；`ui` 直接 import
`monitor` 包（与 `ui → component` 同向、无环），进程内直采，缓存与注入缝也好测。
两个入口共用 `internal/monitor/collect.go` 的 `CollectForServer`，判据只有一份 `assess()`。

响应把 `monitor.Status` 原样放在 `status` 字段里，外加显示用的元信息：
`server` / `cached` / `age_seconds` / `notice` / `config_error` /
`config_path` / `servers_file` / `thresholds`。数值未采到是 `null` 不是 `0`，
`problems` 恒为数组（§11.4 的同款坑，前端 `normalizeView` 再兜一层）。

### 14.3 页面

- 页头：目标服务器下拉（与 CLI 的 `Resolve` 同序：清单 `default` > 唯一
  `role=backup`，选不出来就要人显式选）、「自动刷新」开关、显式「立即刷新」按钮。
- 问题清单：danger 红 / warn 黄；配置错单独一条 warning + 「去配置页」，
  不与快照里那条 danger 重复显示；强制刷新被限流回一条 info。
- 四张卡（连接 / PostgreSQL / MinIO / 磁盘）只渲染后端字段：`null → —`、
  `0` 老实显示 `0.0`；磁盘那条进度条只是把已有的 `used_pct` 画成宽度。
  底部是远端主机、采集时间、缓存年龄、本机 `ops.env` 与 `servers.json` 路径、
  只读展示的三个判定阈值。
- 60s 自动刷新只在 `active=true`（当前页）时跑，切去别的页停定时器；
  配置页保存清单后 `version` 变化会重新拉目标机列表。
- 🔴 **前端不算指标**：`utils/format.ts` 只有单位拼接、数组兜底、默认机选择与文案；
  danger / 阈值 / 新鲜度全在 Go 侧。本 feature 没有 `service.ts`（判据见 §2）。

### 14.4 回归要点

`go test ./internal/ui ./internal/monitor`（401 / 门禁 / 完整快照 / 30s TTL /
5s 限流 / 配置错不缓存 / 脱敏 / 连接失败仍完整快照）、
`web/test/monitor.test.ts`（`null` 与 `0` 的区别、数组兜底、默认机同序）、
`cd web && npm test && npm run typecheck && npm run build`，
最后 `go build -o ops.exe .`（改了 `web/` 必须重建产物，见 §3 / 硬约束 19）。

真机验收（都不改远端）：`ops status --server <备份机>` 与浏览器页面对照同一份快照；
点「立即刷新」两次看 5s 限流提示；在备份机上确认清单账号能读到心跳 / 日志 /
`.dump`，且没有任何文件被写（安装与监控同一个账号，不必另配只读账号）。

