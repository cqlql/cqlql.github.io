#!/bin/bash
# ==========================================
# MinIO 服务更新（ops component update minio --server <name> --image-ref <ref>）
# 由 Go 侧把本机 backup/minio.env 的凭证拼在本文件头部后上传，以 root 执行。
# 判据见 docs/components.md §8.2 / §8.4。
#
# 🔴 只动这一个组件：换镜像只重建容器，Docker 引擎一个包都不动。
# 🔴 目标镜像必须已经在目标机离线导入；绝不 docker pull。
# 🔴 失败回滚只回到「原镜像标签 + 原容器配置」，/data/minio 数据卷从头到尾不参与回滚。
# 🔴 凭证只经 -e 注入，不 echo、不 inspect 全量配置（那会把 root 凭证带进日志）。
# ==========================================
set -euo pipefail

ROOT_USER="${COMPONENT_MINIO_ROOT_USER:-}"
ROOT_SECRET="${COMPONENT_MINIO_ROOT_PASSWORD:-}"
IMAGE="${COMPONENT_MINIO_IMAGE:-}"
RUN_USER="${COMPONENT_RUN_USER:-}"
CONTAINER=minio
DEFAULT_DATA_DIR=/data/minio

ok()   { echo "  [OK]   $*"; }
info() { echo "  [INFO] $*"; }
die()  { echo "  [FAIL] $*" >&2; exit 1; }

echo ""
echo "========== MinIO 服务更新（只换容器镜像） =========="

# ---------- Step 0：前置校验（任何一项不过都不改远端） ----------
[ "$(id -u)" -eq 0 ] || die "更新必须以 root 执行（工具经 sudo 提权）"
[ -n "$ROOT_USER" ] || die "root 用户名缺失（本机 backup/minio.env 的 DEST_KEY）"
[ -n "$ROOT_SECRET" ] || die "root 密钥缺失（本机 backup/minio.env 的 DEST_SECRET）"
[[ "$RUN_USER" =~ ^[A-Za-z_][A-Za-z0-9_-]*$ ]] || die "运行用户名非法或为空：$RUN_USER"
[[ "$IMAGE" =~ ^[A-Za-z0-9][A-Za-z0-9._/:-]*$ ]] || die "目标镜像引用非法或为空：$IMAGE"
command -v docker >/dev/null 2>&1 || die "未找到 docker（上游引擎未安装）"
docker info >/dev/null 2>&1 || die "docker daemon 不可用（docker info 失败）"
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "目标机没有镜像 $IMAGE；本脚本不会 pull，请先导入离线 tar"
docker ps -a --filter "name=^/${CONTAINER}$" --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER" \
  || die "目标机没有 MinIO 容器；没有容器可更新（请走 install）"

OLD_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
[ -n "$OLD_IMAGE" ] || die "读不到当前容器镜像标签，拒绝重建"
[ "$OLD_IMAGE" != "$IMAGE" ] || die "目标镜像与当前容器镜像相同，没有可更新的版本"

# ---------- Step 1：记录当前容器配置（只读，只取需要的字段） ----------
# 🔴 不 inspect 全量配置：那会把 MINIO_ROOT_PASSWORD 带进日志。
API_PORT="$(docker port "$CONTAINER" 9000/tcp 2>/dev/null | head -1 | sed -E 's/.*:([0-9]+)$/\1/' || true)"
CONSOLE_PORT="$(docker port "$CONTAINER" 9001/tcp 2>/dev/null | head -1 | sed -E 's/.*:([0-9]+)$/\1/' || true)"
[ -n "$API_PORT" ] || API_PORT=9000
[ -n "$CONSOLE_PORT" ] || CONSOLE_PORT=9001
DATA_SRC="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}' "$CONTAINER" 2>/dev/null || true)"
[ -n "$DATA_SRC" ] || DATA_SRC="$DEFAULT_DATA_DIR"
[ -d "$DATA_SRC" ] || die "数据目录 $DATA_SRC 不存在，拒绝重建容器（数据卷不参与回滚）"
RESTART="$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$CONTAINER" 2>/dev/null || true)"
[ -n "$RESTART" ] && [ "$RESTART" != "no" ] || RESTART=unless-stopped
ok "已记录原配置：镜像 $OLD_IMAGE · 端口 $API_PORT/$CONSOLE_PORT · 挂载 $DATA_SRC:/data · 重启策略 $RESTART"

start_container() {
  docker run -d --name "$CONTAINER" --restart "$RESTART" \
    -p "${API_PORT}:9000" -p "${CONSOLE_PORT}:9001" \
    -e MINIO_ROOT_USER="$ROOT_USER" -e MINIO_ROOT_PASSWORD="$ROOT_SECRET" \
    -v "${DATA_SRC}:/data" \
    "$1" server /data --console-address ":9001" >/dev/null
}

health_ok() {
  if command -v curl >/dev/null 2>&1; then
    for _try in $(seq 1 20); do
      if curl -fsS -m 2 "http://127.0.0.1:${API_PORT}/minio/health/live" >/dev/null 2>&1; then
        return 0
      fi
      sleep 1
    done
    return 1
  fi
  [ "$(docker inspect --format '{{.State.Status}}' "$CONTAINER" 2>/dev/null)" = "running" ]
}

# ---------- Step 2：停旧容器 → 用新镜像重建（不加 -v，数据在宿主机上） ----------
info "docker stop $CONTAINER → docker rm $CONTAINER（不带 -v，$DATA_SRC 原封不动）"
docker stop "$CONTAINER" >/dev/null
docker rm "$CONTAINER" >/dev/null

if start_container "$IMAGE" && health_ok; then
  ok "已切换到 $IMAGE，/minio/health/live 200 OK"
else
  # ---------- Step 3：失败只回滚容器，数据卷从头到尾不参与 ----------
  info "新镜像启动 / 健康检查失败，回滚到原镜像标签 + 原容器配置"
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  start_container "$OLD_IMAGE" || die "回滚容器创建失败；数据卷 $DATA_SRC 未动，请人工复核"
  health_ok || die "回滚后健康检查未通过；数据卷 $DATA_SRC 未动，请人工复核"
  die "更新失败，已回滚到 $OLD_IMAGE 与原容器配置；数据卷未参与回滚，请复核日志后再试"
fi

echo ""
echo "MinIO 服务更新完成：引擎、其它镜像、/data/minio、crontab / backup.env 均未改动。"
exit 0
