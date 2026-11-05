#!/bin/bash

# ==========================================
# PostgreSQL 备份体系自动安装脚本
# 部署: 运行在"备份端"机器上（与 pg_backup.sh / pg_backup_status.sh 同机）
# 功能: 一键完成以下安装步骤（均幂等，可重复执行）
#   1. 环境自检（root 权限 / 网络 / backup.env）
#   2. 自动安装依赖命令（ssh / scp / pg_restore）
#   3. 检查主服务器 SSH 是否可达（否则提示先配置）
#   4. 从 backup.env.example 生成 backup.env（缺什么问什么）
#   5. 安装日志轮转（logrotate）
#   6. 安装定时任务（每日备份 + 每日健康巡检）
#   7. 执行 preflight 部署自检，给出最终结论
# 用法: sudo bash deploy/backup/postgres/install.sh
# 退出码: 0=安装成功, 1=安装失败
# ==========================================

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/backup.env"
ENV_EXAMPLE="${SCRIPT_DIR}/backup.env.example"
LOGROTATE_SRC="${SCRIPT_DIR}/pg_backup.logrotate"
LOGROTATE_DST="/etc/logrotate.d/pg-backup"

# 定时任务安装标签（与 Makefile 保持一致，便于 preflight 识别）
CRON_TAG_BACKUP="#PG_BACKUP"
CRON_TAG_HEALTH="#PG_BACKUP_HEALTH"

# cron 环境变量（与 Makefile 一致，修复 cron 与手动 shell 环境差异）
CRON_HOME="${CRON_HOME:-/root}"
CRON_PATH="/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin"
PG_BACKUP_LOG_DIR="${PG_BACKUP_LOG_DIR:-/var/log/pg-backup}"
# 定时时间读取优先级：环境变量 > backup.env > 默认值
if [ -z "${CRON_SCHEDULE_BACKUP:-}" ] && [ -f "$ENV_FILE" ]; then
    CRON_SCHEDULE_BACKUP="$(grep -E '^CRON_SCHEDULE_BACKUP=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [ -z "${CRON_SCHEDULE_HEALTH:-}" ] && [ -f "$ENV_FILE" ]; then
    CRON_SCHEDULE_HEALTH="$(grep -E '^CRON_SCHEDULE_HEALTH=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
CRON_SCHEDULE_BACKUP="${CRON_SCHEDULE_BACKUP:-0 3 * * *}"
CRON_SCHEDULE_HEALTH="${CRON_SCHEDULE_HEALTH:-0 9 * * *}"

# ---------- 颜色输出（非 TTY 时自动关闭） ----------
if [ -t 1 ]; then
    C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_WARN=$'\033[33m'
    C_INFO=$'\033[36m'; C_RST=$'\033[0m'
else
    C_OK=""; C_ERR=""; C_WARN=""; C_INFO=""; C_RST=""
fi

ok()   { echo "${C_OK}  ✅ $*${C_RST}"; }
err()  { echo "${C_ERR}  ❌ $*${C_RST}"; }
warn() { echo "${C_WARN}  ⚠️  $*${C_RST}"; }
info() { echo "${C_INFO}  ℹ️  $*${C_RST}"; }
hdr()  { echo ""; echo "${C_INFO}========== $* ==========${C_RST}"; }

have_cmd() { command -v "$1" >/dev/null 2>&1; }

# 记录安装是否全部成功（任一关键步骤失败置 1）
FAILED=0

fail() {
    err "$*"
    FAILED=1
}

echo ""
echo "${C_INFO}=========================================="
echo "  PostgreSQL 备份体系自动安装"
echo "==========================================${C_RST}"
echo "脚本目录: ${SCRIPT_DIR}"
echo ""

# ==========================================
# Step 0: root 权限检查（写 /etc/logrotate.d、crontab、安装依赖均需 root）
# ==========================================
hdr "Step 0: 权限检查"
if [ "$(id -u)" -ne 0 ]; then
    err "请使用 root 或 sudo 执行本脚本（需安装依赖、写 /etc/logrotate.d 与 crontab）"
    exit 1
fi
ok "当前以 root 身份执行"

# ==========================================
# Step 1: 依赖命令检查（仅检查，缺啥提示手动安装）
# ==========================================
hdr "Step 1: 依赖命令检查"

# ssh（PostgreSQL 备份核心依赖）
if have_cmd ssh; then
    ok "已安装 ssh: $(ssh -V 2>&1 | head -1)"
else
    fail "未安装 ssh 客户端（PostgreSQL 备份核心依赖），请手动安装："
    info "  Debian/Ubuntu: apt-get install -y openssh-client"
    info "  CentOS/RHEL:   yum install -y openssh-clients"
fi

# scp（恢复时上传 dump 文件用）
if have_cmd scp; then
    ok "已安装 scp"
else
    warn "未安装 scp（恢复功能需要，如需请手动安装 openssh-client/openssh-clients）"
