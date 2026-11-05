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
SSH_OPTS="${PG_SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=10}"

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

# 构造 ssh 基础命令
SSH_CMD=(ssh -p "$SSH_PORT")
# 未配置私钥时使用默认密钥（~/.ssh/id_rsa 等）
if [ -n "$SSH_KEY" ]; then
    SSH_CMD+=(-i "$SSH_KEY")
fi
# 拆解 SSH_OPTS 为数组（支持额外选项如 -o StrictHostKeyChecking=no）
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

# 在远端容器内执行命令，并把本地标准输入转发到远端容器内（docker exec -i）
# 说明: ssh 不会自动转发本地 stdin，因此必须用管道 + docker exec -i 显式传入数据
remote_docker_stdin() {
    "${SSH_CMD[@]}" "docker exec -i ${CONTAINER_NAME} $*"
}

# 将本地文件复制到主服务器（复用 SSH 端口/密钥/选项）
remote_copy() {
    local src="$1" dst="$2"
    scp -P "$SSH_PORT" \
        ${SSH_KEY:+-i "$SSH_KEY"} \
        ${SSH_OPTS_ARR[@]} \
        "$src" "${SSH_USER}@${SSH_HOST}:${dst}"
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
    if ! cat "$GLOBALS_FILE" | remote_docker_stdin psql -U "$DB_USER" -d postgres; then
        echo "❌ 全局对象恢复失败，操作中止！"
        exit 1
    fi
    echo "✅ 全局对象恢复完成。"
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
        cat "$RESTORE_FILE" | remote_docker_stdin \
            psql -U "$DB_USER" -d "$TARGET_DB"
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
