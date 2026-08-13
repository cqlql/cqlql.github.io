# AGENTS.md

面向 AI 编码助手的项目指引。本项目是一个基于 VuePress 2（`vuepress-theme-hope` + Vite）构建的**个人开发笔记 / 知识库**静态站点。

## 项目概览

- **类型**：文档站点（VuePress 2 + vuepress-theme-hope），无后端业务代码。
- **包管理器**：`pnpm`（锁定版本 `pnpm@10.30.3`，见 `packageManager` 字段，勿用 npm/yarn）。
- **用途**：开发笔记、速查、学习积累，内容全部为 Markdown。

## 常用命令

```sh
pnpm i                 # 安装依赖
pnpm run docs:dev      # 本地开发（端口 3008）：vuepress-vite dev docs
pnpm run docs:build    # 构建产物到 docs/.vuepress/dist
pnpm run docs:clean-dev# 清缓存后启动开发服务
pnpm run git:auto      # 后台运行 git-auto-push.bat 自动提交并推送
pnpm run docker        # docker-compose 启动 nginx 预览构建产物
pnpm run docs:update-package  # 升级 vuepress 相关依赖（vp-update）
```

> 构建产物目录 `docs/.vuepress/dist` 由 `docker-compose.yml` 挂载进 nginx，对外暴露 `10010:80`。

## 目录结构

```
docs/                      # 主内容目录（被 config.ts 加载）
  README.md                # 首页（使用 <HomeView> 组件）
  .vuepress/               # 站点配置与自定义逻辑
  # ===== 笔记分类目录（共 580 篇） =====
  前端/                     # 前端技术栈笔记（约 290 篇）
  后端/                     # 后端技术栈笔记（约 225 篇）
  linux/                    # Linux 运维笔记
  ai/                       # AI 相关笔记
  项目/                     # 具体项目沉淀
  其他/                     # 杂项（终端、vscode、数学、调试、git 等）
docs-other/                # 另一内容源（theme.ts 中 docsDir 指向此处）
docker-compose.yml
git-auto-push.bat          # 检测变更后自动 git add/commit/push
```

## 笔记目录结构（docs/）

所有笔记按技术域分目录存放，目录即导航结构。新增笔记时优先放入对应分类目录。

### `后端/`
- `java/`：Java 基础、并发编程(JUC)、Spring、Web、持久化、网络协议、构建工具、JWT/JSON 序列化、Docker 部署、Flyway 等（含 `java目录结构规划.md`）。
- `dotnet/`：`csharp/`（C# 语言）、`platform/`（.NET 平台体系：入门/实践/速记、EF Core、LINQ、WebApi、多线程异步、反射、配置文件、异常处理等，57 篇）。
- `数据库/`：`mysql/`、`postgresql/`、`redis/`、备份恢复、JOIN、SQL 术语。
- `云原生 (Cloud Native)/`：`docker/`、`k3s/`、`k8s` 介绍与部署、SpringCloud。
- `devops/`：`ci-cd/`、`observability/`（可观测性）。
- `python/`：基础、fastapi、Django、flask、peewee、包管理、部署、日志。
- `go/`：环境安装、打包发布、文件操作、OpenAPI 自动生成。
- 其它：`存储/`、`架构设计/`、`权限系统/`、`认证与授权/`、`tools.md`。

### `前端/`
- 语言与基础：`js/`（65 篇，含 `dom/` 子目录）、`ts/`（20 篇）、`css/`（30 篇，含 `sass/`、`postcss/`、`布局/`）、`html/`（18 篇）、`svg/`、`web-api/`。
- 框架：`vue/`（46 篇，含 `01_Vue3/`、`02_Vue2/`、`vue-router/`、`Vuex/`、`vuepress2/`）、`react/`（18 篇，含 `old/` 旧版归档）、`nodejs/`。
- 工程化与跨端：`构建工具/`（33 篇：`webpack/`（含 `old/`）、`vite/`、`rollup/`、`gulp/`、`babel/`、`eslint-webpack/`、`prettier/`、`vue-cli5/`）、`electron/`、`taro/`、`wechat/`、`第三方js库/`、`monorepo.md`、`astro.md`。
- 测试：`测试/`（jest 等）。
- 设计：`架构设计/`、`前端目录结构规划.md`（含 Vue/React 的 `features` 分层规范）。
- `踩坑记录.md` 汇总常见坑点。

### `linux/`
`网络/`（SSH/scp、静态 IP、代理、诊断）、磁盘测速、解压缩、进程管理、`apt` 包管理与换源、`find` 查找、shell 快捷键、`systemctl`、`journalctl`、LVM 磁盘分区、WSL 安装等。

### `ai/`
`框架与协议.md`、`AI方案与平台.md`、`AI工具.md`、`AI实时语音.md`。

