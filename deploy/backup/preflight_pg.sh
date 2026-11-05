#!/bin/bash

# ==========================================
# PostgreSQL 备份体检（preflight 子模块）
# 由 preflight_check.sh 调度，亦可单独执行: bash deploy/backup/preflight_pg.sh
# 纯只读检查，不执行备份/恢复
# ==========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_DIR="${SCRIPT_DIR}/postgres"

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/common.sh"

check_pg() {
    hdr "PostgreSQL 备份体检"
    local ENV_FILE="${PG_DIR}/backup.env"
    local LOG_DIR

    # --- 1. 配置文件 ---
    if [ ! -f "$ENV_FILE" ]; then
        err "缺少 ${ENV_FILE}（请根据 backup.env.example 创建并填写）"
        return
    fi
    ok "找到配置文件 $(basename "$ENV_FILE")"
    load_env "$ENV_FILE"
    LOG_DIR="${PG_BACKUP_LOG_DIR:-/var/log/pg-backup}"

    # --- 2. 必填参数 ---
    check_required_var "$ENV_FILE" PG_CONTAINER_NAME "主服务器上 PG 容器名"
    check_required_var "$ENV_FILE" PG_DB_USER "数据库用户"
    check_required_var "$ENV_FILE" PG_DB_NAME "业务库名"
    check_required_var "$ENV_FILE" PG_SSH_HOST "主服务器地址"
    check_required_var "$ENV_FILE" PG_SSH_USER "SSH 登录用户"
    check_required_var "$ENV_FILE" PG_BACKUP_ROOT "备份端本地备份根目录"

    # --- 3. 备份根目录 ---
    if [ -d "${PG_BACKUP_ROOT:-}" ]; then
        local bk_size_h; bk_size_h="$(du -sh "${PG_BACKUP_ROOT}" 2>/dev/null | awk '{print $1}')"
        if [ -w "${PG_BACKUP_ROOT}" ]; then
            ok "备份根目录可写: ${PG_BACKUP_ROOT}（当前大小 ${bk_size_h:-?}）"
        else
            err "备份根目录不可写: ${PG_BACKUP_ROOT}（需 root 或当前用户有写权限）"
        fi
    else
        warn "备份根目录不存在: ${PG_BACKUP_ROOT:-<未配置>}（首次备份会自动创建，需有父目录写权限）"
    fi

    # --- 4. 日志目录 ---
    check_log_dir "$LOG_DIR"

    # --- 5. 依赖命令 ---
    have_cmd pg_restore && ok "本地已安装 pg_restore（用于 dump 深度校验）" \
        || warn "本地未安装 pg_restore（跳过深度校验，仅做大小校验）"
    have_cmd ssh && ok "已安装 ssh" || err "未安装 ssh（备份脚本依赖）"

    # --- 6. SSH 私钥 ---
    if [ -n "${PG_SSH_KEY:-}" ]; then
        if [ -f "$PG_SSH_KEY" ]; then
            local perm; perm="$(stat -c '%a' "$PG_SSH_KEY" 2>/dev/null)"
            ok "SSH 私钥存在: ${PG_SSH_KEY}（权限 ${perm}）"
            if [ "$perm" != "600" ] && [ "$perm" != "400" ]; then
                warn "SSH 私钥权限为 ${perm}，建议改为 600（ssh 可能因权限过宽拒绝）"
            fi
        else
            err "SSH 私钥不存在: ${PG_SSH_KEY}"
        fi
    else
        warn "未配置 PG_SSH_KEY（将使用默认 ~/.ssh/id_rsa 等）"
    fi

    # --- 7. SSH 连通性（只读探测，不执行备份） ---
    if [ -n "${PG_SSH_HOST:-}" ] && have_cmd ssh; then
        local port="${PG_SSH_PORT:-22}"
        if ssh -p "$port" ${PG_SSH_KEY:+-i "$PG_SSH_KEY"} \
            -o BatchMode=yes -o ConnectTimeout=8 \
            "${PG_SSH_USER}@${PG_SSH_HOST}" "echo ok" >/dev/null 2>&1; then
            ok "SSH 连通正常: ${PG_SSH_USER}@${PG_SSH_HOST}:${port}"
        else
            err "SSH 无法连通: ${PG_SSH_USER}@${PG_SSH_HOST}:${port}（检查 host/端口/密钥/known_hosts）"
        fi
    fi

    # --- 8. 定时任务 ---
    if have_cmd crontab && crontab -l 2>/dev/null | grep -q '#PG_BACKUP'; then
        ok "已安装 PG 备份定时任务"
    else
        warn "未安装 PG 备份定时任务（执行 make pg-backup-cron-install）"
    fi
    if have_cmd crontab && crontab -l 2>/dev/null | grep -q '#PG_BACKUP_HEALTH'; then
        ok "已安装 PG 健康巡检定时任务"
    else
        warn "未安装 PG 健康巡检定时任务（执行 make pg-backup-health-cron-install）"
    fi

    # --- 9. 是否成功备份过 ---
    check_last_success "$LOG_DIR" "make pg-backup"

    # --- 10. 备份文件数量 ---
    local cnt; cnt="$(find "${PG_BACKUP_ROOT:-/nonexistent}" -name '*.dump' -type f 2>/dev/null | wc -l)"
    if [ "$cnt" -gt 0 ]; then
        ok "已有 ${cnt} 份 .dump 备份文件"
    else
        warn "暂无 .dump 备份文件（首次备份后才会生成）"
    fi
}

# 允许单独执行（供调试/手动调用），被 source 时不触发
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    check_pg
    summary
fi
