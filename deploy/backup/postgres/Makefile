# ==========================================
# PostgreSQL 备份/恢复 Makefile
# 由根 Makefile include 引入，也可在此目录独立使用:
#   make -f deploy/backup/postgres/Makefile pg-backup
# ==========================================

# 以当前 Makefile 所在目录为锚点，脚本与 Makefile 同目录，不依赖项目根层级
HERE := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

PG_BACKUP_SCRIPT  := $(HERE)pg_backup.sh
PG_RESTORE_SCRIPT := $(HERE)pg_restore.sh
PG_STATUS_SCRIPT  := $(HERE)pg_backup_status.sh
PG_INSTALL_SCRIPT := $(HERE)install.sh
PG_ENV_FILE       := $(HERE)backup.env

# 日志目录：优先读 backup.env 的 PG_BACKUP_LOG_DIR，未配置则用默认值
PG_BACKUP_LOG_DIR := $(shell grep -E '^PG_BACKUP_LOG_DIR=' $(PG_ENV_FILE) 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
ifeq ($(strip $(PG_BACKUP_LOG_DIR)),)
PG_BACKUP_LOG_DIR := /var/log/pg-backup
endif

# ---- Crontab 环境变量（修复 cron 与手动 shell 环境差异）----
# cron 默认 HOME 与手动执行时不同，导致 ~/.ssh 私钥路径（免密登录主服务器）不一致；
# 必须显式注入实际手动执行时用的 HOME（用 echo $HOME 查，若为 root 则保持 /root）。
CRON_HOME := /root
# cron 默认 PATH 极简（通常仅 /usr/bin:/bin），导致 ssh/scp/pg_restore 找不到；此处补全常用路径。
# 若命令装在其他位置（which ssh 查看），请把该目录补进此变量。
CRON_PATH := /usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin

# ---- 定时任务时间（优先读 backup.env，未配置则用默认值）----
PG_CRON_SCHEDULE := $(shell grep -E '^CRON_SCHEDULE_BACKUP=' $(PG_ENV_FILE) 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
ifeq ($(strip $(PG_CRON_SCHEDULE)),)
PG_CRON_SCHEDULE := 0 3 * * *
endif
PG_HEALTH_CRON_SCHEDULE := $(shell grep -E '^CRON_SCHEDULE_HEALTH=' $(PG_ENV_FILE) 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
ifeq ($(strip $(PG_HEALTH_CRON_SCHEDULE)),)
PG_HEALTH_CRON_SCHEDULE := 0 9 * * *
endif

# ---- PG 备份定时任务（每天凌晨 3:00，错开 MinIO 的 2:00）----
# 脚本内部已 tee 落盘 pg_backup.log，此处 stdout 丢弃、stderr 追加兜底，避免日志重复
PG_CRON_TAG := \#PG_BACKUP
PG_CRON_JOB := $(PG_CRON_SCHEDULE) HOME=$(CRON_HOME) PATH=$(CRON_PATH) $(PG_BACKUP_SCRIPT) >/dev/null 2> >(sed 's/^/[$(date +%Y-%m-%d\ %H:%M:%S)][cron] /' >>$(PG_BACKUP_LOG_DIR)/pg_backup.log) $(PG_CRON_TAG)

# ---- PG 健康巡检定时任务（每天 9:00）----
PG_HEALTH_CRON_TAG := \#PG_BACKUP_HEALTH
PG_HEALTH_CRON_JOB := $(PG_HEALTH_CRON_SCHEDULE) HOME=$(CRON_HOME) PATH=$(CRON_PATH) $(PG_STATUS_SCRIPT) >/dev/null 2> >(sed 's/^/[$(date +%Y-%m-%d\ %H:%M:%S)][cron] /' >>$(PG_BACKUP_LOG_DIR)/pg_backup.log) $(PG_HEALTH_CRON_TAG)

.PHONY: pg-install pg-backup pg-backup-cron-install pg-backup-cron-uninstall pg-backup-cron-status \
        pg-backup-health pg-backup-health-cron-install pg-backup-health-cron-uninstall pg-backup-health-cron-status \
        pg-backup-logs pg-restore pg-restore-latest

# 一键自动安装 PostgreSQL 备份体系（依赖/配置/轮转/定时任务/自检，幂等）
# 通过环境变量把统一的 cron 时间注入 install.sh，避免两处重复定义漂移
pg-install:
	@chmod +x $(PG_INSTALL_SCRIPT)
	@CRON_SCHEDULE_BACKUP="$(PG_CRON_SCHEDULE)" CRON_SCHEDULE_HEALTH="$(PG_HEALTH_CRON_SCHEDULE)" $(PG_INSTALL_SCRIPT)

# 立即手动执行一次 PostgreSQL 备份
pg-backup:
	@chmod +x $(PG_BACKUP_SCRIPT)
	@echo "开始手动执行 PostgreSQL 备份..."
	@$(PG_BACKUP_SCRIPT)

# 写入 Crontab 定时任务（幂等，不会重复添加）
pg-backup-cron-install:
	@chmod +x $(PG_BACKUP_SCRIPT)
	@if [ ! -f "$(PG_ENV_FILE)" ]; then \
		echo "错误: 未找到配置文件 $(PG_ENV_FILE)，请先根据 backup.env.example 创建！"; \
		exit 1; \
	fi
	@(crontab -l 2>/dev/null | grep -v "$(PG_CRON_TAG)" ; printf '%s\n' "$(PG_CRON_JOB)") | crontab -
	@echo "PostgreSQL 备份定时任务安装成功！规则: $(PG_CRON_SCHEDULE)"

# 从 Crontab 移除该任务
pg-backup-cron-uninstall:
	@(crontab -l 2>/dev/null | grep -v "$(PG_CRON_TAG)") | crontab -
	@echo "PostgreSQL 备份定时任务已移除！"

# 查看当前 Crontab 中的 PG 备份任务
pg-backup-cron-status:
	@echo "=== 当前系统的 PostgreSQL 备份 Crontab 状态 ==="
	@crontab -l 2>/dev/null | grep "$(PG_CRON_TAG)" || echo "未找到已安装的备份定时任务"

# 查看统一日志 pg_backup.log（备份 + 巡检 + Cron 均写入同一文件）
# 用法（参数大小写均可，如 LINES 或 lines、ALL 或 all）:
#   make pg-backup-logs              实时跟踪（Ctrl+C 退出）
#   make pg-backup-logs lines=50     查看最近 50 行
#   make pg-backup-logs all=1        输出全部日志
pg-backup-logs:
	@LOG_DIR="$(PG_BACKUP_LOG_DIR)"; \
	ALL_VAL="$(or $(ALL),$(all))"; \
	LINES_VAL="$(or $(LINES),$(lines))"; \
	if [ ! -f "$$LOG_DIR/pg_backup.log" ]; then \
		echo "日志文件不存在: $$LOG_DIR/pg_backup.log"; \
		echo "提示: 尚未产生日志，可先执行 make pg-backup 触发一次备份"; \
		exit 0; \
	fi; \
	if [ "$$ALL_VAL" = "1" ]; then \
		echo "=== 全部日志: $$LOG_DIR/pg_backup.log ==="; \
		cat "$$LOG_DIR/pg_backup.log"; \
	elif [ -n "$$LINES_VAL" ]; then \
		echo "=== 最近 $$LINES_VAL 行日志: $$LOG_DIR/pg_backup.log ==="; \
		tail -n "$$LINES_VAL" "$$LOG_DIR/pg_backup.log"; \
	else \
		echo "=== 实时日志: $$LOG_DIR/pg_backup.log（Ctrl+C 退出）==="; \
		tail -f "$$LOG_DIR/pg_backup.log"; \
	fi

# 立即查看 PG 备份健康度
pg-backup-health:
	@chmod +x $(PG_STATUS_SCRIPT)
	@if [ ! -f "$(PG_ENV_FILE)" ]; then \
		echo "错误: 未找到配置文件 $(PG_ENV_FILE)，请先根据 backup.env.example 创建！"; \
		exit 1; \
	fi
	@bash -c "set -a; source $(PG_ENV_FILE); set +a; $(PG_STATUS_SCRIPT)"

# 安装"每日 PG 健康巡检"定时任务
pg-backup-health-cron-install:
	@chmod +x $(PG_STATUS_SCRIPT)
	@(crontab -l 2>/dev/null | grep -v "$(PG_HEALTH_CRON_TAG)" ; printf '%s\n' "$(PG_HEALTH_CRON_JOB)") | crontab -
	@echo "PostgreSQL 备份健康巡检定时任务安装成功！规则: $(PG_HEALTH_CRON_SCHEDULE)"

pg-backup-health-cron-uninstall:
	@(crontab -l 2>/dev/null | grep -v "$(PG_HEALTH_CRON_TAG)") | crontab -
	@echo "PostgreSQL 备份健康巡检定时任务已移除！"

pg-backup-health-cron-status:
	@echo "=== 当前系统的 PG 健康巡检 Crontab 状态 ==="
	@crontab -l 2>/dev/null | grep "$(PG_HEALTH_CRON_TAG)" || echo "未找到已安装的健康巡检定时任务"

# 恢复指定备份文件 (用法: make pg-restore FILE=/path/to/x.dump [DB=restore_test])
pg-restore:
	@chmod +x $(PG_RESTORE_SCRIPT)
	@$(PG_RESTORE_SCRIPT) --file $(FILE) $(if $(DB),--db $(DB),)

# 恢复最新本地备份（递归搜索分级目录，含二次确认）
pg-restore-latest:
	@chmod +x $(PG_RESTORE_SCRIPT)
	@$(PG_RESTORE_SCRIPT)
