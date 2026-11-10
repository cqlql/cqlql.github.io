#!/bin/bash

# ==========================================
# PostgreSQL 灾难恢复脚本（有人值守、手动触发）
# 部署: 运行在"备份端"机器上，通过 SSH 将本地 dump 流式推送到主服务器容器内恢复（pull 模式的逆操作）
# 功能: 全局对象 + 业务库恢复，支持指定文件或自动查找最新备份
# 注意: 【不】使用 set -e —— 含交互式 read、文件查找，失败时打印自定义信息
# 注意: 【绝对禁止】放入 Crontab，恢复会覆盖现有数据
# ==========================================

# 获取当前脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载环境变量文件
ENV_FILE="${SCRIPT_DIR}/backup.env"
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1091
    source "$ENV_FILE"
else
    echo "错误: 未找到配置文件 $ENV_FILE"
    echo "请先根据 backup.env.example 创建 backup.env"
    exit 1
fi

# ---------- 配置（带默认值兜底） ----------
CONTAINER_NAME="${PG_CONTAINER_NAME:-postgres}"
DB_USER="${PG_DB_USER:-postgres}"
DB_NAME="${PG_DB_NAME:-pass_up}"
BACKUP_ROOT="${PG_BACKUP_ROOT:-/data/backups/postgres}"
JOBS="${PG_RESTORE_JOBS:-4}"

# SSH 连接参数（主服务器）
SSH_HOST="${PG_SSH_HOST:-}"
SSH_PORT="${PG_SSH_PORT:-22}"
SSH_USER="${PG_SSH_USER:-root}"
SSH_KEY="${PG_SSH_KEY:-}"
# 兜底默认与 pg_backup.sh / backup.env.example 保持一致（含 accept-new）。
SSH_OPTS="${PG_SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new}"

# ---------- 参数解析 ----------
RESTORE_FILE=""       # 指定文件路径（可选）
TARGET_DB="$DB_NAME"  # 目标数据库

while [ $# -gt 0 ]; do
    case "$1" in
        --file)   RESTORE_FILE="$2"; shift 2 ;;
        --db)     TARGET_DB="$2";    shift 2 ;;
        *)        echo "未知参数: $1"; echo "用法: $0 [--file /path/to/backup.dump] [--db dbname]"; exit 1 ;;
    esac
done

# ---------- 前置校验：SSH 配置 ----------
if [ -z "$SSH_HOST" ]; then
    echo "❌ 错误: 未配置 PG_SSH_HOST（主服务器地址），请在 backup.env 中填写！"
    exit 1
fi

# 构造 ssh 基础命令（不含目标主机，便于两条链路分别选 stdin 行为）
SSH_BASE=(ssh -p "$SSH_PORT")
# 未配置私钥时使用默认密钥（~/.ssh/id_rsa 等）
if [ -n "$SSH_KEY" ]; then
    SSH_BASE+=(-i "$SSH_KEY")
fi
# 拆解 SSH_OPTS 为数组（可追加额外选项，如 -o ServerAliveInterval=5；
# 默认的 accept-new 不要替换成 no）
# shellcheck disable=SC2206
SSH_OPTS_ARR=($SSH_OPTS)
SSH_BASE+=("${SSH_OPTS_ARR[@]}")
SSH_TARGET="${SSH_USER}@${SSH_HOST}"

# 在远端执行一条完整命令（作为整体传给远端 shell，避免参数拼接导致引号丢失）
# 🔴 必须带 -n：ssh 默认把脚本 stdin 转发给远端命令，2a 连通性检查 / 2b 容器健康
#    这些内部 ssh 会读光 stdin，第 3 步 read 二次确认拿到 EOF →「数据库名称不匹配」。
#    工具经 StreamWith 喂确认串时同样依赖这条（docs/backup-restore.md §4 第 10 条）。
#    -n 只能加在这里，不能加进上面的基础数组：下面 remote_docker_stdin 要转发 stdin。
remote_exec() {
    "${SSH_BASE[@]}" -n "$SSH_TARGET" "$1"
}

# 在远端容器内执行命令（docker exec）
remote_docker() {
    remote_exec "docker exec ${CONTAINER_NAME} $*"
}

# 在远端容器内执行命令，并把本地标准输入转发到远端容器内（docker exec -i）
# 说明: ssh 不会自动转发本地 stdin，因此必须用管道 + docker exec -i 显式传入数据
# 🔴 这里不能带 -n：globals_*.sql / .sql 分支靠 ssh 把管道里的内容送进容器内的 psql
remote_docker_stdin() {
    "${SSH_BASE[@]}" "$SSH_TARGET" "docker exec -i ${CONTAINER_NAME} $*"
}

