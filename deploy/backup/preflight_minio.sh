#!/bin/bash

# ==========================================
# MinIO 备份体检（preflight 子模块）
# 由 preflight_check.sh 调度，亦可单独执行: bash deploy/backup/preflight_minio.sh
# 纯只读检查，不执行备份/恢复，不修改任何 MinIO 配置
# ==========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINIO_DIR="${SCRIPT_DIR}/minio"

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/common.sh"

# ==========================================
# MinIO 桶版本控制 & 生命周期保留天数检查（只读，不修改任何配置）
# 参数: $1=端名称(源端/备份端) $2=临时alias名(仅ASCII小写/数字/连字符) $3=URL $4=KEY $5=SECRET $6=桶列表(空格分隔) $7=桶名前缀(可空)
# ==========================================
check_bucket_policy() {
    local side="$1" MC_TMP_ALIAS="$2" url="$3" key="$4" secret="$5" buckets="$6" prefix="$7"
    if ! mc alias set "$MC_TMP_ALIAS" "$url" "$key" "$secret" >/dev/null 2>&1; then
        warn "无法为${side}版本控制/生命周期检查建立临时 alias（跳过）"
        return
    fi

    for BUCKET in $buckets; do
        local bucket_name="${prefix}${BUCKET}"
        # 桶不存在时跳过（连通性检查已覆盖整体可达性，这里仅针对桶粒度）
        if ! mc ls "$MC_TMP_ALIAS/$bucket_name" >/dev/null 2>&1; then
            warn "${side}桶不存在: $bucket_name（无法检查版本控制/生命周期）"
            continue
        fi

        # 版本控制状态：mc version info 输出形如 "alias/bucket versioning is enabled/suspended"
        # （小写 "versioning is ..."，且带 alias/bucket 前缀）。转小写后匹配，兼容不同 mc 版本措辞。
        local vc_out vc_low
        vc_out="$(mc version info "$MC_TMP_ALIAS/$bucket_name" 2>/dev/null || true)"
        vc_low="$(printf '%s' "$vc_out" | tr '[:upper:]' '[:lower:]')"
        case "$vc_low" in
            *"versioning is enabled"*) ok "${side}桶 $bucket_name 已开启版本控制" ;;
            *"versioning is suspended"*) warn "${side}桶 $bucket_name 版本控制已暂停（suspended），新对象不再生成版本" ;;
            *"versioning is not enabled"*|*"no versioning"*) warn "${side}桶 $bucket_name 未开启版本控制（误删后无法找回）" ;;
            *) warn "${side}桶 $bucket_name 版本控制状态未知: ${vc_out:-<空>}" ;;
        esac

        # 生命周期保留天数：mc ilm rule ls --json 输出各条规则
        #  - Expiration.Days                          当前版本过期天数（备份桶不应设置，会误删最新备份）
        #  - NoncurrentVersionExpiration.NoncurrentDays 历史版本保留天数（正确做法，仅清理被覆盖的旧版本）
        local ilm_out nc_days=""
        ilm_out="$(mc ilm rule ls --json "$MC_TMP_ALIAS/$bucket_name" 2>/dev/null || true)"
        nc_days="$(echo "$ilm_out" | grep -o '"NoncurrentDays":[[:space:]]*[0-9]*' | grep -o '[0-9]*' | sort -n | tr '\n' ' ' | sed 's/ *$//')"
        if [ -n "$nc_days" ]; then
            info "${side}桶 $bucket_name 历史版本保留天数: ${nc_days} 天（当前版本永久保留）"
        else
            # 未设置历史版本过期规则时，检查是否误用了当前版本过期规则，给出针对性提示
            local cur_days=""
            cur_days="$(echo "$ilm_out" | grep -o '"Days":[[:space:]]*[0-9]*' | grep -o '[0-9]*' | sort -n | tr '\n' ' ' | sed 's/ *$//')"
            if [ -n "$cur_days" ]; then
                warn "${side}桶 $bucket_name 仅设置了当前版本过期（${cur_days} 天），历史版本会无限堆积，建议改为历史版本保留天数（--noncurrent-expire-days）"
            else
                warn "${side}桶 $bucket_name 未配置生命周期过期规则（历史版本可能无限增长）"
            fi
        fi
    done

    mc alias rm "$MC_TMP_ALIAS" >/dev/null 2>&1 || true
}

