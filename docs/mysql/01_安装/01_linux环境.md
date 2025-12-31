::: info

以下是对 **MySQL Community** 版本进行的安装

:::

## ubuntu 下安装

### apt 安装

先下载 MySQL APT Repository，最新下载地址[打开此链接](https://dev.mysql.com/downloads/repo/apt)查看

```sh
sudo wget -P /home https://dev.mysql.com/get/mysql-apt-config_0.8.23-1_all.deb
```

解压

```sh
sudo dpkg -i mysql-apt-config_w.x.y-z_all.deb
```

更新包信息

```sh
sudo apt-get update
```

安装

```sh
sudo apt-get install -y mysql-server
```

**参考文档：**

[MySQL 官方 :: A Quick Guide to Using the MySQL APT Repository](https://dev.mysql.com/doc/mysql-apt-repo-quick-guide/en/)

### 其他方式安装

[官方文档](https://dev.mysql.com/doc/refman/8.0/en/installing.html)

### 安装问题解决

1.  Failed to fetch ，这是一个网络问题，可修改国内阿里云镜像服务器。

[修改国内镜像方法](https://blog.csdn.net/feiniao8651/article/details/60332535)

## 查看安装状态

```sh
systemctl status mysql
```

## 查找 mysql 安装目录

当前环境是 window 子系统，所以排除 /mnt 目录

```sh
sudo find / -path /mnt -prune , -name mysql
```

## windows linux 子系统（wsl）安装 - 失败

::: warning 失败原因

此安装方式在 wsl 中不能成功启动，目前没找到好的解决的办法，似乎与 wsl 没有 systemctl 有关。 [wsl 环境安装方式见下](#wsl-下简单安装方式)

:::

```sh
# 更新 Ubuntu 软件源头
sudo apt update

# 安装
sudo apt install -y mysql-server mysql-common

# 启动
sudo service mysql start

# 查看状态
sudo service mysql status

# 接下来进入 mysql 添加普通用户，再用普通用户登录
sudo mysql
```

参考文档：

[WSL 搭建 MySQL - 简书](https://www.jianshu.com/p/1101ffb128c1)

[使用 WSL 添加或连接数据库 | Microsoft Docs](https://docs.microsoft.com/zh-cn/windows/wsl/tutorials/wsl-database)
