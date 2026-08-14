---
title: MinIO 专用备份服务器目录规范
icon: simple-icons:minio
sort: 6
---

在专用备份服务器上部署 MinIO 时，推荐按照基础设施服务的标准来管理，而不是随意放在用户家目录下。本文整理推荐的目录结构、docker-compose 配置及运维规范。

## 一、核心原则

**服务定义与数据分离**：docker-compose 等服务配置放 `/opt/services/`，实际数据挂载到独立磁盘 `/data/`。两者各司其职，互不干扰。

**各服务独立**：MinIO、备份脚本、监控等各自一个 compose 项目，不要混在一起。后面维护或替换某个组件时才不会互相影响。

> **目录命名约定**：`/opt/services/` 与 `/opt/deploy/` 的区别——
>
> - `/opt/services/`：**实际运行的服务**（如 MinIO 本身），放服务定义、compose、`.env` 等。
> - `/opt/deploy/`：**部署文件、脚本、配置模板**，与 Git 仓库的 `deploy/` 目录**一一对应**，方便整体迁移（`rsync -av /opt/deploy/ new-server:/opt/deploy/` 即可迁走全部部署文件）。
>
> 本项目里备份相关的东西（`pg_backup.sh`、`minio_backup.sh`、restore、巡检、logrotate）本质是**脚本/部署文件**，并非独立服务程序，统一放 `/opt/deploy/backup/`，而不是塞进 `/opt/services/`。而 MinIO 服务本身仍是真正的常驻服务，留在 `/opt/services/minio/`。

## 二、目录结构

```
/opt/services/minio/          ← MinIO 服务定义（只含 MinIO 本身）
├── docker-compose.yml
├── .env                       # 密钥，chmod 600
├── logs/
└── README.md

/opt/deploy/backup/           ← 备份脚本独立项目（与 MinIO 解耦，见第七节）
├── postgres/
│   └── pg_backup.sh
└── minio/
    ├── minio_backup.sh
    ├── minio_restore.sh
    ├── backup_status.sh
    └── minio_backup.logrotate

/data/backups/                 ← 统一备份数据根目录（建议单独挂盘）
├── postgres/                  # PostgreSQL 备份文件（pg_dump 产物）
│   ├── daily/
│   ├── weekly/
│   └── monthly/
└── minio/
    └── data/                  # MinIO 实际对象数据目录
```

挂载关系：

```
/opt/services/minio
        │
        │ docker-compose.yml 挂载
        ↓
/data/backups/minio/data
        │
        ↓
MinIO 对象存储数据
```

## 三、目录属主与权限约定

服务目录与数据目录职责不同，属主划分也各不一样，核心是：**配置/脚本归运维用户，数据归容器**。

`/opt/services/minio/` 与 `/opt/deploy/backup/` 放的是「服务定义 + 备份脚本 + 日志」，由执行 `docker compose up`、`mc cp`、`pg_backup.sh` 的运维用户持有，**不要归属 `root` 独占**。推荐新建一个无登录 shell 的专用系统用户：

```bash
useradd -r -s /usr/sbin/nologin backup
chown -R backup:backup /opt/services/minio /opt/deploy/backup
```

`.env` 含密钥，保持 `chmod 600`（见下文 compose 配置一节）。

数据目录的属主则各归其主：

| 目录 | 属主 | 说明 |
|------|------|------|
| `/data/backups/minio/data/` | 容器内 MinIO 用户可读写 | 由 `minio/minio` 官方镜像内置用户读写，与 `/opt` 配置属主无关 |
| `/data/backups/postgres/` | `backup:backup` | 备份脚本（`pg_dump` 等）按 `daily/weekly/monthly` 分级落地此处，需对备份用户可写 |

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
      - /data/backups/minio/data:/data

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

Docker Compose 服务统一放 `/opt/services/`，数据放 `/data/`，符合运维惯例。

## 六、典型备份数据流

以 PostgreSQL → MinIO 的场景为例：

```
业务服务器
    │
    │ pg_dump / rsync
    ↓
/data/backups/postgres        ← 原始备份先落地（按 daily/weekly/monthly 分级）
    │
    │ mc cp（MinIO Client）
    ↓
MinIO bucket
    │
    ↓
/data/backups/minio/data      ← MinIO 内部存储
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
└── monitoring/
    └── docker-compose.yml

/opt/deploy/
└── backup/
    ├── postgres/
    │   └── pg_backup.sh
    ├── minio/
    │   ├── minio_backup.sh
    │   ├── minio_restore.sh
    │   └── backup_status.sh
    └── cron/
```

每个目录是一个独立的 compose 项目，职责单一，方便启停和维护。

## 八、总结

- **业务服务器**：只负责产生备份，不存长期数据
- **备份服务器**：MinIO 负责接收和存储，配合生命周期策略管理保留周期
- **数据盘**：单独挂载到 `/data/backups`，服务与数据分离
- **服务配置**：MinIO 放 `/opt/services/minio/`，备份脚本放 `/opt/deploy/backup/`，二者各成独立 compose 项目

## 九、Git 仓库与服务器目录的一一对应

`/opt/deploy/` 的设计核心是**让 Git 仓库的 `deploy/` 目录直接映射到服务器目录**，迁移时几乎零成本：

```text
Git                              Server
────────────────────────────────────────────
deploy/backup/          →        /opt/deploy/backup/
deploy/backup/minio/    →        /opt/deploy/backup/minio/
deploy/backup/postgres/ →        /opt/deploy/backup/postgres/
```

迁移服务器时直接：

```bash
rsync -av /opt/deploy/ new-server:/opt/deploy/
```

甚至整个 `/opt/deploy` 都可以作为部署文件统一迁移。

最终边界非常清晰，三个维度各归其位：

```text
/opt/services/minio/    # MinIO 服务定义（实际运行的服务）
/opt/deploy/backup/     # 程序、脚本（随 Git 版本管理）
/data/backups/          # 真正的备份数据（独立挂盘）
/var/log/...            # 日志
```
