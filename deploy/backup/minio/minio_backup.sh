#!/bin/bash

# ==========================================
# MinIO 自动化增量备份脚本（凭证外置）
# 部署: 运行在"备份端"机器上（与 minio_backup_status.sh 同机）
# 功能: 由备份端主动从生产端(源) MinIO 拉取多个桶，增量同步到本机备份 MinIO
# ==========================================

set -euo pipefail

# ---------- 环境兜底（Crontab 与手动 shell 环境差异修复）----------
# Crontab 默认 PATH 极简（通常仅 /usr/bin:/bin），导致 mc/nc 等命令找不到；
# 此处补全常用路径，确保脚本在 cron 下也能定位到 mc。
export PATH="/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin:$PATH"
# Crontab 的 HOME 可能与手动执行时不同，导致 mc alias 配置（~/.mc/config.json）不一致。
# 优先使用外部显式传入的 HOME（由 Makefile 注入 CRON_HOME），否则回退到当前用户目录，
# 确保 mc 始终复用同一份 alias 配置。
if [ -z "${HOME:-}" ] || [ ! -d "$HOME" ]; then
    # 通过用户信息反推 home 目录（兼容 HOME 为空或指向不存在目录的场景）
    REAL_HOME="$(getent passwd "$(id -un)" | cut -d: -f6 2>/dev/null || true)"
    if [ -n "$REAL_HOME" ] && [ -d "$REAL_HOME" ]; then
        export HOME="$REAL_HOME"
    fi
fi

# 获取当前脚本所在目录（Crontab 执行时不依赖 cwd）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载环境变量文件（生产环境建议放在 /etc/passup/backup.env）
ENV_FILE="${SCRIPT_DIR}/backup.env"
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
else
    echo "错误: 未找到配置文件 $ENV_FILE"
    echo "请先根据 backup.env.example 创建 backup.env 并填入真实凭证"
    exit 1
fi

# ---------- 别名与日志 ----------
# 所有日志（备份 + 巡检 + Cron）统一写入 minio_backup.log，便于集中排查
SRC_ALIAS="prod-minio"
DEST_ALIAS="backup-minio"
LOG_DIR="${BACKUP_LOG_DIR:-/var/log/minio-backup}"
LOG_FILE="${LOG_DIR}/minio_backup.log"
# 与 pg_backup.sh 同款防并发锁：cron（每天 2:00）与手动触发共用这一把，
# 否则会两条 mc mirror --overwrite 同时写同一批对象（见 docs/backup-once.md §4.1）。
LOCK_FILE="${LOG_DIR}/minio_backup.lock"
mkdir -p "$LOG_DIR"

# ---------- 日志函数 ----------
# 统一格式：每行以 [YYYY-MM-DD HH:MM:SS][backup] 前缀开头，同时写终端与日志文件。
# [backup] 为来源标识，用于区分同一 minio_backup.log 中不同脚本（备份/巡检）产出的日志。
# 结构化字段采用 logfmt 风格 key=value，便于 Promtail/Loki 直接解析为标签与字段，
# 无需额外正则。level 取值：info / warn / error。
# 用法：
#   log info "普通信息"
#   log_kv error "无法连接源端 MinIO" src_host=172.16.0.217 src_port=9000
# 脚本负责落盘（tee），调用方（Cron / Makefile）不再追加重定向，避免日志重复。
log() {
    local level="$1"; shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')][backup] level=$level $*" | tee -a "$LOG_FILE"
}
# 带结构化 key=value 字段的日志：log_kv <level> <msg> [key=value ...]
log_kv() {
    local level="$1"; shift
    local msg="$1"; shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')][backup] level=$level msg=\"$msg\" $*" | tee -a "$LOG_FILE"
}

# ---------- 防并发控制 (flock) ----------
# 🔴 锁加在脚本内部：定时任务和 ops backup once 都走这里，crontab 行不用改。
#    拿不到锁就如实退出 1，本次没有执行 mirror、没有写心跳；调用方不得自动重试。
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    log warn "上一次备份任务仍在运行中，本次执行取消。"
    exit 1
fi

log info "=========================================="
log info "开始执行 MinIO 异地备份（备份端拉取模式）..."

# ---------- Step 1: 检查源端（生产端）网络连通性 ----------
# 脚本运行在备份端本机，真正需要确认可达的是源端生产 MinIO。
# 从 SRC_URL 中自动解析出主机（IP/域名）与端口
SRC_HOST="${SRC_URL#*://}"   # 去掉 scheme，如 "172.16.0.222:8007" 或 "host/path"
SRC_HOST="${SRC_HOST%%/*}"   # 去掉路径部分
# 仅当 host 部分显式含 ":" 时才解析端口，否则按 scheme 取默认端口
case "$SRC_HOST" in
    *:*) SRC_PORT="${SRC_HOST##*:}"; SRC_HOST="${SRC_HOST%:*}";;
    *)   SRC_HOST="$SRC_HOST"; SRC_PORT="";;
