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

### 方案 A：导出为自定义二进制格式（生产首选，带压缩）

使用 `-F c` 参数导出为 Custom 二进制格式，不仅自带压缩、体积小，而且后续可以使用 `pg_restore` 开启**多线程并发恢复**。

```bash
docker exec <your_postgres_container_name> \
  pg_dump -U <username> -d <dbname> -F c -Z 9 -b -v > /path/to/backup/db_$(date +%Y%m%d_%H%M%S).dump
```

| 参数 | 含义 |
| --- | --- |
| `-i` | **恢复侧必须带**：`pg_restore` / `psql` 读取文件时保持 stdin 打开以喂入备份内容。**备份侧不要加 `-t`**（Cron 无 TTY，否则报 `cannot allocate TTY`）。 |
| `-F c` | Format Custom（自定义二进制格式） |
| `-Z 9` | 压缩级别 0~9，默认 6。**推荐 9**：对 JSON / TEXT / Markdown 这类 AI 聊天数据压缩效果显著（如 20GB 原始数据可压到 3~6GB）。 |
| `-b` | 导出大对象数据（Blobs） |
| `-v` | 显示备份详细日志 |
| `> /path/...` | 通过重定向直接将数据保存到**宿主机**的物理磁盘上，不占用容器内部空间 |

> **备份一致性提示**：`pg_dump` 内部基于 MVCC，不会产出脏数据，但**不保证业务层一致性**（例如 `recharge_order` 已提交而 `user_asset` 尚未更新时，恢复后业务状态可能不一致）。高并发支付/资产类系统可在备份窗口暂停写入接口，或先执行 `CHECKPOINT;` 再 dump：
> ```bash
> docker exec <container> psql -U <username> -d <dbname> -c "CHECKPOINT;"
> ```
> 当前项目规模较小，不停服、仅加 `-Z 9` 与下文 checksum 即可满足日常需求。

### 方案 B：导出为标准纯文本 SQL 文件（适合小库、易查看）

如果数据量很小，或者希望用文本编辑器直接查看 SQL 脚本：

```bash
docker exec <your_postgres_container_name> \
  pg_dump -U <username> -d <dbname> -F p > /path/to/backup/db_$(date +%Y%m%d_%H%M%S).sql
```

> **注意**：这种方式生成的文件体积较大，恢复时无法进行多线程并行加速。

### 数据恢复

恢复命令取决于备份时的文件格式：

**`.dump` 自定义格式（方案 A）**：

```bash
# -j 4 开启 4 线程并行加速，-c 恢复前先清理/删表
docker exec -i <your_postgres_container_name> \
  pg_restore -U <username> -d <dbname> -c -j 4 < /path/to/backup/db_20260807.dump
```

> **坑：目标库不存在时 `-c` 会报错**。`-c` 只负责 DROP 库内的对象，不会自动建库。两种处理方式：
> 1. 先建库再恢复：`docker exec -i <container> createdb -U <username> <dbname>`，再执行上面的 `pg_restore`；
> 2. 或直接用 `-C`（连同建库一起做，此时 `-d` 应指向 `postgres` 等已有库）：`pg_restore -U <username> -C -d postgres -c -j 4 < file.dump`。

**`.sql` 文本格式（方案 B）**：

```bash
docker exec -i <your_postgres_container_name> \
  psql -U <username> -d <dbname> < /path/to/backup/db_20260807.sql
```

### 常见避坑

1. **全局对象丢失**：`pg_dump` 仅备份单个数据库的表结构和数据，**不会**备份数据库用户/角色、密码及表空间。需额外运行：
   ```bash
   docker exec <container> pg_dumpall -U postgres --globals-only > globals.sql
   ```

2. **免密处理**：如果容器设置了 `POSTGRES_HOST_AUTH_METHOD=trust` 或使用默认 `postgres` 用户本地套接字连接，通常不会提示密码。否则可指定环境变量：
   ```bash
   docker exec -e PGPASSWORD='your_password' <container> pg_dump ...
   ```

---

## 2. 自动定时备份脚本

生产环境中需要无人值守的每日自动备份，编写 Shell 脚本配合宿主机 `crontab` 运行。

### 2.1 本地单机备份脚本（入门版）

最简版本，备份直接写在宿主机本地磁盘：

