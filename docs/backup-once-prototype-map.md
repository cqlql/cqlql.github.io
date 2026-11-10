> 状态：**现行**（2026-11-08；手动备份原型首版，19 个 `@section` 锚点 / 约 706 行，
> 以 `wc -l` 为准）。**代码已实现、2026-11-10 按 §8 七场景完成真机验收**（逐条见
> `docs/backup-once.md` §8.1）：本文件留作**交互回归基线**，不删、锚点不重命名；
> 判据权威仍是 `docs/backup-once.md`，原型与分册冲突时**改原型，不是改分册**。
> `ready` / `locked` / `failed` / `busy` 真机跑通，`blocked` / `timeout` / `offline`
> 由代码判据 + 单测覆盖；三处判据修正见分册 §8.1 ③，其中弱凭证回显已在 §8.2
> 修复并重新部署验证。

# backup-once-prototype.html 分区索引

单文件原型，改动前**不要通读全文**：

```bash
grep -n "@section" docs/backup-once-prototype.html     # 一次拿到全部锚点 + 当前行号
```

按命中行号定点 `Read offset=<行号> limit=40~80`，再用 `Edit` 改锚点下那一段。
锚点格式 `==== @section <slug> ==== 说明`；**一个区的终点就是下一个锚点**。行号会漂移，本文不写死行号。
HTML 段用 `<!-- -->`、CSS 段用 `/* */`、JS 段用 `//`。第一个锚点固定是 `index`。

## 改 XX 去哪

| 要改的东西 | 锚点 |
| :--- | :--- |
| 配色 / 变量 / 导航 / 工具条 / 场景条 / 标签 | `css-base` |
| 卡片 / 状态条 / 方向链 / 计划框 / 阶段条 / 任务日志 / 报告 | `css-cards` |
| 确认弹窗 / 表单 / 无密码提示 / toast / 响应式 | `css-modal` |
| 七个导航项 / 顶部工具栏 / 场景切换 chip / 说明 banner / 页头 | `html-shell` |
| 只读上下文 / 定时任务恒「不采集」/ 数据方向链（含生产端只读回显）/ 红线常驻区 | `card-context` |
| 组件分段 / 备份机下拉 / 只读预检按钮 / name 与生产端口径说明 | `card-select` |
| 计划三框（将执行 / 影响清单 / 阻塞与警告）/ 实现命令 / 按钮门 | `card-plan` |
| 阶段条 / 日志区 / 结果报告（含手动触发提示） | `card-task` |
| 设计注记 / 与分册对照 / 落地记录 | `card-notes` |
| 确认弹窗 DOM（yes / 两项勾选 / **没有 sudo 密码框**） | `html-modal` |
| 通用工具 / 阶段条渲染 / 状态格 / toast | `fn-helpers` |
| 七个场景的静态数据（上下文 / banner） | `data-scenes` |
| 计划基线 / 影响清单常量 / 场景覆盖 / 运行时状态 | `data-runtime` |
| 查表投影（场景 + 组件 → 一份计划）/ 能否执行 | `fn-plan` |
| 主渲染：上下文 / 计划 / 按钮门 / 阶段条 / 日志 / 报告 | `fn-render` |
| 弹窗门禁 / 打开 / 关闭 | `fn-modal` |
| 场景与组件切换 / 预演 / 分场景日志与报告 / 事件绑定 | `fn-events` |
| URL 参数直达场景 + 首屏渲染 | `fn-init` |

`SCENES` 七个场景键：`ready` / `blocked` / `locked` / `failed` / `timeout` / `offline` / `busy`；
`grep -n "^  [a-z-]*: {"` 定位，不必读整个静态数据区。
🔴 `locked` / `failed` / `timeout` 三个场景的**计划仍是 `available=true`**：撞锁、组件失败、
30 分钟超时都是**运行期结果**，预演挡不住，也不能在 `fn-plan` 里改成全局阻塞。
差异写在 `TASK_LINES`（日志）与 `taskReport()`（报告）里，改这三类文案去 `fn-events`，别动按钮门。

计划分两层：`PLAN_BASE` 按组件（`all` / `pg` / `minio`）给三份基线，`SCENE_PLAN` 按场景覆盖
`available` 与 `blockers`、追加 `warnings`；`planFor()` **只查表投影、不计算指标**，
实现里整份来自 `GET /api/backup/once/plan` 下发，前端只渲染。`blocked` / `offline` / `busy` 才有全局阻塞。
影响清单先抽成 `PG_IMPACT` / `MINIO_IMPACT` 等常量再被基线引用 ——
🔴 场景对象不能在自身初始化过程中引用 `SCENES`（TDZ 会直接 `ReferenceError`）；
加第八个场景时用 `ctx()` 工厂生成上下文，别写回 `SCENES.ready.xxx`。

## 维护约定

- 新增或拆分区块 → 同步补一个 `@section` 锚点 + 本表加一行；锚点名定下后不改，行号不写进本文。
- 本文只索引**单个 HTML 文件内部**；`AGENTS.md` 的「文档速查」仍是能力文档的唯一索引，
  本仓原型总清单见 `docs/prototype-conventions.md` §1。
- 🔴 判据权威是 `docs/backup-once.md`（§2 落点 / §3 执行契约 / §4 四个坑 / §8 验收 / §8.1 验收记录）；
  **原型与分册不一致时改原型**。实现已落地，`docs/ui.md` §15 是界面那层的说明；两处都要回看。
- 原型是静态交互速览：不连远端、不发网络请求、不执行任何动作（即使命令已落地也不变）。
  `ops backup once` / `mode=once` / `mode=once-dry` 已注册并实现；✅ 真机前置已闭环
  （分册 §7.1：21:4x 重新部署后远端两脚本都带 `flock -n 9`），七场景验收结论见 §8.1。
- 🔴 「目标服务器」是**备份机**（脚本执行地 / 备份存放地），被备份的是**生产端**（由该机
  `backup.env` 决定，只做只读回显，不在本页另选）；页头 / 方向链 / 注记都要用这两个词。
- 🔴 两处口径不能写回旧说法：「定时任务状态」是**不采集**（工具不读 crontab，同监控 §3.2 / 恢复 R1），
  不是「运行中 / 已停」；报告只报脚本结果，且必须带「手动触发不代表定时任务正常」。
  弹窗**没有 sudo 密码框**，与安装弹窗不同。
- 改完按 `docs/prototype-conventions.md` §5 验收：锚点数与本文状态行对账、slug 无重复、
  表格第二列引用无悬空、注释配对、内联 JS `node --check`（或等价语法检查）。
