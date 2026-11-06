# ==========================================
# MinIO 备份/恢复 Makefile
# 由根 Makefile include 引入，也可在此目录独立使用:
#   make -f deploy/backup/minio/Makefile minio-backup
# ==========================================

# 以当前 Makefile 所在目录为锚点，脚本与 Makefile 同目录，不依赖项目根层级
HERE := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

BACKUP_SCRIPT  := $(HERE)minio_backup.sh
RESTORE_SCRIPT := $(HERE)minio_restore.sh
STATUS_SCRIPT  := $(HERE)minio_backup_status.sh
INSTALL_SCRIPT := $(HERE)install.sh
ENV_FILE       := $(HERE)backup.env

# 日志目录：优先读 backup.env 的 BACKUP_LOG_DIR，未配置则用默认值
BACKUP_LOG_DIR := $(shell grep -E '^BACKUP_LOG_DIR=' $(ENV_FILE) 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
ifeq ($(strip $(BACKUP_LOG_DIR)),)
BACKUP_LOG_DIR := /var/log/minio-backup
endif

# ---- Crontab 环境变量（修复 cron 与手动 shell 环境差异）----
# 🔴 Makefile 是手工入口：谁执行 make，crontab 就装在谁名下（不要用 sudo make）。
# HOME 必须是那个人的家目录，~/.mc/config.json 在那儿；写死 /root 会让
# cron 与界面自检读到两份不同的 alias 配置。与 install.sh 的 RUN_HOME 同口径。
CRON_HOME := $(shell getent passwd "$$(id -un)" | cut -d: -f6)
# cron 默认 PATH 极简（通常仅 /usr/bin:/bin），导致 mc/nc 找不到；此处补全常用路径。
# 若 mc 装在其他位置（which mc 查看），请把该目录补进此变量。
CRON_PATH := /usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin

# ---- 定时任务时间（优先读 backup.env，未配置则用默认值）----
CRON_SCHEDULE := $(shell grep -E '^CRON_SCHEDULE_BACKUP=' $(ENV_FILE) 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
ifeq ($(strip $(CRON_SCHEDULE)),)
CRON_SCHEDULE := 0 2 * * *
endif
HEALTH_CRON_SCHEDULE := $(shell grep -E '^CRON_SCHEDULE_HEALTH=' $(ENV_FILE) 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
ifeq ($(strip $(HEALTH_CRON_SCHEDULE)),)
HEALTH_CRON_SCHEDULE := 0 8 * * *
endif

# ---- 备份定时任务（每天凌晨 2:00）----
# 🔴 只用 /bin/sh 语法：cron 默认不是 bash，>(...) 会语法错；crontab 里 % 是特殊字符，
# 而 make 里的 $(date ...) 又会被当成 make 变量展开成空。脚本内部已 tee 落盘带时间戳的
# 业务日志，这里 stdout 丢弃、stderr 直接追加兜底即可。
CRON_TAG := \#MINIO_BACKUP
CRON_JOB := $(CRON_SCHEDULE) HOME=$(CRON_HOME) PATH=$(CRON_PATH) $(BACKUP_SCRIPT) >/dev/null 2>>$(BACKUP_LOG_DIR)/minio_backup.log $(CRON_TAG)

# ---- 健康巡检定时任务（每天 8:00）----
HEALTH_CRON_TAG := \#MINIO_BACKUP_HEALTH
HEALTH_CRON_JOB := $(HEALTH_CRON_SCHEDULE) HOME=$(CRON_HOME) PATH=$(CRON_PATH) $(STATUS_SCRIPT) >/dev/null 2>>$(BACKUP_LOG_DIR)/minio_backup.log $(HEALTH_CRON_TAG)

.PHONY: minio-install minio-backup minio-backup-cron-install minio-backup-cron-uninstall minio-backup-cron-status \
        minio-backup-health minio-backup-health-cron-install minio-backup-health-cron-uninstall minio-backup-health-cron-status \
        minio-backup-logs minio-restore minio-restore-dry-run minio-versioning-enable minio-ilm-clean

# 一键自动安装 MinIO 备份体系（依赖/配置/轮转/定时任务/自检，幂等）
# 通过环境变量把统一的 cron 时间注入 install.sh，避免两处重复定义漂移
minio-install:
	@chmod +x $(INSTALL_SCRIPT)
	@CRON_SCHEDULE_BACKUP="$(CRON_SCHEDULE)" CRON_SCHEDULE_HEALTH="$(HEALTH_CRON_SCHEDULE)" $(INSTALL_SCRIPT)

# 立即手动执行一次 MinIO 备份
minio-backup:
	@chmod +x $(BACKUP_SCRIPT)
	@echo "开始手动执行 MinIO 备份..."
	@$(BACKUP_SCRIPT)

# 写入 Crontab 定时任务（幂等，不会重复添加）
minio-backup-cron-install:
	@chmod +x $(BACKUP_SCRIPT)
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "错误: 未找到配置文件 $(ENV_FILE)，请先根据 backup.env.example 创建！"; \
		exit 1; \
	fi
	@(crontab -l 2>/dev/null | grep -v "$(CRON_TAG)" ; printf '%s\n' "$(CRON_JOB)") | crontab -
	@echo "MinIO 备份定时任务安装成功！规则: $(CRON_SCHEDULE)"

# 从 Crontab 移除该任务
minio-backup-cron-uninstall:
	@(crontab -l 2>/dev/null | grep -v "$(CRON_TAG)") | crontab -
	@echo "MinIO 备份定时任务已移除！"

# 查看当前 Crontab 中的备份任务
minio-backup-cron-status:
	@echo "=== 当前系统的备份 Crontab 状态 ==="
	@crontab -l 2>/dev/null | grep "$(CRON_TAG)" || echo "未找到已安装的备份定时任务"

# 试运行/预览恢复（仅对比差异，不实际写入）
minio-restore-dry-run:
	@chmod +x $(RESTORE_SCRIPT)
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "错误: 未找到配置文件 $(ENV_FILE)"; \
		exit 1; \
	fi
	@echo "正在对比备份端与生产端的数据差异 (Dry-Run)..."
	@bash -c "set -e; source $(ENV_FILE); \
		mc alias set prod-minio \$${SRC_URL} \$${SRC_KEY} \$${SRC_SECRET} >/dev/null 2>&1 || { echo '错误: 无法连接生产端 MinIO'; exit 1; }; \
		mc alias set backup-minio \$${DEST_URL} \$${DEST_KEY} \$${DEST_SECRET} >/dev/null 2>&1 || { echo '错误: 无法连接备份端 MinIO'; exit 1; }; \
		for BUCKET in \$${SRC_BUCKETS}; do \
			DEST_BUCKET=\$${DEST_BUCKET_PREFIX}\$${BUCKET}; \
			echo \"--- 桶: \$${BUCKET} ---\"; \
			mc mirror --dry-run backup-minio/\$${DEST_BUCKET} prod-minio/\$${BUCKET} 2>&1 || echo \"  [跳过] 桶 \$${BUCKET} dry-run 失败，请检查桶是否存在或权限\"; \
		done"

# 执行实际灾难恢复（含二次确认）
minio-restore:
	@chmod +x $(RESTORE_SCRIPT)
	@$(RESTORE_SCRIPT)

# 一键开启版本控制（源端 + 备份端所有桶），可选同时设置历史版本保留天数
# 用法:
#   make minio-versioning-enable                    开启源端+备份端全部桶（仅版本控制）
#   make minio-versioning-enable DAYS=30            同时设置历史版本保留 30 天
#   make minio-versioning-enable TARGET=src DAYS=30 仅源端桶，历史版本保留 30 天
#   make minio-versioning-enable TARGET=dest        仅备份端桶，仅版本控制
# 说明:
#   - 版本控制: mc version enable，幂等（已开启的桶重复执行无副作用）
#   - 保留天数: mc ilm rule add --noncurrent-expire-days（仅历史版本过期）。
#     开启版本控制后，被覆盖的旧对象成为 noncurrent 版本；仅清理历史版本，
#     当前版本永久保留（备份桶的最新数据不会被误删）。
#     同时 --expire-delete-marker 清理删除对象后遗留的僵尸 delete marker（避免其无限堆积）。
#     规则为整桶前缀，若桶已有生命周期规则，新规则会与既有规则叠加（union）。
minio-versioning-enable:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "错误: 未找到配置文件 $(ENV_FILE)，请先根据 backup.env.example 创建！"; \
		exit 1; \
	fi
	@bash -c 'set -e; source $(ENV_FILE); \
		TARGET="$(or $(TARGET),all)"; \
		DAYS="$(or $(DAYS),)"; \
		enable_bucket() { \
			ALIAS="$$1"; URL="$$2"; KEY="$$3"; SECRET="$$4"; PREFIX="$$5"; \
			mc alias set "$$ALIAS" "$$URL" "$$KEY" "$$SECRET" >/dev/null 2>&1 || { echo "错误: 无法连接 $$URL"; exit 1; }; \
			for BUCKET in $${SRC_BUCKETS}; do \
				B="$${PREFIX}$${BUCKET}"; \
				if ! mc ls "$$ALIAS/$$B" >/dev/null 2>&1; then \
					echo "  [跳过] 桶不存在: $$B"; continue; \
				fi; \
				mc version enable "$$ALIAS/$$B" >/dev/null 2>&1 && echo "  [OK] 已开启版本控制: $$B" || { echo "  [失败] 无法开启版本控制: $$B"; exit 1; }; \
				if [ -n "$$DAYS" ]; then \
					mc ilm rule add --noncurrent-expire-days "$$DAYS" --expire-delete-marker "$$ALIAS/$$B" >/dev/null 2>&1 \
						&& echo "  [OK] 已设置历史版本保留 $$DAYS 天（含 delete marker 清理）: $$B" \
						|| { echo "  [失败] 无法设置生命周期规则: $$B"; exit 1; }; \
				fi; \
			done; \
		}; \
		case "$$TARGET" in \
			src)  echo "=== 开启源端桶版本控制 ==="; enable_bucket prod-minio "$${SRC_URL}" "$${SRC_KEY}" "$${SRC_SECRET}" "" ;; \
			dest) echo "=== 开启备份端桶版本控制 ==="; enable_bucket backup-minio "$${DEST_URL}" "$${DEST_KEY}" "$${DEST_SECRET}" "$${DEST_BUCKET_PREFIX}" ;; \
			all)  echo "=== 开启源端桶版本控制 ==="; enable_bucket prod-minio "$${SRC_URL}" "$${SRC_KEY}" "$${SRC_SECRET}" ""; \
			      echo "=== 开启备份端桶版本控制 ==="; enable_bucket backup-minio "$${DEST_URL}" "$${DEST_KEY}" "$${DEST_SECRET}" "$${DEST_BUCKET_PREFIX}" ;; \
			*)    echo "错误: TARGET 仅支持 src/dest/all，当前: $$TARGET"; exit 1 ;; \
		esac'

# 一键清除生命周期规则（源端 + 备份端所有桶）
# 用法:
#   make minio-ilm-clean                清除源端+备份端全部桶的 ILM 规则
#   make minio-ilm-clean TARGET=src     仅清除源端桶
#   make minio-ilm-clean TARGET=dest    仅清除备份端桶
# 说明: mc ilm rule rm --all --force，清空该桶全部生命周期规则（含历史误加的
#       --expire-days 当前版本过期规则）。幂等：无规则时执行无副作用。
#       典型用途: 在重新运行 minio-versioning-enable DAYS=N 前，先清除旧规则，
#       避免叠加产生「当前版本过期」等错误规则导致最新备份被误删。
minio-ilm-clean:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "错误: 未找到配置文件 $(ENV_FILE)，请先根据 backup.env.example 创建！"; \
		exit 1; \
	fi
	@bash -c 'set -e; source $(ENV_FILE); \
		TARGET="$(or $(TARGET),all)"; \
		clean_bucket() { \
			ALIAS="$$1"; URL="$$2"; KEY="$$3"; SECRET="$$4"; PREFIX="$$5"; \
			mc alias set "$$ALIAS" "$$URL" "$$KEY" "$$SECRET" >/dev/null 2>&1 || { echo "错误: 无法连接 $$URL"; exit 1; }; \
			for BUCKET in $${SRC_BUCKETS}; do \
				B="$${PREFIX}$${BUCKET}"; \
				if ! mc ls "$$ALIAS/$$B" >/dev/null 2>&1; then \
					echo "  [跳过] 桶不存在: $$B"; continue; \
				fi; \
				mc ilm rule rm --all --force "$$ALIAS/$$B" >/dev/null 2>&1 \
					&& echo "  [OK] 已清除生命周期规则: $$B" \
					|| { echo "  [失败] 无法清除生命周期规则: $$B"; exit 1; }; \
			done; \
		}; \
		case "$$TARGET" in \
			src)  echo "=== 清除源端桶生命周期规则 ==="; clean_bucket prod-minio "$${SRC_URL}" "$${SRC_KEY}" "$${SRC_SECRET}" "" ;; \
			dest) echo "=== 清除备份端桶生命周期规则 ==="; clean_bucket backup-minio "$${DEST_URL}" "$${DEST_KEY}" "$${DEST_SECRET}" "$${DEST_BUCKET_PREFIX}" ;; \
			all)  echo "=== 清除源端桶生命周期规则 ==="; clean_bucket prod-minio "$${SRC_URL}" "$${SRC_KEY}" "$${SRC_SECRET}" ""; \
			      echo "=== 清除备份端桶生命周期规则 ==="; clean_bucket backup-minio "$${DEST_URL}" "$${DEST_KEY}" "$${DEST_SECRET}" "$${DEST_BUCKET_PREFIX}" ;; \
			*)    echo "错误: TARGET 仅支持 src/dest/all，当前: $$TARGET"; exit 1 ;; \
		esac'

# 查看统一日志 minio_backup.log（备份 + 巡检 + Cron 均写入同一文件）
# 用法（参数大小写均可，如 LINES 或 lines、ALL 或 all）:
#   make minio-backup-logs              实时跟踪（Ctrl+C 退出）
#   make minio-backup-logs lines=50     查看最近 50 行
#   make minio-backup-logs all=1        输出全部日志
minio-backup-logs:
	@LOG_DIR="$(BACKUP_LOG_DIR)"; \
	ALL_VAL="$(or $(ALL),$(all))"; \
	LINES_VAL="$(or $(LINES),$(lines))"; \
	if [ ! -f "$$LOG_DIR/minio_backup.log" ]; then \
		echo "日志文件不存在: $$LOG_DIR/minio_backup.log"; \
		echo "提示: 尚未产生日志，可先执行 make minio-backup 触发一次备份"; \
		exit 0; \
	fi; \
	if [ "$$ALL_VAL" = "1" ]; then \
		echo "=== 全部日志: $$LOG_DIR/minio_backup.log ==="; \
		cat "$$LOG_DIR/minio_backup.log"; \
	elif [ -n "$$LINES_VAL" ]; then \
		echo "=== 最近 $$LINES_VAL 行日志: $$LOG_DIR/minio_backup.log ==="; \
		tail -n "$$LINES_VAL" "$$LOG_DIR/minio_backup.log"; \
	else \
		echo "=== 实时日志: $$LOG_DIR/minio_backup.log（Ctrl+C 退出）==="; \
		tail -f "$$LOG_DIR/minio_backup.log"; \
	fi

# 立即查看备份健康度（是否在跑、上次成功、日志/磁盘占用）
minio-backup-health:
	@chmod +x $(STATUS_SCRIPT)
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "错误: 未找到配置文件 $(ENV_FILE)，请先根据 backup.env.example 创建！"; \
		exit 1; \
	fi
	@bash -c "set -a; source $(ENV_FILE); set +a; $(STATUS_SCRIPT)"

# 在 Crontab 安装"每日健康巡检"定时任务（异常时按 ALERT_WEBHOOK 推送）
minio-backup-health-cron-install:
	@chmod +x $(STATUS_SCRIPT)
	@(crontab -l 2>/dev/null | grep -v "$(HEALTH_CRON_TAG)" ; printf '%s\n' "$(HEALTH_CRON_JOB)") | crontab -
	@echo "MinIO 备份健康巡检定时任务安装成功！规则: $(HEALTH_CRON_SCHEDULE)"

minio-backup-health-cron-uninstall:
	@(crontab -l 2>/dev/null | grep -v "$(HEALTH_CRON_TAG)") | crontab -
	@echo "MinIO 备份健康巡检定时任务已移除！"

minio-backup-health-cron-status:
	@echo "=== 当前系统的健康巡检 Crontab 状态 ==="
	@crontab -l 2>/dev/null | grep "$(HEALTH_CRON_TAG)" || echo "未找到已安装的健康巡检定时任务"
