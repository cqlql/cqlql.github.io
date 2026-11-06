> 状态：**现行**（2026-11-05 起；2026-11-06 导航由顶部 Tabs 改为左侧 Sider + Menu，
> 同日新增全局顶部工具栏与「重启」能力，见 §11）。界面已从
> 「单文件 `index.html` + 原生 JS」迁到 Vite + TypeScript + React + antd，产物构建后嵌入二进制；鉴权模型没变。
> 同日起双击 `启动运维.cmd` 直接开这个页面（隐藏后台守护 + 单实例），形态见
> [one-click-launch.md](one-click-launch.md) §4.4，本文只讲界面与接口。
> **同日新增「备份能力部署」页（第二个 feature）**：预检 / 安装 / 自检。
> 🔴 红线由「界面只读」改为「**双击落地页只读 + 写操作显式二次确认 + 服务端预检门**」，
> 见本文 §9；[AGENTS.md](../AGENTS.md) 硬约束 9/15/21 与
> [backup-deploy.md](backup-deploy.md) §2/§10 已同步。
> 未实现的 P2/P3 视图按本文件 §7 的触发条件再加。

# 界面（`ops ui`）

默认只读查看服务器清单与检查结果；会改远端的写操作有**两个**：「一键免密 sudo」与
「安装 / 升级备份能力」（后者要输 `yes` 且过服务端预检门，见 §9）。
另有 `GET /api/health` / `GET|POST /api/restart`（重启自己，见 §11）与
`POST /api/shutdown`（只关本机界面进程）；三者都不碰远端。
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
| 立刻加 `react-router` + `zustand` | 当时只有一页。加了只会多一个「刷新时 URL 上没有 token」的问题（见 §7；两页后仍只用一个选中态外壳） |

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
    shared/
      api/http.ts                唯一请求底座：令牌、信封、401、ApiError
      ui/ErrorBoundary.tsx       跨能力的渲染兜底
      utils/time.ts              formatShortTime（业务无关）
  test/*.test.ts                 node --test：utils + service + shared/utils
webdist.go                       //go:embed all:web/dist（根包，package main）
```

🔴 **没有 `router/`、顶层 `pages/`、`shared/domain/`、`hooks/`、`store/`** ——
不是漏了，是母本第二节那条「目录是长出来的」：两个 feature 各管各的状态、
零个跨页面共享状态，第二页用 `Sider + Menu` 的选中态切换即可（判据见 §7）。
出现跨页面共享状态时才建目录，别为了结构完整先铺空壳。

`features/servers/` 里为什么有 `service.ts`：`applySudo` 是「先检查 → 判断是否已配好 →
问密码 → apply → 失败回查」的五步编排，属业务细节，不该写在页面里；
而 `api.ts` 只做「一个函数一个接口」，不写判断。判据见母本 §4 那张表。

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
  这是全新 clone 之后最可能看到的第一个状态，所以必须是一页能照做的说明。
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
| `/api/backup/run` | 是 | `POST`，额外校验 `Origin`；`mode=deploy` 必须带 `confirm:"yes"` 且过服务端预检门；只认清单 name（见 §9） |
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
  `ui.json` 是给第二次双击「把浏览器指回已有实例」用的，见 [config.md](config.md) §1。
  ⚠️ 例外：`__takeover`（重启接手）**复用** `ui.json` 里的 token，不换新 ——
  前端 token 没落盘，换掉之后页面轮询 `/api/health` 会一直 401，把成功的重启误报成失败。
  见 §11.4。
- 配置 / 服务器清单读不出来时，页面回 **503 + 一页能照做的说明**（不是白屏、不是 500）：
  `ops init` 生成的是空清单模板，而后台窗口是隐藏的，静默退出等于「双击没反应」。
  每次请求都会重读配置，补完**刷新即可**；API 侧同样回 503 + 中文原因。
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
- **「创建桌面快捷方式」**：页面右上角按钮 → `POST /api/shortcut` → 与 `ops shortcut`
  **同一份实现**（`launcher.CreateShortcutOnDesktop`，由 `main.go` 注入；ui 不反向依赖
  launcher）。只碰本机桌面，配置还没准备好时也能用；非 Windows 回一句明确错误。
  成功时把完整 `.lnk` 路径显示在页面上。
- **停**：点页面右上角的「关闭界面」（`POST /api/shutdown` → 退出码 0），或前台模式下 Ctrl+C。
  后台模式的窗口是隐藏的，没有这个按钮就只能去任务管理器杀进程。
- 🔴 **顶部工具栏有「重启」**：全局头栏（宽屏在内容区顶部、窄屏与横向导航同一条），
  不随页面卸载。它可选「先重建」并换掉 `ops.exe`，源码过期时复选框自动勾上；
  详见 §11。后台守护本身**没有**换身逻辑，接手进程是独立的 detached 进程。

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
| `react-router` | 出现**第二页**，且需要「刷新后停在那页」或「把链接发给别人」 | 第二页（备份能力部署）已出现，但两个条件都不满足：本机回环 + 地址栏带一次性 token，链接发给别人也用不了；「刷新后停在哪个导航项」没有业务价值。用 `Sider + Menu` 的选中态切换，还顺带躲开「刷新时 URL 丢了 token」 |
| `zustand`（或别的 store） | 三个以上视图共享异步状态 | 两个 feature 各管各的 `useState` + `useCallback`；任务日志是单视图内部状态，没有跨视图共享 |

单页回退已经在 Go 侧做好了（非 `/api`、非 `/assets` 的 GET 都回 `index.html`），
加视图、加导航项都**不用动 Go**。

**2026-11-06 起导航放左侧**：`Layout.Sider + Menu`（窗口 < 860px 退化成顶部横向 Menu）。
两个视图是导航项，以后 P2 监控 / P3 部署加视图不用再往顶部标签栏里挤；
窄窗口只是布局变化，切换仍是一次点击。访问过的页面保持挂载、非当前页用 `hidden` 藏起来，
语义与原 `Tabs` 一致：切回来不重新取数，检查结果和备份任务日志都不丢。
仍是**零路由**：选中态只在内存里，刷新回默认的服务器管理页。

## 8. 已知代价

- 二进制约 +1007 KB（gzip 后 321 KB），几乎全来自 antd。
- 构建从 1 步变 2 步；全新 clone 未构建时页面是「怎么构建」的说明页。
- 多了一条 npm 依赖链，需要偶尔 `npm audit`。
- 界面进程多了一份**内存里的任务日志**（上限 256 KB，不落盘、不进 `ops-ui.log`）；
  一个界面同时只跑一个备份任务。
- 换来的是：类型约束、组件现成、P3 的 `Steps` / `Progress` / 日志容器不用手写，
  以及**判定与编排第一次有了测试**（`test/` 28 个用例，其中 7 个覆盖 backup 的编排与判定）。

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
② 安装账号与只读账号不复用；③ 主机只来自 `servers.json`。
变的只有一条：界面**允许**有安装入口，但它必须比 CLI 更严，而不是更松。

### 9.2 六道门（服务端 enforce，前端只是交互）

| # | 门 | 在哪 | 绕过会怎样 |
| :--- | :--- | :--- | :--- |
| 1 | `mode=deploy` 必须 `confirm:"yes"` | `handleBackupRun` | 直接调 API 返回 400，一次命令都不跑 |
| 2 | 服务端先跑 `--dry-run`，非 0 不安装 | `runBackupTask` | 前端没点预检也拦得住；日志写「预检没过」 |
| 3 | `name` 只认清单、`component` 只认 `all/pg/minio` | `handleBackupRun` | 未知 name → 404；不代理任意主机 |
| 4 | 密码单次内存 → 子进程 stdin；日志按行脱敏 | `BackupRunner` / `backupLogWriter` | 明文不进命令行、不落盘、不进 `ops-ui.log` |
| 5 | 任务脱离 `r.Context()`，单任务互斥，日志上限 256 KB | `backupTask` | 刷新页面不打断远端安装；并发 409 |
| 6 | 不发 `--force` / `--run-now` / `--install-deps` | `backupCommandArgs` | 这几个仍是 CLI 专属 |

另外所有写 `POST` 都过 token + `Origin`（§4）；部署期间点「一键免密 sudo」返回 409，
避免两个写动作同时改远端、出事分不清是谁。

### 9.3 接口与任务模型

```
POST /api/backup/run
  { mode: "preflight"|"deploy"|"verify", name, component, password?, confirm? }
  → { started, mode, server, component }        立刻返回，任务在后台 goroutine

GET  /api/backup/task?after=N
  → { running, done, mode, server, component, exit_code, log, next, started_at?, ended_at? }
    log 是 after 之后的**增量**，next 原样喂给下一次请求（字节偏移，中文不会切坏）
```

`preflight` = `backup deploy --dry-run`（只读）、`verify` = `backup verify`，
`deploy` = 服务端先 `--dry-run` 再 `backup deploy`。
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
2. 远端执行身份（`root`）：`rootWrap` 用 `sudo -n sh -c` 提权的结果，**不是配置项**；
3. `backup/{postgres,minio}.env` 的 `PG_SSH_USER` / `*_KEY`：备份脚本每天从**备份端
   连主服务器**拉 dump 用的账号与私钥，跟前两者无关。

`printDryRun` 只打印裸命令、`install.sh` 打印「当前以 root 身份执行」，页面又看不到
sudo 包装层，于是「配置了 cql，日志却说 root」看起来像配置被读错。配置页把这三件事
摆到同一页说清楚，同时解决「不想开编辑器手改配置文件」。

新增左侧菜单「配置」作为**次入口**：不占主路径（服务器管理 / 备份部署）的点击，
双击落地页仍是只读的。

### 12.2 接口与六道门

| 接口 | 作用 | 写哪里 |
|---|---|---|
| `GET /api/config` | 清单字段 + 两份 env 字段 + `exec_chain` | 只读 |
| `POST /api/config/servers` | 保存清单里的白名单字段 | 本机 `servers.json` |
| `POST /api/config/backup-env` | 保存一份本机备份配置 | 本机 `backup/*.env` |
| `POST /api/config/sync-env` | 显式同步到远端 | 远端 `<组件>/backup.env` |

六道门（服务端 enforce，前端只是交互，对应 AGENTS.md 硬约束 23）：

1. 凭证字段（含 `PASSWORD|SECRET|TOKEN|KEY`）**只回显 `configured` 标记**；提交时
   空值 = 保持不变，填新值才覆盖。三个写接口都要 `confirm=="yes"`，`POST` + token + Origin。
2. 路径全部由服务端从 `ops.env` / 配置目录解析，**接口不接收任何路径**；`name` 只认清单，
   组件只认 `pg|minio|all`。
3. 字段白名单：清单不改 `name`（主键，`servers.state.json` 与 default 都按它索引）；
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
- **非 root 安装**：`install.sh` Step 0 硬性要求 `id -u = 0`（写 `/etc/logrotate.d` 与
  crontab）。真要去掉 root 得改脚本架构（用户级 crontab + 日志轮转换方案），另立方案。
- **新增 / 删除服务器**：仍只编辑已有条目，避免引入主键与状态缓存的一致性处理。

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

**交互原型**：[config-compare.html](config-compare.html) 是本节设计阶段的**静态交互原型**
（单文件 HTML，双击即可打开，无需构建）。它用假数据演示四种 `state`、输入框下方的就地对照
与「仅远端有」折叠区，可切换组件、场景与视图。**它是设计稿，不是实现**：
实现以 `web/src/features/config/` 与本节判据为准；原型与判据不一致时以本节为准，
原型不再维护时直接删除，不另建归档目录。

### 12.6 回归要点

- `go test ./internal/ui ./internal/backup`：凭证脱敏、值转义（含 `$(id)`）、
  未知键 / 换行拒绝、清单保留未知字段、非法 `sudo.mode` 不落盘、`.bak`、二次确认、
  未知 name 404、任务忙 409、占位符拒绝同步、runner 参数 `sync-env pg --server <name>`；
- `cd web && npm test && npm run typecheck && npm run build`：`config.test.ts` 的
  「空值 = 保持不变」「只提交改动字段」「保存本机 ≠ 同步远端」；
- 真机：临时配置目录起实例 → 点「配置」→ 改一项非凭证值保存，核对文件与 `.bak` →
  改 `user` 后确认提示重新免密 sudo → 点「同步到远端」后到目标机核对 `backup.env`
  内容与 0600 权限，且 crontab / 脚本 mtime 没变。

