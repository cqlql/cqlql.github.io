#!/bin/bash
# ==========================================
# MinIO 服务只读体检（ops component list 在目标机执行）
#
# 🔴 只读红线：不写任何远端文件、不提权、不装包、不拉镜像、不改容器。
#    一行一个 KEY=VALUE，由 Go 侧解析；「连不上」由 Go 侧归类为 collected=false。
# 🔴 这里刻意不执行在线拉镜像：k1 实测 Docker Hub 超时 / quay.io 401 /
#    dl.min.io 410，安装只认「人从本机导入的离线 tar」。
# ==========================================
set -u

kv() {
  local k="$1" v="${2-}"
  v="${v//$'\r'/ }"
  v="${v//$'\n'/ }"
  printf '%s=%s\n' "$k" "$v"
}

# ---------- 镜像清单（只列名字里带 minio 的本地镜像） ----------
_images=""
_count=0
_first=""
_query=no
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  _query=yes
  while IFS=';' read -r ref id size created; do
    case "$ref" in
      *minio*|*MINIO*) ;;
      *) continue ;;
    esac
    [ -z "$ref" ] && continue
    _count=$((_count + 1))
    [ -z "$_first" ] && _first="$ref"
    _images="${_images}|${ref};${id};${size};${created}"
  done < <(docker images --format '{{.Repository}}:{{.Tag}};{{.ID}};{{.Size}};{{.CreatedAt}}' 2>/dev/null)
fi
kv MINIO_DOCKER_QUERY "$_query"
kv MINIO_IMAGE_COUNT "$_count"
kv MINIO_IMAGE_FIRST "$_first"
kv MINIO_IMAGE_LINES "${_images#|}"

# ---------- 容器状态 ----------
# 没有 docker 二进制时「没有容器」是确定事实（不是猜测），可以标 absent；
# docker 在但 daemon 查不动时才是「未知」，此时绝不推断成未安装 / 已装。
_container=unknown
_run_image=""
if ! command -v docker >/dev/null 2>&1; then
  _container=absent
elif [ "$_query" = "yes" ]; then
  if docker ps -a --filter 'name=^/minio$' --format '{{.Names}}' 2>/dev/null | grep -qx minio; then
    _container="$(docker inspect --format '{{.State.Status}}' minio 2>/dev/null || printf unknown)"
    _run_image="$(docker inspect --format '{{.Config.Image}}' minio 2>/dev/null)"
    case "$_container" in
      running|exited|created|paused|restarting) ;;
      *) _container=unknown ;;
    esac
  else
    _container=absent
  fi
fi
kv MINIO_CONTAINER "$_container"
kv MINIO_RUNNING_IMAGE "$_run_image"

# ---------- 健康检查（本机 9000，只读 GET） ----------
_health=no
if [ "$_container" = "running" ] && command -v curl >/dev/null 2>&1; then
  if curl -fsS -m 3 http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1; then
    _health=ok
  fi
fi
kv MINIO_HEALTH "$_health"

# ---------- 端口占用（只读探测，优先 ss） ----------
port_state() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    if ss -H -ltn 2>/dev/null | grep -Eq "[:.]${p}[[:space:]]"; then
      printf busy
    else
      printf free
    fi
  elif command -v nc >/dev/null 2>&1; then
    if nc -z -w 1 127.0.0.1 "$p" >/dev/null 2>&1; then
      printf busy
    else
      printf free
    fi
  else
    printf unknown
  fi
}
_p9000="$(port_state 9000)"
_p9001="$(port_state 9001)"
kv MINIO_PORT_9000 "$_p9000"
kv MINIO_PORT_9001 "$_p9001"
# 已有 minio 容器时占用属于正常（安装脚本会跳过，不重建）。
_busy=no
if [ "$_container" = "absent" ] && { [ "$_p9000" = "busy" ] || [ "$_p9001" = "busy" ]; }; then
  _busy=yes
fi
kv MINIO_PORT_BUSY "$_busy"

# ---------- 数据目录 / 磁盘 ----------
_parent=no
_dir=no
[ -d /data ] && _parent=yes
[ -d /data/minio ] && _dir=yes
kv MINIO_DATA_PARENT "$_parent"
kv MINIO_DATA_DIR "$_dir"
# /data 还没建时退回根分区余量，页面才不会显示一个空值。
_free="$(df -Pm /data 2>/dev/null | awk 'NR==2{print $4}')"
[ -n "$_free" ] || _free="$(df -Pm / 2>/dev/null | awk 'NR==2{print $4}')"
kv MINIO_DATA_FREE_MB "$_free"

kv MINIO_API_PORT 9000
kv MINIO_CONSOLE_PORT 9001
kv CHECK_OK yes
