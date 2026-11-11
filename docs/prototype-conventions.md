> 状态：**现行**（2026-11-08 起；本仓单文件原型落地口径；同日带锚点原型扩到三份
> （`backup-restore-prototype.html` / `backup-once-prototype.html`），§1 清单已同步；
> 同日晚手动备份原型随代码落地转为「交互回归基线」，不删、不改锚点）。
> **2026-11-10 扩到四份**：新增 `deploy-prototype.html` / `deploy-prototype-map.md`
> （P3 方案 · 待评审 · 七场景验收用例集，§1 清单已同步）。
> **2026-11-11 08:4x**：`deploy-prototype.html` 借鉴小程序「上传代码」新增发版信息区与
> 第 8 个场景 `release-invalid`（23 锚点 / 1145 行 / 八场景），判据见 `deploy.md` §10。
> **同日 10:0x 补齐版本历史**：新增只读「发版历史」区与第 9 个场景 `release-history`
> （27 锚点 / 1341 行 / 九场景），判据见 `deploy.md` §10.4（台账改成 append-only 的
> 正式发布尝试事件流、失败 / 回滚留痕、只读接口失败回 `items: []`）。
> 两轮都**只改文档与原型、代码未实现**，§1 清单与 `deploy-prototype-map.md` 已同步。

# 本仓单文件原型约定（实例）

> 本文件**自包含**：以后在本仓加原型、或给现有原型补锚点，只读这一份就够，**不必打开外仓**。
> 通用判据与「为什么」在 `cqlql-notes/docs/工程/单文件原型分区锚点约定.md`（母本），
> 本文件不复制母本，只写**本仓执行口径 + 本仓路径 + 本仓原型清单**；两者冲突以母本为准，
> 但本仓照本文件执行即可。母本读不到不影响落地。
>
> 定位：本文件是「怎么加原型」的约定，不是索引。各 HTML 内部区块由对应的
> `<主体>-map.md` 索引，能力文档仍以 `AGENTS.md` 的「文档速查」为唯一入口。

## 1. 本仓有哪些原型

| 原型 | 行数 | `@section` 锚点 | 分区索引 | 判据权威 |
| :--- | :--- | :--- | :--- | :--- |
| `components-prototype.html` | 1827 | 42 个 | `components-prototype-map.md` | `components.md` / `ui.md` §13 |
| `backup-restore-prototype.html` | 759 | 19 个 | `backup-restore-prototype-map.md` | `backup-restore.md` §3–§5 / §7（代码已实现 · 交互回归基线；真机只读 §7.3 + 写演练 §7.4 + 工具侧 PG 正式恢复 §7.6 均已跑；`psql` 吞错修复 §7.7 已在 §7.8 部署并真机验证） |
| `backup-once-prototype.html` | 706 | 19 个 | `backup-once-prototype-map.md` | `backup-once.md` §2–§4 / §8（代码已实现 · 交互回归基线；2026-11-10 按七场景完成真机验收，逐条见 §8.1） |
| `deploy-prototype.html` | 1341 | 27 个 | `deploy-prototype-map.md` | `deploy.md` §3 / §5 / §6 / §9 / §10 发版信息 / §10.4 版本历史（**方案未实现** · 九场景评审基线与验收用例集；第一刀只做 `--dry-run` 对齐、不真实发布、上传恒禁用；发版历史只读折叠区） |
| `config-compare.html` | 590 | 无 | 无 | `ui.md` §12.5 |

行数为 2026-11-08 快照（`deploy` 行为 2026-11-11 补齐版本历史后的版本），以 `wc -l` 为准。
🔴 原型标「方案 / 未实现」时，判据权威仍是能力分册；实现落地后要给 `ui.md` 补对应一节再回看原型。
🔴 原型只是**交互速览**，判据以能力分册为准；原型与分册不一致时改原型，不是改分册。

## 2. 什么时候才上锚点

三条全满足才做：① 必须单文件 `file://` 双击可开；② > 500 行或一次会话里会反复改；
③ 改动以局部为主（改文案、加一区、调样式）。

