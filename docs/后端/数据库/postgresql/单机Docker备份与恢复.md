---
title: 单机 Docker PostgreSQL 备份与恢复
icon: database
sort: 2
---

# 单机 Docker PostgreSQL 备份与恢复

> 核心结论：PostgreSQL **也能增量备份**，而且生产环境基本不会一直用 `pg_dump` 全量备份。但 PG 的增量备份思路和对象存储（如 MinIO）不一样，它基于 **WAL 日志**。

## 按运行环境查看

本文以**单机 Docker** 为实操示例，讲解备份/恢复的核心机制与通用流程。不同运行环境的落地差异较大，请按需查看：

- **单机 Docker（本文）**：👉 [单机 Docker PostgreSQL 备份与恢复](./单机Docker备份与恢复.md) — `docker` / `pg_dump` / `pg_restore` / 单机 MinIO
- **k3s / Kubernetes**：👉 [k3s 环境下的备份与恢复](./k3s环境下的备份与恢复.md)（PVC、WAL-G、CloudNativePG Operator、Velero 等）

## 方案 1：pg_dump（逻辑全量备份）

### 原理与结构

```
PostgreSQL
    |
    ↓
pg_dump
    |
    ↓
backup.dump / backup.sql
```

- `pg_dump` 属于**逻辑备份**：导出的是 SQL 语句（或自定义格式 `c`/目录格式）的数据表定义与数据，**不接触底层物理文件或 WAL 日志**。
- **完全不需要** `pgBackRest` / `WAL-G`，是 PG **自带原生命令行工具**，一条命令即可：

```sh
pg_dump -U username -d dbname > backup.sql
```

### 特点

| 维度 | 表现 |
| --- | --- |
| 优点 | 简单、恢复简单、适合小中型项目 |
| 缺点 | 每次都是全量，空间占用大 |

示例：100GB 数据库，每天全量备份 → `Day1 100GB / Day2 100GB / Day3 100GB`。

### 风险（数据量大时）

- 当数据量达到几百 GB 甚至 TB 级时，不仅占用空间大，**恢复时间 RTO 会极长**（恢复时需要重新建表、插入数据、重建索引）。

> 适用场景：**小库 / 测试环境 / 数据量小、无需精准恢复**。

### Docker 环境实操：三种标准用法

在单机 Docker 环境下使用 `pg_dump` 进行逻辑全量备份非常简单。由于无需在宿主机安装任何工具，直接利用现有的 PostgreSQL 容器即可完成操作。

以下是三种最常用的标准方案，推荐使用**方案 1-1（导出自定义二进制格式）**。

#### 方案 1-1：直接导出为自定义二进制格式（生产首选，带压缩）

使用 `-F c` 参数导出为 Custom 二进制格式，不仅自带压缩、体积小，而且后续可以使用 `pg_restore` 开启**多线程并发恢复**。

```bash
docker exec -t <your_postgres_container_name> \
  pg_dump -U <username> -d <dbname> -F c -b -v > /path/to/backup/db_$(date +%Y%m%d_%H%M%S).dump
```

参数说明：

| 参数 | 含义 |
| --- | --- |
| `-t` | 分配伪终端（确保能正常输出数据流，注意**不要**带 `-i`，否则在 Cron 自动化脚本中会报错） |
| `-F c` | Format Custom（自定义二进制格式） |
| `-b` | 导出大对象数据（Blobs） |
| `-v` | 显示备份详细日志 |
| `> /path/...` | 通过重定向直接将数据保存到**宿主机**的物理磁盘上，不占用容器内部空间 |

#### 方案 1-2：导出为标准纯文本 SQL 文件（适合小库、易查看）

如果数据量很小，或者希望用文本编辑器直接查看 SQL 脚本，可以导出为 `.sql` 文件：

```bash
docker exec -t <your_postgres_container_name> \
  pg_dump -U <username> -d <dbname> -F p > /path/to/backup/db_$(date +%Y%m%d_%H%M%S).sql
```

> **注意**：这种方式生成的文件体积较大，恢复时无法进行多线程并行加速。

#### 方案 1-3：自动定时备份脚本（Linux Crontab 落地）

如果在生产环境中需要实现无人值守的每日自动备份，可以编写一个 Shell 脚本配合宿主机的 `crontab` 运行：

##### 1. 编写备份脚本 `pg_backup.sh`

