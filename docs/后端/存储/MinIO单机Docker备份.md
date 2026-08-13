---
title: MinIO 单机 Docker 备份
icon: devicon:docker
sort: 2
tags:
  - MinIO
  - 备份
  - 容灾
---

# MinIO 单机 Docker 备份

> 适用场景：单机 Docker 部署的 MinIO（个人 / 小团队项目）。大型生产集群请直接使用 MinIO Bucket Replication（服务端复制）。

## 一、为什么单机 Docker 部署必须备份？

- **单点故障（SPOF）**：单机模式没有分布式集群的纠删码（Erasure Coding）与多节点容错。宿主机磁盘损坏、Docker Volume 损坏或系统崩溃都会直接导致数据永久丢失。
- **挂载保数据，但保不了逻辑错误**：只要挂载了宿主机目录（`-v /host/data:/data`），删除容器本身不会丢数据；但无法规避误删挂载点、业务 Bug 误删对象或勒索软件加密。
- **无跨机灾备**：多节点分布式部署可抵抗部分节点故障，单机模式无法提供跨机器的灾备能力。

## 二、备份方案选型

### 方案一：`mc mirror`（对象级同步，最推荐）

`mc mirror` 是基于 S3 API 的对象级增量同步工具，通过比对大小 / ETag 实现增量传输。它把单机 MinIO 的数据同步到另一个 MinIO、AWS S3 或任意兼容 S3 的存储中，天然规避了「文件系统层复制半成品对象」的坑。

```bash
# 1. 配置源（单机）与目标（备份库）别名
mc alias set my-src http://localhost:9000 YOUR_ACCESS_KEY YOUR_SECRET_KEY
mc alias set my-backup http://remote-minio:9000 BACKUP_ACCESS_KEY BACKUP_SECRET_KEY

# 2. 增量同步（--overwrite 覆盖变更；不加 --remove 防止备份端被误删）
mc mirror --overwrite my-src/my-bucket my-backup/my-bucket-backup
```

**定位与边界：**

- `mc mirror` 是**客户端对象同步工具**，本质是 S3 到 S3 的镜像，简单、无需额外集群配置，对单机 Docker + MinIO 完全够用。
- 它不是 MinIO 官方的 **Bucket Replication（服务端复制）**——后者由 MinIO 服务端感知对象变化、不依赖常驻 `mc` 进程、失败自动恢复、支持版本复制，更适合企业跨集群灾备。

```plaintext
生产 MinIO ──(Bucket Replication, 服务端)──► 备份 MinIO   (企业生产级推荐)
生产 MinIO ──(mc mirror,        客户端)──► 备份 MinIO   (小团队/个人可用)
```

### 方案二：文件系统级备份（仅作同机兜底，有风险）

> ⚠️ **禁止把 `rsync` / `tar` 复制 `/data` 作为主备份。** MinIO 内部不是简单文件服务器，带有 `xl.meta` 元数据、multipart 分片状态、version 信息等。若在对象**写入过程中**复制，会得到不一致状态的半成品对象。主备份必须走 **API 层（对象级）**。

```plaintext
业务写入 MinIO
      │
      │ mc mirror (对象级, 一致性由 MinIO 保证)
      ▼
另一个 MinIO / S3 / OSS
```

文件系统级手段只适合**同机快速回滚**，无法替代异地灾备（宿主机盘坏了快照也一起没）：

1. **一致性快照**：宿主机底层使用 ZFS / LVM 时，定期给 `/data` 所在卷打快照（优先在写入低峰或暂停写入时）。
2. **定时冷备归档**：通过 `crontab` + `rsync` / `tar` 打包同步到远程服务器——仅作辅助兜底。

## 三、避免「备份套娃」

若 PostgreSQL 的备份产物也存进 MinIO（如把 `pg_dump` 文件上传到桶里），**不要**再让 MinIO 把这些备份文件整体镜像一遍，否则会形成 `PostgreSQL → MinIO → mc mirror → 备份 MinIO` 的套娃链路——pg_dump 的产物已经间接存在于备份 MinIO 中，这是一种无意义的冗余。

正确做法是**数据分源、各管各的**：

```plaintext
业务数据: PostgreSQL ──pg_dump + WAL 归档──► 独立备份存储 / 备份 MinIO（直接输出，不经过主机 MinIO）
文件数据: MinIO      ──mc mirror──────────► 备份 MinIO / OSS
```

各自独立备份一次即可，不要对「已含别人备份的 MinIO」再做二次整体备份。

## 四、生产环境三要素

- **必须开启版本控制（Versioning）**：防止误删或写入污染，开启后即便源端误删，异地备份或源端历史版本仍可找回（删除只生成 delete marker，对象数据保留）。

  ```bash
  mc version enable prod-minio/prod-data
  ```

  建议对用户文件桶开启 Versioning——用户误删 `resume.pdf` 后仍有旧版本可恢复。

  > **版本控制会无限膨胀吗？**
  >
  > 不会自动无限膨胀，但**旧版本不会自动删除**，每次覆盖写入或删除都会产生历史版本/delete marker，持续占用空间。
  >
  > 通过**生命周期管理（ILM）**定期清理即可控制增长：
  >
  > ```bash
  > # 非当前版本保留 30 天后自动删除，并清理无实际对象的 delete marker
  > mc ilm rule add prod-minio/prod-data \
  >   --noncurrent-expire-days "30" \
  >   --expire-delete-marker
  > ```
  >
  > | 参数 | 作用 |
  > |------|------|
  > | `--noncurrent-expire-days` | 非当前版本保留 N 天后自动删除 |
  > | `--expire-delete-marker` | 当所有旧版本都清理完后，自动清理 delete marker |
  >
  > 保留天数可根据备份频率灵活设置，比如每天备份一次、设置 `30` 天就能保留约 30 个历史版本，超出自动清理。

