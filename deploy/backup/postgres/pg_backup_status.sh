#!/bin/bash

# ==========================================
# PostgreSQL 备份健康度统一巡检脚本
# 部署: 运行在"备份端"机器上（与 pg_backup.sh 同机）
# 作用: 一眼看清"是否还在跑、上次成功、日志/磁盘占用"
# 用法: bash /path/pg_backup_status.sh
# 退出码: 0=健康, 1=检测到异常（方便 Cron + 告警联动 grep '❌' 或判断退出码）
# 说明: 纯零依赖（仅用 date/du/df），不改 pg_backup.sh 主逻辑，纯外围增强。
#       BACKUP_DISK_MOUNT 指向备份端本机 PG 备份盘挂载点，用于监控备份写入盘是否写满。
# ==========================================

# 获取当前脚本所在目录（Crontab 执行时不依赖 cwd）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载环境变量文件（与 pg_backup.sh 保持一致）
ENV_FILE="${SCRIPT_DIR}/backup.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ENV_FILE"
    set +a
else
    echo "警告: 未找到配置文件 $ENV_FILE，将使用内置默认值"
fi

# ---------- 可配置项 ----------
# 日志目录（与 pg_backup.sh 保持一致，默认 /var/log/pg-backup）
LOG_DIR="${PG_BACKUP_LOG_DIR:-/var/log/pg-backup}"
# 自建日志目录，避免外部重定向（如 Cron 的 >> 追加）因目录缺失而静默失败
mkdir -p "$LOG_DIR" 2>/dev/null || true
# 统一日志文件：巡检输出与备份脚本写入同一 pg_backup.log，集中排查
LOG_FILE="${LOG_DIR}/pg_backup.log"
# 统一格式：每行以 [YYYY-MM-DD HH:MM:SS][health] 前缀开头；脚本负责落盘（tee），
# [health] 为来源标识，用于区分同一 pg_backup.log 中不同脚本（备份/巡检）产出的日志。
# 调用方（Cron / Makefile）不再追加重定向，避免日志重复。
log() {
    local level="$1"; shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')][health] level=$level $*" | tee -a "$LOG_FILE"
}
# 超过该小时数未成功即告警（Cron 每天跑则设 ~26，留 2h 余量）
THRESHOLD_HOURS="${BACKUP_HEALTH_THRESHOLD_HOURS:-26}"
BACKUP_ROOT="${PG_BACKUP_ROOT:-/data/backups/postgres}"
# 备份端磁盘挂载点（巡检 df 用，按实际部署修改或设置环境变量覆盖）
BACKUP_MOUNT="${BACKUP_DISK_MOUNT:-/data}"
# 磁盘使用率告警阈值（百分比，可被 backup.env 覆盖）：达到该阈值判定异常
DISK_CRIT_PCT="${BACKUP_DISK_CRIT_PCT:-90}"
# 可选: 异常时主动推送的 Webhook（留空则不推送，仅打印）
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"

# ---------- 巡检状态 ----------
HEALTHY=1   # 1=正常 0=异常（供退出码与告警判断）
ALERT_MSG=""   # 汇总异常原因，随 Webhook 推送
HOSTNAME="$(hostname 2>/dev/null || echo "unknown")"

log info "====== PostgreSQL 备份健康巡检 $(date '+%Y-%m-%d %H:%M:%S') ======"

# 1) 上次成功时间 & 是否超时
if [ -f "$LOG_DIR/last_success.txt" ]; then
    LAST="$(cat "$LOG_DIR/last_success.txt")"
    LAST_TS="$(date -d "$LAST" +%s 2>/dev/null)"
    if [ -z "$LAST_TS" ]; then
        log error "❌ 异常：last_success.txt 内容无法解析时间戳（$LAST）"
        HEALTHY=0
        ALERT_MSG="${ALERT_MSG}- last_success.txt 内容无法解析时间戳（${LAST}）\n"
    else
        NOW_TS="$(date +%s)"
        DELTA=$(( (NOW_TS - LAST_TS) / 3600 ))
        if [ "$DELTA" -gt "$THRESHOLD_HOURS" ]; then
            log error "❌ 异常：距上次成功已 ${DELTA} 小时（阈值 ${THRESHOLD_HOURS}h）"
            HEALTHY=0
            ALERT_MSG="${ALERT_MSG}- 备份超时：距上次成功已 ${DELTA} 小时（阈值 ${THRESHOLD_HOURS}h）\n"
        else
            log info "✅ 健康：上次成功 $LAST（${DELTA}h 前）"
        fi
    fi
else
    log error "❌ 异常：从未成功过（无 $LOG_DIR/last_success.txt）"
    HEALTHY=0
    ALERT_MSG="${ALERT_MSG}- 从未成功过：无 $LOG_DIR/last_success.txt\n"
fi

