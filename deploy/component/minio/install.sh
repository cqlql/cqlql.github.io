#!/bin/bash
# ==========================================
# MinIO 服务安装（ops component install minio --server <name>）
# 由 Go 侧把本机 backup/minio.env 的凭证拼在本文件头部后上传，以 root 执行。
#
# 🔴 身份：安装期以 root 跑（建 /data/minio、docker run）；COMPONENT_RUN_USER
#    只用于日志说明，不靠 SUDO_USER 猜。运行期容器与备份脚本仍是清单 user。
# 🔴 只认离线镜像：绝不 docker pull。k1 实测 Docker Hub 超时 / quay.io 401 /
#    dl.min.io 410，镜像由人从本机 `image-load` 导入。
# 🔴 幂等：容器已存在只做健康检查（stopped 则 start），不 docker rm、不重建、
#    不删 /data/minio、不动引擎 / 其它镜像 / crontab / backup.env。
# 🔴 凭证只通过 -e 传进容器；不 echo、不 inspect 全量配置、不写日志文件。
# ==========================================
set -euo pipefail

ROOT_USER="${COMPONENT_MINIO_ROOT_USER:-}"
ROOT_SECRET="${COMPONENT_MINIO_ROOT_PASSWORD:-}"
IMAGE="${COMPONENT_MINIO_IMAGE:-}"
RUN_USER="${COMPONENT_RUN_USER:-}"
API_PORT=9000
CONSOLE_PORT=9001
DATA_DIR=/data/minio
CONTAINER=minio

ok()   { echo "  [OK]   $*"; }
info() { echo "  [INFO] $*"; }
die()  { echo "  [FAIL] $*" >&2; exit 1; }

echo ""
echo "========== MinIO 服务安装 =========="

# ---------- Step 0：前置校验（任何一项不过都不改远端） ----------
[ "$(id -u)" -eq 0 ] || die "安装期必须以 root 执行（工具经 sudo -n 提权）"
[ -n "$ROOT_USER" ] || die "root 用户名缺失（本机 backup/minio.env 的 DEST_KEY）"
[ -n "$ROOT_SECRET" ] || die "root 密钥缺失（本机 backup/minio.env 的 DEST_SECRET）"
[ "${#ROOT_USER}" -ge 3 ] || die "MinIO 要求 root 用户名至少 3 个字符"
[ "${#ROOT_SECRET}" -ge 8 ] || die "MinIO 要求 root 密钥至少 8 个字符"
[[ "$RUN_USER" =~ ^[A-Za-z_][A-Za-z0-9_-]*$ ]] || die "运行用户名非法或为空：$RUN_USER"
[[ "$IMAGE" =~ ^[A-Za-z0-9][A-Za-z0-9._/:-]*$ ]] || die "镜像引用非法或为空：$IMAGE"
command -v docker >/dev/null 2>&1 || die "未找到 docker（请先安装 Docker 引擎）"
docker info >/dev/null 2>&1 || die "docker daemon 不可用（docker info 失败）"
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "目标机没有镜像 $IMAGE；本脚本不会 pull，请先导入离线镜像 tar"

ok "身份 root；运行用户 $RUN_USER；离线镜像 $IMAGE"

# ---------- Step 1：已有容器一律不重建 ----------
_existing=no
if docker ps -a --filter "name=^/${CONTAINER}$" --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
  _existing=yes
  _state="$(docker inspect --format '{{.State.Status}}' "$CONTAINER" 2>/dev/null || printf unknown)"
  case "$_state" in
    running)
      info "容器 $CONTAINER 已在运行：不重建、不换镜像、不删数据，只做健康检查"
      ;;
    exited|created|paused)
      info "容器 $CONTAINER 已存在但未运行（$_state）：docker start 保留原配置与数据"
      docker start "$CONTAINER" >/dev/null
      ok "容器已启动"
      ;;
    *)
      die "容器状态 $_state；本轮不自动重建，请人工复核后再决定是否更新"
      ;;
  esac
fi

if [ "$_existing" = "no" ]; then
  # ---------- Step 2：端口与数据目录 ----------
  if command -v ss >/dev/null 2>&1; then
    for p in "$API_PORT" "$CONSOLE_PORT"; do
      if ss -H -ltn 2>/dev/null | grep -Eq "[:.]${p}[[:space:]]"; then
        die "端口 $p 已被占用，装完也起不来；请先释放端口"
      fi
    done
  else
    info "未找到 ss，跳过端口探测；docker run 会在端口冲突时如实失败"
  fi
  # k4 这类没有独立数据盘的测试机上 /data 可能压根不存在：mkdir -p 会连父目录
  # 一起创建。如实说清「数据落在根分区」，生产环境仍应先挂数据盘到 /data。
  if [ ! -d /data ]; then
    info "目标机没有 /data：将创建在根分区（非独立数据盘）；生产环境建议先挂载数据盘到 /data"
  fi
  mkdir -p "$DATA_DIR"
  ok "数据目录 $DATA_DIR 就绪（/data 及 /data/backups 等既有目录不动）"

  # ---------- Step 3：启动容器 ----------
  info "docker run -d --name $CONTAINER（9000 API / 9001 Console，--restart unless-stopped）"
  docker run -d --name "$CONTAINER" --restart unless-stopped \
    -p "${API_PORT}:9000" -p "${CONSOLE_PORT}:9001" \
    -e MINIO_ROOT_USER="$ROOT_USER" -e MINIO_ROOT_PASSWORD="$ROOT_SECRET" \
    -v "${DATA_DIR}:/data" \
    "$IMAGE" server /data --console-address ":9001" >/dev/null
  ok "容器已创建（凭证只经 -e 注入，未写入任何脚本 / 日志）"
fi

# ---------- Step 4：健康检查（不跑备份、不动 crontab） ----------
_healthy=no
if command -v curl >/dev/null 2>&1; then
  for _try in $(seq 1 20); do
    if curl -fsS -m 2 "http://127.0.0.1:${API_PORT}/minio/health/live" >/dev/null 2>&1; then
      _healthy=yes
      break
    fi
    sleep 1
  done
else
  info "未找到 curl，改看容器运行状态（无法做 HTTP 健康检查）"
  if [ "$(docker inspect --format '{{.State.Status}}' "$CONTAINER" 2>/dev/null)" = "running" ]; then
    _healthy=yes
  fi
fi
[ "$_healthy" = "yes" ] || die "MinIO 健康检查未通过（20 秒内 /minio/health/live 无响应）；容器未删除，请人工复核"
ok "健康检查通过：http://127.0.0.1:${API_PORT}/minio/health/live"

docker ps --filter "name=^/${CONTAINER}$" --format '{{.Status}} · {{.Image}}'
echo ""
echo "MinIO 服务安装完成。"
echo "提醒：备份脚本的 DEST_URL 需指向本机 9000（不是生产端 8007），请到「配置」页修改并同步远端。"
exit 0
