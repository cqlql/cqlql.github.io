> 状态：**已实现 · 真机演练已跑（只读 + 写动作；2026-11-08 分册 → 原型评审 →
> 同日落地代码 → 19:43 只读演练 → 20:09 用户声明测试数据可覆盖并授权写演练）**。
> 人工 SOP 仍是 §3（脚本真实行为）；**工具侧已补**：`ops restore list/plan/run`、
> 界面第 7 个导航项「备份恢复」、只读 `GET /api/restore/candidates` / `GET /api/restore/plan`
> 与 `POST /api/backup/run` 的 `mode=restore` / `restore-dry`；复用已部署脚本与同一把任务锁，
> 不提权、不查 crontab、报告只报脚本结果。落地记录见 §7，界面见 [ui.md](ui.md) §16。
> 原型 `docs/backup-restore-prototype.html` 留作**交互回归基线**：六个场景 = §5.7 用例集，
> 钉死「工具不读 crontab / 只认备份机 / 两级阻塞 / 预演不是执行凭证 / 报告只报脚本结果」，
> 冲突时改原型。原型不连远端、不发请求、不执行任何动作。
> ✅ **只读链路已连真机跑通**（k4 备份机 / prod 主服务器，2026-11-08 19:43）：
> 候选采集、两级阻塞、计划、PG / MinIO 预演、门禁拒绝、界面端到端；演练抓出并修掉
> 两个实现缺陷（预演管道吞掉 `pg_restore` 退出码、GNU `find %T@` 小数 epoch 解析），
> 另确认「备份机 pg_restore 16.15 ≠ 主服务器容器内 18.6」导致的**误挡**。详见 §7.3。
> ✅ **写动作演练已跑**（20:09 用户授权「测试数据可覆盖、未正式上线」）：MinIO 走工具
> **正式恢复全链路**成功（3 桶、五阶段、报告只报脚本结果、同名覆盖 / 多余对象保留已核对）；
> 界面写任务的失败场景（服务端预检门挡下、`PHASE_FAILED 2`、不写生产端）已验证；
> PG 用容器内 `pg_restore 18.6` 恢复到临时库，**60 表 / Flyway 9 与生产库一致**。详见 §7.4。
> 🔴 **工具侧 PG 正式恢复仍未跑通**：归档阻塞先挡下；且 `pg_restore.sh` 内部 `ssh` 会吞掉
> stdin，解除归档阻塞后还需修脚本（§4 第 10 条）。演练产物已清理、环境回到基线。
> ✅ **2026-11-10 两道坎各自收口一半（§7.5）**：本仓 `pg_restore.sh` 的 stdin 坑已修并加
> 源码断言；备份机 k4 已手工装 PGDG `postgresql-client-18`（`pg_restore 18.6`），归档 1.16
> 变「可解析」，`list / plan / run --dry-run` 全绿、`available=true`。stdin 修复用真实 ssh
> 链路做了新旧脚本对照实证。🔴 但**新脚本尚未部署到 k4、正式恢复全链路仍未跑**：当次
> `prod` 的 22 / 2226 都不返回 SSH banner（ICMP 全丢），而 `ops backup deploy` 的
> preflight 失败会回滚 `.old`（[backup-deploy.md](backup-deploy.md) §4.5），故刻意没跑；
> 待 prod 恢复后按 §7.5 清单补齐部署与临时库演练。
> §5.0 的评审结论（R1–R6）是实现的判据，不因落地或演练而失效。

# 备份恢复

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)。
> 脚本清单与「禁止入 Crontab」红线见 [backup-scripts.md](backup-scripts.md) §2；
> 安装 / 升级见 [backup-deploy.md](backup-deploy.md)；只读监控见 [backup-monitor.md](backup-monitor.md)；
> 配置键见 [config.md](config.md)（本文只引用键名，不复述键表与默认值）。
> **界面原型**（方案态）：[backup-restore-prototype.html](backup-restore-prototype.html)，
> 分区索引见 `backup-restore-prototype-map.md`；原型与本文冲突时改原型。

## 1. 现状与缺口

「备份恢复」指**把备份端的数据写回生产端**：与备份方向相反，且会覆盖现网数据。
备份是 pull（`pg_backup.sh` 从主服务器拉 dump、`minio_backup.sh` 从生产端 MinIO 拉桶），
恢复是 push（备份端 `scp` / `mc mirror` 推回主服务器）。

| 层 | 现状 | 判据 |
| :--- | :--- | :--- |
| 恢复脚本 | ✅ 已有 | `deploy/backup/postgres/pg_restore.sh`、`deploy/backup/minio/minio_restore.sh`；随 `ops backup deploy` 的整树 tar 一起落到远端（打包时所有 `.sh` 都是 0755） |
| 手工入口 | ✅ 已有 | 各自 Makefile 的 `pg-restore` / `pg-restore-latest` / `minio-restore` / `minio-restore-dry-run` |
| 二次确认 | ✅ 脚本内 | PG 要求输入**目标库名**，MinIO 要求输入 `YES` |
| `ops` CLI | ❌ 落地前没有 | `main.go` 注册表里没有任何 `restore` 动词；`ops status` 与备份监控页都是**只读**，明确不触发恢复 |
| 界面 | ❌ 落地前没有 | 六个导航项里没有恢复页，也没有候选清单 / 预演 / 执行报告 |
| 文档 | ❌ 落地前只有一句 | [backup-scripts.md](backup-scripts.md) §2 只写了「恢复脚本禁止入 Crontab」，没有流程、风险与验收 |

**缺口的实际代价**（2026-11-08 落地前）：备份可用 ≠ 可恢复。出事时没有「有哪些恢复点、
哪个是完整的、恢复到哪里、恢复完怎么验」的清单，全靠人记得脚本参数和目录结构；
也没有一次预演来提前发现「客户端版本不兼容 / 桶名前缀写反 / 磁盘不够放三份 dump」。

> 上表是**落地前**的缺口记录，保留作判据；三行现在都已有实现（§7）。
> §3 的人工 SOP 与 §4 红线仍然成立：工具只做编排，**不改写 `*_restore.sh` 的恢复逻辑**，
> 也不因为有了界面就允许无人值守或把恢复写进定时任务。

## 2. 恢复对象与数据方向

| | PostgreSQL | MinIO |
| :--- | :--- | :--- |
| 数据源（备份端） | `PG_BACKUP_ROOT` 下分级目录里的 `<库>_<时间戳>.dump`、同目录 `globals_<时间戳>.sql`、`.sha256` | `DEST_BUCKET_PREFIX` + 生产桶名，例如备份端 `passup-backup-passup-public` |
| 恢复目标（生产端） | 主服务器 PG 容器里的 `TARGET_DB`（默认取 `PG_DB_NAME`，可 `--db` 覆盖） | 生产端 `SRC_BUCKETS` 里的同名桶 |
| 链路 | 备份端 → `scp` 到主服务器 `/tmp` → `docker cp` 进容器 → 容器内 `pg_restore -j`；`.sql` 走 `docker exec -i ... psql` | 备份端 `mc mirror --overwrite <备份桶> <生产桶>`，逐桶执行 |
| 全局对象 | 先于业务库：`globals_*.sql` 经 stdin 喂给 `psql -d postgres` | 不适用 |
| 关键配置 | `PG_SSH_HOST/PORT/USER/KEY/OPTS`（备份端 → 主服务器的 ssh，与备份同一条链路）、`PG_RESTORE_JOBS` | `SRC_*`（生产端凭证）、`DEST_*`（备份端凭证）、`DEST_BUCKET_PREFIX` |

🔴 **方向最容易搞反**：`SRC_*` 是**生产端**，`DEST_*` 是**备份端**（这套命名是站在「备份」方向写的）。
恢复时数据从 `DEST_*` 流向 `SRC_*`；`minio_restore.sh` 里 `SRC_ALIAS=prod-minio` 是**目标**、
`DEST_ALIAS=backup-minio` 是**来源**，改脚本前先认清这一点。

