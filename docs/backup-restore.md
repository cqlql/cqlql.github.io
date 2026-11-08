> 状态：**分册已补（2026-11-08）**。现行能力 = **人工在备份机跑 `pg_restore.sh` / `minio_restore.sh`**；
> **`ops` CLI 与界面都没有恢复入口，代码未实现**，§5 是方案、未排期，**不要照抄执行**。
> 脚本行为来自代码阅读，恢复流程**尚未做真机演练**；演练结论回来要更新本文状态行。

# 备份恢复

> 分册；唯一索引见 [AGENTS.md](../AGENTS.md)。
> 脚本清单与「禁止入 Crontab」红线见 [backup-scripts.md](backup-scripts.md) §2；
> 安装 / 升级见 [backup-deploy.md](backup-deploy.md)；只读监控见 [backup-monitor.md](backup-monitor.md)；
> 配置键见 [config.md](config.md)（本文只引用键名，不复述键表与默认值）。

## 1. 现状与缺口

「备份恢复」指**把备份端的数据写回生产端**：与备份方向相反，且会覆盖现网数据。
备份是 pull（`pg_backup.sh` 从主服务器拉 dump、`minio_backup.sh` 从生产端 MinIO 拉桶），
恢复是 push（备份端 `scp` / `mc mirror` 推回主服务器）。

| 层 | 现状 | 判据 |
| :--- | :--- | :--- |
| 恢复脚本 | ✅ 已有 | `deploy/backup/postgres/pg_restore.sh`、`deploy/backup/minio/minio_restore.sh`；随 `ops backup deploy` 的整树 tar 一起落到远端（打包时所有 `.sh` 都是 0755） |
| 手工入口 | ✅ 已有 | 各自 Makefile 的 `pg-restore` / `pg-restore-latest` / `minio-restore` / `minio-restore-dry-run` |
| 二次确认 | ✅ 脚本内 | PG 要求输入**目标库名**，MinIO 要求输入 `YES` |
| `ops` CLI | ❌ 没有 | `main.go` 注册表里没有任何 `restore` 动词；`ops status` 与备份监控页都是**只读**，明确不触发恢复 |
| 界面 | ❌ 没有 | 五个导航项里没有恢复页，也没有候选清单 / 预演 / 执行报告 |
| 文档 | ❌ 只有一句 | [backup-scripts.md](backup-scripts.md) §2 只写了「恢复脚本禁止入 Crontab」，没有流程、风险与验收 |

**缺口的实际代价**：备份可用 ≠ 可恢复。出事时没有「有哪些恢复点、哪个是完整的、恢复到哪里、
恢复完怎么验」的清单，全靠人记得脚本参数和目录结构；也没有一次预演来提前发现
「客户端版本不兼容 / 桶名前缀写反 / 磁盘不够放三份 dump」。

🔴 **本分册不新增代码**。§3 是现在就能照着做的人工流程，§5 是给后续实现留的施工图。

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
7. 🔴 **磁盘要留三份**：`.dump` 同时占备份端、主服务器 `/tmp`、容器内 `/tmp`；
   `PG_RESTORE_JOBS` 调并发，不解决空间。传大文件前先看 `df`。
8. 🔴 **身份与凭证**：以清单 `user` 跑（同一 HOME / `~/.ssh` / `~/.mc`）；
   `backup.env` 是 0600，私钥路径与 `SRC_KEY` / `DEST_SECRET` 等凭证**不进任何输出 / 日志**；
   恢复脚本自己也不打印它们。
9. 🔴 **失败不自动重试、不自动清场**：`pg_restore.sh` 中途失败可能留下宿主机 / 容器 `/tmp`
   的 dump、`mc mirror` 可能只成功了一部分桶。如实报告「哪一步、哪些桶失败」，由人决定下一步。

## 5. 工具侧方案（未实现，未排期）

> 🔴 下面所有 `ops restore ...` / 接口名都是**草案**：`main.go` 没有注册、`internal/` 没有该包、
> `web/` 没有该页。**不要执行、不要写进 AGENTS.md 的命令表**（命令表只列已实现命令）。

### 5.1 三条原则

- **比安装更严**：恢复是覆盖现网数据的写动作，照抄 [AGENTS.md](../AGENTS.md)
  硬约束 15 / 21 的六道门（`confirm=="yes"`、服务端预检、`name` 只认清单、密码只走 stdin、
  任务脱离 HTTP、单任务锁与脱敏），并加码「先预演、再执行」「目标库名人工输入」。
- **只读与写分离**：候选清单 / 预演是只读的，默认视图只读；执行是独立且显式的动作。
  恢复不塞进「备份监控」页，也不改 `status` 的判据。
- **不重写恢复逻辑**：复用现有两个 `*_restore.sh`（脚本已 embed、已随部署落地），
  工具只负责「列候选 → 校验 → 显式触发 → 收日志与报告」。Go 侧不重新实现 pg_restore / mc mirror。