- **备份端应防篡改（对象锁定 / 合规模式）**：版本控制可防误删，但**挡不住勒索软件主动覆盖旧版本**。若备份端 MinIO 支持，建议为备份桶开启 **WORM（对象锁定 / 合规模式 Compliance）**，使历史版本在保留期内（如 30 天）**既不可删也不可改**，即使备份服务器被攻破、凭证泄露，勒索程序也无法抹掉历史备份。

  ```bash
  # 创建带对象锁定的备份桶（需在创建时启用，开启后不可关闭）
  mc mb --with-lock backup-minio/passup-backup-bucket
  # 为已有桶启用版本控制（锁定桶须配合版本控制）
  mc version enable backup-minio/passup-backup-bucket
  ```

  > 注意：对象锁定需在**创建桶时**用 `--with-lock` 一并开启，已存在的普通桶无法再追加锁定能力。合规模式（Compliance）比治理模式（Governance）更严格，连管理员都无法提前删除。

- **备份介质与宿主机不要在同一块硬盘**：否则硬盘损坏时备份也会一并丢失。
- **远期规划（升级为集群）**：条件允许时迁移到 **MinIO 分布式集群模式（Erasure Code 纠删码）**，提供节点级高可用。

## 五、生产级自动化增量备份脚本

### 5.1 设计原则：代码入库、凭证脱敏、部署留痕

把备份脚本放进项目仓库（如 `scripts/backup/`）是**推荐做法**——备份逻辑随代码统一 Git 版本控制，重新部署时 `git pull` 即同步最新逻辑（Infrastructure as Code）。但必须区分**代码版本管理**与**运行时部署**：

- **严禁把密钥硬编码进仓库**：`SRC_SECRET`、`DEST_SECRET`、生产 IP 等一律通过**环境变量文件**注入，仓库只保留 `.example` 模板。
- **脚本自带路径自适应**：通过 `BASH_SOURCE` 定位自身目录，避免 Crontab 绝对路径硬编码。
- **Cron 用 Makefile 封装**：一键 `cron-install / uninstall / status`，自动注入绝对路径并带幂等标记，杜绝重复任务。

### 5.2 项目目录结构

MinIO 备份是**基础设施层**的操作，与业务代码无关。建议将备份相关文件放在独立目录中，纳入 Git 版本控制，与业务仓库解耦：

```text
project/
├── docker/
│   ├── docker-compose.yml         # 单机容器编排（含 MinIO + App 等）
│   └── .env.example               # 容器环境变量模板
│
├── backup/                        # 备份相关（独立于业务代码）
│   ├── minio_backup.sh            # ← 备份脚本：mc mirror 增量同步到远端
│   ├── minio_restore.sh           # ← 恢复脚本：从远端拉回指定备份（含二次确认）
│   ├── backup.env.example         # 凭证模板（可提交 Git，含 SRC/DEST 两套密钥）
│   └── README.md                  # 操作手册：定时任务安装、手动触发、恢复流程
│
├── src/                           # 业务源码
│   └── ...
│
├── .gitignore                     # 忽略 *.log、backup.env、.env 等敏感文件
├── Makefile                       # 统一入口：make backup-cron-install / backup-now / restore
└── README.md
```

> 真实凭证 `backup.env` 由运维根据 `.example` 创建，**不提交 Git**。建议放在 `/etc/project/backup.env` 或 `backup/` 目录下并加入 `.gitignore`。

### 5.3 `backup.env.example`（提交到 Git 的模板）

```bash
# MinIO 备份环境变量配置模板（复制为 backup.env 后填入真实值，勿提交 backup.env）
SRC_URL="http://127.0.0.1:9000"
SRC_KEY="YOUR_PROD_ACCESS_KEY"
SRC_SECRET="YOUR_PROD_SECRET_KEY"

# 需备份的源端桶名（空格分隔，支持多个）
SRC_BUCKETS="passup-prod-bucket app-uploads user-avatars"

# 备份端地址（仅此一处配置协议+主机+端口，连通性预检自动解析）
DEST_URL="http://192.168.1.200:9000"
DEST_KEY="YOUR_BACKUP_ACCESS_KEY"
DEST_SECRET="YOUR_BACKUP_SECRET_KEY"

# 备份端桶名前缀（源端桶名自动拼接此前缀，避免与生产端同名冲突）
DEST_BUCKET_PREFIX="backup-"

# 公网备份限速（可选，如 "50M"；局域网可留空不限制）
UPLOAD_LIMIT=""
```

### 5.4 `minio_backup.sh`（提交到 Git，从外部 env 读取凭证）

包含**网络连通性预检**、**日志记录**与**错误防护**，凭证全部来自同目录 / 指定的 `backup.env`，无任何硬编码密钥：

