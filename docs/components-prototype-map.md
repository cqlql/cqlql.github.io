> 状态：**现行**（2026-11-07 夜；第一档「让文件可寻址」落地，42 个 `@section` 锚点；
> 当夜按实现补齐「备份依赖区」与 `image-copy` 的来源机门禁）。

# components-prototype.html 分区索引

单文件原型（约 1.8k 行，约 32k tokens；行数会漂移，以 `wc -l` 为准）。改动前**不要通读全文**：

```bash
grep -n "@section" docs/components-prototype.html     # 一次拿到全部锚点 + 当前行号
```

按命中行号定点 `Read offset=<行号> limit=40`，再用 `Edit` 改锚点下的那一段。
锚点格式 `==== @section <slug> ==== 说明`；**一个区的终点就是下一个锚点**。行号会漂移，本文不写死行号。
HTML 段用 `<!-- -->`、CSS 段用 `/* */`、JS 段用 `//`；`confirm-*` / `data-*` 是热点区里的子锚点。

## 改 XX 去哪

| 要改的东西 | 锚点 |
| :--- | :--- |
| 配色 / 变量 / 导航 / 场景条 / 标签 | `css-base` |
| 卡片 / 表格 / 详情 / 备份依赖 / 离线镜像 / 日志样式 | `css-cards` |
| 确认弹窗 / 表单 / toast / 响应式 | `css-modal` |
| 导航项 / 工具条 / 场景切换按钮 / 页头 banner / 写动词计数 | `html-shell` |
| 全局状态条 / 依赖链 / 执行身份说明 | `card-global` |
| 组件目录表列名 / 未来组件位 | `card-catalog` |
| **备份依赖区 DOM**（状态表 / PG 主版本 / 安装与卸载按钮） | `card-deps` |
| 详情区 / 三个动词按钮 / 预检 / 离线镜像区 / **来源服务器选择** | `card-detail` |
| 全量体检（演示区）/ 任务日志 / 配置摘要（演示区）/ 设计注记 | `card-checks` / `card-task` / `card-config` / `card-notes` |
| 确认弹窗 DOM（yes / 勾选 / 目标镜像 / **来源机镜像** / 代理 / 密码） | `html-modal` |
| 五态 + `planned` 占位标签文案 | `data-state-tags` |
| 加 / 改组件声明 `COMPONENTS`（Go 注册表的演示镜像） | `data-components` |
| 七个场景的静态数据（banner / rows / 版本 / 镜像） | `data-scenes`，场景键定位见下 |
| 依赖演示数据（items / docs / 卸载计划 / 远端状态） | `data-deps` |
| **改某个弹窗文案**，如「MinIO 更新弹窗」 | `confirm-minio-update`（`confirm-<组件>-<动词>` 共 10 个，含 `confirm-minio-image-load` / `confirm-minio-image-copy` / `confirm-deps-install` / `confirm-deps-uninstall`） |
| 切场景默认选中哪个组件 | `data-scene-focus` |
| 按钮能否点 / 禁用原因 / 目标镜像候选 | `fn-plan` + `fn-render` |
| **image-copy 门禁**（源机只读清单 / `copyReady` / `copyPlan`） | `fn-copy` |
| 安装预检 blockers / warnings | `fn-preflight` |
| **备份依赖**（`depsView` / 两个按钮门 / 表格渲染 / `depsPlanFor`） | `fn-deps` |
| 目录 / 详情渲染、状态点、提示语（含 `renderDeps` 调用） | `fn-render` |
| 场景 / 目录 / 文件选择事件、任务模拟 | `fn-scene-events` / `fn-events` |
| 来源机 / PG 主版本输入、任务结束后状态回写 | `fn-events` |
| 弹窗提交门 / 代理校验 / **卸载至少勾一个** / **源机镜像必选** | `fn-modal` |
| `?scene=&comp=` 直达参数 / 首屏渲染 | `fn-init` |

`SCENES` 七个场景键：`absent` / `dockerOnly` / `healthy` / `minioUpdate` / `dockerUpdate` /
`minioDegraded` / `failed`；`grep -n "  <键>: {"` 直接定位，不必读整个 `data-scenes` 区。
依赖状态与源机镜像清单不走场景键：前者在 `data-deps` / `fn-deps`（`depsState` 由任务模拟改写，
演示「缺 mc → 安装 → 卸载 → 再装」），后者在 `fn-copy`（`SOURCE_IMAGES` 按来源机 name 分，
演示「有镜像 / 有清单但无镜像 / 查不动 collected=false」三种门禁）。

## 维护约定

- 新增或拆分区块 → 同步补一个 `@section` 锚点 + 本表加一行；锚点名定下后不改，行号不写进文档。
- 命名规则：`docs/<主体文件名去扩展名>-map.md`。本文件只服务 `components-prototype.html`；
  将来 `config-compare.html` 若加锚点就叫 `config-compare-map.md`，不要再用不带主体前缀的泛名。
- 本文只索引**单个 HTML 文件内部**；`AGENTS.md` 的「文档速查」仍是能力文档的唯一索引。
- 本档只解决「读哪里」：加第三个组件仍要改 7 处（`data-scenes` / `fn-derive` / `fn-plan` /
  `fn-render` / `data-confirm` 等）；治改动面属第二档「声明式化」，本轮未做。
  备份依赖区（`data-deps` / `fn-deps` / `card-deps`）与复制门禁（`fn-copy`）是独立两条链，
  加第三个组件不必动它们；但改了组件状态语义要回头检查 `fn-copy` 的 `isReady(docker)` 门。
