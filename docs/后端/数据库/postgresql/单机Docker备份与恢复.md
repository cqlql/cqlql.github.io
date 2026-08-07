---
title: 单机 Docker PostgreSQL 备份与恢复
icon: mdi:database-outline
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

> Docker 环境下 `pg_dump` 的完整实操（三种用法、恢复命令、定时脚本、Crontab 配置、Makefile 封装、项目目录位置），见独立文章：[pg_dump 实操指南：脚本、定时与工程化](./pg_dump实操指南.md)。本文只保留方案原理层面的内容。

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

```
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
