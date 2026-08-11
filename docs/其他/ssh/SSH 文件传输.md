---
title: SSH 文件传输
icon: mdi:file-transfer
sort: 3
---

# SSH 文件传输

两种常用方式：`scp`（命令行单次拷贝）和 `sftp`（交互式批量操作）。

## scp

### 上传：本地 → 远程

```bash
# 单个文件
scp 本地文件路径 用户名@远程IP:远程存放目录
scp /root/test.txt root@192.168.1.100:/home/

# 整个文件夹（-r 递归）
scp -r /root/dir root@192.168.1.100:/home/
```

### 下载：远程 → 本地

```bash
# 下载文件
scp root@192.168.1.100:/home/test.txt ./

# 下载文件夹
scp -r root@192.168.1.100:/home/logs ./logs
```

### 常用选项

| 选项 | 作用 |
|------|------|
| `-P 端口` | 指定 SSH 端口（大写，非默认 22） |
| `-r` | 递归传输整个目录 |
| `-C` | 传输时开启压缩，加速大文件 |
| `-p` | 保留文件修改时间、权限等属性（小写） |
| `-v` | 显示详细过程，排查问题用 |

### 指定端口

```bash
scp -P 2222 test.txt root@192.168.1.100:/tmp
```

> 注意：`-P` 大写，与 ssh 命令的 `-p` 小写不同。

### 加速大文件传输

```bash
scp -Cr /data root@192.168.1.100:/backup
```

## sftp

交互式操作，适合不确定文件位置、需要浏览后再传输的场景。

### 连接

```bash
sftp -P 2222 root@192.168.1.100
```

### 常用命令

| 命令 | 作用 |
|------|------|
| `ls` | 查看远程文件 |
| `lls` | 查看本地文件 |
| `cd` | 切换远程目录 |
| `lcd` | 切换本地目录 |
| `pwd` | 查看远程当前目录 |
| `lpwd` | 查看本地当前目录 |
| `get 文件名` | 下载文件 |
| `get -r 文件夹` | 下载文件夹 |
| `put 文件名` | 上传文件 |
| `put -r 文件夹` | 上传文件夹 |
| `rm 文件名` | 删除远程文件 |
| `mkdir 目录` | 创建远程目录 |
| `exit` | 退出 |

### 示例

```bash
lcd /Users/xxx/file   # 切到本地目录
put app.tar.gz         # 上传
get server.log         # 下载
```

## 图形化工具

| 工具 | 特点 |
|------|------|
| Xftp | 与 Xshell 配套，一体 SSH + 文件传输 |
| WinSCP | 纯 SFTP 图形工具，免费 |
| FinalShell | 国产，SSH + 文件拖拽上传下载 |
| MobaXterm | 全能终端，内置 SFTP 面板 |

## 免密传输

配置 SSH 公钥后，scp/sftp 无需每次输密码。详见 [SSH 密钥管理](./SSH%20密钥管理.md)。