esac
SRC_PORT="${SRC_PORT:-}"
# 未显式给出端口时，按协议取默认端口
if [ -z "$SRC_PORT" ]; then
    case "$SRC_URL" in
        https://*) SRC_PORT=443;;
        http://*)  SRC_PORT=80;;
        *)         SRC_PORT=9000;;
    esac
fi

if [ -n "${SRC_HOST:-}" ]; then
    if command -v nc &> /dev/null; then
        if ! nc -z -w 3 "$SRC_HOST" "$SRC_PORT" > /dev/null 2>&1; then
            log_kv error "无法连接到源端生产服务器，备份中断" src_host="$SRC_HOST" src_port="$SRC_PORT"
            exit 1
        fi
    else
        log warn "nc 命令不可用，跳过网络连通性检查"
    fi
fi

# ---------- Step 2: 初始化 mc 别名配置 ----------
log info "初始化 mc 别名配置..."
if ! mc alias set $SRC_ALIAS  $SRC_URL  $SRC_KEY  $SRC_SECRET >/dev/null 2>&1; then
    log_kv error "无法连接源端 MinIO，请检查 SRC_URL/SRC_KEY/SRC_SECRET" src_host="$SRC_HOST" src_port="$SRC_PORT" src_url="$SRC_URL" event=src_minio_connect_failed
    exit 1
fi
if ! mc alias set $DEST_ALIAS $DEST_URL $DEST_KEY $DEST_SECRET >/dev/null 2>&1; then
    log_kv error "无法连接备份端 MinIO，请检查 DEST_URL/DEST_KEY/DEST_SECRET" dest_url="$DEST_URL" event=dest_minio_connect_failed
    exit 1
fi
log info "mc 别名初始化成功"

# ---------- Step 3: 对每个桶执行增量同步（拉取：源端 -> 本机备份端） ----------
# 用于捕获 mc 输出（stdout 文件明细/统计表格 + stderr）的临时文件
MC_OUT_FILE="$(mktemp)"
trap 'rm -f "$MC_OUT_FILE"' EXIT

FAILED_BUCKETS=""
for BUCKET in $SRC_BUCKETS; do
    DEST_BUCKET="${DEST_BUCKET_PREFIX}${BUCKET}"
    log_kv info "正在拉取桶" bucket="$BUCKET" src="$SRC_ALIAS/$BUCKET" dest="$DEST_ALIAS/$DEST_BUCKET"

    # 校验源端桶是否存在（不存在则跳过并给出明确原因）
    if ! mc ls "${SRC_ALIAS}/${BUCKET}" > /dev/null 2>&1; then
        log_kv error "源端桶不存在，视为备份失败，请检查 SRC_BUCKETS 配置或源端桶名" bucket="$BUCKET" src="$SRC_ALIAS/$BUCKET"
        FAILED_BUCKETS="${FAILED_BUCKETS} ${BUCKET}"
        continue
    fi

    # 确保备份端桶存在（不存在则创建）
    if ! mc ls "${DEST_ALIAS}/${DEST_BUCKET}" &> /dev/null; then
        log_kv info "备份端桶不存在，正在创建" bucket="$DEST_BUCKET"
        if ! mc mb "${DEST_ALIAS}/${DEST_BUCKET}" > /dev/null 2>"$MC_OUT_FILE"; then
            log_kv error "创建备份端桶失败" bucket="$DEST_BUCKET" detail="$(cat "$MC_OUT_FILE")"
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

    # 同步：stdout 捕获 mc 输出（文件明细 + 传输统计表格）。mc 在部分场景会把表格同时写到
    # stdout 与 stderr，因此这里把两路合并后按“首次出现”去重，再逐行加前缀写入统一日志。
    if mc "${MIRROR_ARGS[@]}" >"$MC_OUT_FILE" 2>>"$MC_OUT_FILE"; then
        while IFS= read -r line; do
            [ -n "$line" ] && log info "  ${line}"
        done < <(awk '!seen[$0]++' "$MC_OUT_FILE")
        log_kv info "桶同步成功" bucket="$BUCKET"
    else
        log_kv error "桶同步失败" bucket="$BUCKET" detail="$(tail -n 5 "$MC_OUT_FILE")"
        FAILED_BUCKETS="${FAILED_BUCKETS} ${BUCKET}"
    fi
done

# ---------- Step 4: 汇总结果 ----------
if [ -z "$FAILED_BUCKETS" ]; then
    log info "所有桶备份成功完成"
    # 成功完成后写心跳文件（供 minio_backup_status.sh 巡检读取）
    # 仅在所有桶成功后更新，失败分支不更新，last_success.txt 永远只代表"最后一次成功"
    echo "$(date '+%Y-%m-%d %H:%M:%S')" > "$LOG_DIR/last_success.txt"
    exit 0
else
    log_kv error "部分桶备份失败" failed_buckets="$(echo "$FAILED_BUCKETS" | xargs)"
    exit 1
fi
