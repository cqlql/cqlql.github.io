> 状态：**现行**（2026-11-11 10:0x；P3 应用部署交互原型，27 个 `@section` 锚点 / 1341 行，
> 以 `wc -l` 为准；首版是 2026-11-10 23:4x 的 19 锚点 / 847 行 / 七场景，
> 08:4x 为 23 锚点 / 1145 行 / 八场景）。
> **2026-11-11 借鉴小程序「上传代码」新增「发版信息」区（4 个锚点）与第 8 个场景
> `release-invalid`；10:0x 评审追问「版本历史」后补齐「发版历史」区（4 个锚点）与第 9 个场景
> `release-history`，判据见 `docs/deploy.md` §10 / §10.4**。
> **方案，未实现**：`ops deploy` / `rollback` 未注册、
> `internal/deploy/` 不存在、界面第 8 个导航项只是方案。本轮按 2026-11-07 拍板只做
> `--dry-run` 与 `deploy.sh` 逐条对齐、**不真实发布**；本文件留作**评审基线与验收用例集**，
> 不删、锚点不重命名；判据权威是 `docs/deploy.md`，原型与分册冲突时**改原型，不是改分册**。

# deploy-prototype.html 分区索引

单文件原型，改动前**不要通读全文**：

```bash
grep -n "@section" docs/deploy-prototype.html     # 一次拿到全部锚点 + 当前行号
```

按命中行号定点 `Read offset=<行号> limit=40~80`，再用 `Edit` 改锚点下那一段。
锚点格式 `==== @section <slug> ==== 说明`；**一个区的终点就是下一个锚点**。行号会漂移，本文不写死行号。
HTML 段用 `<!-- -->`、CSS 段用 `/* */`、JS 段用 `//`。第一个锚点固定是 `index`。

## 改 XX 去哪

| 要改的东西 | 锚点 |
| :--- | :--- |
| 配色 / 变量 / 导航 / 工具条 / 场景条 / 标签 | `css-base` |
| 卡片 / banner / 状态条 / 方向链 / 红线 / 预检格 / 计划框 / 命令表 / 阶段条 / 日志 / 报告 | `css-cards` |
| 发版信息表单 / 线上版本号 / 更新类型 / 台账 / 校验提示 / 上传按钮 | `css-release` |
| 只读发版历史折叠区 / 筛选 / 表格 / 结果徽标 / 空态 / 失败提示 | `css-history` |
| 未来发布门禁弹窗 / toast / 响应式 | `css-modal` |
| 八个导航项 / 顶部工具栏 / 九个场景 chip / 说明 banner / 页头 | `html-shell` |
| 只读上下文 / 方向链 / 六条常驻红线 | `card-context` |
| 目标机下拉 / 发布范围分段 / 只读预检按钮 / 预检结果格 / 缺前置说明 | `card-select` |
| 发版信息表单 DOM（线上版本号 / 四选一更新类型 / 版本号 / 项目备注 / 取消·上传恒禁用） | `card-release` |
| 只读发版历史折叠区 DOM（按 server 筛选 / 台账表格 / 模拟接口失败空数组 / 保留与空数组红线） | `card-history` |
| 计划三框（将执行的命令 / 影响清单 / 阻塞与警告）/ 草案命令 / 按钮门 | `card-plan` |
| 六阶段条 / 判据快照标签 / 日志区 / 如实报告 | `card-task` |
| 设计注记 / 与分册对照 / 本轮落地记录 / 页脚 | `card-notes` |
| 未来正式发布门禁弹窗 DOM（发版信息回显 / yes / 三项勾选 / **没有 sudo 密码框** / 控件全禁用） | `html-modal` |
| 通用工具 / 状态格 / 阶段条渲染 / 日志 / 报告 / toast | `fn-helpers` |
| 九个场景的静态数据（上下文 / banner / 预检 / 门禁 / 判据日志与报告） | `data-scenes` |
| 发版信息基线 / 台账 / 场景覆盖值 / `sceneRelease()` | `data-release` |
| 发版历史台账事件流 / 结果枚举 / `historyRows()` 按 server 投影（恒返回数组） | `data-history` |
| 命令基线 / 范围映射 / 影响清单常量 / 警告常量 / 运行时状态（含 `historyServer` / `historyError`） | `data-runtime` |
| 查表投影（场景 + 范围 → 一份计划）/ 能否执行 / 草案命令行 / 预演日志与报告 | `fn-plan` |
| 版本号推算 / 白名单校验 / 表单渲染 / 门禁刷新 / 重置与试填非法值 | `fn-release` |
| 只读发版历史渲染 / 筛选 / 徽标与统计 / `items: []` 接口失败空态 / `toggleHistoryError()` | `fn-history` |
| 主渲染：banner / 上下文 / 预检 / 计划 / 按钮门 / 阶段 / 日志 / 报告 / 历史 | `fn-render` |
| 未来门禁弹窗打开 / 关闭 | `fn-modal` |
| 场景与范围与目标机切换 / 预检 / 预演 / 事件绑定 | `fn-events` |
| URL 参数直达场景 + 首屏渲染 | `fn-init` |

