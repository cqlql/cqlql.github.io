#!/bin/bash

# ==========================================
# PostgreSQL 自动化备份脚本（凭证外置 - 增强版）
# 部署: 运行在"备份端"机器上，通过 SSH 主动从主服务器（生产端）拉取数据库 dump（pull 模式）
# 功能: 全局对象(角色/权限) + 业务库 dump + 完整性校验 + 分级目录 + 本地清理 + 心跳
# 分级: 每月 1 号 -> monthly/，每周一 -> weekly/，其余 -> daily/
# 说明: dump 由主服务器上容器内的 pg_dump/pg_dumpall 生成，经 SSH 直接流式拉到备份端落盘，
#       数据不在主服务器上落盘，真正实现"从主服务器 pull"。
# 增强: flock 防并发、先写 .tmp 后原子转正、pg_restore 深度校验、weekly/monthly 分级保留。
# ==========================================

set -euo pipefail

# ---------- 环境兜底（Crontab 与手动 shell 环境差异修复）----------
# Crontab 默认 PATH 极简（通常仅 /usr/bin:/bin），导致 ssh/scp/pg_restore 等命令找不到；
# 此处补全常用路径，确保脚本在 cron 下也能定位到这些命令。
export PATH="/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin:$PATH"
# Crontab 的 HOME 可能与手动执行时不同，导致 ~/.ssh 私钥路径（免密登录主服务器）不一致。
# 优先使用外部显式传入的 HOME（由 Makefile 注入 CRON_HOME），否则回退到当前用户目录，
# 确保 ssh 始终复用同一份私钥与 known_hosts 配置。
if [ -z "${HOME:-}" ] || [ ! -d "$HOME" ]; then
    # 通过用户信息反推 home 目录（兼容 HOME 为空或指向不存在目录的场景）
    REAL_HOME="$(getent passwd "$(id -un)" | cut -d: -f6 2>/dev/null || true)"
    if [ -n "$REAL_HOME" ] && [ -d "$REAL_HOME" ]; then
        export HOME="$REAL_HOME"
    fi
fi

# 获取当前脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载环境变量文件
ENV_FILE="${SCRIPT_DIR}/backup.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1091
    source "$ENV_FILE"
else
    echo "错误: 未找到配置文件 $ENV_FILE"
    exit 1
fi

# ---------- 配置（带默认值兜底） ----------
CONTAINER_NAME="${PG_CONTAINER_NAME:-postgres}"
DB_USER="${PG_DB_USER:-postgres}"
DB_NAME="${PG_DB_NAME:-pass_up}"
BACKUP_ROOT="${PG_BACKUP_ROOT:-/data/backups/postgres}"

# 保留天数配置
LOCAL_RETENTION_DAILY="${PG_LOCAL_RETENTION_DAYS:-7}"
LOCAL_RETENTION_WEEKLY="${PG_WEEKLY_RETENTION_DAYS:-30}"      # 新增：周备份保留 30 天
LOCAL_RETENTION_MONTHLY="${PG_MONTHLY_RETENTION_DAYS:-365}"   # 新增：月备份保留 365 天

# SSH 连接参数
SSH_HOST="${PG_SSH_HOST:-}"
SSH_PORT="${PG_SSH_PORT:-22}"
SSH_USER="${PG_SSH_USER:-root}"
SSH_KEY="${PG_SSH_KEY:-}"
# 兜底默认与 backup.env.example、ops 自身 ssh 封装（internal/shared/remote.go）同口径：
# BatchMode 禁交互、10s 连接超时、accept-new 首次收录主机密钥（变化即拒绝）。
# 注意：BatchMode=yes 下不带 accept-new，cron 首次连一台没进 known_hosts 的主机必然失败；
# 也不要改成 StrictHostKeyChecking=no，那等于关掉主机密钥校验。
SSH_OPTS="${PG_SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new}"

