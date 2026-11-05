# ==========================================
# 备份体系 Makefile（deploy/backup 目录独立使用）
# 也可被仓库根 Makefile include（见根 Makefile 的 BACKUP_DIR 逻辑）
# 独立用法:
#   make -f deploy/backup/Makefile backup-preflight
#   make -f deploy/backup/Makefile pg-backup
#   make -f deploy/backup/Makefile minio-backup
#
# 说明：脚本「同步到备份服务器」不再走本 Makefile —— 统一用
#   ops backup deploy --server <name>
# （tar 流上传 + 换目录 + logrotate + preflight，见 docs/backup-deploy.md）。
# 旧的 backup_sync.sh / sync.env 已删除：rsync 路径在 Windows 开发机上不可用，
# 且不会注入本机 backup.env、不装 logrotate、不跑 preflight，留着只会漂移。
# ==========================================

# 以当前 Makefile 所在目录为锚点，脚本与 Makefile 同目录，不依赖项目根层级
# 注意：不能命名为 HERE——子目录 Makefile 也定义了 HERE（各自锚定自身目录），
# include 后会被覆盖，导致本文件的相对路径错乱。故用独立变量 BACKUP_DIR 锚定。
BACKUP_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

PREFLIGHT_SCRIPT := $(BACKUP_DIR)preflight_check.sh

.PHONY: backup-preflight pg-preflight minio-preflight

# ==========================================
# 部署自检
# ==========================================
backup-preflight:
	@chmod +x $(PREFLIGHT_SCRIPT)
	@$(PREFLIGHT_SCRIPT)

pg-preflight:
	@chmod +x $(PREFLIGHT_SCRIPT)
	@$(PREFLIGHT_SCRIPT) pg

minio-preflight:
	@chmod +x $(PREFLIGHT_SCRIPT)
	@$(PREFLIGHT_SCRIPT) minio

# ==========================================
# 子体系入口：直接 include 各自子目录 Makefile（与根 Makefile 写法一致）
# 子 Makefile 用 lastword MAKEFILE_LIST 自锚定 HERE，include 后其脚本路径仍指向自身目录；
# 其业务变量均带前缀（PG_* / BACKUP_*），同名变量（HERE/CRON_HOME/CRON_PATH）值相同，无冲突。
# ==========================================
include $(BACKUP_DIR)minio/Makefile
include $(BACKUP_DIR)postgres/Makefile
