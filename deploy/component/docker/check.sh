#!/bin/bash
# ==========================================
# Docker 引擎只读体检（ops component list 在目标机执行）
#
# 🔴 只读红线：本脚本不写任何远端文件、不提权、不装包、不改服务。
#    一行一个 KEY=VALUE，由 Go 侧解析；值里不允许出现换行 / 等号以外分隔符。
#    「连不上」（ssh exit 255）由 Go 侧单独归类为 collected=false，
#    绝不在这里猜一个「未安装」的默认值。
# ==========================================
set -u

kv() {
  local k="$1" v="${2-}"
  v="${v//$'\r'/ }"
  v="${v//$'\n'/ }"
  printf '%s=%s\n' "$k" "$v"
}

kv OS_ID            "$( . /etc/os-release 2>/dev/null; printf '%s' "${ID:-}" )"
kv OS_VERSION_ID    "$( . /etc/os-release 2>/dev/null; printf '%s' "${VERSION_ID:-}" )"
kv OS_CODENAME      "$( . /etc/os-release 2>/dev/null; printf '%s' "${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}" )"
kv ARCH             "$(uname -m 2>/dev/null)"
kv USER_NAME        "$(id -un 2>/dev/null)"

if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
  kv SUDO_NOPASSWD yes
else
  kv SUDO_NOPASSWD no
fi

if command -v apt-get >/dev/null 2>&1; then kv APT_GET yes; else kv APT_GET no; fi
if command -v curl >/dev/null 2>&1; then kv CURL yes; else kv CURL no; fi

if command -v docker >/dev/null 2>&1; then
  kv DOCKER_INSTALLED yes
  kv DOCKER_BIN "$(command -v docker)"
  kv DOCKER_VERSION "$(docker --version 2>/dev/null | head -1)"
  if docker compose version >/dev/null 2>&1; then
    kv COMPOSE_PLUGIN yes
  else
    kv COMPOSE_PLUGIN no
  fi
else
  kv DOCKER_INSTALLED no
  kv DOCKER_BIN ""
  kv DOCKER_VERSION ""
  kv COMPOSE_PLUGIN no
fi

_svc="$(systemctl is-active docker 2>/dev/null | head -1 || true)"
kv DOCKER_SERVICE "${_svc:-none}"

if getent group docker >/dev/null 2>&1; then
  kv DOCKER_GROUP yes
  if id -nG 2>/dev/null | tr ' ' '\n' | grep -qx docker; then
    kv USER_IN_DOCKER_GROUP yes
  else
    kv USER_IN_DOCKER_GROUP no
  fi
else
  kv DOCKER_GROUP no
  kv USER_IN_DOCKER_GROUP no
fi

# 官方文档列出的冲突包（Install Docker Engine on Ubuntu → Uninstall old versions）。
conflicts=""
for p in docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc; do
  if [ "$(dpkg-query -W -f='${db:Status-Status}' "$p" 2>/dev/null || true)" = "installed" ]; then
    conflicts="$conflicts $p"
  fi
done
kv CONFLICT_PACKAGES "$(printf '%s' "$conflicts" | xargs 2>/dev/null || printf '%s' "$conflicts")"

if grep -rqs 'download.docker.com' /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null; then
  kv DOCKER_REPO yes
else
  kv DOCKER_REPO no
fi

# 只读探测：apt 仓库可达性。离线/受限网络下会明确报 no，不会尝试拉镜像。
# 内网出口偶发抖动，一次 6s 超时就硬拦会让预检误报；这里给两次机会（每次 10s）。
_repo_reachable=no
if command -v curl >/dev/null 2>&1; then
  for _try in 1 2; do
    if curl -fsSI -m 10 https://download.docker.com/linux/ubuntu/gpg >/dev/null 2>&1; then
      _repo_reachable=yes
      break
    fi
  done
fi
kv APT_REPO_REACHABLE "$_repo_reachable"

kv DISK_FREE_MB "$(df -Pm / 2>/dev/null | awk 'NR==2{print $4}')"
kv CHECK_OK yes