```bash
#!/bin/bash

# --- 配置区 ---
CONTAINER_NAME="postgres-prod"   # PG 容器名称
DB_USER="postgres"               # 数据库用户名
DB_NAME="mydb"                   # 数据库名称
BACKUP_DIR="/data/backups/postgres"   # 宿主机备份根目录
RETENTION_DAYS=3                 # 本地仅保留 3 天（远端 MinIO 保留更久）

# --- 执行备份 ---
DATE=$(date +%Y%m%d_%H%M%S)
FILE_NAME="${DB_NAME}_${DATE}.dump"
FILE_PATH="${BACKUP_DIR}/${FILE_NAME}"

# 创建备份目录
mkdir -p "${BACKUP_DIR}"

# 【可选】业务一致性：高并发场景下先做一次检查点，减少恢复时的重放量
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "CHECKPOINT;"

# 执行导出（-Z 9 最高压缩，适合 AI 聊天这类 JSON/TEXT 数据）
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -F c -Z 9 -b > "${FILE_PATH}"

# 校验备份文件是否生成且非空
if [ -s "${FILE_PATH}" ]; then
    # 生成校验和，恢复前可 sha256sum -c 验证完整性
    sha256sum "${FILE_PATH}" > "${FILE_PATH}.sha256"
    echo "[$(date)] Backup succeeded: ${FILE_PATH}"
    # 清理指定天数之前的旧备份
    find "${BACKUP_DIR}" -type f -name "*.dump*" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;
else
    echo "[$(date)] Backup failed!"
    exit 1
fi
```

### 2.2 备份保留策略：本地短期 + 远端长期 + 分级

> 备份只存在本地一台机器上是不够的——宿主机硬件故障、勒索病毒、误删都可能导致备份全丢。

**生产最佳实践**：本地 + 远端双写，且按时间粒度分级，方便按恢复点精确定位。

```text
/data/backups/postgres/
├── daily/      # 每日全量，保留 30 天（本地可只留 3 天，远端 30 天）
├── weekly/     # 每周全量，保留 12 周
└── monthly/    # 每月全量，保留 12 个月
```

| 存储位置 | 分级 | 保留周期 | 用途 |
| --- | --- | --- | --- |
| 本地宿主机 | daily | 1~3 天 | 快速恢复日常误操作（几秒~几分钟），降低 RTO |
| 远端 MinIO / 对象存储 | daily/weekly/monthly | 30 天 / 12 周 / 12 个月 | 防灾难性故障（宿主机损坏、勒索病毒等） |

> 这符合 **3-2-1 备份原则**：3 份数据副本，2 种不同介质，1 份异地/异机存储。

### 2.3 异机备份方案（本地 + 远端双写）

在单机 Docker + Linux 环境下，将备份文件同步到远端常用三种方案。**对于已在使用 MinIO 的技术栈，强烈推荐方案 A（MinIO）作为主路径**，SCP / NFS 作为备选。

---

#### 方案 A：对象存储 MinIO / S3（已用 MinIO 栈的首选 ⭐）

若已部署 MinIO 或云对象存储（阿里云 OSS / 腾讯云 COS），使用 `mc` (MinIO Client) 或 `rclone` 上传。**最大优势是生命周期管理**：在 MinIO 控制台配置 `daily 保留 30 天 / weekly 保留 12 周 / monthly 保留 12 个月`，无需自己写 `find -mtime` 清理逻辑。

```bash
# 备份生成后连同校验和一起同步到 MinIO Bucket（含分级前缀）
mc cp "${LOCAL_FILE_PATH}"         backup-minio/pg-backups-bucket/daily/
mc cp "${LOCAL_FILE_PATH}.sha256"  backup-minio/pg-backups-bucket/daily/
```

恢复前先在 MinIO 侧（或下载后）校验：

```bash
mc cat backup-minio/pg-backups-bucket/daily/"${FILE_NAME}".sha256 | sha256sum -c -
```

**优点**：天然版本控制、生命周期自动清理、异地容灾，安全性极高。

##### 管道直推版（免落盘 ⭐）：`pg_backup_to_minio.sh`

如果本地磁盘紧张、或不想保留本地临时文件，可用 `pg_dump | mc pipe` 把备份流**直接推送到 MinIO**，全程不经过宿主机磁盘：

