> 状态：**现行**（2026-11-11 20:3x；P3 应用部署交互原型，28 个 `@section` 锚点 / 1505 行，
> 以 `wc -l` 为准；首版是 2026-11-10 23:4x 的 19 锚点 / 847 行 / 七场景，
> 08:4x 为 23 锚点 / 1145 行 / 八场景，10:0x 为 27 锚点 / 1341 行 / 九场景，
> 12:3x 为 27 锚点 / 1350 行，19:5x 为 28 锚点 / 1482 行 / 十场景，
> 20:3x 定稿为 28 锚点 / 1505 行 / 十场景）。
> **2026-11-11 20:3x §11 的 9 条待拍板按推荐结论拍板 → 评审稿转「已拍板定稿」**：
> 本页 `card-p3b` / `p3b-review` 改列 9 条结论（判据见 `deploy.md` §11.10），
> 锚点数仍 28、十场景不变、正式发布按钮恒禁用；🔴 **P3b-1 未开工**、
> 按 §11.8 另需单独授权，代码仍零改动、没连真机、没真实发布。
> **2026-11-11 12:3x 评审通过、P3a 第一刀开工，12:5x 代码与本地链路验收闭环
> （分册 §9.2）；13:5x 网络恢复后真机补验见 §9.3（界面视图仍未实现）**：
> 本页仍是界面视图的评审基线
> （P3a 是 CLI-only，不加导航项 / 接口 / `web/`）；按分册 §9.1 把五处
> 「`.env` 是 CRLF」写死表述改成**远端只读探测 → 检出 CR 才归一化**，
> 命令基线第 3 条与 `WARN_BASE` 同步改，锚点数不变、行数 +9。
> **2026-11-11 借鉴小程序「上传代码」新增「发版信息」区（4 个锚点）与第 8 个场景
> `release-invalid`；10:0x 评审追问「版本历史」后补齐「发版历史」区（4 个锚点）与第 9 个场景
> `release-history`，判据见 `docs/deploy.md` §10 / §10.4**。
> **2026-11-11 19:5x 用户选「P3b 实现方案先评审」**：分册 `deploy.md` 新增 §11 评审稿，
> 本页原型加第 10 个场景 `p3b-review` 与 `card-p3b` 评审要点区（+1 锚点 / +132 行）；
> 同时按 §9.6 把首版占位目标机名统一成 `k2`、按 §3.4 / §3.5 修掉
> 「流转不落盘 / 四段拉起」写死表述、把首屏「`internal/deploy/` 一个文件都不存在」
> 改成 P3a 已落的事实。🔴 **仍只改文档与原型**：代码零改动、没连真机、没真实发布、
> 一个配置键都没启用，正式发布按钮恒禁用。判据见 `docs/deploy.md` §11。
> **界面视图未实现**：第 8 个导航项仍是方案；`rollback` / `ps` / `logs` / `releases` 未注册。
> **P3a 已落 `ops deploy --dry-run`（CLI-only，2026-11-11 12:3x 评审通过）**，按 11-07
> 拍板只做 `--dry-run` 与 `deploy.sh` 逐条对齐、**不真实发布**；本文件留作
> **界面视图的评审基线与验收用例集**，不删、锚点不重命名；
> 判据权威是 `docs/deploy.md`，原型与分册冲突时**改原型，不是改分册**。

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
| 八个导航项 / 顶部工具栏 / 十个场景 chip / 说明 banner / 页头 | `html-shell` |
| 只读上下文 / 方向链 / 六条常驻红线 | `card-context` |
| 目标机下拉 / 发布范围分段 / 只读预检按钮 / 预检结果格 / 缺前置说明 | `card-select` |
| 发版信息表单 DOM（线上版本号 / 四选一更新类型 / 版本号 / 项目备注 / 取消·上传恒禁用） | `card-release` |
| 只读发版历史折叠区 DOM（按 server 筛选 / 台账表格 / 模拟接口失败空数组 / 保留与空数组红线） | `card-history` |
| 计划三框（将执行的命令 / 影响清单 / 阻塞与警告）/ 草案命令 / 按钮门 | `card-plan` |
| 六阶段条 / 判据快照标签 / 日志区 / 如实报告 | `card-task` |
| P3b 定稿要点区（六道门禁 / 六阶段 / 真机证据缺口 / 9 条拍板结论，静态不发请求） | `card-p3b` |
| 设计注记 / 与分册对照 / 本轮落地记录 / 页脚 | `card-notes` |
| 未来正式发布门禁弹窗 DOM（发版信息回显 / yes / 三项勾选 / **没有 sudo 密码框** / 控件全禁用） | `html-modal` |
| 通用工具 / 状态格 / 阶段条渲染 / 日志 / 报告 / toast | `fn-helpers` |
| 十个场景的静态数据（上下文 / banner / 预检 / 门禁 / 判据日志与报告） | `data-scenes` |
| 发版信息基线 / 台账 / 十场景覆盖值 / `sceneRelease()` | `data-release` |
| 发版历史台账事件流 / 结果枚举 / `historyRows()` 按 server 投影（恒返回数组） | `data-history` |
| 命令基线 / 范围映射 / 影响清单常量 / 警告常量 / 运行时状态（含 `historyServer` / `historyError`） | `data-runtime` |
| 查表投影（场景 + 范围 → 一份计划）/ 能否执行 / 草案命令行 / 预演日志与报告 | `fn-plan` |
| 版本号推算 / 白名单校验 / 表单渲染 / 门禁刷新 / 重置与试填非法值 | `fn-release` |
| 只读发版历史渲染 / 筛选 / 徽标与统计 / `items: []` 接口失败空态 / `toggleHistoryError()` | `fn-history` |
| 主渲染：banner / 上下文 / 预检 / 计划 / 按钮门 / 阶段 / 日志 / 报告 / 历史 | `fn-render` |
| 未来门禁弹窗打开 / 关闭 | `fn-modal` |
| 场景与范围与目标机切换 / 预检 / 预演 / 事件绑定 | `fn-events` |
| URL 参数直达场景 + 首屏渲染 | `fn-init` |

