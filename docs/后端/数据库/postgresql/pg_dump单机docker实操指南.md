---
title: pg_dump 单机 Docker 实操指南
icon: mdi:console
sort: 4
---

# pg_dump 单机 Docker 实操指南

本文聚焦 **单机 Docker 环境下 `pg_dump` 逻辑全量备份** 的完整落地流程，从手工命令 → 自动化脚本 → Crontab 定时 → Makefile 封装 → 项目目录位置，形成一条可复制的工程化实践链。

---

## 1. pg_dump 标准用法

在单机 Docker 环境下使用 `pg_dump` 非常简单：无需在宿主机安装任何工具，直接利用现有的 PostgreSQL 容器即可完成操作。文中所有 `docker exec` 命令都假设已有一个运行中的 PG 容器（如 `postgres-prod`）。**生产首选方案 A（自定义二进制格式）**。

### 方案 A：自定义二进制格式（生产首选）

使用 `-F c` 导出为 Custom 格式，自带压缩、体积小，且恢复时可用 `pg_restore -j` 开启**多线程并发恢复**。

```bash
docker exec <container> \
  pg_dump -U <username> -d <dbname> -F c -Z 9 -b > /path/to/backup/db_$(date +%Y%m%d_%H%M%S).dump
```

| 参数 | 含义 |
| --- | --- |
| `-F c` | Format Custom（自定义二进制格式） |
| `-Z 9` | 压缩级别 0~9，默认 6。**推荐 9**：对 JSON/TEXT 类数据压缩效果显著（20GB 原始数据可压到 3~6GB） |
| `-b` | 包含大对象（Blobs） |
| `docker exec`（无 `-it`） | **注意**：备份脚本跑在 Cron 下无 TTY，不能用 `-it`（会报 `cannot allocate TTY`）。只用 `docker exec` 即可 |
| `> /path/...` | 重定向到宿主机磁盘，不占用容器内部空间 |

> **备份一致性**：`pg_dump` 基于 MVCC，不会产出脏数据，但**不保证业务层一致性**（例如 `recharge_order` 已提交而 `user_asset` 尚未更新）。高并发支付/资产类系统可在备份前执行 `CHECKPOINT;` 减少恢复重放量：
> ```bash
> docker exec <container> psql -U <username> -d <dbname> -c "CHECKPOINT;"
> ```

### 方案 B：纯文本 SQL（适合小库、可读）

数据量很小或希望直接查看 SQL 内容时使用：

```bash
docker exec <container> \
  pg_dump -U <username> -d <dbname> -F p > /path/to/backup/db_$(date +%Y%m%d_%H%M%S).sql
```

> 体积较大，恢复时无法并行加速。

### 数据恢复

**`.dump` 自定义格式（方案 A）**：

```bash
# --clean --if-exists: 先清理再灌入；-j 4: 4 线程并行
docker exec -i <container> \
  pg_restore -U <username> -d <dbname> --clean --if-exists --no-owner -j 4 < /path/to/backup/db_20260807.dump
```

> **目标库不存在时**：`pg_restore` 不会自动建库。先 `docker exec -i <container> createdb -U <username> <dbname>`，或加 `-C -d postgres` 让 `pg_restore` 自行建库。

**`.sql` 文本格式（方案 B）**：

```bash
docker exec -i <container> psql -U <username> -d <dbname> < /path/to/backup/db_20260807.sql
```

### 常见避坑

1. **全局对象丢失**：`pg_dump` 只备份单库，**不含**用户/角色/密码/表空间。需额外执行：
   ```bash
   docker exec <container> pg_dumpall -U postgres --globals-only > globals.sql
   ```
   恢复时先恢复 `globals.sql`，再 `pg_restore` 业务库（第 2、3 节脚本已内置此步骤）。

2. **免密处理**：若容器未设 `POSTGRES_HOST_AUTH_METHOD=trust`，需传密码：
   ```bash
   docker exec -e PGPASSWORD='your_password' <container> pg_dump ...
   ```

