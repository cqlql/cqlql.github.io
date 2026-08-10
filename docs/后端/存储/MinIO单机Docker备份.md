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

```text
生产 MinIO ──(Bucket Replication, 服务端)──► 备份 MinIO   (企业生产级推荐)
生产 MinIO ──(mc mirror,        客户端)──► 备份 MinIO   (小团队/个人可用)
```

### 方案二：文件系统级备份（仅作同机兜底，有风险）

> ⚠️ **禁止把 `rsync` / `tar` 复制 `/data` 作为主备份。** MinIO 内部不是简单文件服务器，带有 `xl.meta` 元数据、multipart 分片状态、version 信息等。若在对象**写入过程中**复制，会得到不一致状态的半成品对象。主备份必须走 **API 层（对象级）**。

```text
业务写入 MinIO
      │
      │ mc mirror (对象级, 一致性由 MinIO 保证)
      ▼
另一个 MinIO / S3 / OSS
```

文件系统级手段只适合**同机快速回滚**，无法替代异地灾备（宿主机盘坏了快照也一起没）：

1. **一致性快照**：宿主机底层使用 ZFS / LVM 时，定期给 `/data` 所在卷打快照（优先在写入低峰或暂停写入时）。
2. **定时冷备归档**：通过 `crontab` + `rsync` / `tar` 打包同步到远程服务器——仅作辅助兜底。

## 三、不要「MinIO 备份再备份 MinIO」（避免套娃）

若 PostgreSQL 的备份产物也存进 MinIO（如把 `pg_dump` 文件上传到桶里），**不要**再让 MinIO 把「自己内部这些备份文件」整体镜像一遍，否则会形成 `PostgreSQL → MinIO → mc mirror → 备份 MinIO → (再备份?)` 的套娃。

正确做法是**数据分源、各管各的**：

```text
业务数据: PostgreSQL ──pg_dump + WAL 归档──► 独立备份存储
文件数据: MinIO      ──mc mirror──────────► 备份 MinIO / OSS
```

各自独立备份一次即可，不要对「已含别人备份的 MinIO」再做二次整体备份。

## 四、生产环境三要素

- **必须开启版本控制（Versioning）**：防止误删或写入污染，开启后即便源端误删，异地备份或源端历史版本仍可找回（删除只生成 delete marker，对象数据保留）。

  ```bash
  mc version enable prod-minio/prod-data
  ```

  建议对用户文件桶开启 Versioning——用户误删 `resume.pdf` 后仍有旧版本可恢复。

- **备份介质与宿主机不要在同一块硬盘**：否则硬盘损坏时备份也会一并丢失。
- **远期规划（升级为集群）**：条件允许时迁移到 **MinIO 分布式集群模式（Erasure Code 纠删码）**，提供节点级高可用。

## 五、生产级自动化增量备份脚本

### 5.1 设计原则：代码入库、凭证脱敏、部署留痕

把备份脚本放进项目仓库（如 `scripts/backup/`）是**推荐做法**——备份逻辑随代码统一 Git 版本控制，重新部署时 `git pull` 即同步最新逻辑（Infrastructure as Code）。但必须区分**代码版本管理**与**运行时部署**：

- **严禁把密钥硬编码进仓库**：`SRC_SECRET`、`DEST_SECRET`、生产 IP 等一律通过**环境变量文件**注入，仓库只保留 `.example` 模板。
- **脚本自带路径自适应**：通过 `BASH_SOURCE` 定位自身目录，避免 Crontab 绝对路径硬编码。
- **Cron 用 Makefile 封装**：一键 `cron-install / uninstall / status`，自动注入绝对路径并带幂等标记，杜绝重复任务。

### 5.2 项目目录结构

```text
project/
├── Makefile                      # 运维指挥官：封装 cron-install / uninstall / status / backup
└── deploy/
    └── scripts/
        ├── backup.env.example    # 凭证模板（可提交 Git）
        └── minio_backup.sh       # 备份脚本（可提交 Git，凭证从外部 env 读取）
```

> 真实凭证 `backup.env` 由运维根据 `.example` 创建，**不提交 Git**，建议放在 `/etc/project/backup.env` 或项目目录下但加入 `.gitignore`。

### 5.3 `backup.env.example`（提交到 Git 的模板）

```bash
# MinIO 备份环境变量配置模板（复制为 backup.env 后填入真实值，勿提交 backup.env）
SRC_URL="http://127.0.0.1:9000"
SRC_KEY="YOUR_PROD_ACCESS_KEY"
SRC_SECRET="YOUR_PROD_SECRET_KEY"
SRC_BUCKET="passup-prod-bucket"

DEST_IP="192.168.1.200"
DEST_URL="http://192.168.1.200:9000"
DEST_KEY="YOUR_BACKUP_ACCESS_KEY"
DEST_SECRET="YOUR_BACKUP_SECRET_KEY"
DEST_BUCKET="passup-backup-bucket"
```

### 5.4 `minio_backup.sh`（提交到 Git，从外部 env 读取凭证）

包含**网络连通性预检**、**日志记录**与**错误防护**，凭证全部来自同目录 / 指定的 `backup.env`，无任何硬编码密钥：

