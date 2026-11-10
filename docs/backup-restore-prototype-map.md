> 状态：**交互回归基线 · 代码已实现、真机只读 §7.3 + 写演练 §7.4 均已跑**（2026-11-08；原型首版 19 个
> `@section` 锚点；同日按本页评审定稿 `backup-restore.md` §5 并落地代码）。
> 本页已同步 R1 / R2 文案：「停定时备份」是人工确认状态、工具不读 crontab；
> `--server` 只认备份机。落地回改：标题 / badge / banner / 页头第 7 个导航项 /
> 草案命令 → 已实现命令 / 设计注记 / MinIO 实现差异（对象数不采集、脚本恢复全部桶、
> 只读预演不跑 `mc mirror --dry-run`）。落地记录见分册 §7，界面见 `docs/ui.md` §16。
> 🔴 原型六场景仍是分册 §5.7 的验收用例集：只读判据 19:43 跑通（§7.3），写动作 20:09
> 用户授权后跑通（§7.4，含 MinIO 正式恢复 / 界面失败任务 / PG 临时库数据核对）。
> ✅ 2026-11-10（§7.5 / §7.6）：归档阻塞解除、stdin 坑本仓已修并有真实 ssh 对照实证、
> 只读预演全绿；**新脚本已重新部署，工具侧 PG 正式恢复全链路（`ready`）跑通**
> （rc=0、`PHASE 1→5`、临时库 60 表 / Flyway 47、产物已清理）。
> ✅ 2026-11-10 21:30（分册 §7.7）：`pg_restore.sh` 的 `psql` 吞错在本仓修好
> （globals 输出判错 + 白名单告警 / `.sql` 开 `ON_ERROR_STOP=1`），嵌入产物断言五种改坏全红；
> ✅ 21:4x 已重新部署并在临时库真机验证（分册 §7.8）、环境回基线；
> **原型六场景语义不变**（`blocked` 仍是设计态回归基线）。
> 🔴 仍缺：「脚本中途失败 / 失败桶」运行期场景（不为了造故障去破坏环境）。
> 结论已同步分册状态行 / 本页 / `AGENTS.md` / `docs/ui.md` §16。

# backup-restore-prototype.html 分区索引

单文件原型（约 759 行，以 `wc -l` 为准）。改动前**不要通读全文**：

```bash
grep -n "@section" docs/backup-restore-prototype.html     # 一次拿到全部锚点 + 当前行号
```

按命中行号定点 `Read offset=<行号> limit=40~80`，再用 `Edit` 改锚点下那一段。
锚点格式 `==== @section <slug> ==== 说明`；**一个区的终点就是下一个锚点**。行号会漂移，本文不写死行号。
HTML 段用 `<!-- -->`、CSS 段用 `/* */`、JS 段用 `//`。

## 改 XX 去哪

| 要改的东西 | 锚点 |
| :--- | :--- |
| 配色 / 变量 / 导航 / 工具条 / 场景条 / 标签 | `css-base` |
| 卡片 / 表格 / 状态条 / 方向链 / 计划框 / 任务日志 | `css-cards` |
| 确认弹窗 / 表单 / toast / 响应式 | `css-modal` |
| 导航项 / 顶部工具栏 / 场景切换 chip / 说明 banner / 页头 | `html-shell` |
| 全局状态条 / 数据方向链 / 红线常驻区 | `card-safety` |
| 组件分段 / 目标机选择 / 候选表格 / 汇总数字 | `card-candidates` |
| 动作计划三框（影响 / 阻塞 / 警告）、已实现命令回显、预演与执行按钮 | `card-plan` |
| 阶段条 / 日志区 / 结果报告 | `card-task` |
| 设计注记 / 与分册对照 / 落地同步清单 | `card-notes` |
| 确认弹窗 DOM（库名二次确认 / YES / yes / 三项前置 / 覆盖生产） | `html-modal` |
| 通用工具 / 阶段条渲染 / toast | `fn-helpers` |
| 六个场景的静态数据（候选行 / 安全条） | `data-scenes` |
| 动作计划投影（服务端下发对象）/ 运行时状态 | `data-runtime` |
| 查表投影 / 首个可用恢复点 | `fn-plan` |
| 主渲染：安全条 / 候选表 / 计划 / 按钮门 / 日志 | `fn-render` |
| 弹窗门禁 / 打开 / 关闭 / 覆盖生产额外勾选 | `fn-modal` |
| 场景与组件切换 / 候选选中 / 任务模拟 / 事件绑定 | `fn-events` |
| URL 参数直达场景 + 首屏渲染 | `fn-init` |

`SCENES` 六个场景键：`ready` / `no-checksum` / `cron-running` / `offline` / `blocked` / `failed`；
`grep -n "^  \"\\?[a-z-]*\\\": {"` 定位，不必读整个静态数据区。
🔴 `cron-running` 这个键**保留**（URL 参数与本文已引用，改名会打断评审链接），
但评审后语义是「**未确认停定时备份**」，不是「探测到 cron 在跑」；`safety.cron` 也是人工确认
状态而非采集事实，改文案时别写回「运行中 / 已停」这类事实口径。
候选行先抽成 `PG_ROWS` / `PG_ROWS_NO_SHA` / `MINIO_ROWS` 三个常量再被场景引用
——🔴 **场景对象不能在自身初始化过程中引用 `SCENES`**（TDZ 会直接 `ReferenceError`），
加第八个场景时照这三个常量复用，别写回 `SCENES.ready.xxx.rows`。

动作计划分两层：`BASE_PLAN` / `MINIO_PLAN` 是组件基线，`GLOBAL_BLOCK` 按场景键覆盖
`available` 与 `blockers`；`planFor()` 只查表投影，**不计算指标**（实现时整份来自服务端）。
改阻塞判据去 `data-runtime` + `fn-plan`，别在 `fn-render` 里另算一套。
评审 R3：阻塞分**全局**与**候选行**两级；原型 `planFor()` 按 `STATE.selected` 放行只是多份
服务端响应的静态投影，实现时「换选中行」= **重新请求一次计划**，不是前端重算 `available`。

## 维护约定

- 新增或拆分区块 → 同步补一个 `@section` 锚点 + 本表加一行；锚点名定下后不改，行号不写进本文。
- 本文只索引**单个 HTML 文件内部**；`AGENTS.md` 的「文档速查」仍是能力文档的唯一索引，
  本仓原型总清单见 `docs/prototype-conventions.md` §1。
- 🔴 判据权威是 `docs/backup-restore.md`（§3 现行 SOP / §4 红线 / §5 方案与落地 / §7 落地记录）；
  **原型与分册不一致时改原型，不是改分册**。实现界面见 `docs/ui.md` §16，两处都要回看。
- 原型是静态交互速览：不连远端、不发网络请求、不执行任何动作；
  `ops restore list/plan/run` **已注册、已实现**（`main.go` + `internal/restore/`），
  真实参数与门禁以 `ops restore help` 和分册 §5.3 / §7 为准；原型里的命令串是评审用的简写。
- 🔴 实现差异别写回原型：MinIO 对象数 / 最近同步不采集（显示 `—`）、只读预演不连 MinIO、
  `minio_restore.sh` 固定恢复 `SRC_BUCKETS` 全部桶 —— 三条已在 `data-runtime` 的
  命令 / 警告与 `card-candidates` 注记里写明（分册 §5.2）。
- 改完按 `docs/prototype-conventions.md` §5 验收：锚点数与状态行对账、slug 无重复、
  表格第二列引用无悬空、注释配对、内联 JS `node --check`（或等价语法检查）。