```bash
#!/bin/bash
set -euo pipefail

# --- 配置区 ---
DB_HOST="localhost"            # PG 容器映射的宿主机地址（或容器名，需同网络）
DB_NAME="mydb"
DB_USER="postgres"
DB_PASSWORD="${DB_PASSWORD:?请通过环境变量 DB_PASSWORD 传入数据库密码}"
MINIO_ALIAS="backup-minio"     # 已用 mc alias set 配置好的别名
BUCKET_NAME="pg-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="${DB_NAME}_${DATE}.dump"

# 1. 执行备份并通过管道直接推送到 MinIO（免落盘）
echo "开始备份 ${DB_NAME} 到 MinIO..."
if PGPASSWORD="${DB_PASSWORD}" pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -Fc \
  | mc pipe "${MINIO_ALIAS}/${BUCKET_NAME}/${BACKUP_NAME}"; then
  echo "✅ 备份成功: ${BACKUP_NAME}"
  # 可在此处触发成功告警或日志记录
else
  echo "❌ 备份失败！"
  # 可在此处触发钉钉/企微告警通知
  exit 1
fi
```

> **要点**：
> - `set -euo pipefail` 中的 `pipefail` 很关键——它保证管道中任意一段失败（如 `pg_dump` 中途报错）都能让整条命令返回非零，避免"dump 已经失败却仍被当成成功推送"的静默错误。
> - `DB_PASSWORD:?...` 在变量未设置时直接报错退出，避免 `PGPASSWORD` 为空导致认证失败却难排查。
> - 若 `pg_dump` 走的是 **Docker 容器**（而非宿主机直接装了 `pg_dump`），把该行替换为 `docker exec ${CONTAINER_NAME} pg_dump -U ... -Fc | mc pipe ...` 即可，其余不变。
> - 注意：管道直推方式**无法在本地生成 `.sha256` 校验和**（文件没落盘）。如需完整性校验，建议仍采用上面的"本地落盘 + `mc cp` + 校验和"方式，或恢复时通过 `mc cat | sha256sum` 临时校验。

---

#### 方案 B：SCP 推送（最常用、最简单）

在本地宿主机生成备份后，使用 `scp` 自动传输到远程备份机器。

**前提条件**：宿主机配置 SSH 免密登录到备份机器（`ssh-keygen` + `ssh-copy-id`）。

```bash
#!/bin/bash

# --- 配置区 ---
CONTAINER_NAME="postgres-prod"
DB_USER="postgres"
DB_NAME="mydb"
LOCAL_BACKUP_DIR="/data/backups/postgres/daily"   # 本地短期存储目录
LOCAL_RETENTION_DAYS=3                             # 本地仅保留 3 天

# 远程备份机器配置
REMOTE_USER="backupuser"
REMOTE_IP="192.168.1.200"               # 备份机器 IP
REMOTE_BACKUP_DIR="/nas/pg_backups"     # 远程机器存储目录
REMOTE_RETENTION_DAYS=30                # 远程保留 30 天

# --- 执行本地备份 ---
DATE=$(date +%Y%m%d_%H%M%S)
FILE_NAME="${DB_NAME}_${DATE}.dump"
LOCAL_FILE_PATH="${LOCAL_BACKUP_DIR}/${FILE_NAME}"

mkdir -p ${LOCAL_BACKUP_DIR}

# 备份 + 最高压缩（去 -t，适配 cron 无 TTY）
docker exec ${CONTAINER_NAME} pg_dump -U ${DB_USER} -d ${DB_NAME} -F c -Z 9 -b > ${LOCAL_FILE_PATH}

# --- 校验并传输到远程机器 ---
if [ -s "${LOCAL_FILE_PATH}" ]; then
    sha256sum "${LOCAL_FILE_PATH}" > "${LOCAL_FILE_PATH}.sha256"
    echo "[$(date)] 本地备份成功: ${LOCAL_FILE_PATH}"

    # 1. 推送文件及校验和到远程机器
    scp "${LOCAL_FILE_PATH}" "${LOCAL_FILE_PATH}.sha256" "${REMOTE_USER}@${REMOTE_IP}:${REMOTE_BACKUP_DIR}/"
    SCP_RET=$?

    if [ ${SCP_RET} -eq 0 ]; then
        echo "[$(date)] 远程传输成功！"
    else
        echo "[$(date)] ⚠️ 远程传输失败！"
    fi

    # 2. 清理本地过期备份
    find ${LOCAL_BACKUP_DIR} -type f -name "*.dump*" -mtime +${LOCAL_RETENTION_DAYS} -exec rm -f {} \;

    # 3. 远程清理过期备份 (通过 SSH 在远程机器执行删除)
    ssh ${REMOTE_USER}@${REMOTE_IP} "find ${REMOTE_BACKUP_DIR} -type f -name '*.dump*' -mtime +${REMOTE_RETENTION_DAYS} -exec rm -f {} \;"

else
    echo "[$(date)] ❌ 备份失败，文件为空！"
    exit 1
fi
```