```bash
#!/bin/bash

# --- 配置区 ---
CONTAINER_NAME="postgres-prod"   # PG 容器名称
DB_USER="postgres"               # 数据库用户名
DB_NAME="mydb"                   # 数据库名称
BACKUP_DIR="/data/pg_backups"    # 宿主机备份存储路径
RETENTION_DAYS=7                 # 备份保留天数

# --- 执行备份 ---
DATE=$(date +%Y%m%d_%H%M%S)
FILE_NAME="${DB_NAME}_${DATE}.dump"
FILE_PATH="${BACKUP_DIR}/${FILE_NAME}"

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 执行导出
docker exec -t ${CONTAINER_NAME} pg_dump -U ${DB_USER} -d ${DB_NAME} -F c -b > ${FILE_PATH}

# 校验备份文件是否生成且非空
if [ -s "${FILE_PATH}" ]; then
    echo "[$(date)] Backup succeeded: ${FILE_PATH}"
    # 清理指定天数之前的旧备份
    find ${BACKUP_DIR} -type f -name "*.dump" -mtime +${RETENTION_DAYS} -exec rm -f {} \;
else
    echo "[$(date)] Backup failed!"
    exit 1
fi
```

##### 2. 配置 Crontab 定时任务

赋予脚本执行权限并加入定时任务（例如每天凌晨 2:00 执行）：

```bash
chmod +x pg_backup.sh
crontab -e
```

在打开的编辑器中添加以下内容：

```cron
0 2 * * * /bin/bash /path/to/pg_backup.sh >> /var/log/pg_backup.log 2>&1
```

> 更多关于 Makefile 封装 Crontab 的自动化方案，见：[备份脚本与 Crontab 自动化](./备份脚本与Crontab自动化.md)。

### 数据恢复（pg_dump）

当发生故障需要还原数据库时，恢复命令取决于你备份时的文件格式：

**如果备份的是 `.dump` 自定义格式（方案 1-1）**：

```bash
# 使用 pg_restore 恢复，-j 4 表示开启 4 线程并行加速，-c 表示恢复前先清理/删表
docker exec -i <your_postgres_container_name> \
  pg_restore -U <username> -d <dbname> -c -j 4 < /path/to/backup/db_20260807.dump
```

**如果备份的是 `.sql` 文本格式（方案 1-2）**：

```bash
# 使用 psql 直接导入
docker exec -i <your_postgres_container_name> \
  psql -U <username> -d <dbname> < /path/to/backup/db_20260807.sql
```

### 常见避坑指南

1. **全局对象丢失**：`pg_dump` 仅备份单个数据库的表结构和数据，**不会**备份数据库用户/角色、密码及表空间。如需备份全实例的全局角色，建议额外运行一次：
   ```bash
   docker exec -t <container> pg_dumpall -U postgres --globals-only > globals.sql
   ```

2. **免密处理**：直接在 `docker exec` 中运行 `pg_dump` 时，如果容器设置了 `POSTGRES_HOST_AUTH_METHOD=trust` 或使用的是默认 `postgres` 用户本地套接字连接，通常不会提示输入密码。如果提示密码，可在命令前指定环境变量：
   ```bash
   docker exec -e PGPASSWORD='your_password' -t ...
   ```

## 方案 2：WAL 增量备份 / PITR（生产常用）

### 原理与结构

PostgreSQL 本身有 WAL（Write-Ahead Log，预写日志）：

```
数据库修改
    |
    ↓
WAL 日志（记录底层数据页的变化）
    |
    ↓
保存变化
```

- 初始：全量基础备份 100GB
- 之后每天只备份变化：`Day1 WAL 2GB / Day2 WAL 1GB / Day3 WAL 3GB`
- 备份总量 = `100GB + 2GB + 1GB + 3GB`

恢复时：

```
全量基础备份 (Base Backup)
  +
WAL 日志重放 (Replay)
```

可恢复到任意时间点，例如 `2026-08-06 15:32:10`，这称为 **Point In Time Recovery（PITR，时间点恢复）**。

### 基础备份（Base Backup）是前提

WAL 增量备份**不能单独存在**，必须配合一个**物理全量基础备份**：

$$
\text{全量基础备份 (Base Backup)} + \text{连续的 WAL 日志} = \text{任意时间点数据 (PITR)}
$$

由于 WAL 记录的是底层数据页的变化，恢复时是直接复制文件 + 重放日志，**速度远快于 `pg_dump` 执行 SQL**。

### 原生机制（无需第三方工具也能做）

- **全量基础备份**：使用 PG 自带的 `pg_basebackup` 命令。
- **WAL 归档**：在 `postgresql.conf` 中配置 `archive_command`（例如用简单的 `cp` 命令把 WAL 复制到备份目录）。

```conf
# postgresql.conf
archive_mode = on
archive_command = 'cp %p /path/to/wal_archive/%f'
```

> **是否必须 `pgBackRest` / `WAL-G`？** ⚠️ 非必须，但生产强烈推荐。原生命令就能做；用第三方工具是为了自动上传 MinIO、压缩、并行加速和管理备份生命周期。

## 常用工具

### pgBackRest（推荐 ⭐）

结构：

```
PostgreSQL
    |
    ↓
pgBackRest
    |
    ↓
  MinIO / S3
```

特性：

- 全量备份 / 增量备份 / 差异备份
- WAL 归档
- 压缩、加密
- 原生支持把 WAL 和备份数据直接流式写入 **S3 / MinIO**，支持多线程并行传输