## 3. 现行人工 SOP（有人值守）

> 执行地点：**备份服务器**，身份 = `servers.json` 里的 `user`（与 cron / preflight 同一个
> HOME、`~/.ssh/known_hosts`、`~/.mc`）。🔴 不要 `sudo make` / `sudo bash`：Makefile 的
> crontab 目标是「谁执行就改谁的」，套 sudo 会去动 root 的 crontab，与真实跑备份的那份不是同一份
> （口径见 [backup-deploy.md](backup-deploy.md) §4.4）。

### 3.0 统一前置（两个组件都要）

1. **先确认备份是好的**：运维机跑 `ops status --server <name>`（只读），看 PG / MinIO 心跳、
   最新 dump、磁盘；再看一眼 `pg_backup.log` / `minio_backup.log` 有没有失败记录。
   🔴 监控报 danger 时不要恢复：先修备份，否则可能拿一份半截 dump 去覆盖生产。
2. **定恢复点与影响面**：要回到哪个时间点、影响哪些库 / 桶、这段时间谁在写入；
   恢复点之后的新数据会怎样，先跟业务确认。
3. **停写**：停应用或至少停掉写入方。PG 恢复会 drop / 重建对象，MinIO 恢复会覆盖同名对象，
   边写边恢复的结果不可预测。
4. **留一份「可反悔」的现场**：恢复前先把当前生产状态另存一份（PG 手工 dump 一份、
   MinIO 确认生产端桶的版本控制 / 历史版本可用）。恢复脚本**不会**替你做这件事。
5. **停定时备份**：用同一用户执行
   `make -f <部署目录>/postgres/Makefile pg-backup-cron-uninstall` 与
   `make -f <部署目录>/minio/Makefile minio-backup-cron-uninstall`
   （部署目录默认见 [config.md](config.md) 的 `PASS_UP_OPS_BACKUP_DEPLOY_DIR`）。
   备份与恢复并发时，`pg_backup.sh` 的 `flock` 只挡备份自己，恢复脚本不拿锁；
   cron 可能拉到恢复中间状态，MinIO 更会被反向 mirror 覆盖。
6. **核对配置**：远端 `<组件>/backup.env`（0600）里的目标地址、桶前缀、私钥路径是否仍是当前生产的；
   配置改过但没同步时先按 [backup-deploy.md](backup-deploy.md) §12 的口径同步，别在恢复中途改。
7. **恢复后按 §3.3 收尾**，尤其是把 cron 装回去。

### 3.1 PostgreSQL

```bash
# 在备份机上，以清单 user 执行；<组件目录> = <部署目录>/postgres
cd <组件目录>

# ① 先自己验一遍完整性（脚本也会验，但缺 .sha256 时它只警告跳过）
sha256sum -c <dump 文件名>.sha256

# ② 预演：只读列出归档目录，确认 dump 可被当前 pg_restore 解析
pg_restore -l <dump 文件名> | head

# ③ 先恢复到临时库，验证通过再考虑生产库
make pg-restore FILE=<dump 文件名> DB=restore_test
# 等价于 bash pg_restore.sh --file <dump 文件名> --db restore_test
# 不指定文件时用 make pg-restore-latest（递归 find 最新 .dump）
```

脚本实际行为（照代码，不是照直觉）：

- 前置校验：`PG_SSH_HOST` 非空 → ssh 连通 → 容器健康状态（`unhealthy` 直接中止、`starting` 只警告）
  → 文件非空 → `.sha256` 校验（**缺文件只警告**）。
- 二次确认：打印目标主机 / 容器 / 库 / 源文件，**输入目标库名**才继续；不匹配即取消。
- 全局对象：在同目录找最新的 `globals_*.sql`，经 stdin 喂给 `psql -U <user> -d postgres`；
  找不到只警告跳过。
- `.dump` 分支：目标库不存在先 `createdb` → `scp` 到主服务器 `/tmp` → `docker cp` 进容器
  → `pg_restore -U <user> -d <库> --clean --if-exists --no-owner -j <JOBS>` → 删两处 `/tmp` 临时文件。
  并行 `-j` 不能读 stdin，所以必须落文件，这也是磁盘要留三份空间的原因。
- `.sql` 分支：直接 stdin 喂给 `psql -d <库>`。
- 🔴 脚本**没有** `set -e`，靠 `RET` 判断业务库恢复结果。必须逐行看输出，
  不要只看最后一行退出码；全局对象恢复失败会中止，其余失败要人工判读。

验证（恢复完到下一步之前）：关键表行数 / 表数量、`flyway_schema_history` 的版本、
应用健康检查端点。🔴 **Flyway 单向**（[AGENTS.md](../AGENTS.md) 硬约束 7）：
旧 dump 的 schema 落后于当前镜像时应用会起不来，必须如实报告「数据已恢复但服务可能起不来，
需要前向修复」，**不许假装成功、不许自动回滚镜像**。

### 3.2 MinIO

```bash
cd <部署目录>/minio

make minio-restore-dry-run     # ① 只读预览：mc mirror --dry-run，不写生产端
# 可选（写动作，先确认）：make minio-versioning-enable / minio-versioning-enable DAYS=30
#                        / minio-ilm-clean —— 见 Makefile 注释，会改两端桶的版本控制与 ILM 规则
make minio-restore             # ② 交互式输入 YES 才继续
```

脚本实际行为：打印方向与桶清单 → 输入 `YES` → `mc alias set` 生产端与备份端
（连不上即退出）→ 提示「请确保已暂停定时备份，`make cron-uninstall`」→ 逐桶
`mc ls` 检查、桶不存在则 `mc mb`、`mc mirror --overwrite` → 汇总失败桶，有失败则退出 1。

🔴 **恢复不是精确回滚**：`mc mirror --overwrite` **不带 `--remove`**，生产端在恢复点之后
新建 / 多出来的对象会**原样保留**；只有同名对象被备份端版本覆盖。想精确回到某个时点，
必须人工比对并处理多余对象，工具**不做自动删除**（与 [deploy.md](deploy.md) §3.5
「不 `down -v`、不删 `/data`」同一条红线）。
同理，备份侧的 `minio_backup.sh` 也不带 `--remove`，生产端删掉的对象在备份端仍留着
——误删能找回，但备份端不是生产的精确镜像。

验证：`mc ls` 抽样核对关键对象、应用上传 / 下载链路、对象数量与预期差异（多出来的部分是预期的）。

### 3.3 恢复后收尾清单

| # | 动作 | 说明 |
| :--- | :--- | :--- |
| 1 | 确认应用 / 服务健康 | PG 看 Flyway 与业务接口；MinIO 看对象读写 |
| 2 | 把定时任务装回去 | `*-backup-cron-install` **和** `*-backup-health-cron-install` 两条都要（见 §4 第 4 条）；最稳是重跑一次 `install.sh` / `ops backup deploy` 整份重写 crontab |
| 3 | 跑一次备份 | `make pg-backup` / `make minio-backup`，确认新心跳写进 `last_success.txt` |
| 4 | 跑自检 | `ops backup verify --server <name>`（preflight 只读） |
| 5 | 看监控 | `ops status --server <name>` / 界面「备份监控」页，确认恢复后的第一次成功 |
| 6 | 记录 | 恢复点、执行人、耗时、验证结论、遗留的多余对象；演练结论回写本文状态行 |

## 4. 红线与现行脚本的已知坑

1. 🔴 **恢复必须有人值守**：恢复脚本**禁止入 Crontab**，`install.sh` 只装备份与巡检两条 cron；
   工具侧也不许定时 / 自动触发恢复（[backup-scripts.md](backup-scripts.md) §2）。
2. 🔴 **恢复不进只读链路**：`ops status` 与「备份监控」页只读，不重跑、不恢复、不改配置
   （[backup-monitor.md](backup-monitor.md) §2、[ui.md](ui.md) §14）。恢复期间监控报 danger 是
   **预期结果**，不要为了「让页面变绿」去改判据。
