## 安装

使用命令安装

```sh
# latest 将安装最新版，还可以安装其他的 tag
docker pull mysql:latest
```

**查找其他 tag**：去 [线上仓库](https://hub.docker.com/) 搜索 mysql，查看可用 tag。注意 OFFICIAL 标签表示这是官方镜像。

## 使用

进入 mysql 容器环境

```sh

# 创建 mysql 容器
docker run --name some-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=123123 -d mysql:latest

# 列出 mysql 容器 id
# 此命令会列出正在运行的容器ID
docker ps

# 进入容器，相当于是一个linux系统
# 其中 289cc00dc5ed 为 mysql 容器 id
docker exec -it 289cc00dc5ed bash

```

## 参考文档

[mysql - Official Image](https://hub.docker.com/_/mysql)
