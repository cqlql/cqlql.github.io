---
title: k3s 环境下的 PostgreSQL 备份与恢复
icon: devicon:kubernetes
sort: 5
---

# k3s 环境下的 PostgreSQL 备份与恢复

> 本文聚焦 **k3s / Kubernetes** 运行形态下的 PostgreSQL 备份与恢复落地。
> 通用机制（pg_dump / WAL / PITR 原理、工具对比）见姊妹篇：[单机 Docker PostgreSQL 备份与恢复](./单机Docker备份与恢复.md)。

## 与单机 Docker 的核心差异

| 维度 | 单机 Docker | k3s / Kubernetes |
| --- | --- | --- |
| 数据载体 | 宿主机目录 / 挂载卷 | PVC（PersistentVolumeClaim） |
| 备份执行 | `docker exec` + 宿主机文件 | `kubectl exec` / 独立备份 Job / InitContainer |
| 对象存储 | 单机 MinIO | 集群内 MinIO / 外部 S3 |
| 推荐工具 | `pgBackRest` | `WAL-G` + CloudNativePG Operator |
| 整机恢复 | 重部署容器 | Velero 卷快照 / 重建 StatefulSet + PVC |

## 方案与实操（规划中）

> 本节为结构规划，具体命令与 YAML 示例待补充。核心思路与单机 Docker 一致（逻辑备份 / 物理增量 PITR / 卷快照），差异主要在**执行载体**由宿主机变为 k8s 资源（Pod / Job / PVC），工具链偏向 `WAL-G` + Operator。

### 1. pg_dump 逻辑备份（集群内）

- 通过 `kubectl exec` 在 PG Pod 中执行 `pg_dump`，导出到 PVC 或上传 S3
- 恢复时从 PVC / S3 拉取 dump，再用 `pg_restore` 回灌

### 2. WAL 增量 / PITR（WAL-G + CloudNativePG）

- CloudNativePG Operator 的 `Backup` / `ScheduledBackup` 资源触发备份
- WAL-G 自动将 WAL 归档到 MinIO / S3
- 通过 `Recovery` 资源基于指定备份 + 时间点还原出新集群

### 3. 卷级快照（Velero）

- 用 Velero 对 PostgreSQL PVC 做卷快照（需 Storage Class 支持快照）
- 恢复时注意数据库一致性：优先配合 `pg_start_backup()` / 短暂停写，避免 WAL 与数据页错位

### 4. 恢复演练

- 定期将生产备份恢复到测试命名空间，校验关键表行数与业务可用性