---

## 2. 自动定时备份脚本

生产环境中需要无人值守的每日自动备份，编写 Shell 脚本配合宿主机 `crontab` 运行。

### 2.1 备份保留策略：3-2-1 原则 + 分级

> 备份只存在本地一台机器上是不够的——宿主机硬件故障、勒索病毒、误删都可能导致备份全丢。

**生产最佳实践**：遵循 **3-2-1 备份原则**（3 份数据副本，2 种不同介质，1 份异地/异机存储），本地 + 远端双写，且按时间粒度分级：

```text
/data/backups/postgres/
├── daily/      # 每日全量，本地保留 3 天，远端保留 30 天
├── weekly/     # 每周全量，远端保留 12 周
└── monthly/    # 每月全量，远端保留 12 个月
```

| 存储位置 | 分级 | 保留周期 | 用途 |
| --- | --- | --- | --- |
| 本地宿主机 | daily | 3 天 | 快速恢复日常误操作，降低 RTO |
| 远端 MinIO / SCP / NFS | daily / weekly / monthly | 30 天 / 12 周 / 12 个月 | 防灾难性故障（宿主机损坏、勒索病毒等） |

> **远端备份机的硬件建议**：备份服务器对计算性能要求不高，重点是大容量低成本存储。推荐低配 CPU + 8TB HDD RAID 1/10，大幅降低整体硬件 TCO。若远端采用专用 MinIO，还可利用其 Bucket Lifecycle 自动清理过期备份，无需手写清理脚本。

> 脚本中通过 `cron` 的 `$(date +%u)`（星期几，1=周一）和 `$(date +%d)`（几号）判断当天属于哪个分级，自动写入对应子目录。

### 2.2 生产级备份脚本（核心）

以下脚本整合了**业务库 dump + 全局对象备份 + 完整性校验 + 分级目录 + 本地清理**，作为所有远端方案的基础。远端同步部分在 2.3 中以"追加片段"形式给出，避免脚本主体重复。

```bash
#!/bin/bash
set -euo pipefail

# ============================================================
# 配置区（按实际环境修改）
# ============================================================
CONTAINER_NAME="postgres-prod"                  # PG 容器名称
DB_USER="postgres"                              # 数据库用户名
DB_NAME="mydb"                                  # 数据库名称
BACKUP_ROOT="/data/backups/postgres"            # 宿主机备份根目录
LOCAL_RETENTION_DAYS=3                          # 本地 daily 保留天数

# ============================================================
# 分级目录判定（daily / weekly / monthly）
# ============================================================
DOW=$(date +%u)                                 # 1=周一 ... 7=周日
DOM=$(date +%d)                                 # 当月第几天（01-31）

if [ "${DOM}" = "01" ]; then
    GRADE="monthly"                             # 每月 1 号 → monthly
elif [ "${DOW}" = "1" ]; then
    GRADE="weekly"                              # 每周一 → weekly
else
    GRADE="daily"                               # 其余 → daily
fi

BACKUP_DIR="${BACKUP_ROOT}/${GRADE}"
mkdir -p "${BACKUP_DIR}"

DATE=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.dump"
GLOBALS_FILE="${BACKUP_DIR}/globals_${DATE}.sql"

# ============================================================
# 1. 全局对象备份（角色 / 权限）
# ============================================================
echo "[$(date)] 开始备份全局对象（角色/权限）..."
docker exec "${CONTAINER_NAME}" pg_dumpall -U "${DB_USER}" --globals-only > "${GLOBALS_FILE}"
sha256sum "${GLOBALS_FILE}" > "${GLOBALS_FILE}.sha256"
echo "[$(date)] 全局对象备份完成: ${GLOBALS_FILE}"

# ============================================================
# 2. 业务库备份
# ============================================================
echo "[$(date)] 开始备份业务库 ${DB_NAME}..."

# 高并发场景可选：先做检查点减少恢复重放量
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "CHECKPOINT;" 2>/dev/null || true

# 导出（-F c 自定义格式，-Z 9 最高压缩）
docker exec "${CONTAINER_NAME}" pg_dump \
    -U "${DB_USER}" -d "${DB_NAME}" -F c -Z 9 -b > "${DUMP_FILE}"

# ============================================================
# 3. 完整性校验
# ============================================================
if [ ! -s "${DUMP_FILE}" ]; then
    echo "[$(date)] ❌ 备份失败：文件为空！"
    exit 1
fi

sha256sum "${DUMP_FILE}" > "${DUMP_FILE}.sha256"

if ! sha256sum -c "${DUMP_FILE}.sha256" --status; then
    echo "[$(date)] ❌ 校验和验证失败！"
    exit 1
fi

echo "[$(date)] ✅ 备份成功: ${DUMP_FILE} (分级: ${GRADE})"

# ============================================================
# 4. 本地清理过期备份（仅清理 daily 目录）
# ============================================================
find "${BACKUP_ROOT}/daily" -type f -mtime +"${LOCAL_RETENTION_DAYS}" -delete 2>/dev/null || true

# ============================================================
# 5. 【远端同步占位】—— 将下方 2.3 中选定的方案片段追加到此处
# ============================================================
```

