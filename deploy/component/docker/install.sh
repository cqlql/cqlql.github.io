#!/bin/bash
# ==========================================
# Docker 引擎安装（按官方 Install Docker Engine on Ubuntu / apt repository）
# 由 `ops component install docker --server <name>` 上传到目标机并以 root 执行。
#
# 🔴 身份：安装期以 root 跑（写 /etc/apt、systemctl、usermod）；
#    COMPONENT_RUN_USER 由工具从 servers.json.user 显式传入，只用来加 docker 组，
#    绝不靠 SUDO_USER 猜。运行期仍是清单 user。
# 🔴 幂等：已装官方版（含 compose 插件）就跳过 apt 安装，只补齐服务与用户组；
#    不删 /var/lib/docker、不动任何容器与镜像。
# 🔴 验证不用 hello-world：它会从 Docker Hub 拉镜像，而内网目标机实测 Docker Hub
#    超时（2026-11-06 k1）。改用只读的 docker info，不产生任何外网依赖。
# ==========================================
set -euo pipefail

RUN_USER="${COMPONENT_RUN_USER:-}"
CODENAME="${COMPONENT_OS_CODENAME:-}"
# 可选：本次 apt / curl 走代理（界面安装弹窗 / CLI --proxy 传入）。
# 🔴 只在脚本进程内生效，绝不写 /etc/apt/apt.conf.d/ 等远端系统配置。
PROXY="${COMPONENT_APT_PROXY:-}"

ok()   { echo "  [OK]   $*"; }
info() { echo "  [INFO] $*"; }
die()  { echo "  [FAIL] $*" >&2; exit 1; }

echo ""
echo "========== Docker 引擎安装 =========="

# ---------- Step 0：前置校验（任何一项不过都不改远端） ----------
[ "$(id -u)" -eq 0 ] || die "安装期必须以 root 执行（工具经 sudo -n 提权）"
[[ "$RUN_USER" =~ ^[A-Za-z_][A-Za-z0-9_-]*$ ]] || die "运行用户名非法或为空：$RUN_USER"
[ "$RUN_USER" != "root" ] || die "运行用户不允许是 root"
id "$RUN_USER" >/dev/null 2>&1 || die "运行用户不存在：$RUN_USER"
[[ "$CODENAME" =~ ^[a-z]+$ ]] || die "Ubuntu codename 非法或为空：$CODENAME"
command -v dpkg >/dev/null 2>&1 || die "未找到 dpkg（本脚本只支持 Ubuntu/Debian）"
command -v apt-get >/dev/null 2>&1 || die "未找到 apt-get"
command -v curl >/dev/null 2>&1 || die "未找到 curl"

OS_ID="$( . /etc/os-release 2>/dev/null; printf '%s' "${ID:-}" )"
[ "$OS_ID" = "ubuntu" ] || die "官方 apt 仓库只支持 Ubuntu，当前 OS_ID=$OS_ID"
ARCH="$(dpkg --print-architecture)"
[[ "$ARCH" =~ ^[a-z0-9]+$ ]] || die "架构值非法：$ARCH"

ok "身份 root；运行用户 $RUN_USER；系统 ubuntu $CODENAME / $ARCH"

# ---------- Step 0.5：可选代理（本次安装临时生效） ----------
APT_PROXY_OPTS=()
if [ -n "$PROXY" ]; then
  [[ "$PROXY" =~ ^http://[A-Za-z0-9][A-Za-z0-9.-]*:[0-9]{1,5}$ ]] || die "代理地址格式非法：$PROXY"
  # curl 读小写 https_proxy；apt 显式用 -o 指定，避免依赖 sudo 的环境继承行为。
  export http_proxy="$PROXY" https_proxy="$PROXY" HTTP_PROXY="$PROXY" HTTPS_PROXY="$PROXY"
  APT_PROXY_OPTS=(-o "Acquire::http::Proxy=$PROXY" -o "Acquire::https::Proxy=$PROXY")
  ok "本次 apt / curl 走代理 $PROXY（仅这次安装生效，不写任何远端配置文件）"
fi

# ---------- Step 1：是否已装好官方版 ----------
ALREADY=no
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  ALREADY=yes
  info "已检测到 Docker Engine + compose 插件：$(docker --version 2>/dev/null | head -1)"
  info "跳过 apt 仓库与包安装，只补齐服务状态与用户组"
fi

if [ "$ALREADY" = "no" ]; then
  # ---------- Step 2：卸载官方列出的冲突包 ----------
  conflicts=""
  for p in docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc; do
    if [ "$(dpkg-query -W -f='${db:Status-Status}' "$p" 2>/dev/null || true)" = "installed" ]; then
      conflicts="$conflicts $p"
    fi
  done
  if [ -n "$conflicts" ]; then
    info "卸载冲突包（/var/lib/docker 会保留）：$conflicts"
    DEBIAN_FRONTEND=noninteractive apt-get "${APT_PROXY_OPTS[@]}" remove -y $conflicts
    ok "冲突包已卸载"
  else
    ok "无冲突包"
  fi

  # ---------- Step 3：基础依赖 + 官方 GPG key ----------
  info "apt-get update / 安装 ca-certificates curl"
  apt-get "${APT_PROXY_OPTS[@]}" update -qq
  DEBIAN_FRONTEND=noninteractive apt-get "${APT_PROXY_OPTS[@]}" install -y -qq ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  # 配了代理时 curl 由 https_proxy 自动走代理（不需要改命令）。
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  ok "GPG key 已写入 /etc/apt/keyrings/docker.asc"

  # ---------- Step 4：deb822 仓库源（官方当前写法，不再是 docker.list） ----------
  tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${CODENAME}
Components: stable
Architectures: ${ARCH}
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  ok "仓库源已写入 /etc/apt/sources.list.d/docker.sources（Suites=${CODENAME}）"
  apt-get "${APT_PROXY_OPTS[@]}" update -qq

  # ---------- Step 5：安装 Docker Engine ----------
  info "安装 docker-ce / docker-ce-cli / containerd.io / buildx / compose 插件"
  DEBIAN_FRONTEND=noninteractive apt-get "${APT_PROXY_OPTS[@]}" install -y -qq \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  ok "Docker Engine 包安装完成"
fi

# ---------- Step 6：启用服务 + 把运行用户加入 docker 组 ----------
if command -v systemctl >/dev/null 2>&1; then
  systemctl enable --now docker >/dev/null
  ok "docker.service 已启用并运行"
else
  info "未找到 systemctl：跳过 enable，请自行确认 dockerd 已启动"
fi
groupadd -f docker
usermod -aG docker "$RUN_USER"
ok "$RUN_USER 已加入 docker 组（组变更需重新登录才在当前会话生效）"

# ---------- Step 7：只读验证（不拉任何镜像） ----------
command -v docker >/dev/null 2>&1 || die "安装后仍找不到 docker 命令"
docker --version
docker compose version
if docker info --format '{{.ServerVersion}}' >/dev/null 2>&1; then
  ok "docker daemon 可用，ServerVersion=$(docker info --format '{{.ServerVersion}}' 2>/dev/null)"
else
  die "docker daemon 不可用（docker info 失败）；未执行任何镜像拉取"
fi

echo ""
echo "Docker 引擎安装完成。"
echo "下一步：导入 MinIO 离线镜像后单独安装 MinIO 服务；DEST_URL 需指向本机 9000。"
exit 0
