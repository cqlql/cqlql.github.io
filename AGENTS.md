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

## 图标使用规范

项目使用 [Iconify](https://icon-sets.iconify.design/) 图标系统（`theme.ts` 中 `plugins.icon.assets: "iconify"`），主题的导航栏、侧边栏图标均通过 iconify 渲染。

**格式**：必须使用 `前缀:图标名` 格式，不可使用无前缀的短名称。

**常用前缀**：
| 前缀 | 图标集 | 适用场景 | 搜索入口 |
|------|--------|----------|----------|
| `mdi:` | Material Design Icons | 通用 UI 图标（最广泛） | https://icon-sets.iconify.design/mdi/ |
| `devicon:` | Devicon | 编程语言/技术栈 | https://icon-sets.iconify.design/devicon/ |
| `bi:` | Bootstrap Icons | 通用 UI 图标 | https://icon-sets.iconify.design/bi/ |
| `logos:` | SVG Logos | 品牌/技术 Logo | https://icon-sets.iconify.design/logos/ |
| `carbon:` | Carbon Icons | IBM 设计系统图标 | https://icon-sets.iconify.design/carbon/ |

**已使用的图标记录**：

```yaml
# 目录级图标（.config 文件）
docs/前端/css/.config:             material-icon-theme:css
docs/前端/js/.config:              material-icon-theme:javascript
docs/前端/nodejs/.config:          devicon:nodejs
docs/前端/ts/.config:              devicon:typescript
docs/前端/vue/.config:             logos:vue
docs/后端/数据库/mysql/.config:     devicon:mysql
docs/后端/数据库/postgresql/.config: devicon:postgresql

# 文件级图标（markdown frontmatter）
linux/网络/wget 递归抓取链接.md:                     mdi:network-outline
其他/终端/curl.md:                                   mdi:console
前端/react/性能优化hooks.md:                          mdi:lightning-bolt
前端/react/useEffect基础.md:                          mdi:refresh
前端/react/useEffect-副作用管理.md:                    mdi:sync
前端/react/useState-useRef.md:                        mdi:code-tags
前端/react/useEffect-同步setState警告.md:              mdi:alert-outline
前端/react/核心概念.md:                                devicon:react
后端/云原生/k3s/介绍与安装.md:                          mdi:server
后端/云原生/k3s/Ubuntu高可用部署.md:                    mdi:server
后端/云原生/k3s/VIP方案选型.md:                        mdi:lan
后端/云原生/k3s/Kube-vip部署.md:                       mdi:lan
后端/云原生/k3s/常用命令速查.md:                        mdi:console
后端/云原生/etcdctl客户端.md:                          mdi:database-outline
后端/云原生/镜像下载加速实践.md:                         mdi:rocket-launch-outline
后端/存储/MinIO-Bucket划分最佳实践.md:                  mdi:group
后端/数据库/postgresql/增量备份机制与避坑.md:             mdi:plus-circle-outline
后端/数据库/postgresql/单机Docker备份与恢复.md:          mdi:database-outline
后端/数据库/postgresql/工具选型对比.md:                  mdi:compare
后端/数据库/postgresql/k3s环境下的备份与恢复.md:          devicon:kubernetes
后端/数据库/postgresql/pg_dump实操指南.md:              mdi:console
后端/数据库/postgresql/pgBackRest备份策略.md:            mdi:layers-outline
后端/数据库/postgresql/大库全量备份性能优化.md:            mdi:speedometer
后端/架构设计/项目目录结构规范.md:                        mdi:file-tree-outline
项目/面试助手/架构设计/AI问答计费-资产扣减方案.md:          mdi:handshake-outline
```

**添加新图标时**：
1. 到 https://icon-sets.iconify.design/ 搜索合适的图标。
2. 使用 `前缀:图标名` 格式（如 `mdi:home`、`devicon:docker`）。
3. 禁止使用无前缀的短名称（如 `home`、`code`），它们在 iconify 中无法解析。
4. 新增后更新本文档的图标记录。

## 注意事项

- 仅编辑 Markdown 与 `.vuepress` 配置即可扩展站点；勿改动 `node_modules`、`.vuepress/dist`（构建产物）。
- 依赖版本多为 `2.0.0-rc.*`（VuePress 2 RC），升级需谨慎，优先用 `pnpm run docs:update-package`。
- `git-auto-push.bat` 会自动提交全部变更（`git add .`），本地调试产生的临时文件建议放在 `docs/临时/` 或忽略，避免被自动推送。
- 文档语言为简体中文，`lang: zh-CN`。
