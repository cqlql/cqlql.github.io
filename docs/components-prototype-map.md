> 状态：**现行**（2026-11-07 起；第一档「让文件可寻址」落地，35 个 `@section` 锚点）。

# components-prototype.html 分区索引

单文件原型（1436 行，约 25k tokens）。改动前**不要通读全文**：

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
| 卡片 / 表格 / 详情 / 离线镜像 / 日志样式 | `css-cards` |
| 确认弹窗 / 表单 / toast / 响应式 | `css-modal` |
| 导航项 / 工具条 / 场景切换按钮 / 页头 banner | `html-shell` |
| 全局状态条 / 依赖链 / 执行身份说明 | `card-global` |
| 组件目录表列名 / 未来组件位 | `card-catalog` |
| 详情区 / 三个动词按钮 / 预检 / 离线镜像区 DOM | `card-detail` |
| 全量体检 / 任务日志 / 配置摘要 / 设计注记 | `card-checks` / `card-task` / `card-config` / `card-notes` |
| 确认弹窗 DOM（yes / 勾选 / 目标镜像 / 代理 / 密码） | `html-modal` |
| 五态标签文案 | `data-state-tags` |
| 加 / 改组件声明 `COMPONENTS`（Go 注册表的演示镜像） | `data-components` |
| 七个场景的静态数据（banner / rows / 版本 / 镜像） | `data-scenes`，场景键定位见下 |
| **改某个弹窗文案**，如「MinIO 更新弹窗」 | `confirm-minio-update`（`confirm-<组件>-<动词>` 共 8 个，含 `confirm-minio-image-load` / `confirm-minio-image-copy`） |
| 切场景默认选中哪个组件 | `data-scene-focus` |
| 按钮能否点 / 禁用原因 / 目标镜像候选 | `fn-plan` + `fn-render` |
| 安装预检 blockers / warnings | `fn-preflight` |
| 目录 / 详情渲染、状态点、提示语 | `fn-render` |
| 场景 / 目录 / 文件选择事件、任务模拟 | `fn-scene-events` / `fn-events` |
| 弹窗提交门 / 代理格式校验 | `fn-modal` |
| `?scene=&comp=` 直达参数 / 首屏渲染 | `fn-init` |

`SCENES` 七个场景键：`absent` / `dockerOnly` / `healthy` / `minioUpdate` / `dockerUpdate` /
`minioDegraded` / `failed`；`grep -n "  <键>: {"` 直接定位，不必读整个 `data-scenes` 区。

## 维护约定

- 新增或拆分区块 → 同步补一个 `@section` 锚点 + 本表加一行；锚点名定下后不改，行号不写进文档。
- 命名规则：`docs/<主体文件名去扩展名>-map.md`。本文件只服务 `components-prototype.html`；
  将来 `config-compare.html` 若加锚点就叫 `config-compare-map.md`，不要再用不带主体前缀的泛名。
- 本文只索引**单个 HTML 文件内部**；`AGENTS.md` 的「文档速查」仍是能力文档的唯一索引。
- 本档只解决「读哪里」：加第三个组件仍要改 7 处（`data-scenes` / `fn-derive` / `fn-plan` /
  `fn-render` / `data-confirm` 等）；治改动面属第二档「声明式化」，本轮未做。
