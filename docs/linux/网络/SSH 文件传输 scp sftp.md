---
title: SSH 文件传输 scp sftp
sort: 3
---

# SSH 传输文件两种常用方式：scp、sftp

## 一、scp 命令（简单单文件/文件夹拷贝）

### 1. 本地 → 远程（上传）

```bash
# 单个文件
scp 本地文件路径 用户名@远程IP:远程存放目录
scp /root/test.txt root@192.168.1.100:/home/

# 整个文件夹（加 -r）
scp -r /root/dir root@192.168.1.100:/home/
```

### 2. 远程 → 本地（下载）

```bash
# 下载文件
scp root@192.168.1.100:/home/test.txt ./

# 下载文件夹
scp -r root@192.168.1.100:/home/logs ./logs
```

### 3. 指定端口（SSH 非22端口）

```bash
# -P 大写指定端口
scp -P 2222 test.txt root@192.168.1.100:/tmp
```

## 二、sftp（交互式，适合批量操作）

### 1. 连接远程服务器

```bash
sftp -P 2222 root@192.168.1.100
```

### 常用交互命令

| 命令 | 作用 |
|------|------|
| `ls` | 查看远程文件 |
| `lls` | 查看本地文件 |
| `cd` | 切换远程目录 |
| `lcd` | 切换本地目录 |
| `get 文件名` | 下载远程文件到本地 |
| `get -r 文件夹` | 下载文件夹 |
| `put 文件名` | 上传本地文件到远程 |
| `put -r 文件夹` | 上传文件夹 |
| `exit` | 退出sftp |

示例流程：

```bash
# 切换本地目录
lcd /Users/xxx/file
# 上传
put app.tar.gz
# 下载
get server.log
```

## 三、Windows 客户端图形化工具（新手推荐）

1. **Xshell / Xftp**：一体SSH+文件传输
2. **WinSCP**：纯SFTP图形工具，免费
3. **FinalShell**：国产，SSH+文件拖拽上传下载

## 四、免密传输（无需重复输密码）

本地生成密钥上传到远程，之后 scp/sftp 不用输密码：

```bash
# 生成密钥（一路回车）
ssh-keygen
# 推送公钥到远程
ssh-copy-id -p 2222 root@192.168.1.100
```

## 五、加速大文件传输

加 `-C` 开启压缩传输：

```bash
scp -Cr /data root@192.168.1.100:/backup
```