> **关键点**：
> - `set -euo pipefail`：任何命令失败立即退出，未定义变量报错，管道中任一命令失败即失败。
> - **分级逻辑**：每月 1 号 → `monthly/`，每周一 → `weekly/`，其余 → `daily/`。远端保留策略由 MinIO 生命周期 / 远程清理脚本控制，本地只清理 `daily/`。
> - **全局对象备份内置**：`pg_dumpall --globals-only` 与业务库 dump 在同一脚本中执行，保证时间一致。
> - **`CHECKPOINT` 容错**：`2>/dev/null || true` 避免容器未就绪时中断脚本。

### 2.3 远端同步方案（三选一追加到 2.2 脚本末尾）

在单机 Docker + Linux 环境下，将备份同步到远端常用三种方案。**对于已在使用 MinIO 的技术栈，强烈推荐方案 A 作为主路径**，SCP / NFS 作为备选。

将选定方案的代码片段追加到 2.2 脚本的"远端同步占位"处即可。

---

#### 方案 A：MinIO / S3（已用 MinIO 栈的首选 ⭐）

若已部署 MinIO 或云对象存储（阿里云 OSS / 腾讯云 COS），使用 `mc` (MinIO Client) 上传。**最大优势是生命周期管理**：在 MinIO 控制台配置 `daily 保留 30 天 / weekly 保留 12 周 / monthly 保留 12 个月`，无需自己写清理逻辑。

**前提条件**：`mc alias set backup-minio http://minio-host:9000 ACCESSKEY SECRETKEY`

追加到 2.2 脚本末尾的片段：

```bash
# --- MinIO 同步（追加到 2.2 脚本的“远端同步占位”处） ---
MINIO_ALIAS="backup-minio"
MINIO_BUCKET="pg-backups-bucket"

echo "[$(date)] 同步到 MinIO: ${MINIO_ALIAS}/${MINIO_BUCKET}/${GRADE}/"
mc cp "${DUMP_FILE}"          "${MINIO_ALIAS}/${MINIO_BUCKET}/${GRADE}/"
mc cp "${DUMP_FILE}.sha256"   "${MINIO_ALIAS}/${MINIO_BUCKET}/${GRADE}/"
mc cp "${GLOBALS_FILE}"       "${MINIO_ALIAS}/${MINIO_BUCKET}/${GRADE}/"
mc cp "${GLOBALS_FILE}.sha256" "${MINIO_ALIAS}/${MINIO_BUCKET}/${GRADE}/"
echo "[$(date)] ✅ MinIO 同步完成"
```

> 恢复前校验：`mc cat ${MINIO_ALIAS}/${MINIO_BUCKET}/${GRADE}/filename.sha256 | sha256sum -c -`

---

#### 方案 B：SCP 推送

在本地宿主机生成备份后，使用 `scp` 传输到远程备份机器。

