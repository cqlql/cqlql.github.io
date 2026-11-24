#!/bin/sh
# apt 源现状（只读）。
#
# 🔴 只读：不写任何文件、不提权、不装任何东西。sudo 能力不在这个脚本里探测 ——
#    只读采集不提权，是这个能力的硬规矩。
# 🔴 输出是分节文本（## 节名 + key=value）。当前文件全文用 base64 单行带出，
#    避免换行 / 引号 / 空行在传输与解析里被吃掉。
#
# 用法：ssh root@host 'sh -s' < status.sh
#   可覆盖：APT_SOURCES（默认 /etc/apt/sources.list.d/ubuntu.sources）
#           APT_ONELINE（默认 /etc/apt/sources.list，Debian 用 debian.sources 另指）
set -u

DEB822="${APT_SOURCES:-/etc/apt/sources.list.d/ubuntu.sources}"
ONELINE="${APT_ONELINE:-/etc/apt/sources.list}"
KEYRING="${APT_KEYRING:-/usr/share/keyrings/ubuntu-archive-keyring.gpg}"

os_id=""
codename=""
if [ -r /etc/os-release ]; then
  os_id=$(sed -n 's/^ID=//p' /etc/os-release 2>/dev/null | head -n 1 | tr -d '"')
  codename=$(sed -n 's/^VERSION_CODENAME=//p' /etc/os-release 2>/dev/null | head -n 1 | tr -d '"')
fi

echo "## apt"
echo "os_id=$os_id"
echo "codename=$codename"
echo "path=$DEB822"

if [ -f "$DEB822" ]; then
  echo "deb822_exists=1"
else
  echo "deb822_exists=0"
fi
if [ -f "$ONELINE" ]; then
  echo "oneline_exists=1"
else
  echo "oneline_exists=0"
fi
if command -v curl >/dev/null 2>&1; then
  echo "curl=1"
else
  echo "curl=0"
fi
if command -v gpgv >/dev/null 2>&1; then
  echo "gpgv=1"
else
  echo "gpgv=0"
fi
if [ -r "$KEYRING" ]; then
  echo "keyring=1"
else
  echo "keyring=0"
fi

echo "## current"
if [ -f "$DEB822" ]; then
  # base64 -w0 是 GNU coreutils；缺失时退回不带换行的等价写法。
  b64=$(base64 -w0 "$DEB822" 2>/dev/null || base64 "$DEB822" 2>/dev/null | tr -d '\n')
  echo "content_b64=$b64"
fi