---

#### 方案 C：NFS 共享挂载（本地直写远程）

如果备份机器支持 NFS，直接将远程目录挂载到宿主机，脚本中无需任何传输命令：

```bash
# 在宿主机上把远程机器的 /nas/pg_backups 挂载到本地 /mnt/remote_backups
mount -t nfs 192.168.1.200:/nas/pg_backups /mnt/remote_backups
```

之后 `pg_backup.sh` 直接将备份写入 `/mnt/remote_backups`，数据就落到了远程机器上。

---

### 2.4 全局对象备份（角色 / 权限）

`pg_dump` **只备份单个库**，不会包含数据库用户、角色、密码、表空间等全局对象。灾难恢复时必须先恢复全局对象，否则 `pg_restore` 因缺少同名角色而报错。建议把 `globals.sql` 纳入每日备份：

```bash
#!/bin/bash
# 与业务库 dump 同源执行（复用 pg_backup.sh 中的 CONTAINER_NAME / DB_USER / BACKUP_DIR 变量）
GLOBALS_FILE="${BACKUP_DIR}/globals_$(date +%Y%m%d).sql"
docker exec ${CONTAINER_NAME} pg_dumpall -U ${DB_USER} --globals-only > "${GLOBALS_FILE}"
sha256sum "${GLOBALS_FILE}" > "${GLOBALS_FILE}.sha256"
```

> 建议把以上片段**直接并入 `pg_backup.sh`**，与业务库 dump 在同一每日任务中执行，保证角色/权限与数据备份时间一致。

**恢复顺序**（关键）：

1. 先恢复全局对象（用户、权限）：
   ```bash
   docker exec -i ${CONTAINER_NAME} psql -U ${DB_USER} -d postgres < globals_xxx.sql
   ```
2. 再恢复业务库（见第 3 节 `pg_restore`）。

> 目录约定：`/data/backups/postgres/` 下同时保留 `*.dump`（业务库）与 `globals_*.sql`（全局对象）。

---

## 3. 数据恢复自动化（脚本 + Makefile）

在生产事故或灾难恢复（DR）发生时，运维/开发人员往往处于高压状态，手动敲命令行极易出错（如漏掉 `-j` 多线程参数、选错数据库名、忽略 `-i` 输入流等）。将恢复流程封装为自动化脚本，能大幅降低 **RTO（恢复时间目标）**。

> **备份 vs 恢复的核心区别 —— 安全性**：
> - **备份**：无人值守、自动定时、高频执行、无破坏性。
> - **恢复**：**有人值守、手动触发、低频执行、具备高破坏性（会覆盖/清理当前数据）**。
>
> 因此，恢复脚本必须引入 **交互式二次确认** 与 **防误触保护**，且**绝对禁止放进 Crontab**。

### 3.1 恢复脚本设计（`pg_restore.sh`）

在 `deploy/backup/` 目录下新增 `pg_restore.sh`，特点：

- 支持通过命令行参数指定恢复文件；未指定时自动查找最新 `.dump`。
- **强制二次确认**：要求手动输入目标库名，输入不匹配即中止。
- 自动识别 `.dump`（走 `pg_restore -c -j`）与 `.sql`（走 `psql`）两种格式。