# 将本地文件复制到主服务器（复用 SSH 端口/密钥/选项）
remote_copy() {
    local src="$1" dst="$2"
    scp -P "$SSH_PORT" \
        ${SSH_KEY:+-i "$SSH_KEY"} \
        ${SSH_OPTS_ARR[@]} \
        "$src" "${SSH_TARGET}:${dst}"
}

# ---------- 1. 确定恢复源文件 ----------
if [ -n "$RESTORE_FILE" ]; then
    RESTORE_SRC="$RESTORE_FILE"
else
    echo "🔍 未指定备份文件，正在递归搜索最新备份..."
    RESTORE_FILE=$(find "$BACKUP_ROOT" -name "*.dump" -type f -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -n 1 | awk '{print $2}')
    RESTORE_SRC="$RESTORE_FILE"
fi

# ---------- 2. 前置校验 ----------

# 2a. SSH 连通性检查
echo "🔗 检查主服务器 ${SSH_USER}@${SSH_HOST}:${SSH_PORT} 连通性..."
if ! remote_exec "echo ok" > /dev/null 2>&1; then
    echo "❌ 错误: 无法通过 SSH 连接主服务器，请检查 SSH 配置！"
    exit 1
fi

# 2b. 远端容器健康检查
CONTAINER_STATUS=$(remote_exec "docker inspect -f '{{.State.Health.Status}}' ${CONTAINER_NAME}" 2>/dev/null || echo "unknown")
if [ "$CONTAINER_STATUS" = "unhealthy" ]; then
    echo "❌ 容器 [${CONTAINER_NAME}] 健康状态为 unhealthy，请先修复后再恢复！"
    exit 1
elif [ "$CONTAINER_STATUS" = "starting" ]; then
    echo "⚠️  容器 [${CONTAINER_NAME}] 仍在启动中，建议等待健康后再执行恢复。"
fi

# 2c. 文件存在性检查
if [ ! -s "$RESTORE_FILE" ]; then
    echo "❌ 错误: 未找到可用的备份文件！路径: ${RESTORE_FILE}"
    exit 1
fi

# 2d. 完整性校验
CHECKSUM_FILE="${RESTORE_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
    echo "🔑 正在验证备份完整性..."
    if ! (cd "$(dirname "$RESTORE_FILE")" && sha256sum -c "$(basename "$CHECKSUM_FILE")" --status 2>/dev/null); then
        echo "❌ 校验和验证失败！备份文件可能已损坏，操作已中止。"
        exit 1
    fi
    echo "✅ 校验和验证通过。"
else
    echo "⚠️  未找到校验和文件 ${CHECKSUM_FILE}，跳过完整性校验。"
fi

# ---------- 3. 二次确认 ----------
echo ""
echo "=================================================="
echo "🚨 警告：准备执行数据库恢复操作！"
echo "=================================================="
echo "主服务器   : ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
echo "目标容器   : ${CONTAINER_NAME}"
echo "目标数据库 : ${TARGET_DB}"
echo "恢复源     : ${RESTORE_SRC}"
echo "=================================================="
echo "⚠️  此操作将清空/覆盖数据库 [${TARGET_DB}] 中的原有数据！"
read -r -p "确认继续？输入 [${TARGET_DB}] 以确认: " CONFIRM_DB

if [ "${CONFIRM_DB}" != "${TARGET_DB}" ]; then
    echo "❌ 数据库名称不匹配，恢复操作已取消。"
    exit 1
fi

# ---------- 4. 先恢复全局对象（角色/权限） ----------
DUMP_DIR=$(dirname "$RESTORE_FILE")
GLOBALS_FILE=$(find "$DUMP_DIR" -maxdepth 1 -name "globals_*.sql" -type f -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | head -n 1 | awk '{print $2}')

