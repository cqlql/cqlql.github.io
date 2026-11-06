#!/bin/bash
# ==========================================
# Docker 引擎卸载（ops component uninstall docker --server <name>）
# 由 Go 侧上传到目标机并以 root 执行。判据见 docs/components.md §8.3。
#
# 🔴 默认只停服务 + purge 引擎包：/var/lib/docker、已导入镜像、/data/minio 一律保留。
# 🔴 下游 MinIO 容器会连带停止，备份链路中断；这个确认由 Go 侧强制必勾，
#    脚本再验一次 COMPONENT_ACK_DOWNSTREAM=yes，CLI 与界面都绕不过。
# 🔴 不改 crontab / logrotate / backup.env：卸载后备份任务仍在、下一次执行会失败，
#    这是预期结果，不许顺手删任务或改配置。
# ==========================================
set -euo pipefail

RUN_USER="${COMPONENT_RUN_USER:-}"
ACK="${COMPONENT_ACK_DOWNSTREAM:-}"

ok()   { echo "  [OK]   $*"; }
info() { echo "  [INFO] $*"; }
die()  { echo "  [FAIL] $*" >&2; exit 1; }

echo ""
echo "========== Docker 引擎卸载（数据一律保留） =========="

# ---------- Step 0：前置校验 ----------
[ "$(id -u)" -eq 0 ] || die "卸载必须以 root 执行（工具经 sudo 提权）"
[[ "$RUN_USER" =~ ^[A-Za-z_][A-Za-z0-9_-]*$ ]] || die "运行用户名非法或为空：$RUN_USER"
[ "$ACK" = "yes" ] || die "未确认连带影响：卸载引擎会连带停止 MinIO 备份服务"
command -v dpkg >/dev/null 2>&1 || die "未找到 dpkg（本脚本只支持 Ubuntu/Debian）"
command -v apt-get >/dev/null 2>&1 || die "未找到 apt-get"
if ! dpkg-query -W -f='${db:Status-Status}' docker-ce 2>/dev/null | grep -qx installed; then
  die "目标机没有已安装的 docker-ce 包；没有引擎可卸载"
fi

# ---------- Step 1：记录下游状态并如实提示 ----------
MINIO_WAS_RUNNING=no
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if docker ps --filter "name=^/minio$" --format '{{.Names}}' 2>/dev/null | grep -qx minio; then
    MINIO_WAS_RUNNING=yes
  fi
fi
info "🔴 下游 MinIO 容器运行中：$MINIO_WAS_RUNNING；停 docker.service 会让它一起停"
info "建议顺序：先单独卸载 MinIO，再回来卸引擎（本工具不会替你做这个决定）"

# ---------- Step 2：停服务 + purge 引擎包 ----------
if command -v systemctl >/dev/null 2>&1; then
  systemctl stop docker.service >/dev/null 2>&1 || info "docker.service 已停止或不需要再停"
  systemctl disable docker.service >/dev/null 2>&1 || true
  ok "docker.service 已停并禁用"
else
  info "未找到 systemctl：跳过服务操作，继续 purge 引擎包"
fi
DEBIAN_FRONTEND=noninteractive apt-get purge -y -qq \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
ok "引擎包已 purge（/var/lib/docker 与已导入镜像、/data/minio 全部保留）"

# ---------- Step 3：保留清单与「预期结果」提示 ----------
echo ""
echo "保留：/var/lib/docker、已导入镜像、/data/minio、/data/backups、crontab、logrotate、backup.env。"
echo "提醒：minio 备份定时任务仍在，下一次执行会失败（预期结果）；preflight 报错不要顺手修 crontab。"
echo "Docker 引擎卸载完成。"
exit 0