fi

# pg_restore（本地 dump 深度校验用）
if have_cmd pg_restore; then
    ok "已安装 pg_restore（用于 dump 深度校验）"
else
    warn "本地未安装 pg_restore（将跳过深度校验，仅做大小校验；如需可安装 postgresql-client）"
fi

# logrotate（日志轮转用）
if have_cmd logrotate; then
    ok "已安装 logrotate"
else
    warn "未安装 logrotate（如无需日志轮转可忽略，否则请手动安装）"
fi

# ==========================================
# Step 2: 检查主服务器 SSH（生产端）
# ==========================================
hdr "Step 2: 主服务器 SSH 检查"
# 从 backup.env 读取 PG_SSH_HOST（若已存在），否则跳过（Step 3 生成后由 preflight 统一校验）
if [ ! -f "$ENV_FILE" ]; then
    info "未找到 backup.env，跳过 SSH 连通性检查（生成配置后由 preflight 统一校验）"
elif ! grep -qE '^PG_SSH_HOST=' "$ENV_FILE" 2>/dev/null; then
    info "backup.env 未配置 PG_SSH_HOST，跳过 SSH 连通性检查（由 preflight 统一校验）"
else
    SSH_HOST="$(grep -E '^PG_SSH_HOST=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    SSH_PORT="$(grep -E '^PG_SSH_PORT=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    SSH_USER="$(grep -E '^PG_SSH_USER=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    SSH_KEY="$(grep -E '^PG_SSH_KEY=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    SSH_PORT="${SSH_PORT:-22}"
    SSH_USER="${SSH_USER:-root}"
    info "主服务器: ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
    if [ -n "$SSH_HOST" ] && have_cmd ssh; then
        if ssh -p "$SSH_PORT" ${SSH_KEY:+-i "$SSH_KEY"} \
            -o BatchMode=yes \
            -o ConnectTimeout=8 \
            -o StrictHostKeyChecking=accept-new \
            -o ServerAliveInterval=3 \
            -o ServerAliveCountMax=2 \
            "${SSH_USER}@${SSH_HOST}" "echo ok" >/dev/null 2>&1; then
            ok "主服务器 SSH 可达: ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
        else
            fail "主服务器 SSH 不可达: ${SSH_USER}@${SSH_HOST}:${SSH_PORT}（请确认地址、密钥与 known_hosts 配置）"
        fi
    else
        info "未安装 ssh 或未配置 PG_SSH_HOST，跳过 SSH 连通性检查（由 preflight 统一校验）"
    fi
fi

# ==========================================
# Step 3: 生成 backup.env
# ==========================================
hdr "Step 3: 配置文件 backup.env"
if [ -f "$ENV_FILE" ]; then
    ok "已存在 backup.env（保留现有配置，不覆盖）"
else
    if [ ! -f "$ENV_EXAMPLE" ]; then
        fail "缺少模板文件 ${ENV_EXAMPLE}，无法生成 backup.env"
    else
        info "未找到 backup.env，从备份模板生成..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        chmod 600 "$ENV_FILE"
        ok "已生成 backup.env（权限 600）"
        warn "请编辑 ${ENV_FILE} 填入真实凭证后再继续，或稍后执行 preflight 检查"
    fi
fi

# 交互式询问是否立即编辑
if [ -f "$ENV_FILE" ]; then
    if grep -qE 'CHANGE_ME|YOUR_' "$ENV_FILE" 2>/dev/null; then
        warn "backup.env 仍含占位符（CHANGE_ME / YOUR_），凭证尚未配置"
        read -r -p "是否现在用 vi 编辑 backup.env？（y/N）" edit_now </dev/tty || edit_now="n"
        if [ "${edit_now:-n}" = "y" ] || [ "${edit_now:-n}" = "Y" ]; then
            ${EDITOR:-vi} "$ENV_FILE"
        else
            info "跳过编辑，请稍后手动修改 ${ENV_FILE}"
        fi
    else
        ok "backup.env 已配置（未检测到占位符）"
    fi
fi

# 展示当前配置值（敏感信息脱敏）
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    hdr "当前配置概览"
    # 定义展示项：变量名 + 用途说明
    print_var() {
        local var="$1" desc="$2" val
        val="$(eval echo "\${${var}:-}")"
        if [ -z "$val" ]; then
            warn "[${var}] 未配置（${desc}）"
            return
        fi
        case "$var" in
            *KEY*|*SECRET*|*PASSWORD*|*TOKEN*|*PASSWD*)
                if [ "${#val}" -gt 8 ]; then val="${val:0:3}...${val: -3}"; else val="***"; fi
                ;;
        esac
        ok "[${var}] ${desc}: ${val}"
    }
    print_var PG_CONTAINER_NAME "主服务器 PG 容器名"
    print_var PG_DB_NAME       "业务库名"
    print_var PG_SSH_HOST      "主服务器地址"
    print_var PG_SSH_USER      "SSH 登录用户"
    print_var PG_SSH_KEY       "SSH 私钥路径"
    print_var PG_BACKUP_ROOT   "备份端本地备份根目录"
