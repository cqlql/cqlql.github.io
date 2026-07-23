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
  __old__/                 # 归档历史内容（不参与主目录）
  # ===== 笔记分类目录 =====
  后端/                     # 后端技术栈笔记
  前端/                     # 前端技术栈笔记
  linux/                    # Linux 运维笔记
  ai/                       # AI 相关笔记
  项目/                     # 具体项目沉淀
  其他/                     # 杂项（终端、git、树莓派等）
  临时/                     # 临时草稿（未被自动推送或长期保留）
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
- 语言与框架：`js/`、`ts/`、`vue/`（20 篇）、`react/`、`nodejs/`、`css/`、`web-api/`。
- 工程化与跨端：`构建工具/`、`monorepo.md`、`astro.md`、`electron/`、`taro小程序/`、`wechat微信小程序/`、`第三方js库/`。
- 设计：`架构设计/`、`前端目录结构规划.md`（含 Vue/React 的 `features` 分层规范）。
- `踩坑记录.md` 汇总常见坑点。

### `linux/`
网络、磁盘测速、解压缩、进程管理、`apt` 包管理与换源、`find` 查找、shell 快捷键、`systemctl`、LVM 磁盘分区、WSL 安装等。

### `ai/`
`框架与协议.md`、`AI方案与平台.md`、`AI工具.md`、`AI实时语音.md`。

### `项目/`
`面试助手/` 等具体项目沉淀。

### `其他/`
`终端/`、`git.md`、`树莓派.md`、`algolia 搜索部署.md`。

### `docs-other/`
独立内容源（theme `docsDir` 指向此处），含 `翻墙/`、`工作/`、`学习/`、`临时/` 等，与主 `docs/` 并列构建。

> 注：`__old__/` 为历史归档，不参与主目录；`临时/` 用于未整理草稿。

## 内容编写约定（核心）

站点采用**目录即结构**的约定，自动生成导航与侧边栏，新增内容时请遵循：

1. **目录元数据**：在任意目录下放置 `.config` 文件（JSON），控制该目录在导航中的展示：
   ```json
   {
     "title": ".NET",
     "icon": "javascript",
     "sort": 99
   }
   ```
2. **Markdown 文件 front matter**：每篇文档建议带：
   ```yaml
   ---
   title: 文档标题
   icon: home
   sort: 99
   ---
   ```
3. **排序**：
   - 可用 `sort` 字段，或
   - 通过文件名前缀排序，如 `01_开始`，构建时 `01_` 前缀会被自动去掉（见 `utils/nav-generate.ts` 中 `removeBasenameFirstNo`）。
4. **新增分类**：在 `docs/` 下新建分类目录并加 `.config`；若需在顶栏出现，需在 `docs/.vuepress/navbar.ts` 的 `navbarConfig` 中登记对应 key（否则仅作为侧边栏子项，构建时会警告未匹配的菜单）。

## 配置与自定义逻辑

- **别名**：`config.ts` 中 `@` 指向 `docs/.vuepress` 目录，组件中按 `@/components/xxx.vue` 引用。
- **插件**：`slimsearchPlugin`（全文搜索）、以及一个自定义 `modifyTitle` 插件（用 `removeBasenameFirstNo` 修正路由标题）。
- **导航自动生成**：`navbar.ts` 调用 `utils/nav-generate.js` 读取目录结构，将 `navbarConfig` 中的字符串 key 解析为真实链接；若 key 无对应菜单会 `console.warn`。
- **主题**：`theme.ts` 配置了 `repo: cqlql/node-md`、`hostname`、`pageInfo`（Author/Original/Date/Category/Tag）等。

## 注意事项

- 仅编辑 Markdown 与 `.vuepress` 配置即可扩展站点；勿改动 `node_modules`、`.vuepress/dist`（构建产物）。
- 依赖版本多为 `2.0.0-rc.*`（VuePress 2 RC），升级需谨慎，优先用 `pnpm run docs:update-package`。
- `git-auto-push.bat` 会自动提交全部变更（`git add .`），本地调试产生的临时文件建议放在 `docs/临时/` 或忽略，避免被自动推送。
- 文档语言为简体中文，`lang: zh-CN`。