```bash
#!/bin/bash

# ==========================================
# MinIO 生产环境自动化增量备份脚本（凭证外置）
# 适用: 单机 Docker 部署的 MinIO
# 功能: 将生产端多个桶增量同步到远程备份 MinIO
# ==========================================

set -euo pipefail

# 获取当前脚本所在目录（Crontab 执行时不依赖 cwd）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载环境变量文件（生产环境建议放在 /etc/project/backup.env）
ENV_FILE="${SCRIPT_DIR}/backup.env"
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
else
    echo "错误: 未找到配置文件 $ENV_FILE"
    echo "请先根据 backup.env.example 创建 backup.env 并填入真实凭证"
    exit 1
fi

# ---------- 别名与日志 ----------
SRC_ALIAS="prod-minio"
DEST_ALIAS="backup-minio"
LOG_DIR="/var/log/minio-backup"
LOG_FILE="${LOG_DIR}/minio_backup.log"
mkdir -p "$LOG_DIR"

# ---------- 日志函数 ----------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=========================================="
log "开始执行 MinIO 异地备份..."

# ---------- Step 1: 检查远程服务器网络连通性 ----------
# 从 DEST_URL 中自动解析出主机（IP/域名）与端口
DEST_HOST="${DEST_URL#*://}"
DEST_HOST="${DEST_HOST%%:*}"
DEST_PORT="${DEST_URL##*:}"
DEST_PORT="${DEST_PORT%%/*}"
DEST_PORT="${DEST_PORT:-9000}"

if [ -n "${DEST_HOST:-}" ]; then
    if command -v nc &> /dev/null; then
        if ! nc -z -w 3 "$DEST_HOST" "$DEST_PORT" > /dev/null 2>&1; then
            log "错误: 无法连接到备份服务器 (${DEST_HOST}:${DEST_PORT})，备份中断！"
            exit 1
        fi
    else
        log "警告: nc 命令不可用，跳过网络连通性检查"
    fi
fi

# ---------- Step 2: 初始化 mc 别名配置 ----------
log "初始化 mc 别名配置..."
if ! mc alias set $SRC_ALIAS  $SRC_URL  $SRC_KEY  $SRC_SECRET; then
    log "错误: 无法连接源端 MinIO (${SRC_URL})，请检查 SRC_URL/SRC_KEY/SRC_SECRET"
    exit 1
fi
if ! mc alias set $DEST_ALIAS $DEST_URL $DEST_KEY $DEST_SECRET; then
    log "错误: 无法连接备份端 MinIO (${DEST_URL})，请检查 DEST_URL/DEST_KEY/DEST_SECRET"
    exit 1
fi

# ---------- Step 3: 对每个桶执行增量同步 ----------
# 用于捕获 mc 真实错误输出的临时文件
MC_ERR_FILE="$(mktemp)"
trap 'rm -f "$MC_ERR_FILE"' EXIT

FAILED_BUCKETS=""
for BUCKET in $SRC_BUCKETS; do
    DEST_BUCKET="${DEST_BUCKET_PREFIX}${BUCKET}"
    log "正在同步桶: ${SRC_ALIAS}/${BUCKET} -> ${DEST_ALIAS}/${DEST_BUCKET}"

    # 校验源端桶是否存在（不存在则跳过并给出明确原因）
    if ! mc ls "${SRC_ALIAS}/${BUCKET}" > /dev/null 2>&1; then
        log "错误: 源端桶 ${SRC_ALIAS}/${BUCKET} 不存在，跳过！请检查 SRC_BUCKETS 配置或源端桶名。"
        FAILED_BUCKETS="${FAILED_BUCKETS} ${BUCKET}"
        continue
    fi

    # 确保备份端桶存在（不存在则创建）
    if ! mc ls "${DEST_ALIAS}/${DEST_BUCKET}" &> /dev/null; then
        log "备份端桶 ${DEST_BUCKET} 不存在，正在创建..."
        if ! mc mb "${DEST_ALIAS}/${DEST_BUCKET}" > /dev/null 2>"$MC_ERR_FILE"; then
            log "错误: 创建备份端桶 ${DEST_BUCKET} 失败：$(cat "$MC_ERR_FILE")"
            FAILED_BUCKETS="${FAILED_BUCKETS} ${BUCKET}"
            continue
        fi
    fi

    # 构建 mc mirror 参数
    MIRROR_ARGS=(mirror --overwrite)
    if [ -n "${UPLOAD_LIMIT:-}" ]; then
        MIRROR_ARGS+=(--limit-upload "$UPLOAD_LIMIT")
    fi
    MIRROR_ARGS+=("${SRC_ALIAS}/${BUCKET}" "${DEST_ALIAS}/${DEST_BUCKET}")

    # 同步时：stdout 进日志，stderr 单独捕获，失败时打印真实错误
    if mc "${MIRROR_ARGS[@]}" >> "$LOG_FILE" 2>"$MC_ERR_FILE"; then
        log "桶 ${BUCKET} 同步成功"
    else
        log "桶 ${BUCKET} 同步失败！原因：$(cat "$MC_ERR_FILE")"
        FAILED_BUCKETS="${FAILED_BUCKETS} ${BUCKET}"
    fi
done

# ---------- Step 4: 汇总结果 & 写心跳 ----------
if [ -z "$FAILED_BUCKETS" ]; then
    log "所有桶备份成功完成！"
    # 成功时写心跳文件（供 5.8 巡检脚本读取健康度）
    echo "$(date '+%Y-%m-%d %H:%M:%S')" > "${LOG_DIR}/last_success.txt"
    exit 0
else
    log "以下桶备份失败:${FAILED_BUCKETS}"
    exit 1
fi
```

### 5.5 用 Makefile 封装 Crontab（推荐）

Makefile 自动通过 `$(shell pwd)` 获取项目绝对路径并注入 Crontab，避免路径硬编码；任务结尾打 `#MINIO_BACKUP` 标记，多次 `cron-install` 先清洗旧任务再写入，**幂等不会重复添加**。

