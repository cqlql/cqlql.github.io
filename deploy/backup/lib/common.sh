#!/bin/bash

# ==========================================
# preflight 公共工具库（被 preflight_check.sh 与各 preflight_*.sh source）
# 职责: 颜色输出、日志函数、env 加载、命令检测、必填项校验、状态计数
# 说明: 本文件不直接执行，仅定义函数与全局状态，供调用方 source
# ==========================================

# ---------- 全局状态统计 ----------
# 说明: 用 ${VAR:-0} 兜底，避免被重复 source 时覆盖已累计的计数
ERRORS=${ERRORS:-0}
WARNS=${WARNS:-0}

# 颜色输出（非 TTY 时自动关闭）
if [ -z "${C_OK:-}" ]; then
    if [ -t 1 ]; then
        C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_WARN=$'\033[33m'
        C_INFO=$'\033[36m'; C_DIM=$'\033[90m'; C_RST=$'\033[0m'
    else
        C_OK=""; C_ERR=""; C_WARN=""; C_INFO=""; C_DIM=""; C_RST=""
    fi
fi

ok()   { echo "${C_OK}  ✅ $*${C_RST}"; }
err()  { echo "${C_ERR}  ❌ $*${C_RST}"; ERRORS=$((ERRORS+1)); }
warn() { echo "${C_WARN}  ⚠️  $*${C_RST}"; WARNS=$((WARNS+1)); }
info() { echo "${C_INFO}  ℹ️  $*${C_RST}"; }
hdr()  { echo ""; echo "${C_INFO}========== $* ==========${C_RST}"; }

# 加载 env 文件（若存在），失败不致命
load_env() {
    local f="$1"
    if [ -f "$f" ]; then
        # shellcheck disable=SC1090
        source "$f"
    fi
}

# 检查命令是否存在
have_cmd() { command -v "$1" >/dev/null 2>&1; }

# 检查 env 必填项：$1=env文件 $2=变量名 $3=用途说明
check_required_var() {
    local f="$1" var="$2" desc="$3" val
    val="$(eval echo "\${${var}:-}")"
    if [ -z "$val" ]; then
        err "[${var}] 未配置（${desc}）— 请在 $(basename "$f") 中填写"
        return 1
    fi
    # 🔴 凭证一律不回显：前 3 后 3 也是泄漏，preflight / install 的输出会进任务日志。
    #    与 preflight_minio.sh 的弱凭证告警统一口径（2026-11-10，backup-once.md §8.2）。
    #   `${val}` 只用于上面的空值判定，绝不拼进任何输出。
    case "$var" in
        *KEY*|*SECRET*|*PASSWORD*|*TOKEN*|*PASSWD*) val="***" ;;
    esac
    ok "[${var}] 已配置（${desc}）: ${val}"
    return 0
}

# 检查日志目录：可写性 + 大小统计（日志无限增长会写满磁盘导致备份失败）
# 参数: $1=日志目录路径
check_log_dir() {
    local log_dir="$1"
    if [ -d "$log_dir" ]; then
        local log_size_kb log_size_h
        log_size_kb="$(du -sk "$log_dir" 2>/dev/null | awk '{print $1}')"
        log_size_h="$(du -sh "$log_dir" 2>/dev/null | awk '{print $1}')"
        if [ -w "$log_dir" ]; then
            ok "日志目录可写: $log_dir（当前大小 ${log_size_h:-${log_size_kb}K}）"
        else
            err "日志目录不可写: $log_dir"
        fi
        if [ -n "$log_size_kb" ]; then
            if [ "$log_size_kb" -gt 1048576 ]; then   # > 1GB
                warn "日志目录已超过 1GB（${log_size_h}），请确认 logrotate 轮转是否生效，避免写满磁盘"
            elif [ "$log_size_kb" -gt 104857 ]; then   # > 100MB
                info "日志目录已超过 100MB（${log_size_h}），请留意增长趋势"
            fi
        fi
    else
        warn "日志目录不存在: $log_dir（脚本会自动创建，但需 root 权限）"
    fi
}

# 检查「上次成功备份」心跳文件是否新鲜
# 参数: $1=日志目录 $2=备份命令提示（如 make pg-backup / make minio-backup）
check_last_success() {
    local log_dir="$1" cmd_hint="$2"
    if [ -f "$log_dir/last_success.txt" ]; then
        local last; last="$(cat "$log_dir/last_success.txt")"
        info "上次成功备份时间: $last"
    else
        warn "尚未成功备份过（无 $log_dir/last_success.txt）— 建议手动跑一次 $cmd_hint 验证"
    fi
}

# 汇总体检结果并输出结论（依据 ERRORS / WARNS 决定退出码）
summary() {
    echo ""
    echo "=========================================="
    if [ "$ERRORS" -eq 0 ] && [ "$WARNS" -eq 0 ]; then
        echo "${C_OK}体检结论: 全部通过 ✅${C_RST}"
        echo "备份体系已就绪，可正常使用。"
        exit 0
    elif [ "$ERRORS" -eq 0 ]; then
        echo "${C_WARN}体检结论: 通过，但有 ${WARNS} 项警告 ⚠️${C_RST}"
        echo "警告项多为「尚未首次备份/未装定时任务」，可按提示补齐。"
        exit 2
    else
        echo "${C_ERR}体检结论: 存在 ${ERRORS} 项错误、${WARNS} 项警告 ❌${C_RST}"
        echo "请优先修复 ❌ 项后再执行备份。"
        exit 1
    fi
}