# ---------- 日志 & 锁文件 ----------
# 所有日志（备份 + 巡检 + Cron）统一写入 pg_backup.log，便于集中排查
LOG_DIR="${PG_BACKUP_LOG_DIR:-/var/log/pg-backup}"
LOG_FILE="${LOG_DIR}/pg_backup.log"
LOCK_FILE="${LOG_DIR}/pg_backup.lock"
mkdir -p "$LOG_DIR"

# ---------- 日志函数 ----------
# 统一格式：每行以 [YYYY-MM-DD HH:MM:SS][backup] 前缀开头，同时写终端与日志文件。
# [backup] 为来源标识，用于区分同一 pg_backup.log 中不同脚本（备份/巡检）产出的日志。
# 结构化字段采用 logfmt 风格 key=value，便于 Promtail/Loki 直接解析为标签与字段，
# 无需额外正则。level 取值：info / warn / error。
# 用法：
#   log info "普通信息"
#   log_kv error "无法连接主服务器" src_host=172.16.0.213 src_port=22
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
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    log warn "上一次备份任务仍在运行中，本次执行取消。"
    exit 1
fi

log info "=========================================="
log info "开始执行 PostgreSQL 备份（备份端 pull 模式）..."

# ---------- Step 0: 前置校验 ----------
if [ -z "$SSH_HOST" ]; then
    log error "未配置 PG_SSH_HOST，请在 backup.env 中填写！"
    exit 1
fi

# 构造 ssh 基础命令
SSH_CMD=(ssh -p "$SSH_PORT")
# 未配置私钥时使用默认密钥（~/.ssh/id_rsa 等）
if [ -n "$SSH_KEY" ]; then
    SSH_CMD+=(-i "$SSH_KEY")
fi
# 拆解 SSH_OPTS 为数组（可追加额外选项，如 -o ServerAliveInterval=5；
# 默认的 accept-new 不要替换成 no）
# shellcheck disable=SC2206
SSH_OPTS_ARR=($SSH_OPTS)
SSH_CMD+=("${SSH_OPTS_ARR[@]}" "${SSH_USER}@${SSH_HOST}")

# 在远端执行一条完整命令（作为整体传给远端 shell，避免参数拼接导致引号丢失）
remote_exec() {
    "${SSH_CMD[@]}" "$1"
}

# 在远端容器内执行命令（docker exec）
remote_docker() {
    remote_exec "docker exec ${CONTAINER_NAME} $*"
}

# 连通性 & 容器就绪检查
log info "检查主服务器 ${SSH_USER}@${SSH_HOST}:${SSH_PORT} 连通性..."
if ! remote_exec "echo ok" > /dev/null 2>&1; then
    log_kv error "无法通过 SSH 连接主服务器" host="${SSH_HOST}" port="${SSH_PORT}"
    exit 1
fi

if ! remote_exec "docker ps --format '{{.Names}}'" | grep -qx "$CONTAINER_NAME"; then
    log_kv error "主服务器上的 PostgreSQL 容器未运行" container="$CONTAINER_NAME"
    exit 1
fi

# ---------- 分级目录判定（daily / weekly / monthly） ----------
DOW=$(date +%u)   # 1=周一
DOM=$(date +%d)   # 当月第几天

if [ "${DOM}" = "01" ]; then
    GRADE="monthly"
elif [ "${DOW}" = "1" ]; then
    GRADE="weekly"
else
    GRADE="daily"
fi

BACKUP_DIR="${BACKUP_ROOT}/${GRADE}"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.dump"
TMP_DUMP_FILE="${DUMP_FILE}.tmp"
GLOBALS_FILE="${BACKUP_DIR}/globals_${DATE}.sql"

# 退出时自动清理残留的临时文件
trap 'rm -f "$TMP_DUMP_FILE"' EXIT

