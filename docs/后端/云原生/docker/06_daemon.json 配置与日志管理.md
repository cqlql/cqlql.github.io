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

### 为什么可以设这么小？——与 Loki 的分工

`json-file` **不负责长期日志保存**。它只是一个本地中转缓冲区：

```
应用 stdout
    │
    ↓
Docker json-file（短期缓冲，50m × 5 滚动）
    │
    ↓
Promtail 读取（tail + 推送）
    │
    ↓
Loki 存储（长期保留，可查询）
    │
    ↓
Grafana 查询
```

职责划分：

| 组件       | 角色               | 保留策略         |
| ---------- | ------------------ | ---------------- |
| `json-file` | 本地短期缓冲       | 50m × 5，用完即滚 |
| Promtail   | 日志采集转发       | 不存              |
| Loki       | 长期集中存储与查询 | 按 retention 策略  |

所以：
- `max-size` / `max-file` 的**唯一目的是防止 Docker 本地磁盘被日志撑爆**
- 日志的长期查询、聚合、告警全部交给 Loki + Grafana
- 对单机部署（如 PassUp + PostgreSQL + MinIO），这是**必须配置项**——跑几个月后最容易出的问题就是 `/var/lib/docker` 被日志撑满

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

### 用容器 ID 反查是哪个容器

`du` 输出的目录名就是**容器完整 ID**（64 位短哈希的前段），但 `docker ps` 默认只显示 12 位短 ID。两种反查方式：

**方式一：直接拿完整 ID 查**（最准，ID 前后缀一致即可匹配）

```bash
docker ps -a --no-trunc --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}' \
  | grep f9618fed10c728d42f646c6d034cdbb3892bdf71624c7256a075e90b51697f60
# 输出示例：
# CONTAINER ID                                                      NAMES        IMAGE         STATUS
# f9618fed10c728d42f646c6d034cdbb3892bdf71624c7256a075e90b51697f60  passup-app   passup:1.0    Up 3 weeks
```

`--no-trunc` 显示完整 ID，用 `grep` 匹配那段哈希即可定位容器名与镜像。

**方式二：批量列出 ID ↔ 容器名对照表**（适合一次性核对所有大日志）

```bash
docker ps -a --no-trunc --format '{{.ID}}  {{.Names}}  ({{.Image}})'
```

把 `du` 结果里的 `<容器ID>` 前缀和这份表对照，就能知道 1.4G 的日志属于哪个容器。

> 注：日志目录名 = 容器完整 ID，与 `docker ps` 的 12 位短 ID 同源（短 ID 是完整 ID 的前 12 位），所以 `docker inspect <完整ID或前12位>` 都能直接查到对应容器。

### 一键：把每个日志文件标注上容器名与占用

```bash
sudo sh -c 'du -h /var/lib/docker/containers/*/*-json.log' \
  | sort -h \
  | while read size path; do
      id=$(basename $(dirname "$path") | cut -c1-12)
      name=$(docker ps -a --filter "id=$id" --format '{{.Names}}' 2>/dev/null)
      echo "$size  $id  ${name:-<已删除容器>}"
    done
```

`cut -c1-12` 取 12 位短 ID 喂给 `docker ps --filter`，自动补出容器名；容器已删除（仅剩孤儿日志）时显示 `<已删除容器>`。

### 清理已删除容器的孤儿日志

容器被 `docker rm` / `docker compose down` 删除后，Docker **不会自动删** `/var/lib/docker/containers/<ID>/` 下的 `*-json.log`，于是留下"孤儿日志"（上面命令里标 `<已删除容器>` 的就是）。两种清理方式：

**注意：`docker system prune` 无法清理孤儿日志**

`docker system prune` 只清理已停止的容器、未使用的网络和悬空镜像，**不会删除已删除容器的残留日志目录**。孤儿日志需要手动清理。

**方式一：精确删孤儿日志（不动镜像/网络，推荐）**

自己遍历 `containers/*`，用 12 位短 ID 问 `docker ps -a` "还在不在"，不在就删：

```bash
sudo sh -c '
for d in /var/lib/docker/containers/*; do
  id=$(basename "$d" | cut -c1-12)
  if ! docker ps -a --filter "id=$id" -q | grep -q "$id"; then
    echo "孤儿: $id -> $d"
    rm -rf "$d"
  fi
done
'
```

> 想先只清日志文件、保留目录结构，把上面 `rm -rf "$d"` 改成 `rm -f "$d"/*-json.log` 即可。

> 注：你 `du` 里那些 4K / 8K 的小日志，基本都是历史容器残留，跑一遍 `docker system prune` 就干净了。长期仍靠 `log-opts` 限制单容器体积（见上文），避免个别容器爆到 1.4G。

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
