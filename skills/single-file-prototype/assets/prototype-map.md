> 状态：**现行**（YYYY-MM-DD；N 个 `@section` 锚点）

# <主体文件名> 分区索引

单文件原型（约 X 行 / 约 Xk tokens；行数会漂移，以 `wc -l` 为准）。改动前**不要通读全文**：

    grep -n "@section" <主体文件>     # 一次拿到全部锚点 + 当前行号

按命中行号定点 `Read offset=<行号> limit=40`，再用 `Edit` 改锚点下的那一段。
锚点格式 `==== @section <slug> ==== 说明`；**一个区的终点就是下一个锚点**。本文不写死行号。
HTML 段用 `<!-- -->`、CSS 段用 `/* */`、JS 段用 `//`。

## 改 XX 去哪

| 要改的东西 | 锚点 |
| :--- | :--- |
| 配色 / 变量 / 导航 | `css-base` |
| 确认弹窗 DOM / 勾选 / 目标镜像 | `html-modal` |
| 改某个弹窗文案 | `confirm-<组件>-<动词>` |
| 加一个卡片 | `card-<名字>` |
| 场景数据 | `data-scenes` |
| 提交 / 渲染逻辑 | `fn-plan` + `fn-render` |

（大静态数据区补一句键定位法，例：`grep -n "  <键>: {"` 直接定位，不必读整个 `data-scenes` 区。）

## 维护约定

- 新增或拆分区块 → 同步补一个 `@section` 锚点 + 本表加一行；slug 定下不改，**行号不写进文档**。
- 本文只索引**单个文件内部**；能力索引仍是 `AGENTS.md` 的「文档速查」表。
- 母本见 `skills/single-file-prototype/`（cqlql-notes 仓）。