check_minio() {
    hdr "MinIO 备份体检"
    local ENV_FILE="${MINIO_DIR}/backup.env"

    if [ ! -f "$ENV_FILE" ]; then
        err "缺少 ${ENV_FILE}（请根据 backup.env.example 创建并填写）"
        return
    fi
    ok "找到配置文件 $(basename "$ENV_FILE")"
    load_env "$ENV_FILE"

    local LOG_DIR="${BACKUP_LOG_DIR:-/var/log/minio-backup}"

    # --- 必填参数 ---
    check_required_var "$ENV_FILE" SRC_URL "生产端 MinIO 地址"
    check_required_var "$ENV_FILE" SRC_KEY "生产端 Access Key"
    check_required_var "$ENV_FILE" SRC_SECRET "生产端 Secret Key"
    check_required_var "$ENV_FILE" DEST_URL "备份端 MinIO 地址"
    check_required_var "$ENV_FILE" DEST_KEY "备份端 Access Key"
    check_required_var "$ENV_FILE" DEST_SECRET "备份端 Secret Key"
    check_required_var "$ENV_FILE" SRC_BUCKETS "待备份桶列表"

    # --- 备份端 MinIO 容器名（可选，用于核对容器真实挂载路径） ---
    if [ -n "${MINIO_CONTAINER_NAME:-}" ]; then
        ok "[MINIO_CONTAINER_NAME] 已配置（备份端 MinIO 容器名）"
    else
        warn "未配置 MINIO_CONTAINER_NAME（将跳过容器挂载路径核对）"
    fi

    # --- 敏感信息是否为占位符 ---
    # 🔴 占位符用子串匹配（模板里是 CHANGE_ME_PROD_ACCESS_KEY / YOUR_BACKUP_SECRET_KEY）；
    #    弱凭证一律【全值精确】匹配。旧口径 `*123456*` 是子串，任何含 123456 的
    #    真实强凭证都会被误报（2026-11-10 §8.4 / L3）。精确列表只收常见数字弱口令，
    #    代价是「弱前缀 + 后缀」如 12345678Abc! 会漏报，值守仍需按键名核对配置。
    for v in SRC_KEY SRC_SECRET DEST_KEY DEST_SECRET; do
        local val; val="$(eval echo "\${${v}:-}")"
        case "$val" in
            *CHANGE_ME*|*YOUR_*|123456|1234567|12345678|123456789|1234567890|admin)
                # 🔴 值不进日志：键名 + 告警已足够定位，回显会把弱凭证原样写进任务日志。
                #    ${val} 只用于上面的判据，绝不拼进任何输出（2026-11-10 §8.1 验收发现）。
                warn "[${v}] 疑似占位符/弱凭证（值已脱敏，不回显），请到 backup.env 替换为真实凭证" ;;
        esac
    done

    # --- 依赖命令 ---
    have_cmd mc && ok "已安装 mc 客户端" || err "未安装 mc 客户端（MinIO 备份脚本依赖）"
    have_cmd nc && ok "已安装 nc（用于网络连通性检查）" || warn "未安装 nc（将跳过连通性检查）"

    # --- 源端/目标端连通性（只读探测） ---
    # 注意：不能只用 nc -z 判断 MinIO 可达。nc -z 仅验证 TCP 端口是否开放，
    # 无法确认对方是否真的是 MinIO HTTP 服务；某些网络环境下 TCP 握手可能被
    # 中间设备（防火墙/NAT/负载均衡）伪造应答，导致 nc 报成功但实际请求超时。
    # 因此这里使用 mc 客户端做真实的 S3 认证连接（与备份脚本 mc alias set 一致），
    # 只有认证握手通过才判定为「可达」。nc 仅作为 mc 不可用时的降级探测。
    local SRC_HOST SRC_PORT DEST_HOST DEST_PORT MC_TMP_ALIAS
    SRC_HOST="${SRC_URL#*://}"; SRC_HOST="${SRC_HOST%%/*}"
    case "$SRC_HOST" in
        *:*) SRC_PORT="${SRC_HOST##*:}"; SRC_HOST="${SRC_HOST%:*}";;
        *)   case "$SRC_URL" in https://*) SRC_PORT=443;; http://*) SRC_PORT=80;; *) SRC_PORT=9000;; esac;;
    esac
    DEST_HOST="${DEST_URL#*://}"; DEST_HOST="${DEST_HOST%%/*}"
    case "$DEST_HOST" in
        *:*) DEST_PORT="${DEST_HOST##*:}"; DEST_HOST="${DEST_HOST%:*}";;
        *)   case "$DEST_URL" in https://*) DEST_PORT=443;; http://*) DEST_PORT=80;; *) DEST_PORT=9000;; esac;;
    esac

    if have_cmd mc && [ -n "${SRC_URL:-}" ]; then
        # 用一次性临时 alias 做真实连接验证，避免污染用户的 ~/.mc/config.json
        MC_TMP_ALIAS="preflight-src-$$"
        if mc alias set "$MC_TMP_ALIAS" "$SRC_URL" "${SRC_KEY:-}" "${SRC_SECRET:-}" >/dev/null 2>&1 \
            && mc ls "$MC_TMP_ALIAS" >/dev/null 2>&1; then
            ok "源端 MinIO 可达（认证通过）: ${SRC_HOST}:${SRC_PORT}"
        else
            err "源端 MinIO 不可达或认证失败: ${SRC_HOST}:${SRC_PORT}（检查 SRC_URL/SRC_KEY/SRC_SECRET）"
        fi
        mc alias rm "$MC_TMP_ALIAS" >/dev/null 2>&1 || true
    elif [ -n "${SRC_URL:-}" ] && have_cmd nc; then
        # 降级：mc 不可用时退回 nc 端口探测，并明确标注其局限
        if nc -z -w 3 "$SRC_HOST" "$SRC_PORT" >/dev/null 2>&1; then
            warn "源端 MinIO 端口开放（nc 探测，未做认证验证）: ${SRC_HOST}:${SRC_PORT} — 建议安装 mc 做真实验证"
        else
            err "源端 MinIO 不可达: ${SRC_HOST}:${SRC_PORT}（检查 SRC_URL）"
        fi
    fi

    if have_cmd mc && [ -n "${DEST_URL:-}" ]; then
        MC_TMP_ALIAS="preflight-dest-$$"
        if mc alias set "$MC_TMP_ALIAS" "$DEST_URL" "${DEST_KEY:-}" "${DEST_SECRET:-}" >/dev/null 2>&1 \
            && mc ls "$MC_TMP_ALIAS" >/dev/null 2>&1; then
            ok "备份端 MinIO 可达（认证通过）: ${DEST_HOST}:${DEST_PORT}"
        else
            err "备份端 MinIO 不可达或认证失败: ${DEST_HOST}:${DEST_PORT}（检查 DEST_URL/DEST_KEY/DEST_SECRET）"
        fi
        mc alias rm "$MC_TMP_ALIAS" >/dev/null 2>&1 || true
    elif [ -n "${DEST_URL:-}" ] && have_cmd nc; then
        if nc -z -w 3 "$DEST_HOST" "$DEST_PORT" >/dev/null 2>&1; then
            warn "备份端 MinIO 端口开放（nc 探测，未做认证验证）: ${DEST_HOST}:${DEST_PORT} — 建议安装 mc 做真实验证"
        else
            err "备份端 MinIO 不可达: ${DEST_HOST}:${DEST_PORT}（检查 DEST_URL）"
        fi
    fi

    # --- 源端桶版本控制 & 生命周期保留天数（只读探测，不修改任何配置） ---
    # 目的：核对生产端桶是否开启了版本控制，以及生命周期过期策略（决定对象保留多少天后删除）。
    # 说明：保留天数依赖 ILM 生命周期过期规则（Expiration.Days）；若桶未开启版本控制或未配置
    #       过期规则，会给出警告，提示可能存在的「误删后无法找回 / 数据无限增长」风险。
    if have_cmd mc && [ -n "${SRC_URL:-}" ] && [ -n "${SRC_BUCKETS:-}" ]; then
        check_bucket_policy "源端" "preflight-src" "$SRC_URL" "$SRC_KEY" "$SRC_SECRET" "$SRC_BUCKETS" ""
    fi

    # --- 备份端桶版本控制 & 生命周期保留天数（只读探测，不修改任何配置） ---
    # 目的：核对备份端桶（桶名 = DEST_BUCKET_PREFIX + 源桶名）同样具备版本控制与生命周期策略，
    #       避免「备份端自身」误删后无法找回或数据无限增长。
    if have_cmd mc && [ -n "${DEST_URL:-}" ] && [ -n "${SRC_BUCKETS:-}" ]; then
        check_bucket_policy "备份端" "preflight-dest" "$DEST_URL" "$DEST_KEY" "$DEST_SECRET" "$SRC_BUCKETS" "${DEST_BUCKET_PREFIX:-}"
    fi

    # --- 日志目录 ---
    check_log_dir "$LOG_DIR"

    # --- 备份磁盘挂载点 ---
    local mount="${BACKUP_DISK_MOUNT:-}"
    if [ -n "$mount" ] && [ -d "$mount" ]; then
        ok "备份磁盘挂载点存在: $mount"
    elif [ -n "$mount" ]; then
        warn "备份磁盘挂载点不存在: $mount（请检查 BACKUP_DISK_MOUNT）"
    fi

    # --- 备份端 MinIO 容器真实挂载路径 ---
    # 目的：确认容器数据目录真正挂载到外部数据盘（而非容器可写层，否则重启/删容器丢数据）
    if [ -n "${MINIO_CONTAINER_NAME:-}" ] && have_cmd docker; then
        local src dst found_data=0
        # 用 docker inspect 逐条输出 "宿主机源路径<TAB>容器内目标路径"，一行一个挂载，避免解析整段 JSON
        while IFS=$'\t' read -r src dst; do
            [ -n "$src" ] || continue
            info "  容器挂载: ${src} -> ${dst}"
            case "$dst" in
                */data|*/data/*)
                    found_data=1
                    case "$src" in
                        /data*|/mnt/*|/srv/*|/opt/*|/var/lib/*)
                            ok "数据目录真实挂载到宿主机: ${src} -> ${dst}"
                            if [ -n "$mount" ] && [ "$src" != "$mount" ] && [[ "$src" != "$mount"/* ]]; then
                                warn "数据挂载路径 ${src} 与 BACKUP_DISK_MOUNT(${mount}) 不一致，请核对是否同一块盘"
                            fi
                            ;;
                        *)
                            warn "数据目录 ${dst} 挂载源 ${src} 疑似容器内/非持久路径，重启或删容器可能丢数据"
                            ;;
                    esac
                    ;;
            esac
        done < <(docker inspect "$MINIO_CONTAINER_NAME" \
                --format '{{range .Mounts}}{{.Source}}{{"\t"}}{{.Destination}}{{"\n"}}{{end}}' 2>/dev/null)
        # 上面 read 失败/容器不存在时，found_data 保持 0，需进一步区分「容器不存在」与「无数据挂载」
        if ! docker inspect "$MINIO_CONTAINER_NAME" >/dev/null 2>&1; then
            err "无法 inspect 容器 ${MINIO_CONTAINER_NAME}（检查容器名或 docker 权限）"
        elif [ "$found_data" -eq 1 ]; then
            : # 已找到数据目录挂载，正常
        else
            warn "未发现容器数据目录挂载（/data），请确认 MinIO 数据是否持久化到宿主机"
        fi
    elif [ -n "${MINIO_CONTAINER_NAME:-}" ] && ! have_cmd docker; then
        warn "已配置 MINIO_CONTAINER_NAME 但本机无 docker 命令，跳过容器挂载路径检查"
    fi

    # --- 定时任务 ---
    if have_cmd crontab && crontab -l 2>/dev/null | grep -q '#MINIO_BACKUP'; then
        ok "已安装 MinIO 备份定时任务"
    else
        warn "未安装 MinIO 备份定时任务（执行 make minio-backup-cron-install）"
    fi
    if have_cmd crontab && crontab -l 2>/dev/null | grep -q '#MINIO_BACKUP_HEALTH'; then
        ok "已安装 MinIO 健康巡检定时任务"
    else
        warn "未安装 MinIO 健康巡检定时任务（执行 make minio-backup-health-cron-install）"
    fi

    # --- 是否成功备份过 ---
    check_last_success "$LOG_DIR" "make minio-backup"
}

# 允许单独执行（供调试/手动调用），被 source 时不触发
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    check_minio
    summary
fi