# 2) 备份目录总占用（含分级目录）
if [ -d "$BACKUP_ROOT" ]; then
    log info "📦 备份占用(${BACKUP_ROOT}): $(du -sh "$BACKUP_ROOT" 2>/dev/null | cut -f1)"
    # 列出各分级目录占用
    for G in daily weekly monthly; do
        if [ -d "$BACKUP_ROOT/$G" ]; then
            log info "   ${G}/: $(du -sh "$BACKUP_ROOT/$G" 2>/dev/null | cut -f1)"
        fi
    done
    # 最新一份备份文件
    LATEST=$(find "$BACKUP_ROOT" -name "*.dump" -type f -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -n 1 | awk '{print $2}')
    if [ -n "$LATEST" ]; then
        log info "   最新备份: $LATEST"
    else
        log warn "⚠️  尚未生成任何 .dump 备份文件"
        HEALTHY=0
        ALERT_MSG="${ALERT_MSG}- 尚未生成任何 .dump 备份文件（备份目录 ${BACKUP_ROOT}）\n"
    fi
else
    log warn "⚠️  跳过磁盘检查：备份目录 $BACKUP_ROOT 不存在"
    HEALTHY=0
    ALERT_MSG="${ALERT_MSG}- 备份目录 ${BACKUP_ROOT} 不存在，跳过磁盘检查\n"
fi

# 3) 日志目录总占用（含轮转历史）
LOG_SIZE="$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)"
log info "📄 日志占用: ${LOG_SIZE:-N/A}"

# 4) 当前日志文件大小（最新一份）
CUR="$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -1)"
if [ -n "$CUR" ]; then
    log info "   当前日志: $CUR -> $(du -h "$CUR" | cut -f1)"
fi

# 5) 备份端磁盘剩余（按挂载点）
if [ -d "$BACKUP_MOUNT" ]; then
    DISK_LINE="$(df -P "$BACKUP_MOUNT" 2>/dev/null | awk 'NR==2')"
    if [ -n "$DISK_LINE" ]; then
        DISK_USED_PCT="$(echo "$DISK_LINE" | awk '{print $5}' | tr -d '%')"
        DISK_AVAIL="$(echo "$DISK_LINE" | awk '{print $4}')"
        DISK_TOTAL="$(echo "$DISK_LINE" | awk '{print $2}')"
        log info "💽 磁盘占用(${BACKUP_MOUNT}): 已用 ${DISK_USED_PCT}% (剩余 ${DISK_AVAIL} / ${DISK_TOTAL})"
        case "$DISK_USED_PCT" in
            ''|*[!0-9]*)
                log warn "⚠️  无法解析磁盘使用率，跳过磁盘阈值判断"
                ;;
            *)
                if [ "$DISK_USED_PCT" -ge "$DISK_CRIT_PCT" ]; then
                    log error "❌ 异常：磁盘使用率 ${DISK_USED_PCT}% 已达告警阈值 ${DISK_CRIT_PCT}%，备份可能因写满失败"
                    HEALTHY=0
                    ALERT_MSG="${ALERT_MSG}- 磁盘使用率 ${DISK_USED_PCT}% 已达告警阈值 ${DISK_CRIT_PCT}%（挂载点 ${BACKUP_MOUNT}）\n"
                else
                    log info "✅ 健康：磁盘使用率 ${DISK_USED_PCT}%（告警阈值 ${DISK_CRIT_PCT}%）"
                fi
                ;;
        esac
    else
        log warn "⚠️  跳过磁盘检查：无法读取挂载点 $BACKUP_MOUNT 的磁盘信息"
    fi
else
    log warn "⚠️  跳过磁盘检查：挂载点 $BACKUP_MOUNT 不存在（请在 backup.env 或环境变量设置 BACKUP_DISK_MOUNT）"
fi

# ---------- 异常时主动告警（可选） ----------
if [ "$HEALTHY" -eq 0 ] && [ -n "$ALERT_WEBHOOK" ]; then
    log info "📨 正在推送告警 -> ${ALERT_WEBHOOK:0:20}...（token 已隐去）"
    ALERT_CONTENT="PostgreSQL 备份异常（主机: ${HOSTNAME}）\n${ALERT_MSG}"
    RESP="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ALERT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"${ALERT_CONTENT}\"}}")"
    if [ "$RESP" = "200" ]; then
        log info "✅ 告警推送成功（HTTP $RESP）"
    else
        log warn "⚠️  告警推送异常（HTTP $RESP，Webhook 不可达或机器人拒绝）"
    fi
elif [ "$HEALTHY" -eq 0 ]; then
    log info "ℹ️  检测到异常，但未配置 ALERT_WEBHOOK，仅打印不推送"
fi

log info "=========================================="
if [ "$HEALTHY" -eq 1 ]; then
    log info "结论: 健康"
    exit 0
else
    log error "结论: 异常，请处理"
    exit 1
fi