```makefile
# ==========================================
# 自动化运维 Makefile
# ==========================================

PROJECT_DIR := $(shell pwd)
BACKUP_SCRIPT := $(PROJECT_DIR)/deploy/scripts/minio_backup.sh
ENV_FILE := $(PROJECT_DIR)/deploy/scripts/backup.env

# 每天凌晨 2:00 执行；#MINIO_BACKUP 用于精准识别/删除
CRON_SCHEDULE := 0 2 * * *
CRON_TAG := \#MINIO_BACKUP
CRON_JOB := $(CRON_SCHEDULE) $(BACKUP_SCRIPT) > /dev/null 2>&1 $(CRON_TAG)

.PHONY: help backup cron-install cron-uninstall cron-status

help:
	@echo "MinIO 备份管理命令:"
	@echo "  make backup          - 立即手动执行一次 MinIO 备份"
	@echo "  make cron-install    - 写入 Crontab 定时任务（幂等）"
	@echo "  make cron-uninstall  - 从 Crontab 移除该任务"
	@echo "  make cron-status     - 查看当前 Crontab 中的备份任务"

backup:
	@chmod +x $(BACKUP_SCRIPT)
	@echo "开始手动执行 MinIO 备份..."
	@$(BACKUP_SCRIPT)

cron-install:
	@chmod +x $(BACKUP_SCRIPT)
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "错误: 未找到配置文件 $(ENV_FILE)，请先根据 backup.env.example 创建！"; \
		exit 1; \
	fi
	@(crontab -l 2>/dev/null | grep -v "$(CRON_TAG)" ; echo "$(CRON_JOB)") | crontab -
	@echo "MinIO 备份定时任务安装成功！规则: $(CRON_SCHEDULE)"

cron-uninstall:
	@(crontab -l 2>/dev/null | grep -v "$(CRON_TAG)") | crontab -
	@echo "MinIO 备份定时任务已移除！"

cron-status:
	@echo "=== 当前系统的备份 Crontab 状态 ==="
	@crontab -l 2>/dev/null | grep "$(CRON_TAG)" || echo "未找到已安装的备份定时任务"
```

**新服务器部署三步：**

```bash
cp deploy/scripts/backup.env.example deploy/scripts/backup.env  # 1. 填入真实凭证
vim deploy/scripts/backup.env
make cron-install                                                # 2. 一键安装定时备份
make cron-status                                                 # 3. 确认状态
```

**这样设计的 3 个核心优势：**

1. **路径自适应**：`$(shell pwd)` 获取项目绝对路径并注入 Crontab，在任何目录部署执行 `make cron-install` 都能自动适配。
2. **安全与幂等**：`#MINIO_BACKUP` 标记使 `cron-install` 先清洗旧任务再写入，绝不产生重复行。
3. **运维极简**：手动测试 `make backup`、安装 `make cron-install`、查看 `make cron-status`、卸载 `make cron-uninstall` 一句话搞定。

### 5.6 服务器侧权限与日志目录

克隆项目后，确保脚本可执行且日志目录可写：

```bash
chmod +x /data/www/project/deploy/scripts/minio_backup.sh
sudo mkdir -p /var/log/minio-backup
sudo chown -R "$USER:$USER" /var/log/minio-backup
```

### 5.7 备份日志轮转（logrotate，防止日志无限膨胀）

脚本使用 `>> "$LOG_FILE"` 持续追加日志，在每日 Cron 高频运行（如每 15 分钟 / 每小时）数月后，单文件会无限膨胀、占满磁盘并拖慢排查效率。用 **`logrotate`**（主流 Linux 发行版自带）按天 / 按大小自动切割、压缩并清理旧日志，无需改动备份脚本本身。

**1. 编写 logrotate 配置文件**（`/etc/logrotate.d/minio-backup`，root 权限）

```bash
# /etc/logrotate.d/minio-backup
/var/log/minio-backup/*.log {
    # 每天轮转一次
    daily
    # 日志缺失不报错
    missingok
    # 空文件不轮转
    notifempty
    # 最多保留 14 个历史文件
    rotate 14
    # 压缩历史日志（默认 gzip）
    compress
    # 延迟一轮再压缩，方便排查最近一次
    delaycompress
    # 拷贝后清空原文件，脚本持续 >> 追加不中断
    copytruncate
    # 历史文件加日期后缀，如 minio_backup.log-20260813.gz
    dateext
}
```

**关键参数说明：**

| 参数 | 作用 |
| --- | --- |
| `daily` / `size 50M` | 触发条件：按天，或单文件超 50M（二选一，也可 `daily` + `size` 组合） |
| `rotate 14` | 保留 14 个历史切片后自动删除最旧的，控制总占用 |
| `compress` / `delaycompress` | gzip 压缩历史日志，`delaycompress` 让「最近一次」先留一天明文便于排查 |
| `copytruncate` | **必须**：复制日志内容到新文件后立即截断原文件，备份脚本用 `>>` 追加、无信号感知，只有 `copytruncate` 能不重启脚本即生效（`create` 与之互斥语义，二者选其一，这里用 `copytruncate`） |

> ⚠️ 为什么不用 `create` 或 `postrotate` 发信号？脚本是简单 `>>` 追加、没有监听 HUP 信号重新打开文件描述符的能力。`create` 模式会让脚本仍持有被 rename 后的旧 fd，日志继续写到已移走的旧文件。`copytruncate` 直接原地截断原文件，对脚本完全透明，是最省心的方案。

**2. 验证与手动触发**

```bash
# 检查配置语法是否正确（dry-run，不实际切割）
sudo logrotate -d /etc/logrotate.d/minio-backup

# 强制立即轮转一次（验证效果，生产慎用 -f）
sudo logrotate -f /etc/logrotate.d/minio-backup
```

> logrotate 默认由系统的 `cron.daily` / Systemd Timer（`logrotate.timer`）每天自动执行，无需额外配置。确认服务在跑：`systemctl status logrotate.timer`。

**可选：按大小而非按天轮转**——若备份频率极高、单日日志就可能很大，改用 `size` 触发（注意 `size` 与 `daily` 同时存在时，满足任一即轮转）：

```bash
/var/log/minio-backup/*.log {
    size 50M
    rotate 20
    compress
    delaycompress
    copytruncate
    notifempty
    missingok
    dateext
}
```

这样日志总量被严格约束（约 `50M × (20+1)` 上限），彻底杜绝无限膨胀。

### 5.8 备份健康度统一巡检（一眼看健康 + 占用）

备份脚本只"写日志"，本身不证明自己在跑、不汇报磁盘占用。日常运维最痛的点是：**出事了才发现上次成功是两周前**，或**磁盘悄悄写满**。建议加一层轻量、零依赖的「自检」机制，把"是否健康、占多大"统一到一个命令里看出来。

