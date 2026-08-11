---
title: MinIO 专用备份服务器目录规范
icon: thesvg-color:minio
sort: 3
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

## 三、docker-compose 配置

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

## 四、为什么不放 `/home/user/` 下

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

## 五、典型备份数据流

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

## 六、服务独立原则

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

## 七、总结

- **业务服务器**：只负责产生备份，不存长期数据
- **备份服务器**：MinIO 负责接收和存储，配合生命周期策略管理保留周期
- **数据盘**：单独挂载到 `/data/minio/data`，服务与数据分离
- **服务配置**：统一放在 `/opt/services/minio/`