**前提条件**：宿主机配置 SSH 免密登录（`ssh-keygen` + `ssh-copy-id`）。

追加到 2.2 脚本末尾的片段：

```bash
# --- SCP 远程同步（追加到 2.2 脚本的“远端同步占位”处） ---
REMOTE_USER="backupuser"
REMOTE_IP="192.168.1.200"
REMOTE_DIR="/nas/pg_backups/${GRADE}"
REMOTE_RETENTION_DAYS=30

# 确保远程目录存在
ssh "${REMOTE_USER}@${REMOTE_IP}" "mkdir -p ${REMOTE_DIR}"

# 推送文件
scp "${DUMP_FILE}" "${DUMP_FILE}.sha256" \
    "${GLOBALS_FILE}" "${GLOBALS_FILE}.sha256" \
    "${REMOTE_USER}@${REMOTE_IP}:${REMOTE_DIR}/"

if [ $? -eq 0 ]; then
    echo "[$(date)] ✅ SCP 同步完成"
else
    echo "[$(date)] ⚠️ SCP 同步失败！"
fi

# 远程清理过期备份
ssh "${REMOTE_USER}@${REMOTE_IP}" \
    "find ${REMOTE_DIR}/.. -type f -mtime +${REMOTE_RETENTION_DAYS} -delete"
```

---

#### 方案 C：NFS 共享挂载

如果备份机器支持 NFS，直接将远程目录挂载到宿主机：

```bash
mount -t nfs 192.168.1.200:/nas/pg_backups /mnt/remote_backups
```

之后将 2.2 脚本中的 `BACKUP_ROOT` 改为 `/mnt/remote_backups`，数据直接落到远程机器上，无需任何传输命令。

---

## 3. 数据恢复自动化

在生产事故或灾难恢复（DR）发生时，运维/开发人员往往处于高压状态，手动敲命令行极易出错（如漏掉 `-j` 多线程参数、选错数据库名）。将恢复流程封装为自动化脚本，能大幅降低 **RTO（恢复时间目标）**。

> **备份 vs 恢复的核心区别**：
> - **备份**：无人值守、自动定时、高频执行、无破坏性。
> - **恢复**：**有人值守、手动触发、低频执行、具备高破坏性（会覆盖当前数据）**。
>
> 因此恢复脚本必须引入 **二次确认** 与 **防误触保护**，且**绝对禁止放进 Crontab**。

### 3.1 统一恢复脚本（`pg_restore.sh`）

一个脚本覆盖两种场景：**本地恢复**（指定文件或自动查找最新）与 **MinIO 直取恢复**（免下载）。放在 `deploy/backup/` 目录下。

