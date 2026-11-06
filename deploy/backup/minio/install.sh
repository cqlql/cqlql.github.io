#!/bin/bash

# ==========================================
# MinIO 备份体系自动安装脚本
# 部署: 运行在"备份端"机器上（与 minio_backup.sh / minio_backup_status.sh 同机）
# 功能: 一键完成以下安装步骤（均幂等，可重复执行）
#   1. 环境自检（安装期 root 权限 / 网络 / backup.env）
#   2. 检查依赖命令（curl / netcat / mc）
#   3. 检查备份端 MinIO 是否可用（否则提示先部署）
#   4. 从 backup.env.example 生成 backup.env（缺什么问什么）
#   5. 安装日志轮转（logrotate）+ 把日志目录属主交给运行用户
#   6. 安装定时任务到运行用户的 crontab，并清理旧 root crontab
#   7. 以运行用户身份执行 preflight 部署自检，给出最终结论
# 用法: BACKUP_RUN_USER=<运行用户> sudo bash deploy/backup/minio/install.sh
#       一般不用手工跑，由 ops backup deploy 调用（工具会显式传入运行用户）。
# 退出码: 0=安装成功, 1=安装失败
#
# 🔴 身份模型：本脚本经 sudo 以 root 执行（要写 /etc/logrotate.d、建系统级目录、
# 清理旧 crontab），但它「装出来的东西」一律归属非 root 的运行用户：
# crontab -u、日志目录 chown、preflight 降权。这样 cron 里的 minio_backup.sh
# 与界面自检用的是同一份 HOME / ~/.mc / 目录写权限。
# ==========================================

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/backup.env"
ENV_EXAMPLE="${SCRIPT_DIR}/backup.env.example"
LOGROTATE_SRC="${SCRIPT_DIR}/minio_backup.logrotate"
LOGROTATE_DST="/etc/logrotate.d/minio-backup"

# 定时任务安装标签（与 Makefile 保持一致，便于 preflight 识别）
CRON_TAG_BACKUP="#MINIO_BACKUP"
CRON_TAG_HEALTH="#MINIO_BACKUP_HEALTH"

# ---------- 运行身份（🔴 不允许是 root） ----------
# 工具通过 BACKUP_RUN_USER 显式传清单里的 ssh 登录用户；手工执行时退回 SUDO_USER。
# 这个人的 HOME 决定了 ~/.mc/config.json（mc alias）与 ~/.ssh，必须与 cron、自检是同一个。
RUN_USER="${BACKUP_RUN_USER:-${SUDO_USER:-$(id -un)}}"
if [ "$RUN_USER" = "root" ]; then
    echo "❌ 未指定备份运行用户：请用 BACKUP_RUN_USER=<user> 指定，或经 sudo 执行以带出 SUDO_USER。" >&2
    echo "   安装期允许 root，但备份任务不允许以 root 运行。" >&2
    exit 1
fi
if ! id "$RUN_USER" >/dev/null 2>&1; then
    echo "❌ 备份运行用户不存在：$RUN_USER" >&2
    exit 1
fi
RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
RUN_GROUP="$(id -gn "$RUN_USER")"
if [ -z "$RUN_HOME" ] || [ ! -d "$RUN_HOME" ]; then
    echo "❌ 取不到 $RUN_USER 的家目录" >&2
    exit 1
fi

# cron 环境变量（与 Makefile 一致，修复 cron 与手动 shell 环境差异）
# HOME 必须是运行用户的家目录，否则 cron 里的 mc 会去读 root 的 ~/.mc。
CRON_HOME="${CRON_HOME:-$RUN_HOME}"
CRON_PATH="/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin"
BACKUP_LOG_DIR="${BACKUP_LOG_DIR:-/var/log/minio-backup}"
# 定时时间读取优先级：环境变量 > backup.env > 默认值
if [ -z "${CRON_SCHEDULE_BACKUP:-}" ] && [ -f "$ENV_FILE" ]; then
    CRON_SCHEDULE_BACKUP="$(grep -E '^CRON_SCHEDULE_BACKUP=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [ -z "${CRON_SCHEDULE_HEALTH:-}" ] && [ -f "$ENV_FILE" ]; then
    CRON_SCHEDULE_HEALTH="$(grep -E '^CRON_SCHEDULE_HEALTH=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
CRON_SCHEDULE_BACKUP="${CRON_SCHEDULE_BACKUP:-0 2 * * *}"
CRON_SCHEDULE_HEALTH="${CRON_SCHEDULE_HEALTH:-0 8 * * *}"

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
echo "  MinIO 备份体系自动安装"
echo "==========================================${C_RST}"
echo "脚本目录: ${SCRIPT_DIR}"
echo ""

