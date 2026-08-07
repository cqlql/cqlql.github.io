<!-- @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [软件工具](#软件工具)
  - [pm2 多进程运行](#pm2-多进程运行)
- [nodejs 环境变量](#nodejs-环境变量)
- [linux 安装 npm](#linux-安装-npm)
- [linux 安装 curl](#linux-安装-curl)
- [命令行编辑](#命令行编辑)
- [root 用户切换](#root-用户切换)
- [Linux 环境变量和符号链接](#linux-环境变量和符号链接)
- [systemd - 进程管理](#systemd---进程管理)
- [命令行快捷键](#命令行快捷键)
- [ubuntu apt 软件包管理](#ubuntu-apt-软件包管理)
  - [安装](#安装)
  - [卸载](#卸载)
  - [查看安装包信息](#查看安装包信息)
  - [查看已装可升级软件包](#查看已装可升级软件包)
- [终端快捷键](#终端快捷键)
- [问题](#问题)

<!-- /code_chunk_output -->

## 软件工具

### [pm2](https://github.com/Unitech/pm2) 多进程运行

```sh
pm2 start http-server -- /usr/website
```

## nodejs 环境变量

[ubuntu 安装及配置 nodejs](https://www.jianshu.com/p/4125b3672baf)

export NODE_HOME=/usr/local/nodejs  
export PATH=$PATH:$NODE_HOME/bin  
export NODE_PATH=$NODE_HOME/lib/node_modules

软链接方式：

```sh
sudo ln -s /usr/local/nodejs/bin/node /usr/local/bin/node
sudo ln -s /usr/local/nodejs/bin/npm /usr/local/bin/npm
```

## linux 安装 npm

curl http://npmjs.org/install.sh | sudo sh

## linux 安装 curl

sudo apt-get install curl

## 命令行编辑

查看更多：[Linux 命令行快捷键](https://www.cnblogs.com/aslongas/p/5899586.html)

Ctrl+a 移到行首  
Ctrl+e 移到行尾  
ctrl+w 删除单词  
ctrl+u 删除光标前所有(带剪切)  
ctrl+k 删除光标后所有(带剪切)  
ctrl+y 粘贴

ctrl+l：进行清屏操作

## root 用户切换

设置密码

```sh
sudo passwd root
```

切换

```bash
su root
```

xshell 无法使用 root 登录问题

1. 修改 `/etc/ssh/sshd_config` 文件，把 `PermitRootLogin Prohibit-password` 添加#注释掉
2. 新添加：`PermitRootLogin yes`
3. 重启 ssh 服务 `/etc/init.d/ssh restart`

## Linux 环境变量和符号链接

https://www.jianshu.com/p/ac17d8a3d0c4

## systemd - 进程管理

`systemd` 是一个初始系统，可以提供启动、停止和管理进程的许多强大的功能

## 命令行快捷键

| 快捷键 | 描述                     |
| ------ | ------------------------ |
| Ctrl+k | 删除此处至末尾的所有内容 |
| Ctrl+u | 删除此处至开始的所有内容 |

参考文档：

https://blog.csdn.net/liukai2918/article/details/79463062

---

linux 开放端口

## ubuntu apt 软件包管理

### 安装

```sh
sudo apt install python2
```

### 卸载

```sh
sudo apt remove python2
```

### 查看安装包信息

可查看软件版本，以及是否已经安装等信息

```sh
sudo apt search mysql-server
```

### 查看已装可升级软件包

```sh
apt list --upgradable
```

## 终端快捷键

ctrl+k 删除光标至末尾字符串

## 问题

- Permission denied 拒绝访问 - 权限问题
  刚解压的文件执行其中的 .sh 脚本，最高权限 root 用户，确报 Permission denied 错误。
  解决方法：输入命令 `sudo chmod -R 777 /工作目录`，例如：`sudo chmod -R 777 /home/v2ray-3.05`
