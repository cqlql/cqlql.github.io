---
title: k3s 环境下的 PostgreSQL 备份与恢复
icon: kubernetes
sort: 3
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

## 方案与实操（待补充）

### 1. pg_dump 逻辑备份（集群内）

- [ ] 通过 `kubectl exec` 执行 `pg_dump` 并导出到 PVC / S3
- [ ] 从 PVC / S3 拉取 dump 的恢复流程

### 2. WAL 增量 / PITR（WAL-G + CloudNativePG）

- [ ] CloudNativePG Operator 备份配置（Backup 资源）
- [ ] WAL-G 自动归档到 MinIO / S3
- [ ] 基于 Backup 的还原（Recovery 资源）

### 3. 卷级快照（Velero）

- [ ] 使用 Velero 对 PostgreSQL PVC 做卷快照
- [ ] 快照恢复注意事项（一致性、WAL 对齐）

### 4. 恢复演练

- [ ] 定期将生产备份恢复到测试命名空间校验