`config-compare.html` 590 行、只服务 §12.5 的设计对照，暂无频繁局部改动 → **现在不加**；
一旦开始反复改它，按 §3 补锚点 + 建 `config-compare-map.md`。

🔴 生产代码（`web/`、`internal/`）不用这套：模块 / 组件边界本来就可寻址，加锚点是重复建设。

## 3. 加原型 / 补锚点的固定步骤

1. **命名**：`<主体文件名去扩展名>-map.md`，与 HTML 同目录，**一文件一份 map**；
   不用 `prototype-map.md` 这类泛名（第二个原型出现就会被误读成「所有原型的地图」）。
2. **埋锚点**：格式 `==== @section <slug> ==== <人话说明>`，按所在语言包注释 ——
   HTML `<!-- -->` / CSS `/* */` / JS `//`。第一个锚点固定为 `index`，
   只写一句「改本页前先查 `<主体>-map.md`」。
3. **分区**：一区 30~80 行；**一个区的终点就是下一个锚点**，不写结束标记、不嵌套。
   slug 唯一、小写连字符，前缀 `css-` / `html-` / `card-` / `data-` / `fn-`；
   热点子锚点用 `confirm-<组件>-<动词>`。**slug 定下后不改**。
4. **写 map**：照 `components-prototype-map.md` 的结构 —— 状态行 + `grep -n "@section"` 用法 +
   「改 XX 去哪」表（**人话任务 → slug**，不写行号）+ 大静态数据区的键定位法 + 维护约定。
   表按任务写，不按文件顺序复述目录（那是 `grep -n` 的活）。
5. **登记**：`AGENTS.md` 文档规则加一行、文档速查表加一行；对应能力分册留一句指针。
6. **纯补锚点那次**：`git diff --unified=0` 确认**只有注释行变化**，内联 JS 跑 `node --check`。
   🔴 锚点只能是可grep的注释，不是运行时标记，不参与任何逻辑。

## 4. 改原型时的固定动作

🔴 **先读 map，不要通读 HTML**：

```bash
grep -n "@section" docs/<主体>.html        # 拿实时行号（map 里不写行号，就是为这个）
# → Read offset=<行号> limit=40~80  定点读这一区
# → Edit 定点改，只回传锚点下那一段
```

不确定就再 grep 一个锚点，别「保险起见读全文」。一次最多读 2~3 区；
新增 / 拆了区块要同步补锚点 + 更新 map 表，否则下次会按旧表读错区。

## 5. 验收（在仓根执行，可直接跑）

```bash
grep -c "@section" docs/components-prototype.html                 # 与 map 状态行对账
grep -n "@section" docs/components-prototype.html | sed 's/.*@section \([^ ]*\).*/\1/' | sort | uniq -d   # 应为空
grep -o '@section [a-z0-9-]*' docs/components-prototype.html | awk '{print $2}' | sort -u > /tmp/slugs
grep '^| ' docs/components-prototype-map.md | sed 's/^|[^|]*|//' \
  | grep -o '`[a-z][a-z0-9-]*`' | tr -d '`' | sort -u > /tmp/refs
comm -23 /tmp/refs /tmp/slugs                                     # 应为空
```

⚠️ 最后一步**只能取表格第二列**：对全文反引号做全量匹配会误报 5 个 ——
`image-copy`（CLI 名）、`absent` / `healthy` / `failed`（场景键）、`planned`（状态标签）
都不是锚点。取第二列后实测差异为 0。

再加两项：注释配对（HTML `<!-- -->` / CSS `/* */` / JS `//`）、`node --check` 内联脚本。

## 6. 维护约定

- 本文 §2–§5 是母本 §1 / §3–§6 的**执行摘要**；改母本通用条款时同步本节，
  **本仓不自行改口径**。§1 的清单与表格是本仓特有的，母本不写。
- 本文件不索引任何 HTML 内部区块，也不替代 `AGENTS.md` 文档速查表。
- 别靠锚点解决「加一个组件要改 7 处」：那属于声明式化 / 拆文件，判据见母本 §2。
  三档选型里本仓现在停在第一档「可寻址」，不新增资源文件、不改交付形态。