`SCENES` 九个场景键：`ready` / `blocked` / `offline` / `locked` / `build-failed` /
`health-fail` / `busy` / `release-invalid` / `release-history`；
`grep -n "^  '\?[a-z-]*'\?: {"` 定位，不必读整个静态数据区。
🔴 `release-history` 是 **P3b 只读历史视图判据**，计划仍 `available=true`：
历史只读、不改计划、不参与门禁；只有该场景会把 `<details id="historyCard">` 默认展开
（`fn-history` 里按 `state.scene` 设 `open`），其它场景保持折叠。
🔴 `locked` / `build-failed` / `health-fail` 三个场景的**计划仍是 `available=true`**：
撞锁、构建失败、健康门失败都是**运行期结果**，预演挡不住，不能在 `fn-plan` 里改成全局阻塞；
它们是 P3b / P4 的判据预置，第一刀不真实发布，差异写在各自 `log` / `report` 里。
只有 `blocked`（预检）/ `offline`（连不上）/ `busy`（本地任务锁 409）/
`release-invalid`（发版信息校验）是全局阻塞。
与 `backup-once-prototype.html` 的 `locked` 口径同源，改这里要回看那份 map。

发版信息是第三个正交维度：`data-release` 的 `RELEASE_BASE` + `RELEASE_OVERRIDES`
只提供静态展示值与台账，`fn-release` 的 `validateRelease()` / `bumpVersion()` 是
**原型里的静态模拟**；实现里唯一判据是服务端 `ValidateRelease`，前端只做格式提示与
自动推算，不许拿本地校验当门禁（判据见 `deploy.md` §10.3）。
`sceneRelease(scene)` 只依赖参数、不读 `state`（`data-runtime` 初始化 `state` 时会调它，
反过来会在 TDZ 里炸）；切场景与 `?scene=` 直达都要重新取该场景基线。

发版历史是**纯展示的第四个维度，不进 `planFor()`**：`data-history` 的 `HISTORY_BASE`
字段名与 `deploy.md` §10.2 逐字一致（`ts / server / scope / kind / online_version /
release_version / bump / note / image_tag / result / failed_stage / task_id`），时间倒序；
线上 `1.16.0` 来自最后一次成功 release，`1.16.1` 那次失败并已回滚，所以远端当前值仍是
`1.16.0`，与 `RELEASE_BASE.last` 对得上。🔴 徽标按 `kind` 优先（`historyKind()`）：
`rollback` 单列「回滚」，不混进成功数；`historyRows(server)` **恒返回数组**，
筛选不到也回 `[]`，绝不回 `null`。`state.historyServer` 默认跟随 `setServer()`，
`state.historyError` 只在手动点「模拟只读接口失败」时为真，`setScene()` 会重置。

计划分三层：`PLAN_BASE` 是七条命令基线，`SCOPES` 按发布范围（`all` / `infra` / `ai` /
`backend` / `web`）给命令索引子集与一句说明，`validateRelease()` 再叠一层发版信息门禁；
`planFor()` **只查表投影、不计算指标**，实现里整份来自服务端下发的只读计划，
前端只渲染。`IMPACT` / `WARN_BASE` 抽成常量再被引用。
🔴 场景对象用 `baseCtx()` / `preOK()` 工厂生成上下文，**不能在自身初始化过程中引用
`SCENES`**（TDZ 会直接 `ReferenceError`）；九个场景都照工厂写，别写回 `SCENES.ready.xxx`。
🔴 场景与范围是**正交维度**：场景只管门禁与判据，范围只管命令子集，别在 `planFor()` 里
按范围挑场景。

