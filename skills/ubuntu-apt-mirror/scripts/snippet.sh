#!/bin/sh
# 打印一份 deb822 换源文本（Ubuntu 24.04+）。
#
# 🔴 这是换源文本的**唯一来源**：界面展示、CLI 打印、远端写入都用这一份，
#    否则「给你看的那段」和「实际写进去的那段」迟早对不上。
#
# 用法：sh snippet.sh [仓库根] [发行版代号]
#   sh snippet.sh https://mirrors.aliyun.com/ubuntu noble
#   也可用变量：APT_BASE / APT_SUITE / APT_COMPONENTS / APT_KEYRING
#
# 输出末尾有且只有一个换行，两个 Types: 块之间是空行 —— 与 apt 自己生成的格式一致。
set -u

BASE="${1:-${APT_BASE:-https://mirrors.aliyun.com/ubuntu}}"
SUITE="${2:-${APT_SUITE:-}}"
if [ -z "$SUITE" ]; then
  SUITE=$(sed -n 's/^VERSION_CODENAME=//p' /etc/os-release 2>/dev/null | head -n 1 | tr -d '"')
fi
if [ -z "$SUITE" ]; then
  echo "读不到发行版代号：传第二个参数或用 APT_SUITE" >&2
  exit 2
fi
COMPONENTS="${APT_COMPONENTS:-main restricted universe multiverse}"
KEYRING="${APT_KEYRING:-/usr/share/keyrings/ubuntu-archive-keyring.gpg}"

# 只去掉末尾斜杠，中间原样保留。
BASE=$(printf '%s' "$BASE" | sed 's:/*$::')

cat <<EOF
Types: deb
URIs: $BASE/
Suites: $SUITE $SUITE-updates $SUITE-backports
Components: $COMPONENTS
Signed-By: $KEYRING

Types: deb
URIs: $BASE/
Suites: $SUITE-security
Components: $COMPONENTS
Signed-By: $KEYRING
EOF
