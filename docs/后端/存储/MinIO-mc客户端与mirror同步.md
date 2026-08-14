---
title: MinIO mc 客户端与 mirror 同步
icon: simple-icons:minio
sort: 5
---

`mc`（MinIO Client）是官方命令行工具，相当于对象存储界的 `aws cli` / `rsync`。本文聚焦 `mc mirror` 同步/备份能力，可以和《MinIO 专用备份服务器目录规范》配合落地。

> 前置：`mc` 的安装、`alias` 配置（连接 MinIO）等基础知识请先看《MinIO mc 客户端常用命令》，本文默认已配好别名（下文示例中的 `myminio` / `prod` / `backup`）。

> 与 `mc cp` 的区别：`cp` 是单文件/批量拷贝，`mirror` 是按源→目标做**增量镜像**（只传差异），并可选删除目标端多余文件，适合备份与同步。

## 一、mc mirror 语法

基本格式：

```sh
mc mirror [FLAGS] SOURCE TARGET
```

`SOURCE` / `TARGET` 可以是：

- 本地目录：`/data/backups/postgres/daily`
- 桶路径：`myminio/resume`
- 跨实例桶：`backup/resume`（别名不同即跨实例）

### 常用参数

| 参数 | 说明 |
|------|------|
| `--watch` | 持续监听，源变化实时同步（常驻进程） |
| `--remove` | 删除目标端存在但源端已不存在的文件（保持严格一致） |
| `--overwrite` | 即使目标端较新也强制覆盖 |
| `--dry-run` | 只打印将要执行的操作，不真正执行 |
| `--older-than` / `--newer-than` | 按时间过滤 |
| `--exclude` | 排除匹配项（支持通配） |

## 二、实战场景

### 1. 本地目录 → MinIO（单机备份）

把本地备份目录同步进 MinIO bucket：

```sh
mc mirror /data/backups/postgres/daily myminio/backups
```

> 首次全量，之后只传新增/变更文件，非常适合定时备份。

### 2. MinIO → MinIO（跨实例同步 / 备份服务器落地）

把生产实例的 `resume` 桶镜像到备份服务器：

```sh
mc mirror prod/resume backup/resume
```

配合《MinIO 专用备份服务器目录规范》的目录结构，备份脚本 `minio_sync.sh` 里一行即可：

```sh
#!/usr/bin/env bash
mc mirror prod/resume backup/resume --remove
```

### 3. 实时增量同步（--watch）

常驻进程，源一变化就同步（适合双活 / 准实时容灾）：

```sh
mc mirror prod/resume backup/resume --watch
```

### 4. 严格一致镜像（--remove）

确保目标端和源端完全一致，源删了目标也删：

```sh
mc mirror prod/resume backup/resume --remove --overwrite
```

> ⚠️ `--remove` 危险：目标端多余文件会被删，正式跑前务必先用 `--dry-run` 确认。

### 5. 排除临时文件

```sh
mc mirror /data/backups/postgres/daily myminio/backups \
  --exclude "*.tmp" --exclude "*/temp/*"
```

## 三、与 cron / 定时任务结合

最简单的每日备份，加到 crontab：

```sh
# 每天 03:00 把生产 resume 桶同步到备份服务器
0 3 * * * /usr/local/bin/mc mirror prod/resume backup/resume --remove >> /var/log/mc_sync.log 2>&1
```

## 四、mirror vs cp 怎么选

| 场景 | 用哪个 |
|------|--------|
| 一次性上传一批文件 | `mc cp` |
| 周期性备份 / 增量同步 | `mc mirror` |
| 需要删除目标多余文件 | `mc mirror --remove` |
| 实时同步（容灾） | `mc mirror --watch` |

## 五、总结

- `mc mirror` 是备份/同步主力，支持增量、`--watch` 实时、`--remove` 严格一致。
- 生产同步前用 `--dry-run` 验证，正式结合 cron 落地。

## 六、官方文档参考

- MinIO Client (mc) 概览：<https://min.io/docs/minio/linux/reference/minio-mc.html>
- `mc mirror` 命令参考：<https://min.io/docs/minio/linux/reference/minio-mc/mc-mirror.html>
- `mc cp` 命令参考：<https://min.io/docs/minio/linux/reference/minio-mc/mc-cp.html>