3. 🔴 **是「补齐 + 覆盖」，不是精确回滚**：PG 的 `--clean --if-exists` 只清 dump 里存在的对象，
   目标库里多出来的表 / 对象会留下；MinIO 的 mirror 不带 `--remove`（见 §3.2）。
   两处都不要在方案里偷偷加删除语义。
4. 🔴 **停 / 恢复 cron 的两个坑（现行脚本行为，代码阶段再修）**：
   ① `minio_restore.sh` 提示的 `make cron-uninstall` **在 Makefile 里不存在**，正确目标是
   `minio-backup-cron-uninstall` / `pg-backup-cron-uninstall`；
   ② 标签 `#PG_BACKUP` 是 `#PG_BACKUP_HEALTH` 的前缀，`grep -v` 卸备份任务时**会把健康巡检
   任务一起删掉** —— 收尾时两条都要装回去，别只装备份那条。
5. 🔴 **MinIO 的「已暂停定时备份」只是提示**：脚本 `read -r -p "已确认暂停？"` 按 Enter 就过，
   **不校验** crontab。这一步由 §3.0 第 5 条人工保证。
6. 🔴 **完整性校验会静默降级**：缺 `.sha256` 时 `pg_restore.sh` 只警告跳过；版本不足时
   `pg_backup.sh` 会跳过归档深度校验（[backup-scripts.md](backup-scripts.md) §4）。
   恢复前手工 `sha256sum -c` + `pg_restore -l` 两道不能省；容器内 `pg_restore` 版本要能读该 dump。
   🔴 **两侧客户端不是同一个**（2026-11-08 真机演练确认）：工具的只读归档检查跑在**备份机**
   的 `pg_restore` 客户端，正式恢复脚本跑的是**主服务器容器内**的 `pg_restore`。
   备份机 16.15 读不了归档 1.16，容器内 18.6 却能读 —— 工具会把一份实际可恢复的 dump
   判成「归档不可解析」。文案已如实说明判的是哪一侧并给人工复核指引（§3.1），
   工具**不提供绕过开关**；🔴 `ops backup deps --pg-major 18` **不能**用来升级（20:09 真机
   确认：它只补「缺失」依赖，16.15 已装就报「没有缺少的依赖」）。要放行得手工装 PGDG
   `postgresql-client-18`，或按 §3 人工 SOP 在容器内恢复（本次演练走后者）。详见 §7.3 / §7.4。
   ✅ **2026-11-10 已按前一条手工装 18**（§7.5）：备份机 `pg_restore` 变 18.6，同一份 dump
   的只读归档检查变「可解析」、候选 `selectable=true`、`plan available=true`。
   **判据一行未改、也没有加绕过开关**——只是把校验侧客户端对齐到执行侧版本；
   `ops backup deps` 的「只补缺失」语义保持原样，换机器仍需人工装版本化客户端。
7. 🔴 **磁盘要留三份**：`.dump` 同时占备份端、主服务器 `/tmp`、容器内 `/tmp`；
   `PG_RESTORE_JOBS` 调并发，不解决空间。传大文件前先看 `df`。
8. 🔴 **身份与凭证**：以清单 `user` 跑（同一 HOME / `~/.ssh` / `~/.mc`）；
   `backup.env` 是 0600，私钥路径与 `SRC_KEY` / `DEST_SECRET` 等凭证**不进任何输出 / 日志**；
   恢复脚本自己也不打印它们。
9. 🔴 **失败不自动重试、不自动清场**：`pg_restore.sh` 中途失败可能留下宿主机 / 容器 `/tmp`
   的 dump、`mc mirror` 可能只成功了一部分桶。如实报告「哪一步、哪些桶失败」，由人决定下一步。