### `项目/`
`面试助手/` 等具体项目沉淀。

### `其他/`
`终端/`（cmd、powershell、ps7、curl）、`vscode/`、`数学/`、`调试/`、`git.md`、`树莓派.md`、`algolia 搜索部署.md`、`浏览器 url 打开桌面应用 win系统.md` 等。

### `docs-other/`
独立内容源（theme `docsDir` 指向此处），含 `翻墙/`、`工作/`、`学习/`、`临时/` 等，与主 `docs/` 并列构建。

> 注：早期的 `__old__/` 历史归档已于 2026-08 全量梳理并合入 `docs/` 对应分类，该目录已移除。

## 内容编写约定（核心）

站点采用**目录即结构**的约定，自动生成导航与侧边栏，新增内容时请遵循：

1. **目录元数据**：在任意**目录**下放置 `.config` 文件（JSON），控制该目录在导航中的展示：
   ```json
   {
     "title": ".NET",
     "icon": "devicon:dotnetcore",
     "sort": 99
   }
   ```
   > 注意：`.config` 仅作用于**目录**，由 `docs/.vuepress/scripts/build-nav-tree.ts` 的 `readDirConfig()` 读取目录内的 `.config` 文件。
   > `sort` 也可通过文件名前缀实现，如 `01_开始`，构建时 `01_` 前缀会被自动去掉。
2. **Markdown 文件 front matter**：每篇文档建议带：
   ```yaml
   ---
   title: 文档标题
   icon: mdi:home
   sort: 99
   ---
   ```
   > 注意：单篇 `.md` 文件的排序 / 标题 / 图标**只能通过自身 front matter 控制**，由 `buildFileNode()` 读取。
   > **不要**为单个 `.md` 文件创建同名 `.config`（如 `foo.md` 配 `foo.config`）——当前脚本不会读取它，对排序无效。
   > 若某 `.md` 原本没有 front matter，需要排序时请直接在其顶部补 `--- ... ---` 块，而非新增 `.config`。
3. **排序**：
   - 可用 `sort` 字段，或
   - 通过文件名前缀排序，如 `01_开始`，构建时 `01_` 前缀会被自动去掉（见 `utils/nav-generate.ts` 中 `removeBasenameFirstNo`）。
4. **新增分类**：在 `docs/` 下新建分类目录并加 `.config`；若需在顶栏出现，需在 `docs/.vuepress/navbar.ts` 的 `navbarConfig` 中登记对应 key（否则仅作为侧边栏子项，构建时会警告未匹配的菜单）。

## 配置与自定义逻辑

- **别名**：`config.ts` 中 `@` 指向 `docs/.vuepress` 目录，组件中按 `@/components/xxx.vue` 引用。
- **插件**：`slimsearchPlugin`（全文搜索）、以及一个自定义 `modifyTitle` 插件（用 `removeBasenameFirstNo` 修正路由标题）。
- **导航自动生成**：`navbar.ts` 调用 `utils/nav-generate.js` 读取目录结构，将 `navbarConfig` 中的字符串 key 解析为真实链接；若 key 无对应菜单会 `console.warn`。
- **主题**：`theme.ts` 配置了 `repo: cqlql/node-md`、`hostname`、`pageInfo`（Author/Original/Date/Category/Tag）等。
- **代码高亮（Shiki）**：由 `@vuepress/plugin-shiki` 提供，版本 `@shikijs/core@4.4.2`。`theme.ts` 中 `markdown.highlighter.langs` 当前仅登记 `['bash', 'nginx', 'ini', 'jsx', 'tsx']`。
  - Shiki 4.x **未内置** `caddy`、`logql`、`promql` 等社区扩展语言。若把它们写进 `langs` 数组，会导致 `ShikiError: Language xxx is not included in this bundle`，`docs:dev` / `docs:build` 直接启动失败。
  - 未登记且 Shiki 不认识的语言，会报 `⚠ Missing xxx highlighter, skip highlighting`（警告，服务可跑，但代码块不高亮）。
  - **约定**：Markdown 代码块使用 Shiki 内置语言。PromQL / LogQL 这类查询语言统一用 `sql` 作为代码块语言（已应用于 `后端/devops/observability/` 下笔记）。如需新语言，先确认它存在于 Shiki 内置 bundle，再决定是否加入 `langs` 数组——切勿把 Shiki 不支持的语言名写入 `langs`。

## 图标使用规范

