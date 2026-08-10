---
title: 备份存放架构：专用备份 MinIO vs SCP
icon: mdi:server-network
sort: 3
---

# 备份存放架构：专用备份 MinIO vs SCP

> 本文讨论的是备份的**存放目标与传输方式**选型——即备份文件落盘位置与网络传输机制。  
> 本文与 [备份工具选型](./工具选型对比.md)（如 pgBackRest / WAL-G）属于不同维度：**工具负责“怎么产生备份”，本文负责“备份往哪里放”。**

---

## 一、背景：为什么要引入独立备份机？

在单机 Docker 集中部署场景下（PostgreSQL + MinIO + Java + Redis 运行于同台宿主机），若直接将备份文件写回本地磁盘或业务 MinIO，凌晨高并发备份任务将与生产业务竞争 CPU、内存、磁盘 Sequential/Random I/O 及网络带宽，导致业务 MinIO 响应延时飙升。

合理的解耦方案是将备份写入与存储压力卸载至**独立备份服务器**：

```text
┌──────────────────────────────────────┐
│             生产服务器                │
│  ┌────────────┐     ┌─────────────┐  │
│  │ PostgreSQL │ ──> │ pg_dump -Fc │  │
│  └────────────┘     └──────┬──────┘  │
└────────────────────────────┼─────────┘
                             │ 网络传输 (mc cp / S3 API)
                             ▼
┌──────────────────────────────────────┐
│             备份服务器                │
│  ┌────────────────────────────────┐  │
│  │  专用备份 MinIO (存储隔离)      │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘

```

> **核心原则**：业务 MinIO 用于存放用户上传文件，专用备份 MinIO 仅接收系统备份，实现**物理/逻辑双重隔离**。

---

## 二、独立备份机的核心优势

### 2.1 物理资源隔离，保障生产稳定

在集中式部署架构中，凌晨备份任务会导致严重的资源争抢：

```text
┌─────────────────────────────────────────┐
│               单机集中部署               │
│ PostgreSQL / 业务 MinIO / Java / Redis  │
├─────────────────────────────────────────┤
│ 凌晨 02:00 定时任务启动：                │
│ 1. pg_dump 导出 100 GB 数据             │
│ 2. 写入本地磁盘/业务 MinIO               │
├─────────────────────────────────────────┤
│ 致命后果：磁盘 I/O 挂起、吞吐抖动、业务响应超时│
└─────────────────────────────────────────┘

```

拆分后，生产服务器仅承担短期临时文件的 CPU 计算与网络推送，存储 I/O 压力完全转移至备份机。

### 2.2 硬件成本精准优化

生产服务器侧重高性能（高主频 CPU、大容量 RAM、NVMe SSD RAID）；备份服务器侧重低成本大容量存储（如 `低配 CPU + 8TB HDD RAID 1/10`），大幅降低整体硬件 TCO。

### 2.3 生命周期与多版本自动化管理

MinIO（对象存储）原生支持 Bucket Lifecycle（生命周期策略）与 Versioning（多版本控制）：

```text
postgres-backup/
├── 2026-08-10/
│   └── passup_20260810_0200.dump
├── 2026-08-09/
│   └── passup_20260809_0200.dump
└── 2026-08-08/
    └── passup_20260808_0200.dump

```

可在 MinIO 侧直接配置规则：**保留最近 7 天每日备份、4 周每周备份、12 个月每月备份**，过期由 MinIO 后台自动清理，无需维护易错的 Shell 清理脚本。

---

## 三、架构边界：备份机并非安全终点（3-2-1 原则）

⚠️ **风险警示**：若仅将数据从“生产机”传至“备份机”，当发生机房全盘断电、物理火灾、勒索病毒感染或误删 Bucket 时，两份数据仍有同时丢失的风险。

生产级架构必须遵循 **3-2-1 备份原则**：

```text
生产数据库 (PostgreSQL)
       │
       ├─► 1. 本地/近线备份 ──► 专用备份服务器 (MinIO)
       │
       └─► 2. 异地/云端备份 ──► 异地 NAS / 云厂商对象存储 (AWS S3 / 阿里云 OSS)

```

* **3** 份完整数据（1 份生产 + 2 份备份）
* **2** 种不同介质（如 本地 NVMe + 备份机 HDD / 云存储）
* **1** 份异地副本（防止区域性灾难）

