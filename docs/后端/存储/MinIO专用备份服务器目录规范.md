---
title: MinIO 专用备份服务器目录规范
icon: simple-icons:minio
sort: 6
---

在专用备份服务器上部署 MinIO 时，推荐按照基础设施服务的标准来管理，而不是随意放在用户家目录下。本文整理推荐的目录结构、docker-compose 配置及运维规范。

## 一、核心原则

**服务定义与数据分离**：docker-compose 等服务配置放 `/opt/services/`，实际数据挂载到独立磁盘 `/data/`。两者各司其职，互不干扰。

**各服务独立**：MinIO、备份脚本、监控等各自一个 compose 项目，不要混在一起。后面维护或替换某个组件时才不会互相影响。

## 二、目录结构

```
/opt/services/minio/          ← 服务定义
├── docker-compose.yml
├── .env                       # 密钥，chmod 600
├── backup/
│   └── scripts/
│       ├── pg_backup.sh
│       └── minio_sync.sh
├── logs/
└── README.md

/data/                         ← 数据存储（建议单独挂盘）
├── minio/
│   └── data/                  # MinIO 对象存储数据
└── temp-backup/
    ├── postgres/              # pg_dump 临时存放
    └── files/
```

挂载关系：

```
/opt/services/minio
        │
        │ docker-compose.yml 挂载
        ↓
/data/minio/data
        │
        ↓
MinIO 对象存储数据
```

## 三、目录属主与权限约定

服务目录与数据目录职责不同，属主划分也各不一样，核心是：**配置/脚本归运维用户，数据归容器**。

`/opt/services/minio/` 放的是「服务定义 + 备份脚本 + 日志」，由执行 `docker compose up`、`mc cp`、`pg_backup.sh` 的运维用户持有，**不要归属 `root` 独占**。推荐新建一个无登录 shell 的专用系统用户：

```bash
useradd -r -s /usr/sbin/nologin backup
chown -R backup:backup /opt/services/minio
```

`.env` 含密钥，保持 `chmod 600`（见下文 compose 配置一节）。

数据目录的属主则各归其主：

| 目录 | 属主 | 说明 |
|------|------|------|
| `/data/minio/data/` | 容器内 MinIO 用户可读写 | 由 `minio/minio` 官方镜像内置用户读写，与 `/opt` 配置属主无关 |
| `/data/temp-backup/` | `backup:backup` | 备份脚本（`pg_dump` 等）先落地此处，再由 `mc cp` 同步进 MinIO，需对备份用户可写 |

> 容器内 MinIO 以官方镜像内置用户身份运行，其数据可写性由**目录权限**与**容器挂载**共同决定，与 `/opt/services/minio/` 的配置属主无关。配置目录只需保证运维用户能读 `.env`、跑脚本即可。

## 四、docker-compose 配置

`/opt/services/minio/docker-compose.yml`：

```yaml
services:
  minio:
    image: minio/minio:latest
    container_name: backup-minio
    restart: always

    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console

    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}

    volumes:
      - /data/minio/data:/data

    command:
      server /data --console-address ":9001"
```

`.env` 文件：

```bash
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=xxxxxx
```

权限控制：

```bash
chmod 600 .env
```

## 五、为什么不放 `/home/user/` 下

`/home/xdt/minio/docker-compose.yml` 也不是不能跑，但长期维护不推荐：

| 问题 | 说明 |
|------|------|
| `/home` 属于用户环境 | 用户删除、迁移、权限变更都可能牵连基础服务 |
| 不符合运维习惯 | 基础设施应放在系统级目录，与个人文件隔离 |

Linux 服务器目录约定：

| 目录 | 用途 |
|------|------|
| `/etc` | 系统配置 |
| `/opt` | 第三方软件 |
| `/var/lib` | 服务数据 |
| `/data` | 业务数据 |

Docker Compose 项目统一放 `/opt/services/`，数据放 `/data/`，符合运维惯例。

## 六、典型备份数据流

以 PostgreSQL → MinIO 的场景为例：

```
业务服务器
    │
    │ pg_dump / rsync
    ↓
/data/temp-backup/postgres    ← 原始备份先落地
    │
    │ mc cp（MinIO Client）
    ↓
MinIO bucket
    │
    ↓
/data/minio/data              ← MinIO 内部存储
```

## 七、服务独立原则

MinIO **不要**和备份脚本混在一个 compose 里。

❌ 错误：

```
/opt/services/backup/
├── minio/
├── postgres-backup/
├── cron/
└── scripts/
```

✅ 正确：

```
/opt/services/
├── minio/
│   └── docker-compose.yml
├── backup-agent/
│   ├── scripts/
│   └── cron/
└── monitoring/
    └── docker-compose.yml
```

每个目录是一个独立的 compose 项目，职责单一，方便启停和维护。

## 八、总结

- **业务服务器**：只负责产生备份，不存长期数据
- **备份服务器**：MinIO 负责接收和存储，配合生命周期策略管理保留周期
- **数据盘**：单独挂载到 `/data/minio/data`，服务与数据分离
- **服务配置**：统一放在 `/opt/services/minio/`