`SCENES` 十个场景键：`ready` / `blocked` / `offline` / `locked` / `build-failed` /
`health-fail` / `busy` / `release-invalid` / `release-history` / `p3b-review`；
`grep -n "^  '\?[a-z-]*'\?: {"` 定位，不必读整个静态数据区。
🔴 `p3b-review` 是 **§11 P3b 已拍板定稿的静态判据快照**（19:5x 新增评审稿、20:3x 9 条按推荐结论拍板）：
`available=true` 但 `phases` 全 `wait`（方案态、没开始执行），`blockers:[]` +
`warnings` 按其它场景同口径投影；**不改 `planFor()` 的门禁、不触发动作、
不发请求、不写台账**，正式发布按钮仍恒禁用。要点在 `card-p3b`，不要往
`data-scenes` 里塞实现细节。
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

计划分三层：`PLAN_BASE` 是七条命令基线（19:5x 已按 §3.4 / §3.5 / §3.6 把第 5 条改成
「落盘 + 断点续传」、第 6 条改成两个 compose 单元、第 7 条补启动窗口），
`SCOPES` 按发布范围（`all` / `infra` / `ai` / `backend` / `web`）给命令索引子集与一句说明
（`all` 的 note 不再是四段顺序），`validateRelease()` 再叠一层发版信息门禁；
`planFor()` **只查表投影、不计算指标**，实现里整份来自服务端下发的只读计划，
前端只渲染。`IMPACT` / `WARN_BASE` 抽成常量再被引用。
🔴 场景对象用 `baseCtx()` / `preOK()` 工厂生成上下文，**不能在自身初始化过程中引用
`SCENES`**（TDZ 会直接 `ReferenceError`）；十个场景都照工厂写，别写回 `SCENES.ready.xxx`。
🔴 场景与范围是**正交维度**：场景只管门禁与判据，范围只管命令子集，别在 `planFor()` 里
按范围挑场景。

## 维护约定

- 新增或拆分区块 → 同步补一个 `@section` 锚点 + 本表加一行；锚点名定下后不改，行号不写进本文。
- 本文只索引**单个 HTML 文件内部**；`AGENTS.md` 的「文档速查」仍是能力文档的唯一索引，
  本仓原型总清单见 `docs/prototype-conventions.md` §1。
- 🔴 判据权威是 `docs/deploy.md`（§2 命令 / §3 六段流程 / §5 阶段与两刀 / §6 风险表 /
  §8 方案键 / §9 本轮交付口径 / **§10 发版信息 / §10.4 版本历史 / §11 P3b 已拍板定稿（§11.10 九条结论）**）；
  **原型与分册不一致时改原型**。19:5x 已按 §9.6 把占位目标机名统一成 `k2`
  （k1 是备份服务器、不是部署目标；`prod` 只是台账 / 下拉里的静态示例机），
  并修掉 `PLAN_BASE` 里「流转不落盘 / 四段拉起」的写死表述。
  实现落地后还要给 `docs/ui.md` 补对应一节再回看原型。
- 原型是静态交互速览：**不连远端、不发网络请求、不执行任何动作**；切换场景只改内存里的
  静态数据，弹窗控件全禁用。原型里的正式发布命令 / `rollback` / `ps` / `logs` /
  `releases` 仍是草案、未注册，不要照抄执行；🔴 唯一已注册的是 CLI 侧的
  `ops deploy ... --dry-run`（P3a 只读预演，验收见 `deploy.md` §9.2），
  界面视图仍未实现。
- 🔴 六条口径不能写回旧说法：① 第一刀只有 `--dry-run`，**没有正式发布按钮**（「正式发布」
  与「上传 / 正式发布」都恒禁用，P3b 才开放且要单独授权）；② **预演不是执行凭证**，
  报告固定带「本次仅预演、未改动远端」；③ `locked` / `build-failed` / `health-fail`
  是运行期结果、不是预演阻塞；④ 不 `down -v`、不删 `/data`、Flyway 单向只回滚镜像
  且失败后如实说明「需要前向修复」；⑤ 发版号白名单且**不是镜像 tag**、备注不写远端、
  线上版本号未采集不猜 0、预演不落台账、校验失败挡住计划；
  ⑥ **版本历史 append-only**：预演 / 门禁阻塞不入账，真正执行的成功 / 失败 / 回滚都留痕，
  回滚另记一条不改旧记录，只读、不自动清理、不接备份能力，接口失败回 `items: []` 不白屏。