fi

# ==========================================
# Step 4: 日志轮转（logrotate）检查（仅提示，需手动安装配置）
# ==========================================
hdr "Step 4: 日志轮转（logrotate）检查"
if have_cmd logrotate; then
    if [ -f "$LOGROTATE_DST" ]; then
        ok "日志轮转配置已存在: ${LOGROTATE_DST}"
    else
        warn "日志轮转配置尚未安装，请手动执行："
        info "  cp ${LOGROTATE_SRC} ${LOGROTATE_DST}"
        info "  测试: logrotate -d ${LOGROTATE_DST}"
    fi
else
    warn "未安装 logrotate，如需日志轮转请手动安装后，再按下方提示安装配置"
    info "  cp ${LOGROTATE_SRC} ${LOGROTATE_DST}"
fi

# ==========================================
# Step 5: 安装定时任务（每日备份 + 每日健康巡检）
# ==========================================
hdr "Step 5: 定时任务安装"
if ! have_cmd crontab; then
    warn "未安装 crontab，跳过定时任务安装"
elif [ ! -f "$ENV_FILE" ]; then
    err "缺少 backup.env，跳过定时任务安装"
else
    mkdir -p "$PG_BACKUP_LOG_DIR" 2>/dev/null || true

    BACKUP_SCRIPT="${SCRIPT_DIR}/pg_backup.sh"
    STATUS_SCRIPT="${SCRIPT_DIR}/pg_backup_status.sh"
    chmod +x "$BACKUP_SCRIPT" "$STATUS_SCRIPT"

    CRON_JOB_BACKUP="${CRON_SCHEDULE_BACKUP} HOME=${CRON_HOME} PATH=${CRON_PATH} ${BACKUP_SCRIPT} >/dev/null 2> >(sed 's/^/[$(date +%Y-%m-%d\ %H:%M:%S)][cron] /' >>${PG_BACKUP_LOG_DIR}/pg_backup.log) ${CRON_TAG_BACKUP}"
    CRON_JOB_HEALTH="${CRON_SCHEDULE_HEALTH} HOME=${CRON_HOME} PATH=${CRON_PATH} ${STATUS_SCRIPT} >/dev/null 2> >(sed 's/^/[$(date +%Y-%m-%d\ %H:%M:%S)][cron] /' >>${PG_BACKUP_LOG_DIR}/pg_backup.log) ${CRON_TAG_HEALTH}"

    # 幂等写入：先剔除旧标签再追加
    (crontab -l 2>/dev/null | grep -v "${CRON_TAG_BACKUP}" | grep -v "${CRON_TAG_HEALTH}"; \
        printf '%s\n' "$CRON_JOB_BACKUP"; \
        printf '%s\n' "$CRON_JOB_HEALTH") | crontab -
    ok "备份定时任务已安装: ${CRON_SCHEDULE_BACKUP}（每日 3:00）"
    ok "健康巡检定时任务已安装: ${CRON_SCHEDULE_HEALTH}（每日 9:00）"
fi

# ==========================================
# Step 6: preflight 部署自检
# ==========================================
hdr "Step 6: 部署自检（preflight）"
PREFLIGHT="${SCRIPT_DIR}/../preflight_check.sh"
if [ -f "$PREFLIGHT" ]; then
    info "执行部署自检（只读，不执行备份/恢复）..."
    echo ""
    bash "$PREFLIGHT" pg
    PF_RC=$?
    echo ""
    case "$PF_RC" in
        0) ok "自检全部通过，备份体系已就绪" ;;
        2) warn "自检存在警告（多为尚未首次备份/凭证未配），按提示补齐" ;;
        *) fail "自检发现错误，请修复后重跑本脚本" ;;
    esac
else
    warn "未找到 preflight_check.sh（${PREFLIGHT}），跳过自检"
fi

# ==========================================
# 汇总
# ==========================================
hdr "安装结果汇总"
if [ "$FAILED" -eq 0 ]; then
    echo "${C_OK}PostgreSQL 备份体系安装完成 ✅${C_RST}"
    echo ""
    echo "后续操作："
    echo "  1. 确认 ${ENV_FILE} 已填写真实凭证"
    echo "  2. 手动验证一次备份: make pg-backup"
    echo "  3. 查看定时任务:      make pg-backup-cron-status"
    echo "  4. 查看健康度:        make pg-backup-health"
    echo "  5. 实时查看日志:      make pg-backup-logs"
    exit 0
else
    echo "${C_ERR}安装过程存在失败项，请根据上方 ❌ 提示修复后重跑本脚本${C_RST}"
    exit 1
fi