项目使用 [Iconify](https://icon-sets.iconify.design/) 图标系统（`theme.ts` 中 `plugins.icon.assets: "iconify"`），主题的导航栏、侧边栏图标均通过 iconify 渲染。

**格式**：必须使用 `前缀:图标名` 格式，不可使用无前缀的短名称。

**图标集范围（重要）**：`assets: "iconify"` 意味着 **Iconify 生态内的上千个图标集都可使用**，下表只是常用举例，**不是白名单**。挑选图标时以「语义贴切」优先，不必拘泥于 mdi。例如 `tabler:server-cog`、`carbon:process` 等非 mdi 图标同样可用。但注意：不同图标集视觉风格不同（mdi 实心、tabler 描边、carbon 线性），同级目录建议保持风格统一。

**常用前缀（举例，非限制）**：
| 前缀 | 图标集 | 适用场景 | 搜索入口 |
|------|--------|----------|----------|
| `mdi:` | Material Design Icons | 通用 UI 图标（最广泛） | https://icon-sets.iconify.design/mdi/ |
| `devicon:` | Devicon | 编程语言/技术栈 | https://icon-sets.iconify.design/devicon/ |
| `bi:` | Bootstrap Icons | 通用 UI 图标 | https://icon-sets.iconify.design/bi/ |
| `logos:` | SVG Logos | 品牌/技术 Logo | https://icon-sets.iconify.design/logos/ |
| `simple-icons:` | Simple Icons | 品牌/产品 Logo（devicon/logos 中缺失时优先用，如 `simple-icons:minio`） | https://icon-sets.iconify.design/simple-icons/ |
| `carbon:` | Carbon Icons | IBM 设计系统图标 | https://icon-sets.iconify.design/carbon/ |
| `tabler:` | Tabler Icons | 描边风格 UI 图标（语义图标丰富） | https://icon-sets.iconify.design/tabler/ |

**添加新图标时**：
1. 到 https://icon-sets.iconify.design/ 搜索合适的图标，挑选语义最贴切的（不必限定 mdi）。
2. 使用 `前缀:图标名` 格式（如 `mdi:home`、`devicon:docker`、`tabler:server-cog`）。
3. 禁止使用无前缀的短名称（如 `home`、`code`），它们在 iconify 中无法解析。
4. **务必确认图标真实存在**：iconify 中很多「想当然」的名字并不存在（如 `mdi:progress-gear`、`mdi:array`、`mdi:transform`、`mdi:index`、`mdi:float`、`mdi:modules`、`mdi:crud` 都不存在）。写错图标名不会报构建错误，但会渲染空白。
   - **可靠的核实方式**：直接请求 SVG 端点，HTTP 200 即存在、404 即不存在：
     `https://api.iconify.design/{prefix}/{name}.svg`（例如 `https://api.iconify.design/devicon/docker.svg`）。
   - 注意：`https://api.iconify.design/search?query=关键词&prefix=图标集前缀&limit=10` 仅返回「搜索建议」，不能可靠确认某个具体图标名一定存在，勿单独依赖。
5. **技术栈 / 品牌类优先用对应图标集，勿用 `mdi:` 同名占位，勿发明非标准前缀**：
   - 编程语言/框架/技术栈用 `devicon:`（如 `devicon:docker`、`devicon:kubernetes`、`devicon:json`、`devicon:mysql`、`devicon:postgresql`）。即使 `mdi:` 恰好有同名图标（如 `mdi:docker`、`mdi:kubernetes`、`mdi:json`），也应优先用 `devicon:`，风格统一且语义更准确。
   - 品牌 Logo 优先 `logos:` / `simple-icons:`（如 MinIO 用 `simple-icons:minio`）。**严禁**使用 `thesvg-color:`、`custom:` 等不存在的图标集前缀——它们会渲染空白。
6. **常见 mdi 易错名 → 正确替代**（已在本项目出现并修复）：
   | 误写 | 应为 | 语义 |
   |------|------|------|
   | `mdi:array` | `mdi:code-array` | 数组 |
   | `mdi:transform` | `mdi:axis-arrow` | 变换 |
   | `mdi:float` | `mdi:decimal` | 浮动/浮点 |
   | `mdi:index` | `mdi:sort` | 索引 |
   | `mdi:crud` | `mdi:database` | 增删改查 |
   | `mdi:modules` | `mdi:view-module` | 模块 |
7. 新增后更新本文档的图标记录。

## 注意事项

- 仅编辑 Markdown 与 `.vuepress` 配置即可扩展站点；勿改动 `node_modules`、`.vuepress/dist`（构建产物）。
- 依赖版本多为 `2.0.0-rc.*`（VuePress 2 RC），升级需谨慎，优先用 `pnpm run docs:update-package`。
- `git-auto-push.bat` 会自动提交全部变更（`git add .`），本地调试产生的临时文件建议放在 `docs/临时/` 或忽略，避免被自动推送。
- 文档语言为简体中文，`lang: zh-CN`。
- 代码块语言务必使用 Shiki 内置语言（见上方「代码高亮（Shiki）」约定）。不要为了「看起来对」而写 `caddy`/`logql`/`promql` 等 Shiki 不支持的语言名，否则会触发构建失败。