```bash
#!/bin/bash

# 注意：【不】使用 set -e。原因：脚本含交互式 read、文件查找等逻辑，
# 且需在恢复失败时打印自定义信息而非直接崩溃，故改为手动检查关键命令退出码。

# ============================================================
# 配置区（按实际环境修改）
# ============================================================
CONTAINER_NAME="postgres-prod"                  # PG 容器名称
DB_USER="postgres"                              # 数据库用户名
DB_NAME="mydb"                                  # 目标数据库名称
BACKUP_ROOT="/data/backups/postgres"            # 本地备份根目录（含 daily/weekly/monthly 子目录）
JOBS=4                                          # pg_restore 并行线程数

# MinIO 配置（仅 --source minio 时需要）
MINIO_ALIAS="backup-minio"
MINIO_BUCKET="pg-backups-bucket"

# ============================================================
# 参数解析
# ============================================================
SOURCE="local"          # local | minio
RESTORE_FILE=""         # 指定文件路径（可选）

while [ $# -gt 0 ]; do
    case "$1" in
        --source)   SOURCE="$2"; shift 2 ;;
        --file)     RESTORE_FILE="$2"; shift 2 ;;
        --db)       DB_NAME="$2";    shift 2 ;;
        *)          echo "未知参数: $1"; echo "用法: $0 [--source local|minio] [--file /path/to/backup.dump] [--db dbname]"; exit 1 ;;
    esac
done

# ============================================================
# 1. 确定恢复源文件
# ============================================================
if [ "${SOURCE}" = "minio" ]; then
    # --- MinIO 模式：自动查找最新备份 ---
    echo "🔍 正在从 MinIO 查找最新备份..."
    # 优先 daily 目录，按文件名（含时间戳）排序取最新
    LATEST=$(mc ls "${MINIO_ALIAS}/${MINIO_BUCKET}/daily/" 2>/dev/null \
        | awk '{print $NF}' | grep '\.dump$' | sort -r | head -n 1)
    if [ -z "${LATEST}" ]; then
        echo "❌ 未在 MinIO 找到任何 .dump 备份文件！"
        exit 1
    fi
    RESTORE_SRC="minio://${MINIO_ALIAS}/${MINIO_BUCKET}/daily/${LATEST}"
    echo "最新备份: ${RESTORE_SRC}"

elif [ -n "${RESTORE_FILE}" ]; then
    # --- 指定文件模式 ---
    RESTORE_SRC="${RESTORE_FILE}"

else
    # --- 本地自动查找：递归搜索 daily/weekly/monthly 子目录 ---
    echo "🔍 未指定备份文件，正在递归搜索最新备份..."
    RESTORE_FILE=$(find "${BACKUP_ROOT}" -name "*.dump" -type f -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -n 1 | awk '{print $2}')
    RESTORE_SRC="${RESTORE_FILE}"
fi

# ============================================================
# 2. 前置校验
# ============================================================

# 2a. 容器健康检查（仅本地/容器模式需要）
if [ "${SOURCE}" != "minio" ]; then
    CONTAINER_STATUS=$(docker inspect -f '{{.State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "unknown")
    if [ "${CONTAINER_STATUS}" = "unhealthy" ]; then
        echo "❌ 容器 [${CONTAINER_NAME}] 健康状态为 unhealthy，请先修复后再恢复！"
        exit 1
    elif [ "${CONTAINER_STATUS}" = "starting" ]; then
        echo "⚠️  容器 [${CONTAINER_NAME}] 仍在启动中，建议等待健康后再执行恢复。"
    fi
fi

# 2b. 文件存在性检查（本地模式）
if [ "${SOURCE}" != "minio" ]; then
    if [ ! -s "${RESTORE_FILE}" ]; then
        echo "❌ 错误: 未找到可用的备份文件！路径: ${RESTORE_FILE}"
        exit 1
    fi
fi

# 2c. 完整性校验
if [ "${SOURCE}" != "minio" ]; then
    CHECKSUM_FILE="${RESTORE_FILE}.sha256"
    if [ -f "${CHECKSUM_FILE}" ]; then
        echo "🔑 正在验证备份完整性..."
        if ! sha256sum -c "${CHECKSUM_FILE}" --status 2>/dev/null; then
            echo "❌ 校验和验证失败！备份文件可能已损坏，操作已中止。"
            exit 1
        fi
        echo "✅ 校验和验证通过。"
    fi
else
    # MinIO 模式：先下载 .sha256 校验
    REMOTE_SHA256="${MINIO_ALIAS}/${MINIO_BUCKET}/daily/${LATEST}.sha256"
    echo "🔑 正在从 MinIO 获取校验和..."
    if mc cat "${REMOTE_SHA256}" 2>/dev/null | sha256sum -c --status 2>/dev/null; then
        echo "✅ MinIO 备份完整性校验通过。"
    else
        echo "⚠️  无法校验 MinIO 备份完整性（校验和文件不存在或验证失败），继续执行..."
    fi
fi

# ============================================================
# 3. 二次确认
# ============================================================
echo ""
echo "=================================================="
echo "🚨 警告：准备执行数据库恢复操作！"
echo "=================================================="
echo "数据来源   : ${SOURCE}"
echo "目标容器   : ${CONTAINER_NAME}"
echo "目标数据库 : ${DB_NAME}"
echo "恢复源     : ${RESTORE_SRC}"
echo "=================================================="
echo "⚠️  此操作将清空/覆盖数据库 [${DB_NAME}] 中的原有数据！"
read -r -p "确认继续？输入 [${DB_NAME}] 以确认: " CONFIRM_DB

if [ "${CONFIRM_DB}" != "${DB_NAME}" ]; then
    echo "❌ 数据库名称不匹配，恢复操作已取消。"
    exit 1
fi

# ============================================================
# 4. 先恢复全局对象（角色/权限）
# ============================================================
if [ "${SOURCE}" != "minio" ]; then
    # 本地：查找与 dump 同目录的最新 globals_*.sql
    DUMP_DIR=$(dirname "${RESTORE_FILE}")
    GLOBALS_FILE=$(find "${DUMP_DIR}" -maxdepth 1 -name "globals_*.sql" -type f -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -n 1 | awk '{print $2}')
    if [ -n "${GLOBALS_FILE}" ] && [ -s "${GLOBALS_FILE}" ]; then
        echo "📋 正在恢复全局对象（角色/权限）: ${GLOBALS_FILE}"
        docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d postgres < "${GLOBALS_FILE}"
        echo "✅ 全局对象恢复完成。"
    else
        echo "⚠️  未找到 globals_*.sql，跳过全局对象恢复。"
    fi
fi

# ============================================================
# 5. 执行业务库恢复
# ============================================================
echo "🚀 开始恢复业务库 ${DB_NAME}..."

if [ "${SOURCE}" = "minio" ]; then
    # MinIO 直取：先建库，再灌数据流
    docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d postgres \
        -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || true
    mc cat "${MINIO_ALIAS}/${MINIO_BUCKET}/daily/${LATEST}" \
        | docker exec -i "${CONTAINER_NAME}" pg_restore \
            -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner -j "${JOBS}"
    RET=$?
else
    FILENAME=$(basename "${RESTORE_FILE}")
    case "${FILENAME}" in
        *.dump)
            docker exec -i "${CONTAINER_NAME}" \
                pg_restore -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner -j "${JOBS}" < "${RESTORE_FILE}"
            RET=$?
            ;;
        *.sql)
            docker exec -i "${CONTAINER_NAME}" \
                psql -U "${DB_USER}" -d "${DB_NAME}" < "${RESTORE_FILE}"
            RET=$?
            ;;
        *)
            echo "❌ 无法识别的文件扩展名（仅支持 .dump 或 .sql）"
            exit 1
            ;;
    esac
fi

if [ "${RET}" -eq 0 ]; then
    echo "✅ 数据库恢复成功！"
else
    echo "❌ 数据库恢复异常（退出码 ${RET}），请检查日志！"
    exit 1
fi
```

