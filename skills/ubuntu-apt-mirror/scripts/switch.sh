#!/usr/bin/env sh
# 把**这台机器**的 Ubuntu 24.04+ apt 源换成指定镜像站：预演用 plan，写入用 apply。
#
# 为什么必须先验证再写：换源是一次可能让 apt 整个不可用的改动（地址写错 / 镜像没镜像
# 该 component / 签名对不上），下一次 apt install 才爆出来，而那时人未必记得刚换过源。
# 所以写入前只用**元数据**验证（几秒钟，不跑 apt-get update、不碰 apt 锁）：
#   ① 逐 suite 取 InRelease —— 取得到说明该 suite 在这台镜像上存在；
#   ② 用与候选源 Signed-By **同一个** keyring 验签 —— 这里过不了，apt 一定过不了；
#   ③ InRelease 里列着索引文件的校验和 —— 用它确认 components 真在里面。
#
# 变量：
#   APT_MODE=plan|apply（默认 plan）        APT_BASE=<http(s)://...>
#   APT_SUITE / APT_SUITES                  APT_COMPONENTS（默认 main restricted universe multiverse）
#   APT_NEXT_B64 或 APT_NEXT_FILE           APT_KEYRING
#   APT_SOURCES（默认 /etc/apt/sources.list.d/ubuntu.sources）
#   APT_ONELINE（默认 /etc/apt/sources.list）
#
# 用法：先落盘再 sudo，别用 `sudo sh -s`（喂脚本和读密码会抢 stdin）。
#   scp switch.sh root@host:/tmp/ && ssh -t root@host 'sh /tmp/switch.sh'
set -u

MODE="${APT_MODE:-plan}"
BASE="${APT_BASE:-}"
SUITE="${APT_SUITE:-}"
SUITES="${APT_SUITES:-}"
COMPONENTS="${APT_COMPONENTS:-main restricted universe multiverse}"
NEXT_B64="${APT_NEXT_B64:-}"
NEXT_FILE="${APT_NEXT_FILE:-}"
KEYRING="${APT_KEYRING:-/usr/share/keyrings/ubuntu-archive-keyring.gpg}"

DEB822="${APT_SOURCES:-/etc/apt/sources.list.d/ubuntu.sources}"
ONELINE="${APT_ONELINE:-/etc/apt/sources.list}"
UA='Ubuntu APT-HTTP/1.3 (2.4.11)'

if [ -z "$SUITE" ]; then
  SUITE=$(sed -n 's/^VERSION_CODENAME=//p' /etc/os-release 2>/dev/null | head -n 1 | tr -d '"')
fi
if [ -z "$SUITES" ] && [ -n "$SUITE" ]; then
  SUITES="$SUITE $SUITE-updates $SUITE-backports $SUITE-security"
fi

echo "## switch"
echo "mode=$MODE"
echo "path=$DEB822"
echo "suite=$SUITE"

fail() {
  echo "result=$1"
  echo "detail=$2"
  exit 1
}

case "$BASE" in
http://* | https://*) ;;
*) fail bad_base "仓库根必须是 http(s):// 开头（当前：$BASE）" ;;
esac

if [ -z "$SUITE" ]; then
  fail no_suite "读不到本机发行版代号（/etc/os-release 没有 VERSION_CODENAME），无法生成正确的源配置"
fi
# 逐个 token 校验：suite 会被拼进 URL 与写入的文本，不接受空格分裂出来的怪字符。
bad_t=""
for t in $SUITES; do
  case "$t" in
  '' | [!a-z]*) bad_t="$t" ;;
  *[!a-z0-9-]*) bad_t="$t" ;;
  esac
done
if [ -n "$bad_t" ]; then
  fail bad_suite "suite 里出现非法 token（只允许小写字母、数字、连字符）：$bad_t"
fi

if [ ! -f "$DEB822" ]; then
  if [ -f "$ONELINE" ]; then
    fail unsupported_layout "本机只有一行式 $ONELINE（Ubuntu 22.04 及更早），格式与 deb822 不同 —— 不改它，以免写坏 apt"
  fi
  fail no_source_file "本机没有 $DEB822，无法判断该改哪个文件 —— 没有做任何改动"
fi

if [ ! -r "$KEYRING" ]; then
  fail no_keyring "缺少验签用的 $KEYRING（apt 将来也不会接受这个源）"