if [ -n "$GLOBALS_FILE" ] && [ -s "$GLOBALS_FILE" ]; then
    echo "📋 正在恢复全局对象（角色/权限）: ${GLOBALS_FILE}"
    # 🔴 psql 默认遇 SQL 错误仍返回 0，只把 ERROR 打到输出就继续跑 —— 光看退出码
    #    会把失败当成成功（2026-11-10 真机实证：CREATE ROLE postgres 报
    #    `ERROR: role "postgres" already exists` 被吞，脚本照打「✅ 全局对象恢复完成」，
    #    见 docs/backup-restore.md §7.6）。
    # 🔴 这里【不】开 ON_ERROR_STOP：globals_*.sql 由 pg_dumpall --globals-only 生成，
    #    里面的 CREATE ROLE postgres 在目标端必然已存在；开了会在第一条错误处截断，
    #    后面的 ALTER ROLE / 其它角色反而不执行 —— 比吞错误更危险。
    #    正解：让 psql 跑完所有语句，捕获输出逐行判错；「对象已存在」是幂等噪声，
    #    显式放行并打醒目警告要求值守核对，其余 ERROR 与 ssh/管道失败一律中止。
    GLOBALS_OUT="$(cat "$GLOBALS_FILE" | remote_docker_stdin psql -U "$DB_USER" -d postgres 2>&1)"
    GLOBALS_RC=$?
    printf '%s\n' "$GLOBALS_OUT"
    GLOBALS_ERRORS="$(printf '%s\n' "$GLOBALS_OUT" | grep 'ERROR:' || true)"
    GLOBALS_FATAL="$(printf '%s\n' "$GLOBALS_ERRORS" | grep -v 'already exists' || true)"
    if [ "$GLOBALS_RC" -ne 0 ] || [ -n "$GLOBALS_FATAL" ]; then
        echo "❌ 全局对象恢复失败（psql/ssh 退出码 ${GLOBALS_RC}），操作中止！"
        if [ -n "$GLOBALS_FATAL" ]; then
            printf '%s\n' "$GLOBALS_FATAL"
        fi
        exit 1
    fi
    if [ -n "$GLOBALS_ERRORS" ]; then
        echo "⚠️  全局对象恢复完成，但以下「对象已存在」类错误被跳过（幂等）："
        printf '%s\n' "$GLOBALS_ERRORS"
        echo "   请逐行核对上面的输出，确认被跳过的对象无需重建。"
    else
        echo "✅ 全局对象恢复完成。"
    fi
else
    echo "⚠️  未找到 globals_*.sql，跳过全局对象恢复。"
fi

# ---------- 5. 执行业务库恢复 ----------
echo "🚀 开始恢复业务库 ${TARGET_DB}..."

FILENAME=$(basename "$RESTORE_FILE")
case "$FILENAME" in
    *.dump)
        # 目标库不存在时先建库
        if ! remote_exec "docker exec ${CONTAINER_NAME} psql -U ${DB_USER} -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='${TARGET_DB}'\"" | grep -q 1; then
            echo "目标库 ${TARGET_DB} 不存在，正在创建..."
            remote_docker createdb -U "$DB_USER" "$TARGET_DB" || {
                echo "❌ 创建数据库 ${TARGET_DB} 失败！"
                exit 1
            }
        fi

        # pg_restore 并行模式(-j)不支持从 stdin 读取，故先把 dump 上传到主服务器宿主机，
        # 再 docker cp 拷进容器（容器内 /tmp 与宿主机 /tmp 不互通），由容器内 pg_restore 读文件。
        HOST_TMP="/tmp/${FILENAME}"
        echo "📤 上传备份文件到主服务器: ${HOST_TMP}"
        remote_copy "$RESTORE_FILE" "$HOST_TMP" || {
            echo "❌ 上传备份文件到主服务器失败！"
            exit 1
        }
        remote_exec "docker cp ${HOST_TMP} ${CONTAINER_NAME}:${HOST_TMP}" || {
            echo "❌ 拷贝备份文件到容器失败！"
            remote_exec "rm -f ${HOST_TMP}" || true
            exit 1
        }
        remote_docker \
            pg_restore -U "$DB_USER" -d "$TARGET_DB" --clean --if-exists --no-owner -j "$JOBS" "$HOST_TMP"
        RET=$?
        remote_exec "rm -f ${HOST_TMP}" || true
        remote_exec "docker exec ${CONTAINER_NAME} rm -f ${HOST_TMP}" || true
        ;;
    *.sql)
        # 业务库 SQL 没有 globals 那种「对象已存在」幂等噪声：出错就该真中止。
        # 开 ON_ERROR_STOP 让 psql 返回非 0，下面靠 RET 统一判失败（§5）。
        cat "$RESTORE_FILE" | remote_docker_stdin \
            psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$TARGET_DB"
        RET=$?
        ;;
    *)
        echo "❌ 无法识别的文件扩展名（仅支持 .dump 或 .sql）"
        exit 1
        ;;
esac

if [ "$RET" -eq 0 ]; then
    echo "✅ 数据库恢复成功！"
else
    echo "❌ 数据库恢复异常（退出码 ${RET}），请检查日志！"
    exit 1
fi
