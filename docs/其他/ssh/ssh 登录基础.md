---
title: SSH 登录基础
icon: mdi:console-network
sort: 1
---

# SSH 登录基础

`ssh` 用于**远程登录并在远端执行命令**，是 scp / sftp / rsync over SSH 的共同基础。

## 基本连接

```bash
# 默认 22 端口
ssh user@server_ip

# 指定端口
ssh -p 2222 user@server_ip

# 指定私钥
ssh -i ~/.ssh/id_ed25519 -p 2222 user@server_ip
```

## 远程执行命令

```bash
# 登录后直接跑命令并退出
ssh user@server_ip "uptime"
ssh user@server_ip "df -h /data"
```

## ~/.ssh/config 别名

配置后可用短别名代替冗长参数：

```ssh-config
Host myserver
    HostName 192.168.1.100
    User root
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
```

```bash
ssh myserver          # 等价于 ssh -p 2222 -i ~/.ssh/id_ed25519 root@192.168.1.100
ssh myserver "uptime" # 远程执行
```

> 多个主机可各写一个 `Host` 块；通配可用 `Host 10.0.*` 等形式。

## 跳板 / 代理跳转

```bash
# 通过跳板机访问内网机器（ProxyJump）
ssh -J jump_user@jump_host internal_user@internal_host

# config 写法
Host internal
    HostName 10.0.0.5
    User root
    ProxyJump jump_user@jump_host
```

## 保持连接（防断线）

在 `~/.ssh/config` 中加入，避免长时间空闲被断开：

```ssh-config
ServerAliveInterval 60
ServerAliveCountMax 3
```

## 相关笔记

- 密钥与免密：[SSH 密钥管理](./SSH%20密钥管理.md)
- 文件传输专题：[SSH 文件传输](./SSH%20文件传输.md)