**1. 让脚本自带"心跳"——成功时打 last-success 标记**

在 `minio_backup.sh` 末尾（成功分支）追加一行，记录最近成功时间戳：

```bash
# 成功完成后写心跳文件（供巡检脚本读取）
echo "$(date '+%Y-%m-%d %H:%M:%S')" > /var/log/minio-backup/last_success.txt
```

失败时**不更新**该文件，于是 `last_success.txt` 永远只代表"最后一次成功"，天然成为健康度基准。

**2. 统一巡检脚本 `backup_status.sh`**

把"是否健康、日志占多少、磁盘剩多少"收敛到一个脚本，一条命令全看清：

```bash
#!/bin/bash
# 备份健康度巡检：是否在跑、上次成功、日志/磁盘占用
LOG_DIR="/var/log/minio-backup"
THRESHOLD_HOURS=26   # 超过该小时数未成功即告警（Cron 每天跑则设 ~26）

echo "====== MinIO 备份健康巡检 $(date '+%Y-%m-%d %H:%M:%S') ======"

# 1) 上次成功时间 & 是否超时
if [ -f "$LOG_DIR/last_success.txt" ]; then
    LAST=$(cat "$LOG_DIR/last_success.txt")
    LAST_TS=$(date -d "$LAST" +%s 2>/dev/null)
    NOW_TS=$(date +%s)
    DELTA=$(( (NOW_TS - LAST_TS) / 3600 ))
    if [ "$DELTA" -gt "$THRESHOLD_HOURS" ]; then
        echo "❌ 异常：距上次成功已 ${DELTA} 小时（阈值 ${THRESHOLD_HOURS}h）"
    else
        echo "✅ 健康：上次成功 $LAST（${DELTA}h 前）"
    fi
else
    echo "❌ 异常：从未成功过（无 last_success.txt）"
fi

# 2) 日志目录总占用（含轮转历史）
echo "📄 日志占用: $(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)"

# 3) 当前日志文件大小（最新一份）
CUR=$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -1)
[ -n "$CUR" ] && echo "   当前日志: $CUR -> $(du -h "$CUR" | cut -f1)"

# 4) 备份端磁盘剩余（按挂载点，示例 /data）
echo "💽 磁盘剩余: $(df -h /data | awk 'NR==2{print $4" / "$2" (已用 "$5")"}')"
```

输出示例：

```text
====== MinIO 备份健康巡检 2026-08-13 09:00:00 ======
✅ 健康：上次成功 2026-08-13 02:00:03（7h 前）
📄 日志占用: 12M
   当前日志: /var/log/minio-backup/minio_backup.log -> 1.1M
💽 磁盘剩余: 1.4T / 2.0T (已用 28%)
```

**3. 主动告警（可选但推荐）**

把巡检接入 Cron，异常时才发通知（飞书 / 钉钉 / 邮件），平时不打扰：

```bash
# 每天 9:00 巡检，仅当含 ❌ 时推送
0 9 * * * /path/backup_status.sh | grep -q '❌' && curl -s -X POST $DINGTALK_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{
    "msgtype": "text",
    "text": {
      "content": "MinIO 备份异常，请检查"
    }
  }'
```

也可直接在巡检脚本内判断 `DELTA` 超限就 `curl` 告警，逻辑更集中。

**4. 立刻人工查看**

运维时一条命令即可掌握全貌，无需翻日志：

```bash
bash /path/backup_status.sh
```

| 维度 | 看哪里 | 健康标准 |
| --- | --- | --- |
| 是否还在跑 | `last_success.txt` 距现在小时数 | < 阈值（如 26h） |
| 日志是否膨胀 | `du -sh` 日志目录 + 当前日志大小 | 受 logrotate `rotate N` 约束 |
| 磁盘是否将满 | `df -h /data` 已用% | 留足余量（如 < 80%） |

> 这一层与 logrotate（5.7）互补：logrotate 防"日志膨胀"，巡检防"静默失效 + 磁盘写满"。二者都不需要改 `mc mirror` 主逻辑，纯外围增强。

### 5.9 针对单机 Docker 的取舍

对单机 Ubuntu + Docker 的个人 / 小团队项目，不必上 Bucket Replication，用 `mc mirror` 定时同步即可：

```plaintext
            主服务器(业务)
              MinIO (/data/minio)
                │
                │ mc mirror (每小时/每天)
                ▼
            备份服务器(只跑 MinIO)
              MinIO (/data/backup)
```

备份服务器不跑业务，只存 MinIO，配一块大容量硬盘（如 2TB）即可达到小型 SaaS 不错的容灾水平。

## 六、公网跨机房备份

生产端与备份端跨公网时，安全性与链路稳定性是核心。

### 加密传输（二选一）

**方案一：HTTPS / TLS（推荐）**

- **反向代理（最便捷）**：在备份服务器用 Nginx / Caddy 为 MinIO 提供 HTTPS。以 Caddy 为例（自带 Let's Encrypt 自动申请与续期）：

  ```
  backup-minio.yourdomain.com {
      reverse_proxy localhost:9000
  }
  ```

- **MinIO 原生 TLS**：将证书放入容器内凭证目录（Docker 部署通常挂载为 `/root/.minio/certs/`，即容器内的 `~/.minio/certs/`，具体路径以容器实际挂载为准），包含：

  ```plaintext
  certs/
  ├── public.crt
  └── private.key
  ```

  端口映射保持 `9000`，即可通过 `https://backup-minio.yourdomain.com:9000` 访问。

无论哪种方式，备份脚本里把远程地址改为 HTTPS 即可：

```bash
DEST_URL="https://backup-minio.yourdomain.com:9000"
```

**方案二：SSH 隧道（无需域名 / SSL 证书）**

在生产服务器上建立 SSH 本地端口转发，将本地 `19000` 映射到备份服务器的 `9000`，所有流量经 SSH 加密：

