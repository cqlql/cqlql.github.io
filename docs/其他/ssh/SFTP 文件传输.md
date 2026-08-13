---
title: SFTP 文件传输
icon: mdi:folder-network
sort: 4
---

# SFTP 文件传输

`sftp` 是基于 SSH 的**交互式文件传输**工具，适合不确定文件位置、需要浏览远程目录后再传输的场景。

## 连接

```bash
sftp -P 2222 root@192.168.1.100
```

## 常用命令

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

## 示例

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

配置 SSH 公钥后，sftp 无需每次输密码。详见 [SSH 密钥管理](./SSH%20密钥管理.md)。