10. 🔴 **`pg_restore.sh` 内部 `ssh` 会吞掉 stdin**（20:09 真机写演练发现）：脚本 2a 的
    `remote_exec "echo ok"` 等内部 `ssh` 读光脚本 stdin，第 3 步
    `read -r -p "输入目标库名"` 拿到 EOF →「数据库名称不匹配，恢复操作已取消」；
    经 ssh 喂 1 行 / 5 行确认串都失败。人在备份机**本地终端**交互执行没有这个问题，
    但工具经 `StreamWith` 喂确认串同样会踩到（当时被归档阻塞挡住、暂不可达）。
    ✅ **2026-11-10 本仓已修（§7.5）**：`SSH_CMD` 拆成 `SSH_BASE` / `SSH_TARGET`，
    `remote_exec` 的 ssh 带 `-n`（内部调用不再读脚本 stdin），`remote_docker_stdin`
    **不带** `-n**（`globals_*.sql` / `.sql` 仍靠它把内容喂进容器内 `psql`）；
    二次确认的 `read` 一行未动，**不是绕过确认**。`backupdist_test.go` 从嵌入产物读源码
    锁住三条（漏 `-n` / 全局加 `-n` / 给 stdin 链路加 `-n` 都要红），并用真实 ssh 链路
    做了新旧脚本对照实证。🔴 **远端仍是 11-07 旧脚本**：改本仓后要重新
    `ops backup deploy` 才生效（会重跑 install.sh / crontab / logrotate；preflight 失败会
    回滚 `.old`，见 [backup-deploy.md](backup-deploy.md) §4.5），本次因 `prod` 不可达
    **没有部署**。

## 5. 工具侧方案与落地（已实现 · 真机演练已跑 · 2026-11-08 按原型评审定稿并同日落地）

> ✅ 下面的 `ops restore ...` / 接口名**都已实现**（命令表见 [AGENTS.md](../AGENTS.md)）：
> `main.go` 注册了 `restore`，`internal/restore/` 是能力包，`web/src/features/restore/` 是界面。
> 界面交互基线见 [backup-restore-prototype.html](backup-restore-prototype.html)（分区索引
> `backup-restore-prototype-map.md`）：六个场景、PG 与 MinIO 候选表、预演计划、确认弹窗门禁
> 与任务报告；原型是静态速览，不连远端、不执行动作。**原型与本分册冲突时改原型。**
> ✅ 只读链路（19:43，§7.3）与写动作演练（20:09，§7.4）都已连真机跑过；写演练由用户
> 声明「测试数据可覆盖、未正式上线」后授权。
> ✅ 2026-11-10：归档阻塞已解除（备份机装 18 客户端）、stdin 坑本仓已修，
> 只读 `list / plan / run --dry-run` 全绿（§7.5）。🔴 工具侧 PG **正式恢复仍没跑通**：
> 新脚本尚未部署到 k4，且 `prod` SSH 不可用；不提供绕过开关，也不拿预演当执行凭证。

### 5.0 评审结论（对着原型六个场景逐条过）

| # | 原型暴露的问题 | 定稿口径 | 连带改动 |
| :--- | :--- | :--- | :--- |
| R1 🔴 | 安全条把「定时备份：已停 / 运行中」当成**采集事实**，但 [backup-monitor.md](backup-monitor.md) §3.2 明确「工具不查 cron」，§4 第 4 条还记录了 crontab 标签前缀误删 —— 解析 crontab 既违背既有决策又很脆 | **不读 crontab**。该栏改成「停定时备份：未确认 / 已人工确认」，是人在前置清单里的**显式声明**（本机表单状态，不写远端），不是采集结果；全局阻塞来自「缺这项确认」，不是「探测到 cron 在跑」 | 原型 `cron-running` 场景语义改为「未确认停定时备份」；安全条 / banner / 阻塞文案同步；map 的场景键说明同步 |
| R2 🔴 | 目标机下拉选的是备份机 `k4 · backup-01`，可数据实际写到**主服务器**（生产端）；后者由该机 `backup.env` 的 `PG_SSH_HOST` / `SRC_URL` 决定，不在 `servers.json` 里 —— `--server` 到底选哪台，方案没写 | `--server` **只选备份机**（脚本执行地 + 候选来源 + 采集地）；恢复目标由该机 `backup.env` 决定，接口**不接受另行指定生产主机**。预演计划第一行必须回显「将写入哪台生产端 / 哪个库或桶」供人核对 | 原型方向链与注记补一句；§5.2 写死 |
| R3 | 阻塞没有分层：缺校验和换个恢复点就放行，cron / 断网 / 版本不足则整页禁执行，方案只笼统写了「阻塞原因」 | 服务端下发**两级**：全局 `blockers`（连接 / 前置确认 / 版本 / 磁盘）与候选行 `selectable` + `row_blockers`（校验和、归档不可解析）。换选中行 = **重新请求一次计划**，不是前端重算 | 原型 `planFor()` 只是静态投影，实现时不能照抄；注记补明 |
| R4 | 弹窗把门禁做实了（库名两次逐字比对、`yes`、三项前置勾选、`YES`、覆盖生产额外勾、无 sudo 密码框），方案只写了「库名逐字比对」 | 逐条定稿进 §5.3：三项前置是**人的声明，不是工具验证**；恢复不提权、**不收 sudo 密码**；界面预演不是执行凭证，服务端每次写动作前自己跑 `--dry-run` | §5.1 / §5.3 新增 |
| R5 | 原型有五阶段，成功只说「数据已恢复到临时库」、Flyway 待人工确认；失败停在失败阶段、不重试不清场。方案只有一句「失败如实报告」 | §5.4 定稿：报告**只报脚本结果**，应用可用性 / Flyway 兼容性是 §3.3 的人工步骤，禁止输出「恢复成功，服务正常」；失败不改心跳、不自动清场 | 验收表按原型场景重写 |
| R6 | 原型六个场景本身就是现成的用例集，原验收表是另一套维度 | §5.7 验收**直接以原型六个场景为准**，一条场景一行判据，评审与验收闭环 | map 的场景键定位法继续有效 |

R1 是评审里唯一的阻塞级矛盾：若照原型直译，实现时必然去 `crontab -l`，与监控页的决策相撞，
还会踩 §4 第 4 条的标签前缀坑。R2 是恢复链路特有的方向歧义，写不清就容易恢复错机器。
两条都**先改方案、再改原型**，不是反过来。

### 5.1 原则

- **比安装更严**：恢复是覆盖现网数据的写动作，照抄 [AGENTS.md](../AGENTS.md)
  硬约束 15 / 21 的六道门（`confirm=="yes"`、服务端预检、`name` 只认清单、密码只走 stdin、
  任务脱离 HTTP、单任务锁与脱敏），并加码「先预演、再执行」「目标库名人工输入两次」。
- **只读与写分离**：候选清单 / 预演是只读的，默认视图只读；执行是独立且显式的动作。
  恢复不塞进「备份监控」页，也不改 `status` 的判据。
- **不重写恢复逻辑**：复用现有两个 `*_restore.sh`（脚本已 embed、已随部署落地），
  工具只负责「列候选 → 校验 → 显式触发 → 收日志与报告」。Go 侧不重新实现 pg_restore / mc mirror。
- 🔴 **不查 crontab、不提权**：定时备份是否停由人确认（R1），工具不解析 crontab、不自动停 /
  自动装；恢复以清单 `user` 在备份机跑，弹窗**没有 sudo 密码输入**，与安装弹窗不同。

### 5.2 三段式草案

| 阶段 | 动作（已实现） | 产出 |
| :--- | :--- | :--- |
| A · 只读 | `ops restore list --server <备份机> --component pg\|minio [--json]` / `GET /api/restore/candidates` | 候选清单：PG 为相对路径 / 时间 / 大小 / 分级 / 校验和 / 归档 / 新鲜度 / `selectable`；MinIO 为**桶对**（备份端桶 → 生产端桶）/ `selectable`。对象数 / 最近同步工具**不采集**、恒显示 `—`（见下方「实现差异」）；采不到标 `collected=false`，不用 0 兜底（硬约束 3） |
| A · 预演 | `ops restore plan ... --dry-run` / `GET /api/restore/plan` / `POST /api/backup/run` 的 `mode=restore-dry` | 将执行的命令 + 影响清单（**首行是恢复目标：哪台生产端 / 哪个库或桶**）+ 全局 `blockers` / 警告 + `available`，**不写生产端**；PG 跑 `pg_restore -l` 验归档，MinIO 只做脚本 / `mc` / 桶对的只读核对 |
| B · 执行 | `ops restore run ... --candidate <id> --db <库名> --confirm yes --db-confirm <库名> --checks 1,1,1 --cron-confirmed` / 界面 `mode=restore` | 复用远端 `*_restore.sh`，脚本内二次确认串由工具按**已通过的门禁**喂 stdin；输出接任务日志、逐行脱敏，结束给报告；MinIO 按脚本逐桶执行、失败桶逐项汇总 |

🔴 **`--server` 只认备份机**（R2）：它是候选来源、采集地与脚本执行地；生产端由该机
`backup.env` 的 `PG_SSH_HOST` / `SRC_URL` 决定，不由清单另选、接口不接受任意主机。
计划里必须把恢复目标回显出来让人核对 —— 方向写反是这条链路最贵的事故。

**实现差异（照原型与 §5.0 落地时定下的三条，改代码前先看这里）**：

1. **MinIO 不连生产端 / 备份端 MinIO**：对象数与最近同步恒 `—`（`collected=false` 的展示口径），
   只读预演**不跑** `mc mirror --dry-run`。理由：那需要持有 `SRC_KEY` / `DEST_SECRET`
   并 `mc alias set`（写 `~/.mc`），会把凭证与写动作带进只读链路；桶对清单来自
   `backup.env` 的 `SRC_BUCKETS` + `DEST_BUCKET_PREFIX` 白名单字段。正式恢复仍由
   `minio_restore.sh` 自己完成，工具不重写恢复逻辑。
2. **`minio_restore.sh` 固定恢复 `SRC_BUCKETS` 的全部桶**，脚本没有按桶筛选参数；工具
   **不改脚本**（改了还要重新 `ops backup deploy` 才生效，等于造第二套语义）。选中桶对用于
   核对目标与预演范围，计划的影响清单第 2 行明确写出「全部 N 个桶」，不许让人误以为只恢复一个桶。
3. **脚本内二次确认由工具喂 stdin**：PG 喂目标库名，MinIO 喂 `YES` + 定时备份提示的回车。
   这不是绕过确认 —— 工具侧门禁更严（库名两次逐字比对、`yes`、三项前置、覆盖生产额外勾，
   `confirm=="yes"`、服务端再验一次），且每次写动作前自己跑 `--dry-run`。

阻塞分两级（R3）：全局 `blockers` 与候选行 `row_blockers` 都由服务端下发，
候选**只认备份根目录下的文件**、路径由服务端拼、接口不接收任意路径；
换选中行要**重新取一次计划**，前端不重算 `available`，也不自己判断文件完整性。

### 5.3 门禁与确认（照原型弹窗定稿）

- 服务端门禁：严格 `LoadConfig` + `LoadServers`（`name` 空 400 / 未知 404）、`confirm=="yes"`、
  候选路径与 `--db` 白名单校验、单任务锁、任务脱离 HTTP 请求、日志与响应脱敏
  （私钥路径 / `SRC_KEY` / `DEST_SECRET` 等一律不出现）。
- 🔴 **PG 目标库名输入两次**并逐字比对，服务端再验一次；默认建议 `restore_test`，
  目标是生产库名时额外勾「我确认覆盖生产」。**MinIO 输入 `YES`**（与 `minio_restore.sh` 一致）
  并勾「我确认覆盖生产端同名对象」。
- 🔴 **三项前置勾选默认全不勾、全部必勾**：已停写 / 已停定时备份 / 已留可反悔的现场。
  这是 §3.0 的人工 SOP 固化成门禁，**是人的声明，不是工具验证**；工具不因此去读 crontab 或探活应用。
- 🔴 **界面「预演」不是执行凭证**：它只是给人看的只读动作；服务端**每次**写动作前都自己跑一次
  `--dry-run`，失败就地停、不写生产。前端拿不到也传不了「预演通过」这个令牌。
- 一次只恢复一个组件、一个候选；不开放 `--force`、自动停/装 cron、自动重试、自动删除多余对象
  （停 cron 是单独显式动作，照 [components.md](components.md) §8「动作计划由 Go 侧下发、前端只渲染」）。
- 界面是独立导航项：已实现为**第 7 项**「备份恢复」（手动备份第 6 项，见 `docs/backup-once.md` §2.2），
  默认只读；执行按钮要点按钮 + 二次确认，前端不算任何指标。编号仍写在 `App.tsx` 的
  `PageKey` / `NAV_ITEMS`，别在分册里写死到别处。

### 5.4 计划与报告

- 五个阶段：**预检 → 预演 → 传输 / 恢复 → 验证 → 报告**；失败停在当前阶段并标红，
  不许五个阶段全变绿。
- 🔴 **报告只报脚本结果**：可以写「数据已恢复到临时库」，**不许写「恢复成功，服务正常」**。
  Flyway 兼容性、应用健康门、关键表 / 对象核对都是 §3.3 的人工步骤（硬约束 7：镜像可回滚、
  数据库不回滚，旧 dump 落后时服务可能起不来，必须如实说明需前向修复）。
- 失败如实报告「哪一步、哪些桶失败」；不自动重试、不自动清场（可能留下 `/tmp` dump）、
  **不改 `last_success.txt`**、不缓存失败结果。
- 连不上 / 配置错仍回**完整快照**（`collected=false` + 显示 `—` + `disk_free_kb: null`），
  不把整页打白、不缓存失败结果；判据与 [backup-monitor.md](backup-monitor.md) §4 同口径。
  已实现：`restore.FailureSnapshot()` 与 `GET /api/restore/candidates` 的 200 完整快照。

### 5.5 不做

🔴 定时 / 自动恢复、回滚数据库、精确回滚（自动删多余对象）、从任意主机或任意路径恢复、
**读或改 crontab**、**另选生产主机**、**收 sudo 密码 / 提权**、给恢复单设账号或凭证、
把恢复脚本写进 crontab、界面内嵌终端、把恢复塞进 `status` 或监控页。

### 5.6 落地同步清单（2026-11-08 已逐项完成）

`main.go` 注册表 + 菜单 `probe("restore")` ✅ → 新增 `internal/restore/`（依赖方向仍是
`main → 能力包 → shared`，`shared` 不反向 import）✅ → `web/src/features/restore/` ✅ →
[ui.md](ui.md) §16 ✅ → [AGENTS.md](../AGENTS.md) 状态行 / 硬约束 33 / 命令表 / 文档速查表 /
目录边界 ✅ → **没有新增任何 `ops.env` / `backup.env` 键**（`go test` 的文档键断言仍绿）✅ →
**原型与 map 回改**（实现态文案、第 7 个导航项、命令不再是草案）✅ → 本文状态行与 §5
改为「已实现」✅。落地细节与实现差异见 §7。
[backup-scripts.md](backup-scripts.md) §2 的「禁止入 Crontab」红线**一行未改**。

### 5.7 验收（真机；**只读 + 写动作均已跑**；用例集 = 原型六个场景）

> **状态（2026-11-10 更新）**：`ready` / `no-checksum` / `cron-running` / `offline` /
> `blocked` 的只读判据见 §7.3；写动作部分（MinIO 正式恢复、界面失败任务、PG 临时库恢复
> 与数据核对）见 §7.4，由用户授权「测试数据可覆盖」后执行，产物已清理、环境回到基线。
> ✅ 2026-11-10 补：候选归档变「可解析」、`plan available=true`、`run --dry-run` 读出
> 859 条 TOC（Dump Version 1.16-0）；stdin 修复有新旧脚本对照实证（§7.5）。
> 🔴 仍缺：**部署新脚本之后的**工具侧 PG 正式恢复全链路（写临时库 + 60 表 / Flyway 核对），
> 以及真正「脚本中途失败 / 失败桶」运行期场景（不破坏环境）；当前阻塞是 `prod` SSH 不可用。

| 原型场景 | 判据 |
| :--- | :--- |
| `ready` | 候选齐全、计划 `available=true`；预演前后生产库 / 桶内容一致、远端无新增文件；恢复到临时库后关键表 / 对象对得上 |
| `no-checksum` | 缺 `.sha256` 的候选行 `selectable=false`；改选合格行后**重新取计划**才放行；工具不把「脚本只警告跳过」当校验通过 |
| `cron-running`（评审后语义：未确认停定时备份） | 三项前置未勾全时执行入口禁用；工具**没有**去读 `crontab -l`，也没有自动停任务 |
| `offline` | 连不上仍返回完整快照（`—` / `null` / `collected=false`），不白屏、不缓存、不猜 0 |
| `blocked` | 版本不足 / 磁盘不够给出明确阻塞原因，预演仍可看（只读）、执行禁用，不自动清理空间 |
| `failed` | 停在当前阶段并标红；报告写清失败步骤与失败桶；不自动重试、不自动清场、不改心跳 |
| 通用门禁 | 缺 `confirm` / 未知 `name` / 任意路径 / 库名两次不一致 / 未勾覆盖生产都被服务端拒绝 |
| 通用隔离与脱敏 | 恢复期间 `ops status` 与监控页仍只读；crontab 不被改动；日志 / HTTP 响应里没有私钥路径与 DB / MinIO 凭证 |

## 6. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| 先补文档、不动代码 | 直接做 `ops restore` | 恢复是高危写动作，先把现行人工流程、真实脚本行为与红线写清楚；今天就能照着演练，演练结论会反过来改方案 |
| 复用 `*_restore.sh`，工具只做编排 | 用 Go 重写恢复逻辑 | 两个脚本已在备份机上、已被 embed，重写等于维护两套恢复语义，且无法真机验证的那套最容易漂 |
| 三段式「列候选 → 预演 → 执行」 | 一个「立即恢复」按钮 | 「有没有可用恢复点」和「恢复会不会覆盖错对象」是两个问题，必须分开看；也和组件页「动作计划由 Go 侧下发」同构 |
| 默认恢复到临时库 | 直接覆盖生产库 | 恢复点校验、Flyway 兼容性都要在临时库上先证一遍；生产覆盖只能是最后一个显式决定 |
| 不做精确回滚 / 自动删多余对象 | `mc mirror --remove`、恢复前 drop 库 | 删除是单向且不可逆的，与「不 `down -v`、不删 `/data`」同一条红线；多余对象由人比对后决定 |
| 停 cron 是独立显式动作 | 恢复前自动停、结束后自动装 | 自动改 crontab 会在失败时留下「定时任务被永久关掉」的半状态；现行标签还有前缀误删问题（§4 第 4 条），更不能悄悄做 |
| **不读 crontab，停没停由人确认**（R1） | `crontab -l` 解析出「已停」再放行 | 与 [backup-monitor.md](backup-monitor.md) §3.2 同口径；解析会把工具绑到安装脚本的标签格式（§4 第 4 条的前缀误删就是现成例子），而且「解析到任务不存在」也不等于恢复期间没人写。恢复前的责任边界是人确认，不是工具探测 |
| **界面预演只是给人看，服务端每次自己跑 `--dry-run`**（R4） | 前端「预演通过」当执行凭证 | 前端结果可绕过、会过期，不能当令牌；与组件页「服务端先跑预检」同构，也省掉一份要同步的预演状态 |
| **只读链路不连 MinIO / 不写 `~/.mc`**（落地时补） | 工具自己跑 `mc mirror --dry-run` 拿对象数 | 那要持有 `SRC_KEY` / `DEST_SECRET` 并 `mc alias set`，把凭证与写动作带进只读链路；对象数 / 最近同步采不到就显示 `—`（硬约束 3），正式恢复仍由脚本完成 |
| **不改 `minio_restore.sh` 去支持按桶筛选**（落地时补） | 给脚本加 `--bucket` 参数 | 脚本改了必须重新 `ops backup deploy` 才生效，等于多一个真机前置和一套恢复语义；工具在计划里明说「脚本会按 SRC_BUCKETS 恢复全部 N 个桶」，比偷偷少恢复 / 多恢复诚实 |
| **按原型落地、原型不删**（2026-11-08） | 把原型当一次性草图丢掉 / 只落 CLI | 六场景就是实现与验收的共同基线；R1–R6 逐条对应实现里的 `cron_confirmed`、`restore-dry`、`BuildPlan` 两级阻塞、`ValidateGate`、`appendRestoreReport`，原型留作交互回归基线 |

## 7. 落地记录（2026-11-08）

| # | 做了什么 | 落点 |
| :--- | :--- | :--- |
| 1 | `ops restore list/plan/run` 顶层动词 + 菜单第 8 项只读候选 | `main.go` 注册表 / `usage()`、`internal/launcher/menu.go` 的 `probe("restore")`、`internal/restore/{cli,types,collect,plan,gate}.go` |
| 2 | 只读采集（一次 ssh `sh -s`）：白名单非凭证 META + PG dump / MinIO 桶对候选、校验和、归档可解析、磁盘余量、心跳；**不写远端、不提权、不读 crontab、不连 MinIO** | `internal/restore/collect.go`；`restore_test.go` 从源码锁住只读脚本不含 sudo / crontab / mc alias / 删改动作 |
| 3 | 两级阻塞计划：全局 `blockers` 与候选行 `row_blockers` 都由 Go 侧下发；换选中行重新取计划；首行回显恢复目标；离线完整快照（`—` / `null`） | `internal/restore/plan.go`、`internal/ui/restore.go` 的 `GET /api/restore/candidates` / `/api/restore/plan` |
| 4 | 门禁：`confirm=="yes"`、库名两次逐字比对且等于计划回显、MinIO `YES`、三项前置全勾、覆盖生产额外勾、候选查表（不接受任意路径）、不收 sudo 密码；CLI 的 `ValidateGate` 是唯一完整判据，界面 HTTP 层再挡一道字面量 | `internal/restore/gate.go`、`internal/ui/restore.go` 的 `validateRestoreRunRequest` |
| 5 | 写任务复用**同一把** `backupTask` 锁与增量日志：`POST /api/backup/run` 的 `mode=restore` / `restore-dry`、服务端预检门先跑 `--dry-run`、逐行脱敏、报告只报脚本结果、五阶段条失败停在当前阶段 | `internal/ui/backup.go` / `restore.go`、`backuprun.go` 的 `restore` 前缀直通与 30 分钟超时提示、`shared/remote.go` 的 `StreamWith`（stdin 喂脚本内二次确认） |
| 6 | 第 7 个导航项「备份恢复」：候选表 / 前置状态 / 计划三框 / 阶段条 / 日志 / 确认弹窗（无密码框），复用备份域的 `WriteConfirmModal` 与 `BackupLog`、复用任务轮询不复制第二套 | `web/src/App.tsx`、`web/src/features/restore/**`、`web/src/index.css`、`web/test/restore.test.ts` |
| 7 | 文档与原型回改 | 本文、`docs/ui.md` §16、`AGENTS.md` 状态 / 硬约束 33 / 命令表 / 速查表、原型与 map；`docs/backup-scripts.md` §2 红线未改 |
| 8 | 重建产物 | `go vet ./...` / `go test ./...` / `go build -o ops.exe .` + `cd web && npm test && npm run typecheck && npm run build`；**没有新增任何配置键** |

### 7.1 真机前置与已知差异

- 🔴 **远端跑的仍是 11-07 部署的那两份脚本**：2026-11-08 落地时工具只接一根线过去，
  `deploy/backup/**` 一行未改；**2026-11-10 本仓修了 `pg_restore.sh` 的 stdin 坑**（§7.5），
  但还没部署。正式执行前必须重新 `ops backup deploy`，确认带 `-n` 的新版落到备份机
  （preflight 失败会回滚 `.old`，见 [backup-deploy.md](backup-deploy.md) §4.5）。
- 🔴 **MinIO 脚本固定恢复 `SRC_BUCKETS` 全部桶**；对象数 / 最近同步显示 `—`；只读预演不跑
  `mc mirror --dry-run`。三条差异见 §5.2，界面与计划里都已明说，不是遗漏。
- 🔴 **界面子进程 30 分钟上限**：超时只结束本机等待，报告写「远端恢复脚本可能仍在执行」，
  不写「已取消」、不杀远端、不自动重试 / 清场；CLI 侧是 6 小时（与 `deploy --run-now` 同款）。
- 🔴 **报告只报脚本结果**：不承诺应用可用；Flyway 兼容性、关键表 / 对象核对、装回两条 cron
  都是 §3.3 的人工收尾。任务日志与 HTTP 响应不含私钥路径与 DB / MinIO 凭证。
- **§5.7 真机演练状态**：只读判据（§7.3）与写动作演练（§7.4）都已跑；`ops.exe`
  已按 §7.3 的修复重建，19:50 通过界面「重启」加载新 exe（同端口同 token、boot_id 已换）
  并复验。✅ 2026-11-10 新 exe 再按 stdin 修复重建（13,679,616 B），但**远端脚本仍是
  11-07 旧版**；🔴 工具侧 PG 正式恢复全链路仍未跑通，前置是「prod SSH 恢复 → 重新
  `ops backup deploy` → 临时库演练」，见 §7.5。

### 7.2 回归要点

`go vet ./...`、`go test ./...`（只读脚本断言 / 完整快照 / 两级阻塞 / 门禁矩阵 / 报告措辞 /
UI 六道门 / 计划接口）、`cd web && npm test && npm run typecheck && npm run build`、
`go build -o ops.exe .`。改了 `web/` 或 `deploy/backup/**` 两步都不能省
（§3 / 硬约束 19、26）；改了恢复脚本要同步复核 §3 的「脚本实际行为」，别照旧文档执行。

### 7.3 真机只读演练（2026-11-08 19:43，k4 / prod）

**环境**（清单里的两台机，凭证只在 `servers.json` / `backup.env`）：备份机 `k4`（清单
`user`，SSH 通、`scripts_ok=true`）；主服务器 `prod`（PG 容器 `postgres`，容器内
`pg_restore` / `pg_dump` **18.6**；备份机客户端 `pg_restore` **16.15**）；
MinIO 生产端 3 个桶、备份端桶前缀 `passup-backup-`。演练前 `ops status --server k4 --json`：
PG / MinIO 心跳都在 1.4 小时前、磁盘 14.8 GB 可用、`problems=[]`（无 danger）。

| 用例 / 场景 | 真机命令（全部只读） | 结论 |
| :--- | :--- | :--- |
| `ready`（只读部分） | `restore list --component pg\|minio --json` | ✅ PG 采到 1 个 dump（`.sha256` 通过、294.3 KB、daily、新鲜度 1.5 小时）；MinIO 采到 3 个桶对，方向回显 `SRC_*=生产端 / DEST_*=备份端` 正确；`scripts_ok=true` |
| `no-checksum` / R3 两级阻塞 | `restore plan --candidate ... --dry-run` | ✅ 候选行 `selectable=false` + `row_blockers`，并升级成全局 `blockers`、`available=false`；计划首行回显生产端库/容器；不写生产端 |
| `cron-running`（R1） | `restore run ... --dry-run`（不带 / 带 `--cron-confirmed`） | ✅ 未勾选时全局阻塞「尚未确认已停定时备份」，MinIO 预演 rc=1；勾选后 MinIO 预演 rc=0（只读放行）。工具没有读 `crontab -l`、没有停任务 |
| `blocked` | `restore run --component pg ... --dry-run` | ✅ `pg_restore -l` 报 `unsupported version (1.16)`，停在 `PHASE 2/5`，`PHASE_FAILED 2`，日志明写「不执行恢复；生产端没有被修改」 |
| `offline` | 未知 `name` / 界面 `GET /api/restore/candidates` | ✅ 未知 name 直接 rc=2（只认清单）；界面只读接口返回 200 完整快照。离线完整快照另有本机单测覆盖 |
| 通用门禁 | `POST /api/backup/run` 带 `../../etc/passwd` | ✅ HTTP 400「候选 ID 不合法」，没有启动任何任务；`confirm` / 库名两次 / 三项前置 / 覆盖生产另有 Go 单测矩阵 |
| 通用隔离 | `ops status` / 界面 `/api/health` / 只读接口 | ✅ 演练期间监控页仍只读、心跳与 crontab 未被改动；HTTP 响应与日志无私钥路径与凭证 |
| `failed` / `ready` 的写部分 | 真正执行 `*_restore.sh` | 🔴 **未执行**：会覆盖现网数据，见下方「未做」 |

**演练抓出并修掉的 4 个问题**（都已重建 `ops.exe`，`go test ./...` 全绿）：

1. 🔴 **预演裸管道吞掉退出码**：`pg_restore -l ... | head` 在 POSIX `sh` 下没有 pipefail，
   `pg_restore` 失败时管道仍是 0，日志误报「归档目录可解析」。改成先收进变量、
   `|| { printf ...; exit 3; }` 显式判退出码；`pgRestoreDryRunScript()` 抽成纯函数并加单测，
   真机复验已能打印 `unsupported version (1.16) in file header` 并停在 PHASE 2。
2. **新鲜度恒为 —**：GNU `find %T@` 输出带小数秒（`1794133122.3018926360`），
   `ParseInt` 失败；改 `ParseFloat` 取整并加单测，真机显示「1.5 小时前」。
3. **CLI 计划重复前缀**：`printPlan` 又加了一次「恢复目标：」，改成直接打印 `Plan.Target`。
4. 🔴 **两侧客户端版本不同造成误挡**（见 §4 第 6 条）：备份机 16.15 读不了归档 1.16，
   容器内 18.6 能读。`row_blockers` / 预演失败提示已改成如实说明「判的是备份机客户端」、
   给出「在目标容器内人工跑 `pg_restore -l`」的指引，并明说工具**不提供绕过开关**。
   保持硬挡是刻意的：工具不连生产端校验，宁可让人复核，也不拿没验证过的归档去覆盖现网。

**当时的未做项**：真正执行 `*_restore.sh` 的写演练、`failed` 场景、临时库数据核对。
20:09 用户声明「数据都可覆盖、都是测试数据、未正式上线」并授权后，这些已在 §7.4 完成
（三项前置由用户授权代填，工具不替人验证；演练前人工只读核对了定时窗口与数据基线，
恢复后清理产物、环境回到基线）。

> ✅ 演练当时的 7788 界面是 19:41 启动的旧 exe（freshness 为 `—`、旧阻塞文案）。
> 19:50 已按界面「重启」的确认门加载新 exe（`rebuild=false`、沿用 7788 与原 token，
> `boot_id` 从 `b0f47b9a…` 换成 `f5dbb2cb…`），并复验：候选新鲜度 `1.8 小时前`、
> 新阻塞文案（说明判的是备份机客户端、给人工复核指引）、勾选 cron 后计划只剩归档阻塞、
> MinIO 3 个桶对方向正确、任意候选路径仍 HTTP 400。**界面与 CLI 现在同源**。

### 7.4 真机写演练（2026-11-08 20:09 用户授权，k4 / prod）

> **授权边界**：用户明确「数据都可覆盖，都是测试数据，目前还未正式上线」。
> 三项前置（已停写 / 已停定时备份 / 已留现场）按该授权作为**人的声明**代填
> `--checks 1,1,1` / `--cron-confirmed`；工具不替人验证，也没有替用户停应用或改 crontab。
> 演练前人工只读核对了定时窗口与数据基线，演练后清理了全部自建产物。

**前置核对**：远端 12:11，备份 cron 在 2:00 / 3:00、巡检 8:00 / 9:00，**不在恢复窗口**
（因此没有停 cron，crontab 全程 4 条未改）；应用 / PG / MinIO / redis 容器都 Up；
`pass_up_dev` public 60 张表、Flyway 9；MinIO 三桶生产端与备份端对象数都是 87 / 1 / 0。

| 演练项 | 做法 | 结论 |
| :--- | :--- | :--- |
| `ready`（写）· MinIO 工具全链路 | `ops restore run --server k4 --component minio --candidate passup-public --confirm yes --minio-confirm YES --checks 1,1,1 --cron-confirmed --cover-production` | ✅ rc=0；`PHASE 1→5` 全跑完；服务端预检门先跑 `--dry-run`；`minio_restore.sh` 逐桶 mirror，3 桶全部成功；报告只报脚本结果、明确「不承诺应用可用」「多余对象由人比对」 |
| 同名覆盖 / 多余对象保留 | 演练前把生产端一个同名 JS 对象改成 smoke 文本（ETag `680913…`），另新建一个多余对象 | ✅ 恢复后同名对象 ETag 还原成备份端的 `4da925…`（907 B，原 JS 内容）；多余对象 ETag `8e52b…` **仍在**；`passup-public` 87→88（87 + 1 多出来的）。`mc mirror` 不带 `--remove` 的语义得到实证 |
| `failed`（失败阶段 / 报告） | 界面 `POST /api/backup/run` 的 `mode=restore` 带**完整门禁**、选中归档不可解析的候选 | ✅ 任务启动 200、`exit_code=1`、`PHASE_FAILED 2`；日志「服务端预检（--dry-run）→ `unsupported version (1.16)` → 预检没过，不执行恢复；远端没有被修改」；`appendRestoreReport` 如实报告失败、不自动重试 / 清场 / 改心跳；失败后 `restore_test` 库仍不存在（实证没写生产端） |
| `ready`（写）· PG 数据可恢复 | 归档阻塞挡住工具链路，改按 §3 人工 SOP 的等价路径：dump 经本机 pipe 中转（不落盘、不碰凭证）→ 主服务器容器内 `pg_restore 18.6` 恢复到**临时库** `restore_test` | ✅ `pg_restore_rc=0`；临时库 60 张表 / Flyway 9，与 `pass_up_dev` **完全一致** —— 证明归档 1.16 在实际恢复侧可读，工具的阻塞是备份机客户端 16.15 造成的误挡 |
| 通用脱敏 / 隔离 | 检查任务日志与 HTTP 响应 | ✅ 无 `SRC_KEY` / `DEST_SECRET` / 私钥路径；`ops status` 与监控页仍只读；心跳仍是 10:18（恢复没有写 `last_success.txt`）；crontab 未改 |
| §3.3 收尾与清理 | `dropdb restore_test`、`mc rm` 多余测试对象、删除宿主机 / 容器 `/tmp` 的临时 dump | ✅ 库列表回到 `pass_up_dev / postgres`（60 表 / Flyway 9）；三桶对象数回到 87 / 1 / 0；容器健康、`problems=[]`。**环境回到演练前基线** |

**两个真机新发现（已写进 §4，未擅自改远端脚本）**：

1. 🔴 `ops backup deps --pg-major 18` **不能**升级已安装的客户端：它只补「缺失」依赖，
   备份机 16.15 已装时预演直接回「没有缺少的依赖」。要解除归档阻塞得手工装 PGDG
   `postgresql-client-18`（§4 第 6 条已修正原先的错误建议）。
2. 🔴 `pg_restore.sh` 内部 `ssh` 吞 stdin（§4 第 10 条）：人工 SOP 经 ssh 喂确认串，
   1 行 / 5 行都报「数据库名称不匹配，恢复操作已取消」；脚本 2a 的 `remote_exec` 先把
   stdin 读光，第 3 步 `read` 拿到 EOF。**工具经 `StreamWith` 喂确认串同样会踩到**，
   只是当前被归档阻塞挡住、尚未可达。修法要给 `remote_exec` 的 ssh 加 `-n`，但
   `remote_docker_stdin` 必须保留 stdin 转发（`globals_*.sql` 靠它喂 `psql`），不能全局加；
   改本仓脚本后还要重新 `ops backup deploy`（会重跑 install.sh / crontab / logrotate）。
   11-08 演练**没有改 `deploy/backup/**`**，当时列为已知遗留风险；该坑已在 2026-11-10
   本仓修好并加断言、做了对照实证（§7.5），但**远端脚本仍未更新**。

**仍未覆盖（2026-11-10 已推进两项，见 §7.5）**：工具侧 PG 正式恢复全链路仍需
「重新部署新脚本 + prod 可达」；归档阻塞已解除、stdin 坑本仓已修并有对照实证。
真正「脚本执行中途失败 / 失败桶」的运行期场景没有人为制造（不为了造故障去破坏环境），
失败阶段与报告措辞由界面预检门失败任务验证。要补完，先按 §7.5 的顺序重跑 §5.7 用例集。

### 7.5 2026-11-10 收口进展（脚本 stdin + 18 客户端；prod 不可达挂起）

> **授权与边界**：用户授权「在 k4 装 18 客户端 + 重新 `ops backup deploy` + 用临时库
> `restore_test` 跑一次工具侧 PG 正式恢复并核对、演练后清理」，不覆盖 `pass_up_dev`。
> 只读前置核对时发现 `prod` 不可达，**只跑了不依赖生产端的部分**；部署与正式恢复主动挂起，
> 没有拿 `--dry-run` 的结果当执行凭证，也没有改远端已部署的脚本。

**① 本仓修复 stdin 坑**（§4 第 10 条）：`deploy/backup/postgres/pg_restore.sh` 把
`SSH_CMD` 拆成 `SSH_BASE` / `SSH_TARGET`，`remote_exec` 带 `-n`、`remote_docker_stdin`
不带；`backupdist_test.go` 从**嵌入产物**读源码锁住三条红线（漏 `-n` / 全局加 `-n` /
给 stdin 链路加 `-n`），三种改坏方式都实测变红、还原后全绿。`go vet ./...`、
`go test ./...`（10 包）、`bash -n`、无 CR、`go build -o ops.exe .`（13,679,616 B）
+ `__dist-check` 全过；**新 exe 已带修好的脚本，但远端尚未部署**。

**② k4 手工装 PGDG 18 客户端**（按 §4 第 6 条既定路线，不改 `ops backup deps` 语义）：
noble / amd64，写 `/etc/apt/sources.list.d/pgdg.sources` 与官方密钥后
`apt-get install -y postgresql-client-18`。结果 `pg_restore` / `pg_dump` 均变 **18.6**，
`postgresql-client-16` 与 `postgresql-client-common` 共存，`libpq5` 顺带升到 18.6；
`sudo -n` 可用、crontab 仍是 4 条、**没有重新部署、没有跑备份**。判据一行未改、
也没有加绕过开关，只是把校验侧客户端对齐到执行侧版本。

**③ 只读链路实证**（本机 CLI → k4，不连 prod）：

| 动作 | 结果 |
| :--- | :--- |
| `ops restore list --server k4 --component pg --json` | `checksum=通过` / `archive=可解析` / `freshness=2.1 天前` / `selectable=true` / `row_blockers=[]`，`scripts_ok=true`、磁盘 14.42 GB |
| `ops restore plan ... --candidate daily/pass_up_dev_20261108_101840.dump --db restore_test --cron-confirmed` | `available=true`、全局阻塞「无」、首行回显恢复目标 `192.168.1.221:2226 / postgres / restore_test` |
| `ops restore run ... --dry-run` | `PHASE 2/5` 用 18.6 读出归档：`TOC Entries: 859` / `Dump Version: 1.16-0` / `Dumped by pg_dump 18.6`；「归档目录可解析；未写生产端」，预演完成且声明不是执行凭证 |

**④ stdin 修复的真实 ssh 对照实证**：把**修改后的脚本**按段落标记切到「第 3 步二次确认」
之后、恢复动作之前（跳过 2d 校验和：远端 `.sha256` 里是绝对路径，本机临时目录对不上），
dump 从 k4 scp 到本机临时目录，配置里把 `PG_SSH_HOST` 指到可达的 k4，让 2a 的内部 ssh
走真实链路；`printf 'restore_test\n'` 喂 stdin：

- 新脚本（`-n`）→ `PROBE_CONFIRMED=[restore_test]`，二次确认读到了确认串；
- 同一份脚本去掉 `-n` → `❌ 数据库名称不匹配，恢复操作已取消。`，**复现 11-08 真机故障**。

临时目录用完即清理。这是「脚本前段 + 真实 ssh」的对照验证，**不是完整恢复脚本端到端**；
后者要等 prod 恢复、脚本部署后才能跑。

**⑤ 挂起原因（只读诊断）**：

- `prod 192.168.1.221` 的 22 / 2226 端口 TCP 都通、ARP `REACHABLE`，但**两个端口都不返回
  SSH banner**（`Connection timed out during banner exchange`），ICMP 100% 丢包；
  从本机与从 k4 过去一致，重试仍失败。30 秒长超时复核：`2226` 依然无 banner，
  `22` 回 `kex_exchange_identification: read: Connection reset by peer` —— 不是慢启动。
  恢复脚本 / `pg_backup.sh` 都走这条 ssh。
- k4 `uptime 9 min`（刚开机）、`cron` / `ssh` 服务 active；`pg_backup.log` 停在
  11-08 10:18，`ops status --server k4 --json` 显示心跳 50.4 小时前、两条 danger
  （超过 26h 阈值）、磁盘剩余 14.8 GB，无其它 problem。**心跳落后主要是关机造成**。
- crontab 4 条（2:00 / 3:00 备份，8:00 / 9:00 巡检）逐条核对未改；`backup.env` 的非凭证
  字段（`PG_SSH_HOST/PORT`、`PG_CONTAINER_NAME`、`PG_DB_NAME`）与清单一致。

**⑥ 为什么没跑 `ops backup deploy`**：[backup-deploy.md](backup-deploy.md) §4.5 写明
preflight 失败会**恢复 `.old` 目录并重跑旧版 install.sh**（可能把任务装回 root crontab）。
此刻 preflight 的 SSH 探测必然失败，跑下去只会把刚修的脚本回滚、把 crontab 弄成半状态，
所以刻意不跑。同理，正式恢复也没有触发。

**⑦ 待办（prod 恢复后按顺序，仍是 §5.7 用例集）**：

1. 复核 `prod` SSH 与容器健康、`pass_up_dev` 基线（60 表 / Flyway 9）。
2. `ops backup deploy --server k4`（不加 `--run-now`）：确认 `/opt/passup-backup/postgres/pg_restore.sh`
   已带 `-n`、crontab 仍是 4 条且属主 `cql`、preflight 通过。
3. `ops restore run --server k4 --component pg --candidate daily/pass_up_dev_20261108_101840.dump
   --db restore_test --confirm yes --db-confirm restore_test --checks 1,1,1 --cron-confirmed`
   —— **临时库**，不覆盖 `pass_up_dev`；看 `PHASE 1→5` 与「只报脚本结果」的报告。
4. 核对 `restore_test` 的 60 表 / Flyway 9 → `dropdb restore_test` → 复核库列表、crontab、
   心跳、容器健康，回到基线。
5. 结论回写本文状态行 / §5.7 / §7.1、`AGENTS.md`、`ui.md` §16、原型 map；原型 HTML 的
   场景语义不变（`blocked` 仍是设计态回归基线）。
6. 可选：让 `ops backup deps --pg-major` 支持「已装但版本低」的对齐安装；本次按既定
   路线**没有改**，换机器仍需人工装版本化客户端。

> 若要撤回 18 客户端：`apt-get remove postgresql-client-18` 并删掉 PGDG 源与密钥即可，
> 但 `libpq5` 已升到 18.6、16 客户端仍在，撤掉后 `/usr/bin/pg_restore` 会回到 16.15，
> **归档阻塞会回来** —— 撤之前先确认是否还要走工具侧恢复。