# ---------- Step 1: 全局对象备份 ----------
log info "拉取全局对象（角色/权限）..."
if remote_docker pg_dumpall -U "$DB_USER" --globals-only > "$GLOBALS_FILE"; then
    sha256sum "$GLOBALS_FILE" > "$GLOBALS_FILE.sha256"
    log info "全局对象备份完成: $GLOBALS_FILE"
else
    log error "全局对象备份失败！"
    exit 1
fi

# ---------- Step 2: 业务库备份（先写入临时文件） ----------
log info "拉取业务库 ${DB_NAME} (格式: custom, 压缩级别: 9)..."

# 高并发场景可选：先做检查点减少恢复重放量（容器未就绪时容错）
remote_docker psql -U "$DB_USER" -d "$DB_NAME" -c "CHECKPOINT;" > /dev/null 2>&1 || true

# 导出（-F c 自定义格式，-Z 9 最高压缩，-b 包含大对象）
if remote_docker pg_dump \
    -U "$DB_USER" -d "$DB_NAME" -F c -Z 9 -b > "$TMP_DUMP_FILE"; then
    :
else
    log error "业务库 ${DB_NAME} 备份传输中断！"
    exit 1
fi

# ---------- Step 3: 多重完整性校验 ----------
if [ ! -s "$TMP_DUMP_FILE" ]; then
    log error "备份文件大小为 0！"
    exit 1
fi

# 深度校验：如果本地或容器有 pg_restore，尝试解析归档目录（TOC）
# 注意：本地 pg_restore 版本必须不低于服务端 pg_dump，否则归档格式版本不兼容
# （如服务端 PG 18 的 dump 头为 1.16，PG 16 的 pg_restore 会报 unsupported version），
# 会误判「文件损坏」。版本不足时跳过深度校验并告警，仍保留大小校验。
if command -v pg_restore >/dev/null 2>&1; then
    LOCAL_PG_MAJOR="$(pg_restore --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
    REMOTE_PG_VERSION="$(remote_docker pg_dump --version 2>/dev/null || true)"
    REMOTE_PG_MAJOR="$(printf '%s\n' "$REMOTE_PG_VERSION" | grep -oE '[0-9]+' | head -1 || true)"
    if [ -n "$LOCAL_PG_MAJOR" ] && [ -n "$REMOTE_PG_MAJOR" ] && [ "$LOCAL_PG_MAJOR" -lt "$REMOTE_PG_MAJOR" ]; then
        log warn "本地 pg_restore ${LOCAL_PG_MAJOR} 低于服务端 pg_dump ${REMOTE_PG_MAJOR}，跳过归档深度校验（已做大小校验）"
    elif ! pg_restore -l "$TMP_DUMP_FILE" > /dev/null 2>&1; then
        log error "Dump 文件损坏，未通过 pg_restore 归档结构校验！"
        exit 1
    else
        log info "已通过 pg_restore 格式结构深度校验"
    fi
fi

# 校验通过，原子转正文件
mv "$TMP_DUMP_FILE" "$DUMP_FILE"
sha256sum "$DUMP_FILE" > "$DUMP_FILE.sha256"

log info "备份成功: $DUMP_FILE (分级: ${GRADE})"

# ---------- Step 4: 全局分级清理 ----------
find "${BACKUP_ROOT}/daily" -type f -mtime +"${LOCAL_RETENTION_DAILY}" -delete 2>/dev/null || true
find "${BACKUP_ROOT}/weekly" -type f -mtime +"${LOCAL_RETENTION_WEEKLY}" -delete 2>/dev/null || true
find "${BACKUP_ROOT}/monthly" -type f -mtime +"${LOCAL_RETENTION_MONTHLY}" -delete 2>/dev/null || true

# ---------- Step 5: 成功心跳（供 pg_backup_status.sh 巡检读取） ----------
echo "$(date '+%Y-%m-%d %H:%M:%S')" > "$LOG_DIR/last_success.txt"

log info "备份任务顺利完成！"
exit 0
