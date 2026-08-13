---
title: SCP 文件传输
icon: mdi:content-copy
sort: 3
---

# SCP 文件传输

`scp`（Secure Copy）是基于 SSH 的**简单文件复制**工具，适合"把这个文件传过去"的一次性拷贝场景。

## 上传：本地 → 远程

```bash
# 单个文件
scp 本地文件路径 用户名@远程IP:远程存放目录
scp /root/test.txt root@192.168.1.100:/home/

# 整个文件夹（-r 递归）
scp -r /root/dir root@192.168.1.100:/home/
```

## 下载：远程 → 本地

```bash
# 下载文件
scp root@192.168.1.100:/home/test.txt ./

# 下载文件夹
scp -r root@192.168.1.100:/home/logs ./logs
```

## 常用选项

| 选项 | 作用 |
|------|------|
| `-P 端口` | 指定 SSH 端口（大写，非默认 22） |
| `-r` | 递归传输整个目录 |
| `-C` | 传输时开启压缩，加速大文件 |
| `-p` | 保留文件修改时间、权限等属性（小写） |
| `-v` | 显示详细过程，排查问题用 |

## 指定端口

```bash
scp -P 2222 test.txt root@192.168.1.100:/tmp
```

> 注意：`-P` 大写，与 ssh 命令的 `-p` 小写不同。

## 指定私钥

```bash
# 用非默认私钥传输
scp -i ~/.ssh/id_ed25519 test.txt root@192.168.1.100:/tmp
```

## 使用 ~/.ssh/config 别名

在 `~/.ssh/config` 配置别名后，可省去用户、地址、端口：

```ssh-config
Host myserver
    HostName 192.168.1.100
    User root
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
```

之后直接写别名即可：

```bash
scp test.txt myserver:/tmp
```

## 加速大文件传输

```bash
scp -Cr /data root@192.168.1.100:/backup
```

## 免密传输

配置 SSH 公钥后，scp 无需每次输密码。详见 [SSH 密钥管理](./SSH%20密钥管理.md)。

> 需要增量同步（只传变化部分）或断点续传时，见 [rsync 文件同步](./rsync%20文件同步.md)。
