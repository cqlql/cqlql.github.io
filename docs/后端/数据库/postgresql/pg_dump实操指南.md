---
title: pg_dump 实操指南：脚本、定时与工程化
icon: shell
sort: 3
---

# pg_dump 实操指南：脚本、定时与工程化

本文聚焦 **单机 Docker 环境下 `pg_dump` 逻辑全量备份** 的完整落地流程，从手工命令 → 自动化脚本 → Crontab 定时 → Makefile 封装 → 项目目录位置，形成一条可复制的工程化实践链。

---

## 1. pg_dump 三种标准用法

在单机 Docker 环境下使用 `pg_dump` 非常简单。由于无需在宿主机安装任何工具，直接利用现有的 PostgreSQL 容器即可完成操作。推荐使用**方案 A（导出自定义二进制格式）**。

### 方案 A：导出为自定义二进制格式（生产首选，带压缩）

使用 `-F c` 参数导出为 Custom 二进制格式，不仅自带压缩、体积小，而且后续可以使用 `pg_restore` 开启**多线程并发恢复**。

```bash
docker exec -t <your_postgres_container_name> \
  pg_dump -U <username> -d <dbname> -F c -b -v > /path/to/backup/db_$(date +%Y%m%d_%H%M%S).dump
```

| 参数 | 含义 |
| --- | --- |
| `-t` | 分配伪终端（确保能正常输出数据流，注意**不要**带 `-i`，否则在 Cron 自动化脚本中会报错） |
| `-F c` | Format Custom（自定义二进制格式） |
| `-b` | 导出大对象数据（Blobs） |
| `-v` | 显示备份详细日志 |
| `> /path/...` | 通过重定向直接将数据保存到**宿主机**的物理磁盘上，不占用容器内部空间 |

### 方案 B：导出为标准纯文本 SQL 文件（适合小库、易查看）

如果数据量很小，或者希望用文本编辑器直接查看 SQL 脚本：

```bash
docker exec -t <your_postgres_container_name> \
  pg_dump -U <username> -d <dbname> -F p > /path/to/backup/db_$(date +%Y%m%d_%H%M%S).sql
```

> **注意**：这种方式生成的文件体积较大，恢复时无法进行多线程并行加速。

### 数据恢复

恢复命令取决于备份时的文件格式：

**`.dump` 自定义格式（方案 A）**：

```bash
# -j 4 开启 4 线程并行加速，-c 恢复前先清理/删表
docker exec -i <your_postgres_container_name> \
  pg_restore -U <username> -d <dbname> -c -j 4 < /path/to/backup/db_20260807.dump
```

**`.sql` 文本格式（方案 B）**：

```bash
docker exec -i <your_postgres_container_name> \
  psql -U <username> -d <dbname> < /path/to/backup/db_20260807.sql
```

### 常见避坑

1. **全局对象丢失**：`pg_dump` 仅备份单个数据库的表结构和数据，**不会**备份数据库用户/角色、密码及表空间。需额外运行：
   ```bash
   docker exec -t <container> pg_dumpall -U postgres --globals-only > globals.sql
   ```

2. **免密处理**：如果容器设置了 `POSTGRES_HOST_AUTH_METHOD=trust` 或使用默认 `postgres` 用户本地套接字连接，通常不会提示密码。否则可指定环境变量：
   ```bash
   docker exec -e PGPASSWORD='your_password' -t ...
   ```

---

## 2. 自动定时备份脚本

生产环境中需要无人值守的每日自动备份，编写 Shell 脚本配合宿主机 `crontab` 运行：

```bash
#!/bin/bash

# --- 配置区 ---
CONTAINER_NAME="postgres-prod"   # PG 容器名称
DB_USER="postgres"               # 数据库用户名
DB_NAME="mydb"                   # 数据库名称
BACKUP_DIR="/data/pg_backups"    # 宿主机备份存储路径
RETENTION_DAYS=7                 # 备份保留天数

# --- 执行备份 ---
DATE=$(date +%Y%m%d_%H%M%S)
FILE_NAME="${DB_NAME}_${DATE}.dump"
FILE_PATH="${BACKUP_DIR}/${FILE_NAME}"

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 执行导出
docker exec -t ${CONTAINER_NAME} pg_dump -U ${DB_USER} -d ${DB_NAME} -F c -b > ${FILE_PATH}

# 校验备份文件是否生成且非空
if [ -s "${FILE_PATH}" ]; then
    echo "[$(date)] Backup succeeded: ${FILE_PATH}"
    # 清理指定天数之前的旧备份
    find ${BACKUP_DIR} -type f -name "*.dump" -mtime +${RETENTION_DAYS} -exec rm -f {} \;
else
    echo "[$(date)] Backup failed!"
    exit 1
fi
```

