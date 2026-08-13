---
title: MinIO mc 客户端常用命令
icon: simple-icons:minio
sort: 3
---

`mc` 是 MinIO 官方命令行工具，语法贴近 Unix 命令。本文梳理日常高频命令的速查，配合《MinIO mc 客户端与 mirror 同步》使用：那篇侧重安装、`alias` 配置与 `mirror` 备份，本文侧重 bucket、对象、权限、版本等日常运维操作。

## 一、别名（alias）

连接 MinIO 前先配置别名，后续命令不再重复写地址与密钥。

```sh
# 添加别名：mc alias set <别名> <endpoint> <accessKey> <secretKey>
mc alias set local http://localhost:9000 minioadmin minioadmin

# 列出所有别名
mc alias list

# 删除别名
mc alias remove local
```

## 二、Bucket 管理

```sh
# 创建 bucket
mc mb local/resume

# 创建时指定区域
mc mb --region cn-north-1 local/resume

# 列出所有 bucket
mc ls local

# 查看 bucket 详情（占用、对象数等）
mc du local/resume

# 删除 bucket（仅空桶）
mc rb local/resume

# 强制删除（含对象）
mc rb --force local/resume
```

## 三、对象上传 / 下载

```sh
# 上传文件
mc cp ./简历.pdf local/resume/10001/简历.pdf

# 上传目录（递归）
mc cp -r ./files local/resume/

# 下载文件
mc cp local/resume/简历.pdf ./下载.pdf

# 下载整个目录
mc cp -r local/resume/files ./

# 上传并保留原文件名/类型（自动识别 Content-Type）
mc cp --attr "Content-Type=application/pdf" ./a.pdf local/resume/a.pdf
```

## 四、对象查看与元数据

```sh
# 查看对象内容（直接输出到终端）
mc cat local/resume/readme.md

# 查看对象元数据（大小、类型、ETag、时间等）
mc stat local/resume/简历.pdf

# 查看前 N 行（适合日志类对象）
mc head -n 50 local/logs/app.log

# 搜索对象
mc find local/resume --name "*.pdf"

# 列出对象（含子路径，类似 ls -R）
mc ls -r local/resume

# 递归列出并展示人眼友好的大小
mc ls -r local/resume --summarize
```

## 五、删除与移动

```sh
# 删除单个对象
mc rm local/resume/简历.pdf

# 删除目录（递归）
mc rm -r local/resume/files

# 删除前预览（dry-run）
mc rm -r --dry-run local/resume/files

# 移动 / 重命名对象
mc mv local/resume/a.pdf local/resume/b.pdf

# 跨 bucket 移动
mc mv local/resume/a.pdf local/archive/a.pdf
```

## 六、权限管理（policy）

```sh
# 查看 bucket 当前策略
mc anonymous get local/resume

# 设为公开读（所有人都能读，谨慎）
mc anonymous set download local/public-bucket

# 设为公开读写（非常危险，勿用于敏感数据）
mc anonymous set public local/temp-bucket

# 恢复为私有（默认）
mc anonymous set none local/resume
```

> 预签名 URL 场景请保持 bucket 私有（`none`），不要为敏感文件开公开读。

## 七、版本控制与保留

```sh
# 开启版本控制
mc version enable local/resume

# 挂起版本控制
mc version suspend local/resume

# 查看版本控制状态
mc version info local/resume

# 列出对象所有版本
mc ls --versions local/resume/简历.pdf
```

## 八、其他常用

```sh
# 查看磁盘/桶使用情况
mc du local/resume

# 设置对象过期（生命周期规则，需按格式写入 JSON）
mc ilm add --expiry-days 30 local/resume/temp

# 导出配置（备份 alias）
mc alias export
```

## 九、常用参数汇总

| 参数 | 说明 |
|------|------|
| `-r` / `--recursive` | 递归操作目录 |
| `--dry-run` | 只打印不执行 |
| `--force` | 强制（如删除非空 bucket） |
| `--json` | 输出 JSON 格式，便于脚本解析 |
| `--older-than` | 只处理早于指定时间的对象 |
| `--newer-than` | 只处理晚于指定时间的对象 |
| `--exclude` | 排除匹配项（支持通配） |

## 十、速查对照表

| 操作 | 命令 |
|------|------|
| 配别名 | `mc alias set` |
| 建桶 | `mc mb` |
| 列桶/对象 | `mc ls` |
| 上传/下载 | `mc cp` |
| 增量同步 | `mc mirror` |
| 看内容 | `mc cat` |
| 看元数据 | `mc stat` |
| 删除 | `mc rm` |
| 移动/改名 | `mc mv` |
| 删桶 | `mc rb` |
| 占用统计 | `mc du` |
| 搜索 | `mc find` |
| 权限 | `mc anonymous` |
| 版本 | `mc version` |

## 官方文档参考

- MinIO Client (mc) 概览：<https://min.io/docs/minio/linux/reference/minio-mc.html>
- `mc cp` 命令参考：<https://min.io/docs/minio/linux/reference/minio-mc/mc-cp.html>
- `mc anonymous` 命令参考：<https://min.io/docs/minio/linux/reference/minio-mc/mc-anonymous.html>
- `mc version` 命令参考：<https://min.io/docs/minio/linux/reference/minio-mc/mc-version.html>
