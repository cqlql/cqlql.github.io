---
title: rsync 文件同步
icon: mdi:sync
sort: 5
---

# rsync 文件同步

`rsync` 是一种**文件同步工具**，擅长增量传输（只传变化的部分），常通过 **SSH 作为传输通道**，也支持原生 `rsync://` 协议。

> 定位区分：`scp` 适合"把这个文件传过去"，`rsync` 适合"让这两个目录保持同步"。二者场景不同，并非简单的替代关系。

## 核心特点

- **增量同步**：只传输源与目标之间的差异，大目录二次同步极快。
- **保留属性**：可保留权限、时间戳、符号链接等。
- **断点续传**：配合 `-P` 可显示进度并支持断点。
- **灵活排除**：通过 `--exclude` 跳过指定文件/目录。
- **传输通道**：默认（或显式 `-e ssh`）走 SSH；也可直接连 `rsync://server/module`。

## 常用选项

| 选项 | 作用 |
|------|------|
| `-a` | 归档模式，递归并保留符号链接、权限、时间戳等（常用 `-avz` 基础组合） |
| `-v` | 显示详细过程 |
| `-z` | 传输时压缩，加速网络传输 |
| `-P` | 等同 `--partial --progress`，显示进度并支持断点续传 |
| `-r` | 递归目录（`-a` 已隐含 `-r`） |
| `-h` | 以人类可读格式显示数字（如 `1.2M/s`） |
| `-n` | 试运行（dry-run），只显示会做什么，不真正传输 |
| `--delete` | 删除目标中源已不存在的文件，使目标成为源的镜像 |
| `--exclude=模式` | 排除匹配的文件/目录 |
| `--bwlimit=KBPS` | 限速传输，单位 KB/s，避免占满带宽 |
| `-e ssh` | 指定通过 SSH 传输（默认通常已是 SSH） |

## 通过 SSH 同步（最常用）

```bash
# 本地目录 → 远程（注意源路径结尾的 / 含义不同，见下文）
rsync -avz ./data/ user@server:/data/

# 远程 → 本地
rsync -avz user@server:/data/ ./data/

# 指定 SSH 端口
rsync -avz -e "ssh -p 2222" ./data/ user@server:/data/

# 试运行，先看会同步什么
rsync -avzn ./data/ user@server:/data/
```

## 原生命令通道

```bash
# 不走 SSH，直接连 rsync daemon
rsync -avz user@server::module/path ./local/
rsync -avz rsync://user@server/module/path ./local/
```

## 排除与镜像

```bash
# 排除 node_modules 和 .git
rsync -avz --exclude=node_modules --exclude=.git ./app/ user@server:/app/

# 排除写在文件里（每行一个模式）
rsync -avz --exclude-from=exclude.txt ./app/ user@server:/app/

# 镜像：让目标与源完全一致（删除目标多余文件，慎用）
rsync -avz --delete ./app/ user@server:/app/
```

> `--delete` 会删除目标上源没有的文件，建议先用 `-n` 试运行确认。

## 斜杠的含义

- `./data/` ：同步目录**内容**到目标。
- `./data` （无尾斜杠）：在目标下创建 `data` 目录再同步内容。

## 与 scp / sftp 的对比

| 工具 | 主要用途 | 增量 | 交互 |
|------|----------|------|------|
| `scp` | 简单文件复制 | 否 | 否 |
| `sftp` | 交互式文件传输 | 否 | 是 |
| `rsync` | 增量文件同步 | 是 | 否 |

## 免密同步

配置 SSH 公钥后，`rsync over SSH` 无需每次输密码。详见 [SSH 密钥管理](./SSH%20密钥管理.md)。