```bash
#!/bin/bash

# 注意：【不】使用 set -e。原因：脚本含交互式 read、文件查找等逻辑，
# 且需在恢复失败时打印自定义错误信息而非直接崩溃，故改为手动检查关键命令退出码。

# --- 配置区 ---
CONTAINER_NAME="postgres-prod"        # PG 容器名称
DB_USER="postgres"                     # 数据库用户名
DB_NAME="mydb"                         # 目标数据库名称
BACKUP_DIR="/data/backups/postgres"    # 默认备份目录
JOBS=4                                 # pg_restore 并行线程数

# --- 获取恢复目标文件 ---
# 支持通过命令行第一个参数指定文件；若未指定，默认自动查找最新的 .dump 文件
SPECIFIED_FILE="$1"

if [ -n "${SPECIFIED_FILE}" ]; then
    RESTORE_FILE="${SPECIFIED_FILE}"
else
    echo "🔍 未指定备份文件，正在寻找最新备份..."
    RESTORE_FILE=$(ls -t "${BACKUP_DIR}"/*.dump 2>/dev/null | head -n 1)
fi

# 检查文件是否存在且非空
if [ ! -s "${RESTORE_FILE}" ]; then
    echo "❌ 错误: 未找到可用的备份文件！路径: ${RESTORE_FILE}"
    exit 1
fi

# 校验容器运行状态（防向未就绪的数据库灌数据）
CONTAINER_STATUS=$(docker inspect -f '{{.State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "unknown")
if [ "${CONTAINER_STATUS}" = "unhealthy" ]; then
    echo "❌ 容器 [${CONTAINER_NAME}] 健康状态为 unhealthy，请先修复后再恢复！"
    exit 1
elif [ "${CONTAINER_STATUS}" = "starting" ]; then
    echo "⚠️ 容器 [${CONTAINER_NAME}] 仍在启动中，建议等待健康后再执行恢复。"
fi

# 校验完整性（若同目录存在 .sha256 校验和文件则自动验证，防磁盘坏块/传输损坏）
CHECKSUM_FILE="${RESTORE_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
    echo "🔑 检测到校验和文件，正在验证完整性..."
    if ! sha256sum -c "${CHECKSUM_FILE}" --status 2>/dev/null; then
        echo "❌ 校验和验证失败！备份文件可能已损坏，操作已中止。"
        exit 1
    fi
    echo "✅ 校验和验证通过。"
fi

# --- 灾难防护：强制二次确认 ---
echo "=================================================="
echo "🚨 警告：准备执行数据库恢复操作！"
echo "=================================================="
echo "目标容器 : ${CONTAINER_NAME}"
echo "目标数据库 : ${DB_NAME}"
echo "恢复源文件 : ${RESTORE_FILE}"
echo "=================================================="
echo "⚠️  此操作可能会清空或覆盖当前数据库 [${DB_NAME}] 中的原有数据！"
read -p "确认继续执行吗？输入 [${DB_NAME}] 以确认操作: " CONFIRM_DB

if [ "${CONFIRM_DB}" != "${DB_NAME}" ]; then
    echo "❌ 数据库名称输入不匹配，恢复操作已取消。"
    exit 1
fi

echo "🚀 开始恢复数据库..."

# --- 执行恢复 ---
FILENAME=$(basename "${RESTORE_FILE}")

if [[ "${FILENAME}" == *.dump ]]; then
    # 方案 A：Custom 自定义二进制格式 (pg_restore)
    # -c: 恢复前先 DROP 数据库对象
    # -j: 开启多线程并行恢复
    docker exec -i "${CONTAINER_NAME}" \
      pg_restore -U "${DB_USER}" -d "${DB_NAME}" -c -j "${JOBS}" < "${RESTORE_FILE}"
    RET=$?

elif [[ "${FILENAME}" == *.sql ]]; then
    # 方案 B：纯文本 SQL 脚本 (psql)
    docker exec -i "${CONTAINER_NAME}" \
      psql -U "${DB_USER}" -d "${DB_NAME}" < "${RESTORE_FILE}"
    RET=$?

else
    echo "❌ 无法识别的文件扩展名（仅支持 .dump 或 .sql）"
    exit 1
fi

if [ ${RET} -eq 0 ]; then
    echo "✅ 数据库恢复成功！"
else
    echo "❌ 数据库恢复过程中出现异常（退出码 ${RET}），请检查日志！"
    exit 1
fi
```

赋予执行权限：

```bash
chmod +x deploy/backup/pg_restore.sh
```

### 3.2 从 MinIO 直接恢复（免下载 ⭐）：`pg_restore_from_minio.sh`