赋予执行权限：

```bash
chmod +x deploy/backup/pg_restore.sh
```

### 3.2 使用方式

```bash
# 本地恢复：自动查找最新备份（递归搜索 daily/weekly/monthly 子目录）
bash deploy/backup/pg_restore.sh

# 本地恢复：指定文件
bash deploy/backup/pg_restore.sh --file /data/backups/postgres/daily/mydb_20260810_020000.dump

# 本地恢复：指定目标库（默认 mydb）
bash deploy/backup/pg_restore.sh --db restore_test

# MinIO 直取恢复（免下载，自动定位最新备份）
bash deploy/backup/pg_restore.sh --source minio --db restore_test
```

### 3.3 定期恢复演练（DR 演练）

"每天备份、从没恢复过"是生产最大隐患。建议**每月**用独立测试库做一次演练：

```bash
# 用最新备份恢复到临时库验证
bash deploy/backup/pg_restore.sh --db restore_test

# 验证关键指标（表数量、行数等）
docker exec -i postgres-prod psql -U postgres -d restore_test -c "
  SELECT schemaname, tablename, n_live_tup
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC
  LIMIT 20;
"

# 演练结束清理
docker exec -i postgres-prod psql -U postgres -d postgres -c "DROP DATABASE restore_test;"
```

