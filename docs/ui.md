> 状态：**现行**（2026-11-05 起）。界面已从「单文件 `index.html` + 原生 JS」迁到
> Vite + TypeScript + React + antd，产物构建后嵌入二进制；鉴权模型没变。
> 同日起双击 `启动运维.cmd` 直接开这个页面（隐藏后台守护 + 单实例），形态见
> [one-click-launch.md](one-click-launch.md) §4.4，本文只讲界面与接口。
> 未实现的 P2/P3 页面按本文件 §7 的触发条件再加。

# 界面（`ops ui`）

只读查看服务器清单与检查结果；会改远端的写操作只有「一键免密 sudo」一个，
另有 `POST /api/shutdown` 只关本机界面进程、不碰远端。
接口、清单与 sudo 的规则分别见 [servers.md](servers.md) 与 [config.md](config.md)，本文只讲界面本身。

## 1. 为什么不再用单文件 HTML

2026-11-05 之前是 339 行的 `internal/ui/index.html`：手写 DOM、原生 JS、零构建。
它对「一张表 + 两个按钮」是合适的，但 P2 的 `ops status`（四张卡 + 问题清单）与
P3 的 `ops deploy`（步骤进度 + 实时日志）一定会来，届时这个文件会破千行，
而它既没有类型、也没有一处可测的判定逻辑。

迁移的判断是**成本随时间上升**：现在搬是搬一张表，晚点搬是搬一张表加两个复杂视图。

| 被否的方案 | 为什么不选 |
| :--- | :--- |
| 继续单文件，拆成 `index.html` + `app.js` + `app.css` | 零构建，但 P3 的步骤表格 / 日志流仍要手写，判定逻辑依旧没有测试 |
| 服务端 `html/template` 渲染 | 模板只能出静态 HTML，弹窗与行内 loading 仍要 JS，等于两套渲染 |
| Svelte / Vue（体积更小） | 与同机另一个本地工具 `wsl-manager/web` 技术栈不一致，跨项目复用的收益归零 |
| 立刻加 `react-router` + `zustand` | 现在只有一页。加了只会多一个「刷新时 URL 上没有 token」的问题（见 §7） |

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
    App.tsx                      ConfigProvider(zhCN) + ErrorBoundary + 页面
    index.css                    全局样式（只此一份，没建 styles/ 目录）
    features/
      servers/                   一个能力一个目录（将来 P2/P3 各一个兄弟目录）
        api.ts                   只发请求：list / check / applySudo
        service.ts               编排：先检查 → 问密码 → apply → 失败回查
        types.ts                 与 Go 的 ServerInfo / ServerStatus 逐字对齐
        utils/status.ts          状态 → {text, tone}；按钮能不能点
        utils/server.ts          user@host:port、role 中文、私钥/密码提示
        components/ServersTable.tsx   表格（只渲染，判定全在 utils/）
        pages/ServersPage.tsx    取数 + 拼装 + UI 状态（loading / busy / 弹窗）
        index.ts                 对外只导出 ServersPage
    shared/
      api/http.ts                唯一请求底座：令牌、信封、401、ApiError
      ui/ErrorBoundary.tsx       跨能力的渲染兜底
      utils/time.ts              formatShortTime（业务无关）
  test/*.test.ts                 node --test：utils + service + shared/utils
webdist.go                       //go:embed all:web/dist（根包，package main）
```

🔴 **没有 `router/`、顶层 `pages/`、`shared/domain/`、`hooks/`、`store/`** ——
不是漏了，是母本第二节那条「目录是长出来的」：现在只有一页、一个能力、
零个跨页面共享状态。出现第二个文件时才建目录，别为了结构完整先铺空壳。

`features/servers/` 里为什么有 `service.ts`：`applySudo` 是「先检查 → 判断是否已配好 →
问密码 → apply → 失败回查」的五步编排，属业务细节，不该写在页面里；
而 `api.ts` 只做「一个函数一个接口」，不写判断。判据见母本 §4 那张表。

## 3. 产物怎么进二进制

- 🔴 **`//go:embed` 的路径不能出现 `..`**，所以嵌 `web/dist` 的 Go 文件必须和 `web/` 同级 ——
  那就是仓库根的 `webdist.go`。`internal/ui/` 拿不到它，只能**接收**一个 `fs.FS`
  （`ui.CmdUI(args, static)`）。副作用是好的：测试可以塞 `fstest.MapFS`，
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
| `/api/shortcut` | 是 | `POST`，额外校验 `Origin`；只碰本机桌面（建 `.lnk`），**不依赖配置是否齐全** |
| `/api/shutdown` | 是 | `POST`，额外校验 `Origin`；只结束**本机**界面进程（退出码 0），不改远端 |

- 静态产物不过 token 是**有意的**：真正的边界是 API —— 拿不到 token 就调不通任何接口，
  页面本身只是空壳。服务只监听 `127.0.0.1`，见 AGENTS.md 硬约束 14。
- 写操作额外校验 `Origin`：有 `Origin` 头且不等于本服务源 → 403（挡别的网页借浏览器打本机）。
  `POST /api/shutdown` 也走这条，所以别的网页关不掉这个面板。
- token 只活在**内存 + 地址栏 + 配置目录的 `ui.json`（0600）**，不写 `localStorage`：
  `ops ui` 每次启动都换新 token，存进 localStorage 只会让人分不清「当前这个后端」和「上一个」。
  `ui.json` 是给第二次双击「把浏览器指回已有实例」用的，见 [config.md](config.md) §1。
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

ops ui                    # 前台：打印带 token 的地址并自动开浏览器
ops ui --no-open          # 不自动开浏览器（验收 / 脚本）
启动运维.cmd               # 双击：隐藏后台托管 + 自动开浏览器 + 单实例
启动运维.cmd --fg         # 前台跑 ops ui，保留窗口看 stdout
启动运维.cmd --menu       # 交互菜单（只读预检 / 远端自检等入口）

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
- 🔴 **后台守护不给「重启」按钮**：本仓没做退出码 75 自重建 / `ops.exe.new` 换身，
  源码改动请手动 `go build -o ops.exe .`（改了 `web/` 先 `npm run build`）。

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
| `react-router` | 出现**第二页**，且需要「刷新后停在那页」或「把链接发给别人」 | 一页用不上；而路由会带来「刷新时 URL 丢了 token」的额外问题 |
| `zustand`（或别的 store） | 三个以上视图共享异步状态 | 一个视图里 `useState` + `useCallback` 就够 |

单页回退已经在 Go 侧做好了（非 `/api`、非 `/assets` 的 GET 都回 `index.html`），
加视图时**不用动 Go**。

## 8. 已知代价

- 二进制约 +950 KB（gzip 后 303 KB），几乎全来自 antd。
- 构建从 1 步变 2 步；全新 clone 未构建时页面是「怎么构建」的说明页。
- 多了一条 npm 依赖链，需要偶尔 `npm audit`。
- 换来的是：类型约束、组件现成、P3 的 `Steps` / `Progress` / 日志容器不用手写，
  以及**判定与编排第一次有了测试**（`test/` 21 个用例，含 7 个走 service 流程的）。