## 维护约定

- 新增或拆分区块 → 同步补一个 `@section` 锚点 + 本表加一行；锚点名定下后不改，行号不写进本文。
- 本文只索引**单个 HTML 文件内部**；`AGENTS.md` 的「文档速查」仍是能力文档的唯一索引，
  本仓原型总清单见 `docs/prototype-conventions.md` §1。
- 🔴 判据权威是 `docs/deploy.md`（§2 命令 / §3 六段流程 / §5 阶段与两刀 / §6 风险表 /
  §8 方案键 / §9 本轮交付口径 / **§10 发版信息 / §10.4 版本历史**）；**原型与分册不一致时改原型**。
  实现落地后还要给 `docs/ui.md` 补对应一节再回看原型。
- 原型是静态交互速览：**不连远端、不发网络请求、不执行任何动作**；切换场景只改内存里的
  静态数据，弹窗控件全禁用。命令是草案、未注册，不要照抄执行。
- 🔴 六条口径不能写回旧说法：① 第一刀只有 `--dry-run`，**没有正式发布按钮**（「正式发布」
  与「上传 / 正式发布」都恒禁用，P3b 才开放且要单独授权）；② **预演不是执行凭证**，
  报告固定带「本次仅预演、未改动远端」；③ `locked` / `build-failed` / `health-fail`
  是运行期结果、不是预演阻塞；④ 不 `down -v`、不删 `/data`、Flyway 单向只回滚镜像
  且失败后如实说明「需要前向修复」；⑤ 发版号白名单且**不是镜像 tag**、备注不写远端、
  线上版本号未采集不猜 0、预演不落台账、校验失败挡住计划；
  ⑥ **版本历史 append-only**：预演 / 门禁阻塞不入账，真正执行的成功 / 失败 / 回滚都留痕，
  回滚另记一条不改旧记录，只读、不自动清理、不接备份能力，接口失败回 `items: []` 不白屏。
- 🔴 发版信息区（`css-release` / `card-release` / `data-release` / `fn-release`）是
  **静态模拟**：唯一判据是服务端 `ValidateRelease`（`deploy.md` §10.3），
  版本推算 / 上次填写都只在内存里改数据，不写台账、不写 `state.env`、不发请求。
- 🔴 发版历史区（`css-history` / `card-history` / `data-history` / `fn-history`）同样是
  **静态模拟**：`HISTORY_BASE` 是内存对象，不读 `deploy-releases.jsonl`、不发
  `GET /api/deploy/releases`、不写任何文件。实现里唯一入口是服务端只读接口
  （`deploy.md` §10.4.2）；🔴 **失败必须回 `ok=true` + `data.error` + `items: []`**，
  数组恒为 `[]`、不能是 `null` 或 `ok:false`（`ui.md` §11.4-5 / §12.5-3 的白屏事故口径）。
  历史区**没有**编辑 / 删除 / 重发按钮，也不改变 `planFor()` 的门禁。
- 🔴 目标机**只来自 `servers.json` 的 name**（`--server <name>`），不接受任意 host；
  备份机与部署目标可同可不同，别把备份监控 / 手动备份的「目标机 = 备份机」口径抄过来。
  私钥路径不打印；写动作未来必须 `yes` + 勾选 + 服务端预检门，弹窗**没有 sudo 密码框**
  （沿用 P0 免密 `sudo -n`，确需一次性密码也只经 stdin）。
- 🔴 `locked` / `build-failed` / `health-fail` 的日志与报告顶部都标「判据预置 · P3b / P4」：
  第一刀不真实发布，这些结果**不会出现**，只用来钉死文案；不要把判据快照写成真机结论。
- 改完按 `docs/prototype-conventions.md` §5 验收：锚点数与本文状态行对账、slug 无重复、
  表格第二列引用无悬空、注释配对、内联 JS 语法检查（`node --check` 或等价编译校验）。