---

## 3. 配置 Crontab 定时任务

赋予脚本执行权限并加入定时任务（例如每天凌晨 2:00 执行）：

```bash
chmod +x pg_backup.sh
crontab -e
```

在打开的编辑器中添加：

```cron
0 2 * * * /bin/bash /path/to/pg_backup.sh >> /var/log/pg_backup.log 2>&1
```

---

## 4. Makefile 封装 Crontab（推荐）

将 Crontab 配置封装到 `Makefile` 中，团队成员用统一指令完成部署，避免手动编辑 `crontab -e` 时出现拼写错误。核心原则是**使用幂等性逻辑（避免重复添加）**。

```makefile
# 定义变量
SCRIPT_PATH := $(shell pwd)/deploy/scripts/pg_backup.sh
LOG_PATH := /var/log/pg_backup.log
# Crontab 表达式：每天凌晨 2:00 执行
CRON_SCHEDULE := 0 2 * * *
CRON_JOB := $(CRON_SCHEDULE) /bin/bash $(SCRIPT_PATH) >> $(LOG_PATH) 2>&1

.PHONY: backup-cron-install backup-cron-status backup-cron-uninstall

## 安装或更新 Crontab 定时任务
backup-cron-install:
	@chmod +x $(SCRIPT_PATH)
	@mkdir -p /var/log
	@# 读取现有 crontab，过滤掉旧的该脚本任务，追加新任务后重新写入（实现幂等更新）
	@(crontab -l 2>/dev/null | grep -v "$(SCRIPT_PATH)"; echo "$(CRON_JOB)") | crontab -
	@echo "✅ Crontab 备份任务已成功配置/更新！"
	@echo "当前任务列表："
	@crontab -l | grep "$(SCRIPT_PATH)"

## 查看当前的备份 Crontab 状态
backup-cron-status:
	@echo "🔍 检查备份定时任务状态："
	@crontab -l 2>/dev/null | grep "$(SCRIPT_PATH)" || echo "⚠️ 未找到相关备份任务！"

## 卸载 Crontab 定时任务
backup-cron-uninstall:
	@(crontab -l 2>/dev/null | grep -v "$(SCRIPT_PATH)") | crontab -
	@echo "🗑️  Crontab 备份任务已移除！"
```

### Make 指令速查

| 命令 | 作用 |
| --- | --- |
| `make backup-cron-install` | 赋予脚本执行权限，写入 Crontab 定时任务（自动去重） |
| `make backup-cron-status` | 查看当前系统是否已挂载该备份任务 |
| `make backup-cron-uninstall` | 精准移除该备份任务，不影响其他 Cron |

### 避坑

1. **缩进必须为 Tab**：Makefile 命令行开头必须使用 Tab 键缩进，不能用空格，否则报 `missing separator` 错误。
2. **`$(shell pwd)` 解析为绝对路径**：保证 Crontab 运行时不会因相对路径找不到脚本而失败。

---

## 5. 放到项目哪个位置好？

结合 **Docker、PostgreSQL 备份脚本、Makefile** 以及 **Spring Boot 后端**，建议采用**标准 Maven 架构 + 运维部署解耦**的目录组织方式：

```text
my-springboot-project/               # 项目根目录
├── deploy/                          # 运维与部署目录（与业务代码隔离）
│   ├── docker/
│   │   ├── Dockerfile               # Spring Boot 镜像构建文件
│   │   └── docker-compose.yml       # 单机容器编排（App + PG）
│   ├── scripts/
│   │   ├── pg_backup.sh             # ← 备份脚本放这里
│   │   └── init.sql                 # 数据库初始化 SQL
│   └── env/
│       ├── .env.example             # 环境变量模板
│       └── postgres.env.example
│
├── src/                             # Spring Boot 源码（按 modules 分包）
│   └── ...
│
├── .gitignore
├── Makefile                         # ← Makefile 放根目录，作为统一入口
├── pom.xml
└── README.md
```

### 设计要点

- **运维解耦**：所有 Dockerfile、Compose 文件、备份脚本、初始化 SQL 统一放在 `deploy/` 下，不堆在项目根目录。
- **安全隔离**：`.gitignore` 中忽略 `.dump`、`.log`、`.env` 等敏感/临时文件，只提交模板（`.example`）。
- **Makefile 作为统一入口**：`make backup-cron-install` 一行命令完成 Crontab 安装，新人无需了解底层细节。

> 更多关于项目目录结构的设计原则，见：[项目目录结构规范](../架构设计/项目目录结构规范.md)。
> 关于 `pg_dump` 在整个备份体系中的定位（vs `pg_basebackup` / `pgBackRest`），见：[单机 Docker PostgreSQL 备份与恢复](./单机Docker备份与恢复.md)。