> 演练也可直接走 MinIO 直取：`bash deploy/backup/pg_restore.sh --source minio --db restore_test`

### 3.4 恢复脚本关键设计要点

| 要点 | 说明 |
| --- | --- |
| **绝对禁止进 Cron** | 恢复只能手动触发 |
| **二次确认** | 输入目标库名才放行，防手滑 |
| **容器健康检查** | `docker inspect Health.Status`，拒绝向 unhealthy 容器灌数据 |
| **完整性校验** | 自动验证同目录 `.sha256`，MinIO 模式先拉校验和再恢复 |
| **全局对象优先** | 自动查找同目录最新 `globals_*.sql` 并先恢复角色/权限 |
| **分级目录兼容** | `find` 递归搜索 `daily/weekly/monthly` 子目录，按修改时间取最新 |
| **`--no-owner`** | 避免恢复时因角色缺失报错 |
| **`--clean --if-exists`** | 先清理再灌入，`--if-exists` 容错首次恢复时对象不存在 |

---

## 4. 定时执行（Crontab + Makefile）

备份脚本需要无人值守定时运行。推荐用 Makefile 封装 Crontab 操作，避免手动编辑 `crontab -e` 时出现拼写错误。

### 4.1 手动方式（快速验证）

```bash
chmod +x deploy/backup/pg_backup.sh
crontab -e
```

添加：

```
0 2 * * * /bin/bash /path/to/deploy/backup/pg_backup.sh >> /var/log/pg_backup.log 2>&1
```

### 4.2 Makefile 封装（推荐）

核心原则：**幂等性**（重复执行不会产生重复条目）。

```makefile
# 定义变量
SCRIPT_PATH := $(shell pwd)/deploy/backup/pg_backup.sh
RESTORE_SCRIPT := $(shell pwd)/deploy/backup/pg_restore.sh
LOG_PATH := /var/log/pg_backup.log
# Crontab 表达式：每天凌晨 2:00 执行
CRON_SCHEDULE := 0 2 * * *
CRON_JOB := $(CRON_SCHEDULE) /bin/bash $(SCRIPT_PATH) >> $(LOG_PATH) 2>&1

.PHONY: backup-cron-install backup-cron-status backup-cron-uninstall
.PHONY: db-restore db-restore-latest db-restore-minio

## 安装或更新 Crontab 定时任务
backup-cron-install:
	@chmod +x $(SCRIPT_PATH)
	@mkdir -p /var/log
	@# 读取现有 crontab，过滤旧任务，追加新任务（幂等）
	@(crontab -l 2>/dev/null | grep -v "$(SCRIPT_PATH)"; echo "$(CRON_JOB)") | crontab -
	@echo "✅ Crontab 备份任务已配置！"
	@crontab -l | grep "$(SCRIPT_PATH)"

## 查看备份 Crontab 状态
backup-cron-status:
	@crontab -l 2>/dev/null | grep "$(SCRIPT_PATH)" || echo "⚠️ 未找到备份任务！"

## 卸载 Crontab 定时任务
backup-cron-uninstall:
	@(crontab -l 2>/dev/null | grep -v "$(SCRIPT_PATH)") | crontab -
	@echo "🗑️  备份任务已移除！"

## 恢复最新本地备份（递归搜索分级目录）
db-restore-latest:
	@chmod +x $(RESTORE_SCRIPT)
	@$(RESTORE_SCRIPT)

## 恢复指定备份文件 (用法: make db-restore FILE=/path/to/x.dump)
db-restore:
	@chmod +x $(RESTORE_SCRIPT)
	@$(RESTORE_SCRIPT) --file $(FILE)

## 从 MinIO 直接恢复到测试库 (用法: make db-restore-minio DB=restore_test)
db-restore-minio:
	@chmod +x $(RESTORE_SCRIPT)
	@$(RESTORE_SCRIPT) --source minio --db $(DB)
```