```bash
# 在生产服务器上执行，-f 后台运行，-N 仅做端口转发
ssh -f -N -L 19000:localhost:9000 user@<备份服务器公网IP> -p <SSH端口>
```

> 隧道进程挂掉会导致备份静默失败，建议用 **`autossh`** 或 **Systemd 服务**守护该转发，并加 `-o ServerAliveInterval=30 -o ServerAliveCountMax=3` 自动检测断连重连。

脚本中把目标指向本地映射端口：

```bash
DEST_URL="http://127.0.0.1:19000"
# mc 以为在写本地，实际流量由 SSH 加密传往公网远程服务器
```

### 公网传输的关键策略

1. **限速（非常重要）**：公网带宽昂贵或受限，加 `--limit-upload` 避免备份跑满生产出口：

   ```bash
   # 限制最大上传速度为 50 MB/s（mc 中 M=MB/s，也可写 MiB；支持 K/M/G 后缀）
   mc mirror --overwrite --limit-upload 50M src-minio/my-bucket dest-minio/my-bucket
   ```

   > 若需同时限制下载（从备份端拉取恢复时的下行），可加 `--limit-download`，用法与 `--limit-upload` 相同。

2. **断点续传与重试**：公网波动时保持定时 Cron 增量同步（如每小时）。`mc mirror` 会自动跳过已同步且大小 / ETag 未变动的文件，仅重传遗漏部分。
3. **防误删**：脚本**不加 `--remove`**，即便生产端遭勒索或误删，备份端数据依然留存。

## 七、同步策略选型：`--watch` 实时 vs 定时增量

`mc mirror` 的**定时增量**（Cron 调度）与**实时同步**（`--watch`）没有绝对好坏，关键是 **RPO（恢复点目标）** 与**资源开销**的平衡。

| 对比维度 | 定时增量（Crontab） | 实时监听（`--watch`） |
| --- | --- | --- |
| 数据丢失风险（RPO） | 较高（最多丢失上一次到现在） | 极低（秒级 / 毫秒级） |
| 系统资源开销 | 低（仅触发时占用） | 持续占用（常驻后台进程监听事件） |
| 网络带宽 | 脉冲式（触发时可能占满带宽） | 平滑式（有写入才传输） |
| 运维成本 | 极低（脚本 + Cron，断网可自动恢复） | 中等（需 Systemd 守护防挂） |
| 适用网络 | 局域网 / 专线 / 公网（可限速） | 局域网 / 高质量专线（公网易打断） |

**选型建议：**

- **优先定时增量（Cron）**：数据不频繁变动、允许丢失数小时，或跨公网易抖动的场景。脚本每次独立运行、执行完即退出，断连后下次自动断点续传。对单机 Docker + MinIO 的个人 / 小团队项目，这通常是**首选**。
- **`--watch` 定位**：适合小规模、自建备份、临时同步、非关键数据。它依赖**常驻客户端进程**，生产关键数据若采用 `--watch` 必须配合 Systemd 守护 + Cron 兜底，否则进程挂掉会漏同步。

**可选双保险（仅当需要秒级 RPO 时采用）**：两种方式基于文件状态比对，具有**幂等性**，并行不会冲突——`--watch` 解决 RPO 实现秒级热备，Cron 解决自愈、补全遗漏事件。

```plaintext
          生产端 MinIO
               │
   ┌───────────┴────────────┐
[可选] 实时推送            [主力] 离峰校准
mc mirror --watch          Cron 增量 (每小时/每天 2:00)
   │                           │
   └───────────┬───────────────┘
               ▼
          备份端 MinIO
```

> ⚠️ 若启用删除同步（`--remove`），务必提前在存储桶开启 **Versioning**，否则生产端误删时实时与定时都会把备份端一并抹去。默认不加 `--remove` 即天然防误删，无需此顾虑。

## 八、局域网（LAN）环境优化

局域网速度与安全性大幅提升，无需考虑公网费用与 TLS 部署：

1. **协议**：直接走 `http://192.168.x.x:9000`，开销更低、速度更快。
2. **取消限速**：千兆 / 万兆网下无需 `--limit-upload`，可满速传输。
3. **频率可调高**：除每日定时外，如需更短 RPO 可提到每 **15 分钟 / 1 小时**；是否启用 `--watch` 取决于能否接受常驻进程运维成本。

局域网 `--watch` 示例（带 `--overwrite`，不带 `--remove` 防误删）：

```bash
mc mirror --watch --overwrite src-minio/your-bucket dest-minio/your-bucket
```

Cron 频率建议：核心业务数据每 **15 分钟 / 1 小时**；普通文件每天凌晨（如 `0 2 * * *`）。

## 九、数据增长：首次全量、后续增量

不必担心「文件越来越多备份越慢」。`mc mirror` 是增量同步：

- 首次全量（如 1TB）：千兆网实际约 80MB/s，≈ 3.5 小时属正常，仅第一次慢。
- 之后每天只同步**新增 / 变化**的对象（如 100MB），不会每天重传全量。

**大文件避坑**：若用户会上传大文件（如 5GB 视频，上传耗时长），**不要**实时同步，否则可能复制「上传中」的半成品。常见做法是在业务表记录对象状态，只备份 `COMPLETED` 的对象，或结合离峰 Cron 而非 `--watch` 实时，天然避开上传中途的不一致窗口：

```plaintext
file_object 表: id | bucket | object_key | status(UPLOADING/COMPLETED) | size | created_time
备份只同步 status = COMPLETED 的对象
```

## 十、备份策略总览与检查清单

### 10.1 最终检查清单（Checklist）

