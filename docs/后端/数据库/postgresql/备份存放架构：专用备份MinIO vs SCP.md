---
title: 备份存放架构：专用备份 MinIO vs SCP
icon: mdi:server-network
sort: 3
---

# 备份存放架构：专用备份 MinIO vs SCP

> 本文讨论的是备份的**存放目标与传输方式**选型——备份文件最终落到哪里、怎么传过去。
> 与[备份工具选型](./工具选型对比.md)（pgBackRest / WAL-G）是不同维度：工具负责「怎么备份」，本文负责「备份往哪放」。

## 一、背景：为什么要独立备份机

在单机 Docker 场景（PostgreSQL + MinIO + Java + Redis 全在一台机器）下，如果直接把备份写回本机 / 业务 MinIO，凌晨备份会与业务竞争 CPU、内存、磁盘 IO 与网络，还可能拖慢业务 MinIO。

更合理的演进是把备份压力挪到另一台机器：

```text
┌─────────────────────────┐
│        业务服务器        │
│                         │
│      PostgreSQL         │
│          │              │
│          │ pg_dump      │
│          ↓              │
│      backup 文件        │
│          │              │
│          │ 上传         │
│          ↓              │
└──────────┬──────────────┘
           │
           ↓
┌─────────────────────────┐
│        备份服务器        │
│                         │
│   MinIO（专用，只负责备份）│
└─────────────────────────┘
```

要点：**业务 MinIO 负责用户文件，备份 MinIO 只负责备份，两者完全隔离。**

## 二、优点

### 1. 不影响业务 MinIO

集中式部署时备份与业务抢资源：

```text
┌─────────────────────────────┐
│ 一台机器：PostgreSQL / MinIO │
│           / Java / Redis     │
│ 凌晨：pg_dump 100GB          │
│       → MinIO 写入 100GB     │
│ 竞争：CPU / 内存 / 磁盘IO / 网络│
└─────────────────────────────┘
```

拆分后备份压力在另一台机器，业务基本无感。

### 2. 备份服务器可针对性优化

业务服务器用高配（SSD / 16 核 / 64GB RAM），备份服务器用大容量低配即可，例如 `8TB HDD + RAID1`，备份并不需要 NVMe。

### 3. 可保存多版本 + 生命周期管理

MinIO bucket 天然按对象组织，方便多版本保留：

```text
postgres-backup/
├── 2026-08-10/
│    └── passup.dump
├── 2026-08-09/
│    └── passup.dump
└── 2026-08-08/
     └── passup.dump
```

配合生命周期规则：保留最近 7 天、4 周、12 个月，自动清理。

## 三、重要提醒：备份机不是终点

```text
业务服务器 → 备份服务器 MinIO
```

> ⚠️ 单点风险：机房断电、火灾、勒索病毒、误删 bucket，两份数据会同时消失。

更完整的结构应加上异地/云：

```text
生产服务器 PostgreSQL
    → 备份服务器 MinIO
    → 异地 / 云存储（OSS / S3 / 另一台机器）
```

即经典的 **3-2-1 备份原则**：

```text
3 份数据
2 种介质
1 份异地
```

## 四、方案对比：SCP 推送 vs 专用备份 MinIO

### 方案一：SCP 推送文件

```text
生产服务器：pg_dump → backup.dump → scp → 备份服务器 /backup/postgres/
```

- 优点：简单、Linux 原生、学习成本最低、小规模完全够用。
- 缺点：
  - 没有对象存储能力，文件生命周期 / 权限 / 多项目隔离 / 自动清理都要自己写脚本。
  - 断点续传弱：100GB 传到 90GB 断开通常需重传。
  - 多项目扩展麻烦（`scp projectA.dump ...:/backup/a` 脚本越写越多）。

### 方案二：备份服务器部署 MinIO

```text
生产服务器：pg_dump → mc cp / aws s3 api → 备份服务器 MinIO
bucket: backup
  ├── postgres/passup/2026-08-10.dump
  ├── minio/...
  └── configs/...
```

- 天然适合备份：对象存储模型天然隔离多项目。
- 生命周期管理：可直接配置 7 / 30 / 90 天保留，无需手写 `find -mtime +30 -delete`。
- 支持断点、多线程：S3 multipart upload 可分片、重试、并发，比 scp 适合大文件。
- 后续升级容易：本地 MinIO 迁移到 AWS S3 / 阿里云 OSS / 腾讯 COS，代码几乎不变。

### 性能对照

两者最终都走网络（TCP），速度差别不大：

| 维度 | SCP | MinIO |
| --- | --- | --- |
| 速度 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 大文件 | 一般 | 优秀 |
| 断点续传 | 弱 | 强 |
| 权限管理 | 弱 | 强 |
| 生命周期 | 无 | 有 |
| 多项目 | 麻烦 | 方便 |
| 未来扩展 | 一般 | 好 |

## 五、推荐设计（结合 PassUp 项目）

```text
生产服务器
================
PostgreSQL
每日：pg_dump -Fc → /backup/tmp → mc cp
================
备份服务器
================
MinIO  bucket: backup
  postgres/passup/2026-08-10.dump
  minio/...
  config/...
```

MinIO 侧建议开启：用户权限、bucket 生命周期、重要备份的 versioning。

### 一个小优化：上传前先校验

不要直接 `pg_dump | 上传`，推荐落盘校验后再传：

```text
pg_dump → /backup/postgres/tmp.dump
  → 校验 md5 / sha256
  → 上传 MinIO
  → 上传成功
  → 删除本地文件
```

避免「上传中断生成半个备份」。

### 什么时候 SCP 更合适？

仅当：单个数据库、数据 < 10GB、永不扩展、纯个人项目时，`scp backup.dump backup-server:/data` 完全够用。

若已有 PostgreSQL + MinIO + 多项目且后续可能增长，**优先选专用备份服务器 + MinIO**，这是从小项目平滑走向生产架构的路线；后续接入 pgBackRest / WAL 增量，也可直接把 WAL 归档到同一个 MinIO，无需换架构。

## 六、两阶段演进路线

### 第一阶段（现在，规模小）

```text
服务器 A（生产）：Docker 跑 PostgreSQL / Redis / MinIO(业务) / Java
服务器 B（备份）：Docker 跑 MinIO(backup)
每日凌晨 2 点：pg_dump → 上传服务器 B MinIO
```

特点：架构简单、成本低，已把备份 IO 与业务隔离。

### 第二阶段（数据 > 200GB）

升级为 `pgBackRest + WAL 归档 + MinIO backup`：

```text
全量备份：每周一次
WAL 归档：持续上传（实时）
```

特点：从「每晚全量 dump」升级为「增量 + 时间点恢复（PITR）」，仍能复用第一阶段的 MinIO，无需换架构。

落地命令细节见 [pg_dump 单机实操](./pg_dump单机docker实操指南.md) 与 [pgBackRest 备份策略](./pgBackRest备份策略.md)。