### 指令速查

| 命令 | 作用 |
| --- | --- |
| `make backup-cron-install` | 安装 Crontab 定时备份（自动去重） |
| `make backup-cron-status` | 查看备份定时任务状态 |
| `make backup-cron-uninstall` | 移除备份定时任务 |
| `make db-restore-latest` | 自动查找最新本地备份并恢复（含二次确认） |
| `make db-restore FILE=/path/to/x.dump` | 恢复指定备份文件（含二次确认） |
| `make db-restore-minio DB=restore_test` | 从 MinIO 直取最新备份恢复到测试库 |

### 避坑

1. **缩进必须为 Tab**：Makefile 命令行开头必须用 Tab，不能用空格。
2. **`$(shell pwd)` 解析为绝对路径**：保证 Cron 运行时不会因相对路径找不到脚本。

---

## 5. 项目目录结构建议

结合 **Docker、PostgreSQL 备份脚本、Makefile** 以及 **Spring Boot 后端**，建议采用**标准 Maven 架构 + 运维部署解耦**的目录组织方式：

```text
my-springboot-project/               # 项目根目录
├── deploy/                          # 运维与部署目录（与业务代码隔离）
│   ├── docker/
│   │   ├── Dockerfile               # Spring Boot 镜像构建文件
│   │   └── docker-compose.yml       # 单机容器编排（App + PG）
│   ├── backup/                      # 备份恢复统一目录（未来可扩 redis/minio 备份）
│   │   ├── pg_backup.sh             # ← 核心备份脚本（定时、无人值守，含 MinIO/SCP 远端同步片段）
│   │   ├── pg_restore.sh            # ← 统一恢复脚本（支持本地 / MinIO 两种来源，含二次确认）
│   │   ├── README.md                # 备份恢复操作手册
│   │   └── init.sql                 # 数据库初始化 SQL
│   └── env/
│       ├── .env.example             # 环境变量模板
│       └── postgres.env.example
│
├── src/                             # Spring Boot 源码（按 modules 分包）
│   └── ...
│
├── .gitignore
├── Makefile                         # ← Makefile 放根目录，作为统一入口
├── pom.xml
└── README.md
```

### 设计要点

- **运维解耦**：所有 Dockerfile、Compose 文件、备份/恢复脚本、初始化 SQL 统一放在 `deploy/` 下，不堆在项目根目录。备份脚本归拢到 `deploy/backup/`，后续引入 `redis_backup.sh`、`minio_backup.sh` 也不混乱。
- **安全隔离**：`.gitignore` 中忽略 `.dump`、`.sql`、`.sha256`、`.log`、`.env` 等敏感/临时文件，只提交模板（`.example`）。
- **Makefile 作为统一入口**：`make backup-cron-install` 一行命令完成 Crontab 安装；`make db-restore` / `make db-restore-latest` 统一入口触发恢复（含二次确认），新人无需了解底层细节。

---

## 6. 数据量选型：pg_dump 还是物理备份？

`pg_dump` 是逻辑备份，简单可靠、可跨大版本恢复，但库越大越慢、恢复越久，且不支持增量。随着数据规模增长，应按以下路线升级：

| 数据库大小 | 推荐方案 | 说明 |
| --- | --- | --- |
| < 20GB | `pg_dump -Fc -Z9` | 本文方案，简单、可跨版本恢复 |
| 20~100GB | `pg_dump` + 压缩 + 分级保留 | 配合 daily/weekly/monthly，恢复时间尚可接受 |
| 100GB~1TB | pgBackRest | 支持增量备份、并行、WAL 归档、PITR 时间点恢复 |
| TB 级 | `pg_basebackup` + WAL 连续归档 | 物理备份，逻辑备份已不现实 |

> 物理备份与 WAL 归档方案见：[单机 Docker PostgreSQL 备份与恢复](./单机Docker备份与恢复.md)。

> 项目目录结构设计原则见：[项目目录结构规范](../../架构设计/项目目录结构规范.md)。
