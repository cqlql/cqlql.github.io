#!/bin/bash

# ==========================================
# MinIO 灾难恢复脚本（从备份端拉回生产端）
# 适用: 单机 Docker 部署的 MinIO
# 功能: 将备份端数据反向同步回生产环境
# ==========================================

set -euo pipefail

# 获取当前脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/backup.env"

if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
else
    echo "错误: 未找到配置文件 $ENV_FILE"
    exit 1
fi

SRC_ALIAS="prod-minio"     # 目标：生产端（恢复目标）
DEST_ALIAS="backup-minio"  # 源：备份端（数据来源）

echo "=========================================="
echo "  MinIO 灾难恢复操作"
echo "=========================================="
echo "数据方向: 备份端 -> 生产端"
echo "备份端: ${DEST_URL}"
echo "生产端: ${SRC_URL}"
echo "待恢复桶: ${SRC_BUCKETS}"
echo "=========================================="

# ---------- 交互式二次确认 ----------
read -r -p "确认要将备份数据覆盖/还原回生产环境吗？(输入 'YES' 继续): " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
    echo "操作已取消。"
    exit 0
fi

# ---------- 初始化 mc 别名 ----------
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 初始化 mc 别名..."
if ! mc alias set $SRC_ALIAS  $SRC_URL  $SRC_KEY  $SRC_SECRET  > /dev/null 2>&1; then
    echo "错误: 无法连接生产端 MinIO (${SRC_URL})，请检查 SRC_URL/SRC_KEY/SRC_SECRET"
    exit 1
fi
if ! mc alias set $DEST_ALIAS $DEST_URL $DEST_KEY $DEST_SECRET > /dev/null 2>&1; then
    echo "错误: 无法连接备份端 MinIO (${DEST_URL})，请检查 DEST_URL/DEST_KEY/DEST_SECRET"
    exit 1
fi

# ---------- 提示检查 Cron ----------
echo ""
echo "[提示] 请确保已暂停定时备份任务 (执行 make cron-uninstall)，避免恢复过程中产生写冲突。"
read -r -p "已确认暂停定时备份？(按 Enter 继续) "

# ---------- 对每个桶执行反向同步 ----------
FAILED_BUCKETS=""
for BUCKET in $SRC_BUCKETS; do
    DEST_BUCKET="${DEST_BUCKET_PREFIX}${BUCKET}"
    echo ""
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 正在恢复桶: ${DEST_ALIAS}/${DEST_BUCKET} -> ${SRC_ALIAS}/${BUCKET}"

    # 确保生产端桶存在
    if ! mc ls "${SRC_ALIAS}/${BUCKET}" &> /dev/null; then
        echo "生产端桶 ${BUCKET} 不存在，正在创建..."
        mc mb "${SRC_ALIAS}/${BUCKET}" || true
    fi

    # 反向同步：备份端 -> 生产端
    if mc mirror --overwrite "${DEST_ALIAS}/${DEST_BUCKET}" "${SRC_ALIAS}/${BUCKET}"; then
        echo "桶 ${BUCKET} 恢复成功"
    else
        echo "桶 ${BUCKET} 恢复失败！"
        FAILED_BUCKETS="${FAILED_BUCKETS} ${BUCKET}"
    fi
done

# ---------- 汇总 ----------
echo ""
echo "=========================================="
if [ -z "$FAILED_BUCKETS" ]; then
    echo "所有桶数据恢复完成！请检查生产端 MinIO 桶数据。"
    echo "恢复完成后，记得重新启用定时备份 (make cron-install)"
else
    echo "以下桶恢复失败，请检查网络或 mc 权限配置:${FAILED_BUCKETS}"
    exit 1
fi