当备份只存在于远端 MinIO、且不想先把大文件下载到本地磁盘时，可用 `mc cat | pg_restore` 把数据流**直接从 MinIO 灌入数据库**（配合第 2.3 节管道直推版形成闭环）。与 3.1 的本地脚本相比，本方案**省去下载环节**，但同样需要二次确认 + 环境锁，绝不能进 Crontab。

> ⚠️ **提示**：恢复脚本中一定要加入**环境校验锁**（比如检查是否为生产环境，避免误操作覆盖线上库）。

```bash
#!/bin/bash

# 注意：【不】使用 set -e，因脚本含交互式 read，且需在失败时打印自定义信息而非直接崩溃。

# --- 防误触安全锁（禁止在生产服务器直接运行）---
if [ "${NODE_ENV:-}" = "production" ]; then
  echo "ERROR: 禁止在生产环境直接运行恢复脚本！"
  exit 1
fi

# --- 配置区 ---
TARGET_DB="mydb_restore_test"   # 恢复到独立测试库，避免误覆盖线上
MINIO_ALIAS="backup-minio"
BUCKET_NAME="pg-backups"
DB_HOST="localhost"
DB_USER="postgres"
DB_PASSWORD="${DB_PASSWORD:-}"  # 可选：通过环境变量传入数据库密码

# 1. 从 MinIO 获取最新的备份文件名（按文件名/时间倒序取第一条）
LATEST_BACKUP=$(mc ls "${MINIO_ALIAS}/${BUCKET_NAME}/" | sort -k5 | tail -n 1 | awk '{print $5}')
if [ -z "${LATEST_BACKUP}" ]; then
  echo "❌ 未在 MinIO 找到任何备份文件！"
  exit 1
fi
echo "最新备份文件: ${LATEST_BACKUP}"

# 2. 强制二次确认（防误触）
echo "=================================================="
echo "🚨 警告：准备从 MinIO 执行数据库恢复！"
echo "=================================================="
echo "目标数据库 : ${TARGET_DB}"
echo "恢复源文件 : ${LATEST_BACKUP}"
echo "=================================================="
read -p "确认继续执行吗？输入 [${TARGET_DB}] 以确认: " CONFIRM_DB
if [ "${CONFIRM_DB}" != "${TARGET_DB}" ]; then
  echo "❌ 数据库名称输入不匹配，恢复操作已取消。"
  exit 1
fi

# 3. 先建库（容忍已存在），再灌入数据
echo "正在从 MinIO 恢复数据到 ${TARGET_DB}..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -U "${DB_USER}" -c "CREATE DATABASE ${TARGET_DB};" 2>/dev/null || true
mc cat "${MINIO_ALIAS}/${BUCKET_NAME}/${LATEST_BACKUP}" \
  | pg_restore -h "${DB_HOST}" -U "${DB_USER}" -d "${TARGET_DB}" --clean --if-exists --no-owner -j 4

echo "✅ 恢复完成！"
```

> **要点**：
> - **安全锁**：`NODE_ENV=production` 时直接拒绝运行；生产恢复务必走独立测试库（`mydb_restore_test`）演练，确认无误后再人工切库。
> - **`mc ls | sort -k5 | tail`**：`mc ls` 输出第 5 列为文件名，按该列排序后取末尾即最新（前提是文件名含时间前缀 `mydb_20260810_020000.dump`，与备份脚本命名一致）。
> - **目标库处理**：先用 `CREATE DATABASE` 建库（`|| true` 容忍库已存在），再 `pg_restore --clean --if-exists` 灌入；`--no-owner` 避免恢复时因角色缺失报错。`-j 4` 开启并行恢复加速。
> - 若 `pg_restore` 在容器内执行，把管道右侧改为 `docker exec -i ${CONTAINER_NAME} pg_restore ...` 即可。

### 3.3 在 Makefile 中封装恢复指令

与第 5 节的备份指令呼应，在根目录 `Makefile` 中追加恢复相关目标：

```makefile
# 在原有 Makefile 变量后追加：
RESTORE_SCRIPT_PATH := $(shell pwd)/deploy/backup/pg_restore.sh

.PHONY: db-restore db-restore-latest

## 恢复最新的 .dump 备份文件
db-restore-latest:
	@chmod +x $(RESTORE_SCRIPT_PATH)
	@$(RESTORE_SCRIPT_PATH)

## 恢复指定的备份文件 (用法: make db-restore FILE=/path/to/backup.dump)
db-restore:
	@chmod +x $(RESTORE_SCRIPT_PATH)
	@$(RESTORE_SCRIPT_PATH) $(FILE)
```