- [ ] 备份服务器的 `9000` / `9001` 端口已在防火墙中对生产服务器放行。
- [ ] 生产端与备份端的存储桶均已开启 **版本控制（Versioning）**，防止误删或勒索破坏。
- [ ] （可选但推荐）备份端桶已开启 **对象锁定（WORM / 合规模式）**，保留期内历史版本防篡改、防勒索覆盖。
- [ ] 备份服务器挂载了**独立**的大容量磁盘 / NAS，确保与宿主机不同盘、存储空间充足。
- [ ] 公网传输已加密（HTTPS / SSH 隧道）并限速，避免挤占生产出口。
- [ ] 脚本未加 `--remove`，防范生产端误删 / 勒索同步到备份端。

### 10.2 项目最终备份建议表

| 数据 | 方案 | 频率 |
| --- | --- | --- |
| PostgreSQL | `pg_dump` 全量 + WAL 归档 | 每天全量 + 每 5 分钟 WAL（可恢复到任意时间点） |
| MinIO | `mc mirror` | 每小时（或每天一次，视文件变化频率） |
| Redis | 不备份 | 缓存可重建 |
| Docker 配置 / Compose | Git 保存 | 每次发布 |
| 上传文件 | MinIO Versioning | 开启 |

## 十一、灾难恢复（从备份还原）

基于 `mc mirror` 的**对象级备份**，恢复的过程本质上就是把备份镜像「反向同步」回生产环境。根据故障程度的不同，提供 3 种常见场景的恢复指引。

### 11.1 场景一：生产环境完全崩溃（全新节点 / 硬盘替换）

生产服务器硬盘损坏或容器毁弃，需在**新部署的 MinIO** 上做全量数据恢复。

**1. 部署新的 MinIO Docker 容器**

```bash
docker run -d \
  --name minio-prod \
  -p 9000:9000 -p 9001:9001 \
  -v /data/minio/data:/data \
  minio/minio server /data --console-address ":9001"
```

**2. 执行反向同步恢复（把备份拉回生产环境）**

在能访问两台机器的节点上执行（或直接在新的生产服务器上操作）。别名体系与第 11.6 节的恢复脚本保持一致（`backup-minio`=备份端、`prod-minio`=生产端）：

```bash
# 1. 配置源（备份节点）与目标（新生产节点）
mc alias set backup-minio http://192.168.1.200:9000 BACKUP_KEY BACKUP_SECRET
mc alias set prod-minio   http://127.0.0.1:9000  NEW_PROD_KEY NEW_PROD_SECRET

# 2. 若新生产端没有桶，先创建
mc mb prod-minio/your-bucket

# 3. 反向镜像同步：将备份端数据推回新生产端
mc mirror --overwrite backup-minio/your-bucket-backup prod-minio/your-bucket
```

> ⚠️ 方向务必核对：源是 **备份端**（`backup-minio`），目标是 **新生产端**（`prod-minio`）。`mc mirror` 会把「源」覆盖写到「目标」，方向写反会把空的生产端反向抹掉备份端。

### 11.2 场景二：业务误删或损坏了单个 / 部分文件

业务 Bug 误删某些文件，或某个文件被损坏，可进行精准恢复。

**方案 A：按路径 / 文件恢复单个对象**

```bash
# 将备份端指定文件单独拷回生产端（别名与场景一、恢复脚本保持一致）
mc cp backup-minio/your-bucket-backup/path/to/lost-file.pdf \
      prod-minio/your-bucket/path/to/lost-file.pdf
```

**方案 B：利用版本控制（Versioning）一键回滚**

若生产端开启了 **Versioning**，误删操作只是打上了一个「删除标记（Delete Marker）」，无需从备份端拉取，可直接恢复：

```bash
# 1. 查看文件历史版本（找到带 Delete Marker 的版本）
mc ls --versions prod-minio/your-bucket/path/to/lost-file.pdf

# 2. 删除该「删除标记」，最新版本自动变回被删前的文件
mc rm --version-id "YOUR_DELETE_MARKER_ID" \
      prod-minio/your-bucket/path/to/lost-file.pdf
```

### 11.3 场景三：灾难应急响应（直接接管生产流量）

生产硬件损坏且**短时间内无法修复或买不到新服务器**时，可直接让备份服务器接管读写：

1. **临时将业务切到备份服务器**：修改后端 `application.yml`（或微服务 Nacos / 环境变量中的 MinIO Endpoint），把连接地址从生产 IP（`192.168.1.100`）改为备份服务器 IP（`192.168.1.200`）。
2. **继续提供服务**：备份服务器上的 MinIO 本身是全量最新的对象存储，业务可直接读写。
3. **后续修复**：主服务器硬件修复后，将备份服务器新产生的数据同步回主服务器，最后把 Endpoint 切回主服务器。

### 11.4 恢复场景与策略速查

| 故障场景 | 恢复策略 | 是否需运行恢复脚本 |
| --- | --- | --- |
| 场景 A：整机 / 硬盘崩溃（重建 MinIO） | 重新启动生产端 MinIO 容器后，运行 `make restore` 全量拉回数据 | 需要 |
| 场景 B：业务 Bug 误删单个文件 | 无需脚本。开启 Bucket Versioning 后，在 Console 或 `mc rm --version-id` 移除 Delete Marker 即可秒级回滚 | 不需要（用控制台 / 版本控制） |
| 场景 C：生产机硬件故障短期无法修复 | 应急接管：修改后端 `application.yml` 中的 MinIO 地址，直接切到备份服务器 Endpoint 提供读写 | 不需要（切应用配置） |

### 11.5 为什么恢复操作也建议「脚本化 / Makefile 化」？

恢复不依赖 Cron 定时（它是**人工触发的应急响应**），但把恢复逻辑写成脚本或集成进 `Makefile` 仍很有价值：

