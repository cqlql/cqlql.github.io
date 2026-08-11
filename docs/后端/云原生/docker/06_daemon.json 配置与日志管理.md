---
title: daemon.json 配置与日志管理
icon: devicon:docker
sort: 6
---

`/etc/docker/daemon.json` 是 Docker 守护进程的配置文件，核心用于设置**存储驱动**和**容器日志策略**。本文聚焦最常用的 `storage-driver`、`log-driver`、`log-opts` 三项配置。

## 一、核心配置

```json
{
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

### 1. `storage-driver: overlay2`

Docker 镜像采用分层结构，容器在只读镜像层之上叠加一个可写层：

```
镜像 layer 1 (只读)
    ↓
镜像 layer 2 (只读)
    ↓
镜像 layer 3 (只读)
    ↓
容器可写层
```

overlay2 将这些层联合挂载为运行中的容器文件系统。相比历史上的 `aufs`、`devicemapper`、`overlay` 等驱动，overlay2 是 Linux 主流推荐：

- 内核原生支持，性能与稳定性好
- 磁盘占用低（层共享，不重复复制）

查看当前驱动：

```bash
docker info | grep Storage
# Storage Driver: overlay2
```

### 2. `log-driver: json-file`

指定容器日志的存储方式（默认值）。`docker logs <容器名>` 看到的输出实际保存在：

```
/var/lib/docker/containers/<容器ID>/<容器ID>-json.log
```

### 3. `max-size` / `max-file`

默认 `json-file` **不限制日志大小**，长期运行会撑满 `/var/lib/docker`，导致 Docker 异常。滚动策略参数：

| 参数       | 含义                         | 示例  |
| ---------- | ---------------------------- | ----- |
| `max-size` | 单个日志文件最大体积         | `50m` |
| `max-file` | 最多保留的日志文件数（含当前） | `5`   |

超过 `max-size` 后 Docker 自动滚动，保留最近 `max-file` 个文件。以 `50m × 5` 为例，单容器日志最多约 **250MB**。

## 二、配置生效

修改配置后需要重启 Docker 服务：

```bash
sudo vim /etc/docker/daemon.json
sudo systemctl restart docker
```

重启后守护进程级配置对所有后续容器生效。⚠️ **已存在的容器仍沿用旧配置**，需重建：

```bash
docker compose down && docker compose up -d
```

## 三、查看容器日志占用

> 关键：以下命令需用 `sudo sh -c '...'` 包裹，让 root shell 展开通配符。普通用户无权读取 `/var/lib/docker/containers`，`*` 无法展开会报 `No such file or directory`。

### 所有容器日志占用

```bash
sudo sh -c 'du -sh /var/lib/docker/containers/*/*-json.log'
```

### 按大小排序

```bash
sudo sh -c 'du -h /var/lib/docker/containers/*/*-json.log | sort -h | tail -20'
```

### 全部 Docker 日志总量

```bash
sudo du -sh /var/lib/docker/containers
```

### 指定容器的日志

```bash
# 查看日志文件路径
docker inspect --format='{{.LogPath}}' <容器名>
# 查看大小
sudo du -h $(docker inspect --format='{{.LogPath}}' <容器名>)
```

### 爆盘排查：各目录整体占用

```bash
sudo du -h /var/lib/docker | sort -h | tail -30
# 输出示例：
# 20G  /var/lib/docker/overlay2
# 8G   /var/lib/docker/containers
# 100G /var/lib/docker/volumes
```

### 临时清空过大日志（不重启容器）

```bash
sudo truncate -s 0 $(docker inspect --format='{{.LogPath}}' <容器名>)
```

这只是应急手段，长期仍需配置 `log-opts` 并重建容器。

> ⚠️ `docker system df` **不统计 json-file 日志**，日志爆盘时请直接看 `/var/lib/docker/containers`。

## 四、排错：`du` 报 No such file or directory

报错：

```text
du: cannot access '/var/lib/docker/containers/*/*-json.log': No such file or directory
```

常见原因及排查：

### 1. 通配符未展开（最常见）

`*` 由当前用户 shell 展开，普通用户无权读取该目录，通配符匹配失败。

✅ 解决：用 `sudo sh -c '...'` 让 root shell 展开：

```bash
sudo sh -c 'du -sh /var/lib/docker/containers/*/*-json.log'
```

### 2. 日志驱动不是 json-file

查看默认驱动：

```bash
docker info | grep -i logging
# Logging Driver: json-file
```

查看每个容器的实际驱动：

```bash
docker ps -q | xargs docker inspect --format '{{.Name}} {{.HostConfig.LogConfig.Type}}'
```

若默认驱动是 **`local`**（Ubuntu 24.04 新版 Docker 常见），日志不在 `*-json.log` 中，而在容器目录的 `local-logs/` 下。此时改用：

```bash
sudo du -sh /var/lib/docker/containers/*
sudo find /var/lib/docker/containers -type f -size +100M
```

无论哪种驱动，定位单容器日志文件的通用方式：

```bash
docker inspect <容器名或ID> --format '{{.LogPath}}'
```