- 🔴 **§11 P3b 已拍板定稿（19:5x 评审稿 → 20:3x 9 条按推荐结论拍板，七条口径不变）**：
  ① 一句「继续」不算授权，正式发布要一次明确授权且只对当次任务有效；② 六道门禁缺一不可、
  默认拒绝兜底，`--dry-run` 不拿锁；③ 失败停在当前阶段、不写「部署成功 / 服务已恢复正常」；
  ④ 默认逐镜像 gzip 落盘 + 断点续传、一次只 load 一个、每步看余量，
  「流转不落盘」只是可选快路径；⑤ 拉起是两个 compose 单元、健康门必须
  「启动窗口内连续 2 次 200」；⑥ **健康门失败不自动回滚**（结论 C，已修 §3.6 矛盾）、
  P3b 首刀仍 **0 新键**（结论 F）；⑦ 台账入账界线仍是「有没有真正开始执行」，
  不加 `running` 起始事件（结论 E）。其余结论：窗口 **150 s 内置**（D）、
  tar.gz **成功即删 / 失败人工清**（A）、52 键**由人核对且结论只在当次**（B）、
  **CLI-first 拆 P3b-1/2/3**（8）、**默认每轮构建 + `--no-build` 快路径**（9）。
  `card-p3b` / `p3b-review` 只是静态判据展示；🔴 **P3b-1 未授权开工**，
  正式发布按钮恒禁用，每批次单独授权。
- 🔴 发版信息区（`css-release` / `card-release` / `data-release` / `fn-release`）是
  **静态模拟**：唯一判据是服务端 `ValidateRelease`（`deploy.md` §10.3），
  版本推算 / 上次填写都只在内存里改数据，不写台账、不写 `state.env`、不发请求。
- 🔴 发版历史区（`css-history` / `card-history` / `data-history` / `fn-history`）同样是
  **静态模拟**：`HISTORY_BASE` 是内存对象，不读 `deploy-releases.jsonl`、不发
  `GET /api/deploy/releases`、不写任何文件。实现里唯一入口是服务端只读接口
  （`deploy.md` §10.4.2）；🔴 **失败必须回 `ok=true` + `data.error` + `items: []`**，
  数组恒为 `[]`、不能是 `null` 或 `ok:false`（`ui.md` §11.4-5 / §12.5-3 的白屏事故口径）。
  历史区**没有**编辑 / 删除 / 重发按钮，也不改变 `planFor()` 的门禁。
- 🔴 `fn-init` 的 `?scene=` 正则已允许数字（`[a-z0-9-]+`）：第 10 个场景键
  `p3b-review` 含 `3`，旧正则 `[a-z-]+` 会把它截成 `p` 而静默回到首屏 `ready`。
  新增含数字的场景键时别改回旧正则；19:5x 已用 DOM 桩对十个场景做过渲染冒烟。
- 🔴 目标机**只来自 `servers.json` 的 name**（`--server <name>`），不接受任意 host；
  备份机与部署目标可同可不同，别把备份监控 / 手动备份的「目标机 = 备份机」口径抄过来。
  私钥路径不打印；写动作未来必须 `yes` + 勾选 + 服务端预检门，弹窗**没有 sudo 密码框**
  （沿用 P0 免密 `sudo -n`，确需一次性密码也只经 stdin）。
- 🔴 `locked` / `build-failed` / `health-fail` 的日志与报告顶部都标「判据预置 · P3b / P4」：
  第一刀不真实发布，这些结果**不会出现**，只用来钉死文案；不要把判据快照写成真机结论。
- 🔴 **CRLF 不是写死前提**（2026-11-11 12:3x 按分册 §3.2 改）：本机检出的
  `docker/.env` 是 **LF**，判据必须来自**远端只读探测**（检出 CR / 未检出 / 文件不存在，
  结论写进报告），只有检出 CR 才在正式发布路径归一化。已同步五处：
  `card-context` 常驻红线第 2 条、`baseCtx()` 的 `lint`、`SCENES.ready` 警告、
  `PLAN_BASE[2]`、`WARN_BASE[0]`；**别改回「`.env` 是 CRLF，统一转 LF」**。
  分册 §4 同时按真实 `deploy.sh` 校正：脚本里没有 `docker tag`、Step 4 是整目录
  `rsync --delete`，P3a 逐条对齐以真实脚本为准。
- 改完按 `docs/prototype-conventions.md` §5 验收：锚点数与本文状态行对账、slug 无重复、
  表格第二列引用无悬空、注释配对、内联 JS 语法检查（`node --check` 或等价编译校验）。