1. **高压场景防误操作（降低 MTTR）**：生产灾难时运维高度紧张，预写脚本可避免临时敲错 `mc` 参数（如误把空的生产端反向覆盖备份端）。
2. **自动化安全防护**：恢复前必须**先停止定时备份 Cron 和 `--watch` 监听**，并在执行前做**二次确认（Are you sure?）**，这些逻辑写在脚本里最安全。
3. **反向同步逻辑固定**：基于 `mc mirror` 的恢复本质就是把备份镜像「反向传输」回生产环境，流程可固化。

### 11.6 在 Makefile 中集成恢复命令

在现有 `Makefile` 尾部追加恢复 target，配合恢复脚本，简化灾难恢复流程。

**1. 编写恢复脚本 `deploy/scripts/minio_restore.sh`**

```bash
#!/bin/bash

# 获取当前脚本所在目录（Crontab 执行时不依赖 cwd）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/backup.env"

if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
else
    echo "错误: 未找到配置文件 $ENV_FILE"
    echo "请先根据 backup.env.example 创建 backup.env 并填入真实凭证"
    exit 1
fi

SRC_ALIAS="prod-minio"    # 目标：生产端
DEST_ALIAS="backup-minio" # 源：备份端

echo "=========================================="
echo "警告：您正在执行 MinIO 灾难恢复操作！"
echo "数据方向: 备份端 [${DEST_URL}] -> 生产端 [${SRC_URL}]"
echo "待恢复桶(备份端前缀 ${DEST_BUCKET_PREFIX}): ${SRC_BUCKETS}"
echo "=========================================="

# 1. 交互式二次确认，防止误操作
read -p "确认要将备份数据覆盖/还原回生产环境吗？(输入 'YES' 继续): " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
    echo "操作已取消。"
    exit 0
fi

# 2. 预先初始化 mc 别名配置（失败即中断，避免写到空别名）
mc alias set $SRC_ALIAS  $SRC_URL  $SRC_KEY  $SRC_SECRET  > /dev/null 2>&1 || {
    echo "错误: 无法连接生产端 MinIO (${SRC_URL})，请检查 SRC_URL/SRC_KEY/SRC_SECRET"
    exit 1
}
mc alias set $DEST_ALIAS $DEST_URL $DEST_KEY $DEST_SECRET > /dev/null 2>&1 || {
    echo "错误: 无法连接备份端 MinIO (${DEST_URL})，请检查 DEST_URL/DEST_KEY/DEST_SECRET"
    exit 1
}

# 3. 提示检查 Cron 是否已停止
echo "[提示] 请确保已暂停定时备份任务 (执行 make cron-uninstall)，避免恢复过程中产生写冲突。"

# 4. 对每个桶执行反向同步恢复（把备份端数据推回生产端）
FAILED_BUCKETS=""
for BUCKET in $SRC_BUCKETS; do
    DEST_BUCKET="${DEST_BUCKET_PREFIX}${BUCKET}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始拉取桶 ${DEST_BUCKET} -> ${BUCKET} ..."
    mc mirror --overwrite "${DEST_ALIAS}/${DEST_BUCKET}" "${SRC_ALIAS}/${BUCKET}" && \
        echo "桶 ${BUCKET} 恢复完成！" || {
        echo "桶 ${BUCKET} 恢复失败，请检查网络或 mc 权限配置！"
        FAILED_BUCKETS="${FAILED_BUCKETS} ${BUCKET}"
    }
done

if [ -z "$FAILED_BUCKETS" ]; then
    echo "所有桶数据恢复完成！请检查生产端 MinIO 桶数据。"
    exit 0
else
    echo "以下桶恢复失败:${FAILED_BUCKETS}"
    exit 1
fi
```

> 💡 脚本复用第 5 章的 `backup.env`（同一份凭证文件），无需额外维护配置。`SRC_ALIAS / DEST_ALIAS` 与备份脚本保持一致，避免混淆方向。

**2. 在 `Makefile` 尾部追加恢复 Target**

```makefile
# ==========================================
# 恢复命令（追加到 Makefile 尾部）
# ==========================================

RESTORE_SCRIPT := $(PROJECT_DIR)/deploy/scripts/minio_restore.sh

.PHONY: restore restore-dry-run

# 1. 试运行/预览恢复（仅对比差异，不产生实际写入）
restore-dry-run:
	@chmod +x $(RESTORE_SCRIPT)
	@echo "正在对比备份端与生产端的数据差异 (Dry-Run)..."
	@bash -c "source $(ENV_FILE) && \
		mc alias set prod-minio \$${SRC_URL} \$${SRC_KEY} \$${SRC_SECRET} >/dev/null 2>&1 && \
		mc alias set backup-minio \$${DEST_URL} \$${DEST_KEY} \$${DEST_SECRET} >/dev/null 2>&1 && \
		for B in \$${SRC_BUCKETS}; do \
			mc mirror --dry-run backup-minio/\$${DEST_BUCKET_PREFIX}\$$B prod-minio/\$$B; \
		done"

# 2. 执行实际灾难恢复
restore:
	@chmod +x $(RESTORE_SCRIPT)
	@$(RESTORE_SCRIPT)
```

- `make restore-dry-run`：用 `--dry-run` 预览备份端相比生产端的差异，**不实际写入**，适合恢复前先确认范围。
- `make restore`：执行真实反向同步，脚本内含二次确认，避免误触发。

### 11.7 灾难恢复最佳实践

- **恢复前暂停实时同步脚本**：若采用了 `--watch` 实时同步，准备恢复或处理故障前，**先停止系统服务**（`make cron-uninstall` / 停掉 `--watch` 常驻进程），避免异常状态被误同步。
- **定期做「演练」**：建议每半年在测试环境模拟一次 `mc mirror` 反向恢复，确保备份数据的完整性和恢复流程的可行性。
- **备份与恢复职责分离**：备份脚本负责**自动、高频、静默**运行；恢复脚本强调**防错、可视化、人工控制**。`make restore-dry-run`（预览差异）+ `make restore`（实际恢复）是单机 Docker 项目最清晰、安全的应急响应组合。