---

## 四、传输与存储选型：SCP 推送 vs 专用 MinIO

### 4.1 方案一：传统 SCP / RSYNC 推送

```bash
pg_dump -Fc ... | ssh user@backup-server "cat > /backup/postgres/passup.dump"

```

* **优点**：依赖少、Linux 原生开箱即用、适合单机微型项目。
* **缺点**：
* **缺乏断点续传**：百 GB 级大文件在传输到 90% 网络抖动中断后必须重传。
* **扩展性差**：多项目/多库隔离与生命周期（过期删除）需手动编写大量容易出错的 `find /backup -mtime +30 -delete` Cron 脚本。
* **权限控制粗粒度**：基于 SSH Key，风险相对偏高。



### 4.2 方案二：专用 MinIO 对象存储 (推荐)

```bash
pg_dump -Fc ... > /tmp/passup.dump && mc cp /tmp/passup.dump backup-minio/postgres/passup/

```

* **优点**：
* **高可靠传输**：原生支持 S3 Multipart Upload（分片上传、断点续传、并发加速）。
* **自动化治理**：声明式 Bucket 生命周期策略，无代码实现 Retention 管理。
* **生态平滑演进**：后续若需无缝切到 AWS S3、阿里云 OSS 或腾讯云 COS，上层 CLI / 代码完全无需修改。
* **安全隔离**：为备份服务单独分配专用 `AccessKey` / `SecretKey`，并限制仅具备特定 Bucket 的 `s3:PutObject` 写入权限。



### 4.3 多维度性能与功能对照

| 对照维度 | SCP / RSYNC | 专用 MinIO (S3 API) |
| --- | --- | --- |
| **传输速度** | ⭐⭐⭐⭐ (受单线程加密限制) | ⭐⭐⭐⭐⭐ (支持多线程分片并发) |
| **大文件断点续传** | 弱 (SCP 需改用 rsync) | 强 (S3 Multipart 分片重试) |
| **访问控制 (IAM)** | 较弱 (依赖 OS 用户与 SSH) | 精细 (基于 AccessKey/Policy) |
| **生命周期管理** | 无 (需手写 `cron` + `find`) | 原生支持 (设置 Days/Tags 自动过期) |
| **多项目/多租户** | 麻烦 (手动维护目录结构) | 极佳 (Bucket / Prefix 逻辑隔离) |
| **平滑云端演进** | 困难 | 无缝 (完全兼容 S3 标准 API) |

---

## 五、PassUp 项目落地推荐设计

### 5.1 完整备份流水线逻辑

为了防止“传输中断导致写入损坏的半成品备份”，推荐采用“本地落盘 ➔ 完整性校验 ➔ 远程推送 ➔ 状态上报 ➔ 本地清理”的标准流程：

```text
[1. pg_dump 导出] ──> /backup/tmp/passup_20260810.dump
          │
[2. 校验文件 Head & 哈希] (如 pg_restore -l 确认格式无误)
          │
[3. mc cp 推送] ──> 备份 MinIO (bucket: passup-backup)
          │
[4. 校验远程文件] ──> 比对 ETag / MD5
          │
[5. 清理本地临时文件] ──> rm /backup/tmp/...

```

### 5.2 生产脚本参考示例

```bash
#!/usr/bin/env bash
set -euo pipefail

# 配置变量
DATE=$(date +%Y%m%d_%H%M%S)
TMP_DIR="/var/backups/postgres_tmp"
FILE_NAME="passup_${DATE}.dump"
LOCAL_PATH="${TMP_DIR}/${FILE_NAME}"
MINIO_ALIAS="backup-minio"
BUCKET_NAME="passup-backup"

mkdir -p "${TMP_DIR}"

# 1. 执行数据库导出 (Custom 格式)
docker exec -e PGPASSWORD="${PGPASSWORD}" postgres_prod \
  pg_dump -U postgres -d passup -Fc -f "/tmp/${FILE_NAME}"

docker cp "postgres_prod:/tmp/${FILE_NAME}" "${LOCAL_PATH}"
docker exec postgres_prod rm "/tmp/${FILE_NAME}"

# 2. 基础有效性校验 (验证是否为合法的 pg_dump 文件)
if ! pg_restore -l "${LOCAL_PATH}" > /dev/null 2>&1; then
    echo "[ERROR] 备份文件损坏，取消上传！"
    exit 1
fi

# 3. 推送至专用备份 MinIO
mc cp "${LOCAL_PATH}" "${MINIO_ALIAS}/${BUCKET_NAME}/postgres/${FILE_NAME}"

# 4. 清理本地临时文件
rm -f "${LOCAL_PATH}"
echo "[INFO] 备份上传完成: ${FILE_NAME}"

```

