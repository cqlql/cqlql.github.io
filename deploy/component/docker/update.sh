#!/bin/bash
# ==========================================
# Docker 引擎更新（ops component update docker --server <name>）
# 由 Go 侧上传到目标机并以 root 执行。判据见 docs/components.md §8.2。
#
# 🔴 只动引擎包：不换 / 不重建 MinIO 容器镜像，不 docker pull，不删数据。
# 🔴 apt 升级会重启 docker.service，下游 MinIO 容器会短暂中断；
#    这个连带影响由 Go 侧算进确认弹窗，这里再如实回显一次。
# 🔴 可选代理只在本次 apt / curl 进程内生效，绝不写 /etc/apt/apt.conf.d/。
# ==========================================
set -euo pipefail

RUN_USER="${COMPONENT_RUN_USER:-}"
CODENAME="${COMPONENT_OS_CODENAME:-}"
PROXY="${COMPONENT_APT_PROXY:-}"
TARGET_VERSION="${COMPONENT_DOCKER_TARGET_VERSION:-}"

ok()   { echo "  [OK]   $*"; }
info() { echo "  [INFO] $*"; }
die()  { echo "  [FAIL] $*" >&2; exit 1; }

echo ""
echo "========== Docker 引擎更新（只升引擎包） =========="

# ---------- Step 0：前置校验（任何一项不过都不改远端） ----------
[ "$(id -u)" -eq 0 ] || die "更新必须以 root 执行（工具经 sudo 提权）"
[[ "$RUN_USER" =~ ^[A-Za-z_][A-Za-z0-9_-]*$ ]] || die "运行用户名非法或为空：$RUN_USER"
[[ "$CODENAME" =~ ^[a-z]+$ ]] || die "Ubuntu codename 非法或为空：$CODENAME"
command -v dpkg >/dev/null 2>&1 || die "未找到 dpkg（本脚本只支持 Ubuntu/Debian）"
command -v apt-get >/dev/null 2>&1 || die "未找到 apt-get"
command -v curl >/dev/null 2>&1 || die "未找到 curl"
OS_ID="$( . /etc/os-release 2>/dev/null; printf '%s' "${ID:-}" )"
[ "$OS_ID" = "ubuntu" ] || die "官方 apt 仓库只支持 Ubuntu，当前 OS_ID=$OS_ID"
command -v docker >/dev/null 2>&1 || die "未找到 docker：没有引擎可更新（请走 install）"
INSTALLED="$(apt-cache policy docker-ce 2>/dev/null | awk '/Installed:/{print $2; exit}')"
CANDIDATE="$(apt-cache policy docker-ce 2>/dev/null | awk '/Candidate:/{print $2; exit}')"
[ -n "$INSTALLED" ] && [ "$INSTALLED" != "(none)" ] || die "取不到已装 docker-ce 版本"
[ -n "$CANDIDATE" ] && [ "$CANDIDATE" != "(none)" ] || die "官方 apt 仓库没有可用候选版本（请检查源 / 代理）"
[ "$CANDIDATE" != "$INSTALLED" ] || die "候选版本与已装版本相同（$INSTALLED），没有可升级的包"
[ "$TARGET_VERSION" = "$CANDIDATE" ] || info "预检时的候选版本是 $TARGET_VERSION，远端当前候选是 $CANDIDATE（以远端为准）"

# ---------- Step 0.5：可选代理（本次临时生效） ----------
APT_PROXY_OPTS=()
if [ -n "$PROXY" ]; then
  [[ "$PROXY" =~ ^http://[A-Za-z0-9][A-Za-z0-9.-]*:[0-9]{1,5}$ ]] || die "代理地址格式非法：$PROXY"
  export http_proxy="$PROXY" https_proxy="$PROXY" HTTP_PROXY="$PROXY" HTTPS_PROXY="$PROXY"
  APT_PROXY_OPTS=(-o "Acquire::http::Proxy=$PROXY" -o "Acquire::https::Proxy=$PROXY")
  ok "本次 apt / curl 走代理 $PROXY（只这次生效，不写任何远端配置文件）"
fi

# ---------- Step 1：记录下游 MinIO 容器状态（只读） ----------
MINIO_WAS_RUNNING=no
if docker info >/dev/null 2>&1 && docker ps --filter "name=^/minio$" --format '{{.Names}}' 2>/dev/null | grep -qx minio; then
  MINIO_WAS_RUNNING=yes
fi
ok "身份 root；运行用户 $RUN_USER；下游 MinIO 容器运行中：$MINIO_WAS_RUNNING"
info "🔴 升级会重启 docker.service，MinIO 容器会短暂中断（确认弹窗已列明）"

# ---------- Step 2：只升官方引擎包（--only-upgrade，不装新包） ----------
info "apt-get update → --only-upgrade docker-ce 系列（$INSTALLED → $CANDIDATE）"
apt-get "${APT_PROXY_OPTS[@]}" update -qq
DEBIAN_FRONTEND=noninteractive apt-get "${APT_PROXY_OPTS[@]}" install -y -qq --only-upgrade \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
ok "引擎包升级完成（/var/lib/docker、容器与已导入镜像全部保留）"

# ---------- Step 3：重启服务并只读验证 ----------
if command -v systemctl >/dev/null 2>&1; then
  systemctl restart docker >/dev/null
  ok "docker.service 已重启"
else
  die "未找到 systemctl：无法按官方流程重启 docker.service"
fi
docker info --format '{{.ServerVersion}}' >/dev/null 2>&1 || die "升级后 docker daemon 不可用（docker info 失败）"
ok "docker daemon 可用，ServerVersion=$(docker info --format '{{.ServerVersion}}' 2>/dev/null)"

# ---------- Step 4：下游健康检查（容器原来在跑才检查） ----------
if [ "$MINIO_WAS_RUNNING" = "yes" ]; then
  _healthy=no
  for _try in $(seq 1 20); do
    if curl -fsS -m 2 http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1; then
      _healthy=yes
      break
    fi
    sleep 1
  done
  [ "$_healthy" = "yes" ] || die "引擎升级后 MinIO 健康检查未通过；容器与数据未改动，请人工复核"
  ok "下游 MinIO 已恢复：http://127.0.0.1:9000/minio/health/live"
else
  info "下游 MinIO 原本没在跑，跳过健康检查"
fi

echo ""
echo "Docker 引擎更新完成；MinIO 容器镜像未换、/data/minio 未动、crontab / backup.env 未改。"
exit 0
