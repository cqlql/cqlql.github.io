#!/bin/bash
# ==========================================
# MinIO 服务卸载（ops component uninstall minio --server <name>）
# 由 Go 侧上传到目标机并以 root 执行。判据见 docs/components.md §8.3。
#
# 🔴 默认只移除容器：/data/minio 全部数据、已导入镜像、Docker 引擎一律保留。
# 🔴 删数据是独立勾选项且默认不勾：只有 COMPONENT_PURGE_DATA=yes 才删，且路径是
#    固定常量 /data/minio，绝不拼用户字符串、绝不 rm -rf 变量路径。
# 🔴 不改 crontab / logrotate / backup.env：卸载后备份任务仍在、下一次执行会失败，
#    这是预期结果，不许顺手删任务或改配置。
# ==========================================
set -euo pipefail

PURGE="${COMPONENT_PURGE_DATA:-no}"
CONTAINER=minio
DATA_DIR=/data/minio

ok()   { echo "  [OK]   $*"; }
info() { echo "  [INFO] $*"; }
die()  { echo "  [FAIL] $*" >&2; exit 1; }

echo ""
echo "========== MinIO 服务卸载（数据默认保留） =========="

# ---------- Step 0：前置校验 ----------
[ "$(id -u)" -eq 0 ] || die "卸载必须以 root 执行（工具经 sudo 提权）"
[ "$PURGE" = "yes" ] || [ "$PURGE" = "no" ] || die "删除数据开关的值非法：$PURGE"
command -v docker >/dev/null 2>&1 || die "未找到 docker（请确认上游引擎状态）"
docker info >/dev/null 2>&1 || die "docker daemon 不可用（docker info 失败）"
docker ps -a --filter "name=^/${CONTAINER}$" --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER" \
  || die "目标机没有 MinIO 容器；没有容器可卸载"

# ---------- Step 1：停容器 + 移除容器（不加 -v，数据卷在宿主机上） ----------
ok "身份 root；删除数据目录：$PURGE（默认 no）"
docker stop "$CONTAINER" >/dev/null 2>&1 || info "容器已停止或不需要再停"
docker rm "$CONTAINER" >/dev/null
ok "容器已移除（docker rm 不带 -v；$DATA_DIR 与已导入镜像、引擎均保留）"

# ---------- Step 2：只有显式勾选才删数据（不可逆） ----------
if [ "$PURGE" = "yes" ]; then
  info "已显式勾选「同时删除 /data/minio 数据目录」：这一步不可逆"
  rm -rf /data/minio
  ok "数据目录 /data/minio 已删除（不可恢复）"
else
  ok "数据目录 /data/minio 完整保留"
fi

# ---------- Step 3：「预期结果」提示 ----------
echo ""
echo "保留：Docker 引擎、已导入镜像（未勾选删数据时还有 /data/minio）、crontab、logrotate、backup.env。"
echo "提醒：minio 备份定时任务仍在，下一次执行会失败（预期结果）；preflight 报错不要顺手修 crontab。"
echo "MinIO 服务卸载完成。若还要卸引擎，请回到组件目录单独操作并勾选连带影响确认。"
exit 0