---

## 六、两阶段架构演进路线

```text
┌──────────────────────────────────────────────────────────┐
│ 阶段一：初创期 (数据量 < 200GB)                          │
│ 每日全量 pg_dump -Fc ➔ MinIO 存储                        │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│ 阶段二：成熟期 (数据量 > 200GB / 高 RPO 需求)              │
│ pgBackRest / WAL-G ➔ WAL 实时归档 + 每周全量 ➔ MinIO    │
└──────────────────────────────────────────────────────────┘

```

1. **第一阶段（快速落地）**：
* 采用 `pg_dump -Fc` 每日凌晨执行全量导出并推送到专用 MinIO。
* 架构简单、故障恢复直观，满足初期业务需求。


2. **第二阶段（高平滑升级）**：
* 当数据库体积增长至 200GB+ 时，全量 `pg_dump` 耗时过长。
* 引入 **pgBackRest**，将 WAL 日志实时流式归档至专用 MinIO，配合每周一次全量块级备份，实现 **PITR（任意时间点精准恢复）**。**前期建设的 MinIO 存储基础设施可 100% 复用。**



---

## 七、MinIO 备份的灾难恢复 (DR) 标准 SOP

> **核心认知**：MinIO 仅作为冷数据存储介质，不参与数据库计算。灾难恢复本质上是**“将 Dump 文件拉回目标服务器 ➔ 使用 pg_restore 导入数据库”**。

```text
备份 MinIO (存储) ──► 下载 .dump ──► pg_restore ──► PostgreSQL (计算)

```

### 7.1 数据库恢复具体操作步骤

#### Step 1: 从 MinIO 下载目标备份文件

```bash
mc cp backup-minio/passup-backup/postgres/passup_20260810_0200.dump /tmp/restore.dump

```

#### Step 2: 停止上游业务服务

避免恢复过程中产生并发写入导致的脏数据：

```bash
docker compose stop backend

```

#### Step 3: 重建目标数据库

进入 PostgreSQL 容器，清理现有数据库连接并重建空白库：

```bash
docker exec -it postgres_prod psql -U postgres -c "
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'passup' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS passup;
CREATE DATABASE passup OWNER passup_user;
"

```

#### Step 4: 执行高效并发恢复

利用 `pg_restore` 的 `-j` (jobs) 参数启用多线程并行导入，可大幅缩短恢复时间：

```bash
# -j 4 表示开启 4 个并行线程导入表结构与数据
docker exec -i postgres_prod pg_restore \
  -U postgres \
  -d passup \
  -j 4 \
  --no-owner \
  --role=passup_user \
  /tmp/restore.dump

```

#### Step 5: 验证数据完整性并启动业务

```bash
# 检查核心表数据行数
docker exec -it postgres_prod psql -U postgres -d passup -c "SELECT count(*) FROM app_user;"

# 启动业务服务
docker compose start backend

```

---

### 7.2 极限场景预案 (Extreme Scenarios)

#### 场景 A：生产服务器整体宕机/毁坏

在新服务器上通过 Docker Compose 快速拉起全新的 PostgreSQL 实例，通过 `mc` 将最新备份从 MinIO 拉回，执行 `pg_restore` 即可在短时间内重建整个生产环境。

#### 场景 B：备份 MinIO 节点硬盘故障

若备份机没有开启 RAID1/RAID10，且单盘损坏，导致 MinIO 数据丢失：

* **预防手段**：设置 MinIO 自动将数据同步/镜像（`mc mirror`）至异地 NAS 或 AWS S3/云厂商 OSS（即严格执行 **3-2-1 原则**）。

---

### 7.3 演练建议

> **无演练，不备份。**

建议团队建立**每月定时恢复演练机制**：

1. 自动化拉起一台临时测试 Docker 容器。
2. 自动拉取 MinIO 最新备份执行 `pg_restore`。
3. 运行基础校验 SQL（检查基础表行数、最新订单时间）。
4. 输出演练报告并销毁临时容器。