fi
if ! command -v gpgv >/dev/null 2>&1; then
  fail no_gpgv "本机没有 gpgv，无法验签；本脚本不装依赖"
fi
if ! command -v curl >/dev/null 2>&1; then
  fail no_curl "本机没有 curl，无法取 InRelease 验证；本脚本不装依赖"
fi

tmp=$(mktemp -d "${TMPDIR:-/tmp}/aptmirror-verify.XXXXXX") || fail temp_failed "建临时目录失败"
trap 'rm -rf "$tmp"' EXIT INT TERM

# ---- 1) 写前验证：suite 存在 / 签名对得上 / components 齐全 ----
for s in $SUITES; do
  f="$tmp/InRelease.$s"
  if ! curl -sS --http1.1 -A "$UA" --max-time 20 -o "$f" "$BASE/dists/$s/InRelease" 2>"$tmp/curl.err"; then
    fail verify_failed "$s 的 InRelease 取不到：$(head -n 1 "$tmp/curl.err" 2>/dev/null)"
  fi
  if [ ! -s "$f" ]; then
    fail verify_failed "$s 的 InRelease 是空文件"
  fi
  if ! gpgv --keyring "$KEYRING" "$f" >/dev/null 2>&1; then
    fail verify_failed "$s 的 InRelease 验签失败（keyring $KEYRING 不认这台镜像的签名）"
  fi
  for c in $COMPONENTS; do
    if ! grep -q " $c/binary-amd64/Packages" "$f"; then
      fail verify_failed "$s 的 InRelease 里没有 component $c —— 这个镜像没有镜像它"
    fi
  done
  echo "verify=ok $s"
done

# ---- 2) 算出当前 / 目标内容，比较 ----
current=$(cat "$DEB822")
if [ -n "$NEXT_B64" ]; then
  next=$(printf '%s' "$NEXT_B64" | base64 -d 2>"$tmp/base64.err") || fail bad_next "换源文本解码失败"
elif [ -n "$NEXT_FILE" ]; then
  next=$(cat "$NEXT_FILE" 2>"$tmp/read.err") || fail bad_next "读不到换源文本 $NEXT_FILE"
else
  fail bad_next "没给换源文本：用 APT_NEXT_FILE 或 APT_NEXT_B64（应由 snippet.sh 生成）"
fi
if [ -z "$next" ]; then
  fail bad_next "换源文本为空，拒绝写入"
fi

echo "current_b64=$(printf '%s' "$current" | base64 -w0 2>/dev/null || printf '%s' "$current" | base64 | tr -d '\n')"
echo "next_b64=$(printf '%s' "$next" | base64 -w0 2>/dev/null || printf '%s' "$next" | base64 | tr -d '\n')"

if [ "$current" = "$next" ]; then
  echo "changed=0"
  echo "result=no_change"
  exit 0
fi
echo "changed=1"

if [ "$MODE" != "apply" ]; then
  echo "result=plan"
  exit 0
fi

# ---- 3) 备份 → 写 → 复核 → 失败还原 ----
backup="$DEB822.aptmirror.bak"
if ! cp -a "$DEB822" "$backup" 2>"$tmp/cp.err"; then
  fail backup_failed "写前备份失败，为安全起见没有写入：$(head -n 1 "$tmp/cp.err" 2>/dev/null)"
fi
echo "backup=$backup"

tf="$tmp/ubuntu.sources"
printf '%s\n' "$next" >"$tf" || fail write_failed "写临时文件失败"
if ! install -m 0644 "$tf" "$DEB822" 2>"$tmp/install.err"; then
  if cp -a "$backup" "$DEB822" 2>/dev/null; then
    echo "rolled_back=1"
  else
    echo "rolled_back=0"
  fi
  fail write_failed "写入失败（原文件已备份到 $backup）：$(head -n 1 "$tmp/install.err" 2>/dev/null)"
fi

# 落盘复核：读回来的必须是刚写进去的那份，否则同样算没写成。
post=$(cat "$DEB822")
echo "post_b64=$(printf '%s' "$post" | base64 -w0 2>/dev/null || printf '%s' "$post" | base64 | tr -d '\n')"
if [ "$post" != "$next" ]; then
  fail write_mismatch "写入后读回的内容与目标不一致（原文件已备份到 $backup）"
fi

echo "applied=1"
echo "result=done"
