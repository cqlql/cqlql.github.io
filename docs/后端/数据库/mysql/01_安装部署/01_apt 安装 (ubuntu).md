---
title: apt 安装 (Ubuntu)
icon: devicon:ubuntu
sort: 1
---

> [!tip]
> 以下基于 **MySQL Community** 版本，Ubuntu 环境。

## apt 安装

下载 MySQL APT Repository（[最新地址](https://dev.mysql.com/downloads/repo/apt)）：

```sh
sudo wget -P /home https://dev.mysql.com/get/mysql-apt-config_0.8.23-1_all.deb
sudo dpkg -i mysql-apt-config_0.8.23-1_all.deb
sudo apt-get update
sudo apt-get install -y mysql-server
```

**参考：** [MySQL APT Repository 官方指南](https://dev.mysql.com/doc/mysql-apt-repo-quick-guide/en/)

## 安装问题解决

- `Failed to fetch`：多为网络问题，可切换阿里云镜像源。
  - [修改国内镜像方法](https://blog.csdn.net/feiniao8651/article/details/60332535)

## 查看安装状态

```sh
systemctl status mysql
```

## 查找 mysql 安装目录

当前环境是 Windows 子系统，排除 `/mnt` 目录：

```sh
sudo find / -path /mnt -prune -o -name mysql -print
```

## 其他安装方式

- [官方安装文档](https://dev.mysql.com/doc/refman/8.0/en/installing.html)