# ==========================================
# Step 0: root 权限检查（写 /etc/logrotate.d、crontab、安装依赖均需 root）
# ==========================================
hdr "Step 0: 权限检查"
if [ "$(id -u)" -ne 0 ]; then
    err "请经 sudo 以 root 执行本脚本（安装期要写 /etc/logrotate.d 与系统级目录）"
    exit 1
fi
ok "安装期以 root 身份执行；备份任务 / 自检的运行身份为 ${RUN_USER}（HOME=${RUN_HOME}）"

# ==========================================
# Step 1: 依赖命令检查（仅检查，缺啥提示手动安装）
# ==========================================
hdr "Step 1: 依赖命令检查"

# mc（MinIO 备份核心依赖）
if have_cmd mc; then
    ok "已安装 mc 客户端: $(mc --version 2>/dev/null | head -1)"
else
    fail "未安装 mc 客户端（MinIO 备份核心依赖），请手动安装："
    info "  参考 https://min.io/docs/minio/linux/reference/minio-mc.html"
    info "  快速安装: curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc && chmod +x /usr/local/bin/mc"
fi

# nc / netcat（网络连通性检查用）
if have_cmd nc || have_cmd netcat; then
    ok "已安装 nc/netcat"
else
    warn "未安装 nc，备份脚本将降级跳过源端连通性检查（如需可手动安装 netcat-openbsd）"
fi

# logrotate（日志轮转用）
if have_cmd logrotate; then
    ok "已安装 logrotate"
else
    warn "未安装 logrotate（如无需日志轮转可忽略，否则请手动安装）"
fi

# ==========================================
# Step 2: 检查备份端 MinIO（本机）
# ==========================================
hdr "Step 2: 备份端 MinIO 检查"
# 从 backup.env 读取 DEST_URL（若已存在），否则跳过（Step 3 生成后由 preflight 统一校验）
if [ ! -f "$ENV_FILE" ]; then
    info "未找到 backup.env，跳过 MinIO 连通性检查（生成配置后由 preflight 统一校验）"
elif ! grep -qE '^DEST_URL=' "$ENV_FILE" 2>/dev/null; then
    info "backup.env 未配置 DEST_URL，跳过 MinIO 连通性检查（由 preflight 统一校验）"