```bash
#!/bin/bash

# ==========================================
# MinIO 生产环境自动化增量备份脚本（凭证外置）
# ==========================================

# 获取当前脚本所在目录（Crontab 执行时不依赖 cwd）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载环境变量文件（生产环境建议放在 /etc/project/backup.env）
ENV_FILE="${SCRIPT_DIR}/backup.env"
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
else
    echo "错误: 未找到配置文件 $ENV_FILE"
    exit 1
fi

# 别名与日志
SRC_ALIAS="prod-minio"
DEST_ALIAS="backup-minio"
LOG_FILE="/var/log/minio-backup/minio_backup.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "==========================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始执行 MinIO 异地备份..." >> "$LOG_FILE"

# Step 1: 检查远程服务器网络连通性
nc -z -w 3 "$DEST_IP" 9000 > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: 无法连接到备份服务器 ($DEST_IP:9000)，备份中断！" >> "$LOG_FILE"
    # 可在此处接入告警（微信 / 钉钉 / 飞书 Webhook）
    exit 1
fi

# Step 2: 初始化本地 mc 别名配置
mc alias set $SRC_ALIAS $SRC_URL $SRC_KEY $SRC_SECRET > /dev/null 2>&1
mc alias set $DEST_ALIAS $DEST_URL $DEST_KEY $DEST_SECRET > /dev/null 2>&1

# Step 3: 执行增量同步
# --overwrite: 覆盖变更文件
# 默认不加 --remove: 生产端删除时备份端仍保留，防止误删 / 勒索风险
mc mirror --overwrite $SRC_ALIAS/$SRC_BUCKET $DEST_ALIAS/$DEST_BUCKET >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份成功完成！" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份过程中出现错误，请检查日志！" >> "$LOG_FILE"
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

### 5.7 针对单机 Docker 的取舍

对单机 Ubuntu + Docker 的个人 / 小团队项目，不必上 Bucket Replication，用 `mc mirror` 定时同步即可：

```text
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

  ```caddy
  backup-minio.yourdomain.com {
      reverse_proxy localhost:9000
  }
  ```

- **MinIO 原生 TLS**：将证书放入容器内凭证目录（Docker 部署通常挂载为 `/root/.minio/certs/`，即容器内的 `~/.minio/certs/`，具体路径以容器实际挂载为准），包含：

  ```text
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

脚本中把目标指向本地映射端口：

```bash
DEST_URL="http://127.0.0.1:19000"
# mc 以为在写本地，实际流量由 SSH 加密传往公网远程服务器
```

### 公网传输的关键策略

1. **限速（非常重要）**：公网带宽昂贵或受限，加 `--limit-upload` 避免备份跑满生产出口：

   ```bash
   # 限制最大上传速度为 50 MB/s
   mc mirror --overwrite --limit-upload 50M src-minio/my-bucket dest-minio/my-bucket
   ```

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
| 适用网络 | 局域网 / 专线 / **公网（可限速）** | 局域网 / 高质量专线（公网易打断） |

**选型建议：**

- **优先定时增量（Cron）**：数据不频繁变动、允许丢失数小时，或跨公网易抖动的场景。脚本每次独立运行、执行完即退出，断连后下次自动断点续传。对单机 Docker + MinIO 的个人 / 小团队项目，这通常是**首选**。
- **`--watch` 定位**：适合小规模、自建备份、临时同步、非关键数据。它依赖**常驻客户端进程**，生产关键数据若采用 `--watch` 必须配合 Systemd 守护 + Cron 兜底，否则进程挂掉会漏同步。

**可选双保险（仅当需要秒级 RPO 时采用）**：两种方式基于文件状态比对，具有**幂等性**，并行不会冲突——`--watch` 解决 RPO 实现秒级热备，Cron 解决自愈、补全遗漏事件。

```text
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

## 九、数据增长：首次慢、之后只增量

不必担心「文件越来越多备份越慢」。`mc mirror` 是增量同步：

- 首次（如 1TB）：千兆网实际约 80MB/s，≈ 3.5 小时属正常，仅第一次慢。
- 之后每天只同步**新增 / 变化**的对象（如 100MB），不会每天重传全量。

**大文件避坑**：若用户会上传大文件（如 5GB 视频，上传耗时长），**不要**实时同步，否则可能复制「上传中」的半成品。企业常见做法是在业务表记录对象状态，只备份 `COMPLETED` 的对象，或结合离峰 Cron 而非 `--watch` 实时，天然避开上传中途的不一致窗口：

```text
file_object 表: id | bucket | object_key | status(UPLOADING/COMPLETED) | size | created_time
备份只同步 status = COMPLETED 的对象
```

## 十、最终检查清单（Checklist）

- [ ] 备份服务器的 `9000` / `9001` 端口已在防火墙中对生产服务器放行。
- [ ] 生产端与备份端的存储桶均已开启 **版本控制（Versioning）**，防止误删或勒索破坏。
- [ ] 备份服务器挂载了**独立**的大容量磁盘 / NAS，确保与宿主机不同盘、存储空间充足。
- [ ] 公网传输已加密（HTTPS / SSH 隧道）并限速，避免挤占生产出口。
- [ ] 脚本未加 `--remove`，防范生产端误删 / 勒索同步到备份端。

### 项目最终备份建议表

| 数据 | 方案 | 频率 |
| --- | --- | --- |
| PostgreSQL | `pg_dump` 全量 + WAL 归档 | 每天全量 + 每 5 分钟 WAL（可恢复到任意时间点） |
| MinIO | `mc mirror` | 每小时（或每天一次，视文件变化频率） |
| Redis | 不备份 | 缓存可重建 |
| Docker 配置 / Compose | Git 保存 | 每次发布 |
| 上传文件 | MinIO Versioning | 开启 |