### 3.4 运维实操对比

| 场景 | 命令 | 说明 |
| --- | --- | --- |
| **日常演练 / 恢复最新本地备份** | `make db-restore-latest` | 自动寻找 `/data/backups/postgres` 下最新的 `.dump` 文件并提示确认 |
| **恢复特定历史节点** | `make db-restore FILE=/data/backups/postgres/mydb_20260801_020000.dump` | 显式传入历史备份文件进行精准还原 |
| **从 MinIO 直接恢复（免下载）** | `bash deploy/backup/pg_restore_from_minio.sh` | 含环境锁 + 二次确认，自动定位最新备份并直灌测试库 |
| **定时自动备份部署** | `make backup-cron-install` | 部署 Crontab 自动任务（**仅备份，恢复不在此列**） |

### 3.5 恢复脚本的工程避坑原则

1. **绝对禁止放进 Cron**：恢复脚本只能由管理员手动触发，绝不能包含任何自动循环或无人值守逻辑。
2. **校验容器运行状态**：脚本执行前可通过 `docker inspect -f '{{.State.Health.Status}}' ${CONTAINER_NAME}` 确认容器健康状态，防止向未准备好的数据库灌数据。
3. **环境隔离保护**：如需防止误在**生产环境容器**上直接运行恢复脚本，可在脚本开头增加环境变量检查（例如判断 `ENV != production`，否则要求额外输入超级密钥）。
4. **目标库不存在时 `-c` 会报错**：若恢复目标库尚未创建，参考第 1 节「数据恢复」中的处理方式（先 `createdb` 或用 `-C`）。
5. **先恢复全局对象**：若备份包含 `globals_*.sql`，必须先恢复它（用户/权限）再 `pg_restore` 业务库，否则会因缺角色报错。
6. **恢复前校验和验证**：本地脚本已自动校验同目录 `.sha256` 文件，避免把损坏备份灌入生产库；MinIO 直取方案可先用 `mc cat ... | sha256sum` 临时校验。

### 3.6 定期恢复演练（DR 演练）

"每天备份、从没恢复过"是生产最大隐患——真出事才发现备份不可用。建议**每月**做一次恢复演练：

1. 创建临时库 `restore_test`；
2. 用最新 `.dump`（或 `.sha256` 校验通过后）恢复：
   ```bash
   docker exec -i ${CONTAINER_NAME} pg_restore -U ${DB_USER} -d restore_test -c -j 4 < latest.dump
   ```
3. 校验关键指标（表数量、用户数、订单数）是否符合预期；
4. 演练结束 `DROP DATABASE restore_test` 清理。

> 演练可用 `make db-restore FILE=...` 复用同一套二次确认逻辑，只是目标库改成 `restore_test`；也可直接使用 3.2 的 MinIO 直取脚本指向独立测试库。

---

## 4. 配置 Crontab 定时任务

赋予脚本执行权限并加入定时任务（例如每天凌晨 2:00 执行）：

```bash
chmod +x deploy/backup/pg_backup.sh
crontab -e
```

在打开的编辑器中添加：

```
0 2 * * * /bin/bash /path/to/deploy/backup/pg_backup.sh >> /var/log/pg_backup.log 2>&1
```

---

## 5. Makefile 封装 Crontab（推荐）

将 Crontab 配置封装到 `Makefile` 中，团队成员用统一指令完成部署，避免手动编辑 `crontab -e` 时出现拼写错误。核心原则是**使用幂等性逻辑（避免重复添加）**。