else
    DEST_URL="$(grep -E '^DEST_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    info "备份端 MinIO 地址: ${DEST_URL}"
    if [ -n "$DEST_URL" ] && have_cmd nc; then
        # 用 nc 做 TCP 端口探测（与 preflight 一致，不依赖 mc alias）
        dhost="${DEST_URL#*://}"; dhost="${dhost%%/*}"
        case "$dhost" in
            *:*) dport="${dhost##*:}"; dhost="${dhost%:*}";;
            *)   case "$DEST_URL" in https://*) dport=443;; http://*) dport=80;; *) dport=9000;; esac;;
        esac
        if nc -z -w 3 "$dhost" "$dport" >/dev/null 2>&1; then
            ok "备份端 MinIO 可达: ${dhost}:${dport}"
        else
            fail "备份端 MinIO 不可达: ${dhost}:${dport}（请确认 MinIO 已部署、地址与凭证正确）"
        fi
    else
        info "未安装 nc 或未配置 DEST_URL，跳过 MinIO 连通性检查（由 preflight 统一校验）"
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
    print_var SRC_URL     "生产端 MinIO 地址"
    print_var SRC_KEY     "生产端 Access Key"
    print_var SRC_SECRET  "生产端 Secret Key"
    print_var DEST_URL    "备份端 MinIO 地址"
    print_var DEST_KEY    "备份端 Access Key"
    print_var DEST_SECRET "备份端 Secret Key"
    print_var SRC_BUCKETS "待备份桶列表"
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
        info "  sed -e 's|__BACKUP_USER__|${RUN_USER}|g' -e 's|__BACKUP_GROUP__|${RUN_GROUP}|g' ${LOGROTATE_SRC} | sudo tee ${LOGROTATE_DST} >/dev/null"
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
    # 日志目录在 /var/log 下，普通用户建不了：安装期由 root 建好并把属主
    # 交给运行用户，之后 cron / 自检 / 备份脚本都不再需要 sudo。
    # chown -R 把旧安装（一直以 root 跑）留下的日志一并迁过来。
    # /*/ 只接受至少两级的绝对路径，避免把 /、/var 这类挂载点整体 chown。
    case "$BACKUP_LOG_DIR" in
        /*/*) mkdir -p "$BACKUP_LOG_DIR" && chown -R "${RUN_USER}:${RUN_GROUP}" "$BACKUP_LOG_DIR" \
                || fail "无法准备日志目录：$BACKUP_LOG_DIR" ;;
        *) warn "跳过根级/相对路径，不自动 chown：$BACKUP_LOG_DIR" ;;
    esac

    BACKUP_SCRIPT="${SCRIPT_DIR}/minio_backup.sh"
    STATUS_SCRIPT="${SCRIPT_DIR}/minio_backup_status.sh"
    chmod +x "$BACKUP_SCRIPT" "$STATUS_SCRIPT"

    # 🔴 cron 默认 SHELL=/bin/sh：不能用 bash 的 >(...)；crontab 里 % 是特殊字符；
    # 而双引号里的 $(date) 会在**安装时**就展开成固定时间戳，不是运行时时间。
    # 脚本内部已用 tee -a 把带时间戳的业务日志写进同一个文件，这里只兜底 stderr，
    # 直接追加重定向即可：无展开、无 %、无 bash 依赖，在 /bin/sh 下必定生效。
    CRON_JOB_BACKUP="${CRON_SCHEDULE_BACKUP} HOME=${CRON_HOME} PATH=${CRON_PATH} ${BACKUP_SCRIPT} >/dev/null 2>>${BACKUP_LOG_DIR}/minio_backup.log ${CRON_TAG_BACKUP}"
    CRON_JOB_HEALTH="${CRON_SCHEDULE_HEALTH} HOME=${CRON_HOME} PATH=${CRON_PATH} ${STATUS_SCRIPT} >/dev/null 2>>${BACKUP_LOG_DIR}/minio_backup.log ${CRON_TAG_HEALTH}"

    # 幂等写入：装到运行用户的 crontab（不是 root 的），先剔除旧标签再追加。
    (crontab -u "$RUN_USER" -l 2>/dev/null | grep -v "${CRON_TAG_BACKUP}" | grep -v "${CRON_TAG_HEALTH}"; \
        printf '%s\n' "$CRON_JOB_BACKUP"; \
        printf '%s\n' "$CRON_JOB_HEALTH") | crontab -u "$RUN_USER" -
    ok "备份定时任务已安装到 ${RUN_USER}: ${CRON_SCHEDULE_BACKUP}（每日 2:00）"
    ok "健康巡检定时任务已安装到 ${RUN_USER}: ${CRON_SCHEDULE_HEALTH}（每日 8:00）"

    # 迁移：旧版本把任务装在 root crontab 里，不清掉就会每天双跑。
    # 只删带我们标签的行，其它 root 任务原样保留；内容没变就不写回。
    if crontab -u root -l >/dev/null 2>&1; then
        old_cron="$(crontab -u root -l 2>/dev/null || true)"
        new_cron="$(printf '%s\n' "$old_cron" | grep -v "${CRON_TAG_BACKUP}" | grep -v "${CRON_TAG_HEALTH}" || true)"
        if [ "$new_cron" != "$old_cron" ]; then
            printf '%s\n' "$new_cron" | crontab -u root - \
                && ok "已清理旧 root crontab 的备份任务（避免双跑）" \
                || fail "清理旧 root crontab 失败"
        fi
    fi
fi

# ==========================================
# Step 6: preflight 部署自检
# ==========================================
hdr "Step 6: 部署自检（preflight）"
PREFLIGHT="${SCRIPT_DIR}/../preflight_check.sh"
if [ -f "$PREFLIGHT" ]; then
    info "执行部署自检（只读，不执行备份/恢复）..."
    echo ""
    # 降权到运行用户：自检读的 ~/.mc / crontab / 目录写权限必须与
    # cron 里的备份脚本完全一致，用 root 跑等于检查了另一套环境。
    sudo -n -u "$RUN_USER" -H bash "$PREFLIGHT" minio
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
    echo "${C_OK}MinIO 备份体系安装完成 ✅${C_RST}"
    echo ""
    echo "后续操作："
    echo "  1. 确认 ${ENV_FILE} 已填写真实凭证"
    echo "  2. 手动验证一次备份: make minio-backup"
    echo "  3. 查看定时任务:        make minio-backup-cron-status"
    echo "  4. 查看健康度:          make minio-backup-health"
    echo "  5. 实时查看日志:        make minio-backup-logs"
    exit 0
else
    echo "${C_ERR}安装过程存在失败项，请根据上方 ❌ 提示修复后重跑本脚本${C_RST}"
    exit 1
fi