典型节奏：

```
周日: 全量 100GB
周一: 增量 2GB
周二: 增量 1GB
```

### WAL-G（K8s 场景补充）

- 若运行在 Kubernetes，结合 CloudNativePG 等 Operator 时，**`WAL-G`** 也是很流行且轻量的高效备份工具。

## 方案 3：文件级增量（rsync / 快照，不推荐）

思路：直接同步数据目录 `/var/lib/postgresql/data` 的变化文件。

```
/var/lib/postgresql/data
    |
    ↓ rsync
变化文件
```

### 为什么"非常危险"

PG **不推荐**直接对运行中的数据目录做文件级增量，原因：

- **数据页一致性 / 脏页问题**：运行中内存里的数据页可能尚未刷盘（Dirty Pages），或正在写入 8KB 数据页；`rsync` 逐个文件复制时会抓到"半写状态"的数据页（Torn Pages）。
- **WAL 状态 / checkpoint**：复制过程中 WAL 与数据页状态可能不一致。

> 结论：除非先执行 `pg_start_backup()` 让数据库进入备份模式，或停机备份，否则**绝对不能直接用 `rsync` / 快照复制运行中的数据目录**，否则极易恢复失败。

## 备份对应的恢复方式

恢复方式取决于采用了哪种备份方案。当前主要有两类：

1. `pg_dump` 全量备份（当前推荐）
2. `pgBackRest + WAL` 增量备份（以后生产级）

### 一、pg_dump 恢复（最简单）

假设备份位于 MinIO：

```
MinIO:
backup/postgres/
 └── passup_20260806.dump
```

#### 1. 停止应用（避免恢复期间还有写入）

```bash
docker stop passup-backend
```

#### 2. 删除旧数据库（可选）

```bash
docker exec -it postgres psql -U postgres
```

```sql
DROP DATABASE passup;

CREATE DATABASE passup
OWNER passup;
```

```sql
\q
```

#### 3. 恢复

若 dump 在宿主机：

```bash
docker exec -i postgres \
pg_restore \
-U passup \
-d passup \
< passup_20260806.dump
```

恢复完成后启动应用：

```bash
docker start passup-backend
```

### 二、整机故障恢复（服务器挂了怎么办）

例如服务器 A 的 Docker / PostgreSQL / MinIO 全部失效，但备份在服务器 B 的 MinIO 上：

```
服务器B:
MinIO 备份
 └── backup/postgres/passup.dump
```

流程：

1. **重新部署 PostgreSQL**

```yaml
postgres:
  image: postgres:17
```

```bash
docker compose up -d postgres
```

2. **下载备份**

```bash
mc cp backup/postgres/passup.dump .
```

3. **创建数据库**

```bash
createdb passup
```

4. **restore**

```bash
pg_restore -U passup -d passup passup.dump
```

### 三、pgBackRest 恢复（增量 / PITR）

假设备份链：

```
全量:  2026-08-01  100GB
WAL:   2026-08-02  2GB
WAL:   2026-08-03  3GB
```

恢复过程：

```
全量备份
  |
  ↓ 恢复数据文件
  +
  |
  ↓ 重放 WAL
  |
  ↓ 恢复完成
```

由于有连续 WAL，可**恢复到任意时间点**，例如：

```
2026-08-03 14:32:10
```

典型误删恢复场景：

```sql
delete from user_asset;   -- 14:30 误操作
```

可恢复到误操作之前：

```
2026-08-03 14:29:59
```

> 这正是 PITR 的价值：**精确到秒级回滚**，避免整库回退带来更大损失。

### 四、定期恢复演练（强烈建议）

很多人最大的问题不是"没备份"，而是"**有备份，却没验证过恢复**"。

建议每月一次：

```
生产备份
  |
  ↓ 拉到测试服务器
  |
  ↓ restore
  |
  ↓ 检查表数据
```

恢复后校验关键表行数：

```sql
select count(*) from app_user;
select count(*) from interview_record;
```

## 方案对比总表

| 备份方案 | 核心原生命令 / 机制 | 是否必须 pgBackRest / WAL-G | 说明 |
| --- | --- | --- | --- |
| 方案 1：逻辑全量 | `pg_dump` | ❌ 不需要 | PG 自带工具，一条命令搞定 |
| 方案 2：物理增量 (PITR) | `pg_basebackup` + WAL 归档 | ⚠️ 非必须，但生产强烈推荐 | 原生命令就能做；第三方工具用于自动上传 MinIO、压缩、生命周期管理 |
| 方案 3：文件级 | `rsync` / 快照 | ❌（但不推荐） | 易造成 Torn Pages，恢复易失败 |

## 落地选型结论

- **小库 / 测试环境**：继续用 `pg_dump`。
- **生产环境 / 大库**：直接上 **`pgBackRest` + MinIO + WAL 归档 (PITR)**，这是目前业内最标准、最稳妥的方案。