```makefile
# 定义变量
SCRIPT_PATH := $(shell pwd)/deploy/backup/pg_backup.sh
LOG_PATH := /var/log/pg_backup.log
# Crontab 表达式：每天凌晨 2:00 执行
CRON_SCHEDULE := 0 2 * * *
CRON_JOB := $(CRON_SCHEDULE) /bin/bash $(SCRIPT_PATH) >> $(LOG_PATH) 2>&1

.PHONY: backup-cron-install backup-cron-status backup-cron-uninstall

## 安装或更新 Crontab 定时任务
backup-cron-install:
	@chmod +x $(SCRIPT_PATH)
	@mkdir -p /var/log
	@# 读取现有 crontab，过滤掉旧的该脚本任务，追加新任务后重新写入（实现幂等更新）
	@(crontab -l 2>/dev/null | grep -v "$(SCRIPT_PATH)"; echo "$(CRON_JOB)") | crontab -
	@echo "✅ Crontab 备份任务已成功配置/更新！"
	@echo "当前任务列表："
	@crontab -l | grep "$(SCRIPT_PATH)"

## 查看当前的备份 Crontab 状态
backup-cron-status:
	@echo "🔍 检查备份定时任务状态："
	@crontab -l 2>/dev/null | grep "$(SCRIPT_PATH)" || echo "⚠️ 未找到相关备份任务！"

## 卸载 Crontab 定时任务
backup-cron-uninstall:
	@(crontab -l 2>/dev/null | grep -v "$(SCRIPT_PATH)") | crontab -
	@echo "🗑️  Crontab 备份任务已移除！"
```

### Make 指令速查

| 命令 | 作用 |
| --- | --- |
| `make backup-cron-install` | 赋予脚本执行权限，写入 Crontab 定时任务（自动去重） |
| `make backup-cron-status` | 查看当前系统是否已挂载该备份任务 |
| `make backup-cron-uninstall` | 精准移除该备份任务，不影响其他 Cron |
| `make db-restore-latest` | 恢复 `/data/backups/postgres` 下最新的 `.dump` 备份（含二次确认） |
| `make db-restore FILE=/path/to/x.dump` | 恢复指定备份文件（含二次确认） |

### 避坑

1. **缩进必须为 Tab**：Makefile 命令行开头必须使用 Tab 键缩进，不能用空格，否则报 `missing separator` 错误。
2. **`$(shell pwd)` 解析为绝对路径**：保证 Crontab 运行时不会因相对路径找不到脚本而失败。

---

## 6. 放到项目哪个位置好？

结合 **Docker、PostgreSQL 备份脚本、Makefile** 以及 **Spring Boot 后端**，建议采用**标准 Maven 架构 + 运维部署解耦**的目录组织方式：

```text
my-springboot-project/               # 项目根目录
├── deploy/                          # 运维与部署目录（与业务代码隔离）
│   ├── docker/
│   │   ├── Dockerfile               # Spring Boot 镜像构建文件
│   │   └── docker-compose.yml       # 单机容器编排（App + PG）
│   ├── backup/                      # 备份恢复统一目录（未来可扩 redis/minio 备份）
│   │   ├── pg_backup.sh             # ← 本地落盘备份（定时、无人值守）
│   │   ├── pg_backup_to_minio.sh    # ← 管道直推 MinIO（免落盘）
│   │   ├── pg_restore.sh            # ← 本地恢复脚本（含二次确认、手动触发）
│   │   ├── pg_restore_from_minio.sh # ← MinIO 直取恢复（含环境锁、手动触发）
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

## 7. 数据量选型：pg_dump 还是物理备份？

`pg_dump` 是逻辑备份，简单可靠、可跨大版本恢复，但库越大越慢、恢复越久，且不支持增量。当前项目（Spring Boot + PostgreSQL + Redis + MinIO + AI 业务，数据量通常在 20GB 以内）使用 `pg_dump + 压缩 + MinIO` 完全够用；当数据规模增长后应按下表升级：

| 数据库大小     | 推荐方案                | 说明 |
| --------- | ------------------- | ---- |
| < 20GB    | `pg_dump -Fc -Z9`   | 当前方案，简单、可跨版本恢复 |
| 20~200GB  | `pg_dump` + 压缩 + MinIO | 配合分级保留（daily/weekly/monthly） |
| 200GB~1TB | pgBackRest          | 支持增量备份、并行、WAL 归档，恢复更快 |
| TB 级      | 物理备份（pg_basebackup）+ WAL 连续归档 | 逻辑备份已不现实 |

> 物理备份与 WAL 归档的定位，见：[单机 Docker PostgreSQL 备份与恢复](./单机Docker备份与恢复.md)（若尚未单独成文，可参考本文第 7 节选型表）。

> 更多关于项目目录结构的设计原则，见：[项目目录结构规范](../../架构设计/项目目录结构规范.md)。
