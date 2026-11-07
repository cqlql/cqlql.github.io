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
        # 🔴 私钥路径不打印（AGENTS.md 硬约束 8）：日志会回流到界面任务输出。
        if [ -f "$PG_SSH_KEY" ]; then
            local perm; perm="$(stat -c '%a' "$PG_SSH_KEY" 2>/dev/null)"
            ok "SSH 私钥存在（权限 ${perm}，路径不回显）"
            if [ "$perm" != "600" ] && [ "$perm" != "400" ]; then
                warn "SSH 私钥权限为 ${perm}，建议改为 600（ssh 可能因权限过宽拒绝）"
            fi
        else
            err "SSH 私钥不存在（PG_SSH_KEY 指向的文件在备份端找不到，路径不回显）"
            info "PG_SSH_KEY 应填备份端私钥文件的绝对路径；不用显式私钥就把它清成空值，ssh 会用默认密钥"
        fi
    else
        warn "未配置 PG_SSH_KEY（将使用默认 ~/.ssh/id_rsa 等）"
    fi

    # --- 7. SSH 连通性（只读探测，不执行备份） ---
    # 🔴 必须与 pg_backup.sh / pg_restore.sh 用同一份 PG_SSH_OPTS（含默认兜底）。
    # BatchMode=yes 下不带 StrictHostKeyChecking=accept-new 时，首次连接一台没进
    # 「当前执行身份」known_hosts 的主机会直接失败：交互式 ssh 会问一次 yes 并记下
    # 主机密钥，批处理不会，于是出现「手工能连、自检说连不上」的假阴性。
    # 自检与 cron 现在都以清单 user 跑（同一份 HOME / known_hosts / 私钥），
    # 但 BatchMode=yes 仍不会问 yes：新主机要能自动收录、密钥变了要能拒绝，
    # 所以 accept-new 依旧不能省。身份模型见 docs/backup-scripts.md §4.1。
    # 另一条：不要把 ssh 的 stderr 直接丢进 /dev/null，否则失败只剩一句无从排查的
    # 「SSH 无法连通」。下面只回显归类后的原因，不回显原文（原文可能带私钥路径）。
    if [ -n "${PG_SSH_HOST:-}" ] && have_cmd ssh; then
        local port="${PG_SSH_PORT:-22}"
        local ssh_user="${PG_SSH_USER:-root}"
        local ssh_opts="${PG_SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new}"
        local -a ssh_opts_arr=() ssh_cmd=()
        # shellcheck disable=SC2206
        ssh_opts_arr=($ssh_opts)
        ssh_cmd=(ssh -p "$port")
        if [ -n "${PG_SSH_KEY:-}" ]; then
            ssh_cmd+=(-i "$PG_SSH_KEY")
        fi
        ssh_cmd+=("${ssh_opts_arr[@]}" "${ssh_user}@${PG_SSH_HOST}" "echo ok")

        local ssh_err="" ssh_rc=0 why
        # 2>&1 在前、>/dev/null 在后：只捕获 stderr，丢掉远端 echo ok 的 stdout
        ssh_err="$("${ssh_cmd[@]}" 2>&1 >/dev/null)" || ssh_rc=$?
        if [ "$ssh_rc" -eq 0 ]; then
            ok "SSH 连通正常: ${ssh_user}@${PG_SSH_HOST}:${port}（与定时任务同一身份）"
        else
            case "$ssh_err" in
                *"REMOTE HOST IDENTIFICATION HAS CHANGED"*|*"Host key verification failed"*)
                    why="主机密钥未收录或已变更（当前运行用户的 known_hosts；WSL/系统重装后 host key 会变）"
                    ;;
                *"Permission denied"*|*"Load key"*|*"invalid format"*|*"bad permissions"*)
                    why="认证失败或私钥不可用（确认 PG_SSH_KEY 对应公钥已在主服务器 authorized_keys，且私钥权限为 600）"
                    ;;
                *"Connection refused"*|*"No route to host"*|*"Network is unreachable"*)
                    why="从备份端访问该 host:port 被拒或不可路由（端口转发/防火墙可能只对运维机开放）"
                    ;;
                *"timed out"*|*"Operation timed out"*)
                    why="连接超时（检查备份端到主服务器的路由与防火墙）"
                    ;;
                *"Could not resolve hostname"*)
                    why="主机名无法解析"
                    ;;
                *)
                    why="ssh 退出码 ${ssh_rc}，原因未归类；请在备份端以相同身份手工复现"
                    ;;
            esac
            err "SSH 无法连通: ${ssh_user}@${PG_SSH_HOST}:${port} — ${why}"
            info "在备份端以同一运行身份复现：ssh -p <port> -i <私钥> -o BatchMode=yes -o StrictHostKeyChecking=accept-new <user>@<host> \"echo ok\""
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
