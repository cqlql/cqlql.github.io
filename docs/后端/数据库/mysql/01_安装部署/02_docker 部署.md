---
title: Docker 部署
icon: devicon:docker
sort: 2
---

## 拉取镜像

```sh
# latest 安装最新版，也可指定 tag（如 mysql:8.0）
docker pull mysql:latest
```

查找可用 tag：去 [Docker Hub](https://hub.docker.com/_/mysql) 搜索，注意 `OFFICIAL` 为官方镜像。

## 创建并运行容器

```sh
docker run --name some-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=123123 \
  -d mysql:latest
```

## 进入容器

```sh
# 列出运行中的容器 ID
docker ps

# 进入容器（相当于一个 linux 系统），289cc00dc5ed 为容器 id
docker exec -it 289cc00dc5ed bash
```

## 快速初始化（建库 + 用户）

root 权限过高，建议限制 root 仅本地访问，并创建专用业务用户：

```sql
-- 创建业务库
CREATE DATABASE IF NOT EXISTS db_user
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

-- 创建业务用户（% 表示任意 host，可改为 localhost 仅本地）
CREATE USER 'joly'@'%' IDENTIFIED BY '123123';

-- 授权该库
GRANT ALL ON db_user.* TO 'joly'@'%';

FLUSH PRIVILEGES;
```

> [!warning]
> 必须先 `CREATE USER` 再 `GRANT`，否则 MySQL 8 会隐式创建用户（不推荐，且旧版本不支持）。

## 参考

- [mysql - Official Image](https://hub.docker.com/_/mysql)