### 5.2 三段式草案

| 阶段 | 动作 | 产出 |
| :--- | :--- | :--- |
| A · 只读 | `ops restore list --server <name> --component pg|minio` | 候选清单：文件名 / 时间 / 大小 / 校验和是否存在、桶名与对象数；采不到标 `collected=false`，不用 0 兜底（硬约束 3） |
| A · 预演 | `ops restore plan ... --dry-run`（PG: `pg_restore -l`；MinIO: `mc mirror --dry-run`） | 将执行的命令 + 影响清单 + 阻塞原因，**不写生产端** |
| B · 执行 | `ops restore run ... --file <候选> --db <库名>` / 界面按钮 | 复用脚本，输出接任务日志，逐行脱敏，结束给报告 |

服务端门禁（B 阶段，在六道门之外）：

- 候选**只认备份根目录下的文件**，路径由服务端拼、接口不接收任意路径；
  `--db` 目标库名必须人输入并由服务端与二次确认值逐字比对；
- 🔴 **默认恢复到临时库**，恢复到生产库名要额外勾一次「我确认覆盖生产」；
- `--force` / 自动停 cron / 自动重试 / 自动删除多余对象一律**不开放**；停 cron 是单独的显式动作
  （照 [components.md](components.md) §8 的「动作计划由 Go 侧下发、前端只渲染」）；
- 一次只恢复一个组件、一个候选；失败如实报告，不自动清场、不改 `last_success.txt`；
- 界面是第 6 个导航项，默认只读；执行按钮要点按钮 + 二次确认，前端不算任何指标。

🔴 **不做**：定时 / 自动恢复、回滚数据库、精确回滚（自动删多余对象）、从任意主机或任意路径恢复、
把恢复脚本写进 crontab、给恢复单设一套账号或凭证。

### 5.3 落地时同步清单（避免漏改）

`main.go` 注册表 + 菜单 `probe("restore")` → 新增 `internal/restore/`（依赖方向仍是
`main → 能力包 → shared`，`shared` 不反向 import）→ `web/src/features/restore/` →
[ui.md](ui.md) 新增一节 → [AGENTS.md](../AGENTS.md) 状态行 / 硬约束 / 命令表 / 文档速查表 /
目录边界 → 若新增配置键，先过 [config.md](config.md) §4 的唯一事实源
（`env-schema.json` / `opsEnvKeys`）与生成器，`go test` 会挡住文档键漂移 →
本文状态行与 §5 改为「已实现 + 真机演练结论」。
[backup-scripts.md](backup-scripts.md) §2 的「禁止入 Crontab」红线**不变**。

### 5.4 验收（真机，代码阶段用）

| 项 | 判据 |
| :--- | :--- |
| 预演不写生产 | `--dry-run` 前后生产库 / 桶内容一致，远端无新增文件 |
| 恢复可验证 | 先恢复到临时库并对得上关键表 / 对象，再决定是否覆盖生产 |
| 门禁 | 缺 `confirm` / 未知 `name` / 任意路径 / 库名不匹配都被服务端拒绝 |
| 失败可解释 | 断网、缺校验和、客户端版本不足分别给出明确原因，不猜 0、不缓存 |
| 隔离 | 恢复期间 `ops status` 与监控页仍只读；crontab 不被自动改动 |
| 脱敏 | 任务日志 / HTTP 响应里没有私钥路径、没有 MinIO / DB 凭证 |

## 6. 决策与备选

| 决策 | 备选 | 为什么选这个 |
| :--- | :--- | :--- |
| 先补文档、不动代码 | 直接做 `ops restore` | 恢复是高危写动作，先把现行人工流程、真实脚本行为与红线写清楚；今天就能照着演练，演练结论会反过来改方案 |
| 复用 `*_restore.sh`，工具只做编排 | 用 Go 重写恢复逻辑 | 两个脚本已在备份机上、已被 embed，重写等于维护两套恢复语义，且无法真机验证的那套最容易漂 |
| 三段式「列候选 → 预演 → 执行」 | 一个「立即恢复」按钮 | 「有没有可用恢复点」和「恢复会不会覆盖错对象」是两个问题，必须分开看；也和组件页「动作计划由 Go 侧下发」同构 |
| 默认恢复到临时库 | 直接覆盖生产库 | 恢复点校验、Flyway 兼容性都要在临时库上先证一遍；生产覆盖只能是最后一个显式决定 |
| 不做精确回滚 / 自动删多余对象 | `mc mirror --remove`、恢复前 drop 库 | 删除是单向且不可逆的，与「不 `down -v`、不删 `/data`」同一条红线；多余对象由人比对后决定 |
| 停 cron 是独立显式动作 | 恢复前自动停、结束后自动装 | 自动改 crontab 会在失败时留下「定时任务被永久关掉」的半状态；现行标签还有前缀误删问题（§4 第 4 条），更不能悄悄做 |
