#!/bin/sh
# 在**运行本脚本的这台机器**上测到各镜像站的延迟与吞吐（只读）。
#
# 为什么必须在目标机上跑：镜像站快不快取决于「从这台机器出发的网络」。
#
# 三条测量口径：
#   1. 吞吐必须串行：并发下载会让所有源平分带宽，名次变成「谁先启动谁快」。
#   2. 失败 ≠ 0：连不上（reachable=0）与「可达但没测到吞吐」分开报，都不给速度数字。
#   3. 404 才换下一个候选文件：403 / 超时换文件也是白搭，如实报更有用。
#
# 🔴 只读：只有 curl GET，不改文件、不提权、不装依赖。
#
# 用法：sh probe.sh                      # 内置 6 个候选源
#       APT_MIRRORS='id|名称|host|https://base' sh probe.sh
#       APT_MIRRORS_FILE=/tmp/mirrors.txt sh probe.sh
#   APT_SUITE（默认取本机 /etc/os-release 的 VERSION_CODENAME）
#   APT_ROUNDS（延迟轮次，默认 2）APT_BUDGET（每源吞吐预算秒，默认 6）
set -u

SUITE="${APT_SUITE:-}"
if [ -z "$SUITE" ]; then
  SUITE=$(sed -n 's/^VERSION_CODENAME=//p' /etc/os-release 2>/dev/null | head -n 1 | tr -d '"')
fi
ROUNDS="${APT_ROUNDS:-2}"
BUDGET="${APT_BUDGET:-6}"
# 以 apt 的身份去问：默认 UA 会被部分镜像站 403，把完全正常的源报成「不可用」。
UA='Ubuntu APT-HTTP/1.3 (2.4.11)'
LATENCY_TIMEOUT=6
# 时间预算是唯一约束：文件大小不参与名次（否则「谁的文件小谁快」）。
MAX_BYTES=67108863

DEFAULT_MIRRORS='aliyun|阿里云|mirrors.aliyun.com|https://mirrors.aliyun.com/ubuntu
tencent|腾讯云|mirrors.cloud.tencent.com|https://mirrors.cloud.tencent.com/ubuntu
huawei|华为云|repo.huaweicloud.com|https://repo.huaweicloud.com/ubuntu
ustc|中科大|mirrors.ustc.edu.cn|https://mirrors.ustc.edu.cn/ubuntu
tuna|清华 TUNA|mirrors.tuna.tsinghua.edu.cn|https://mirrors.tuna.tsinghua.edu.cn/ubuntu
official|官方（境外）|archive.ubuntu.com|https://archive.ubuntu.com/ubuntu'

if [ -n "${APT_MIRRORS:-}" ]; then
  MIRRORS="$APT_MIRRORS"
elif [ -n "${APT_MIRRORS_FILE:-}" ]; then
  if [ ! -r "$APT_MIRRORS_FILE" ]; then
    echo "## meta"
    echo "probe_error=读不到候选清单 $APT_MIRRORS_FILE"
    exit 0
  fi
  MIRRORS=$(cat "$APT_MIRRORS_FILE")
else
  MIRRORS="$DEFAULT_MIRRORS"
fi

ms() {
  awk -v s="$1" 'BEGIN { printf "%.0f", s * 1000 }'
}

echo "## meta"
echo "suite=$SUITE"
echo "rounds=$ROUNDS"
echo "budget=$BUDGET"
if [ -z "$SUITE" ]; then
  echo "probe_error=读不到发行版代号（传 APT_SUITE）"
  exit 0
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl=0"
  echo "probe_error=目标机没有 curl：本工具不装依赖，测速无法进行"
  exit 0
fi
echo "curl=1"

printf '%s\n' "$MIRRORS" | while IFS='|' read -r id name host base; do
  [ -n "${id:-}" ] || continue
  echo "## mirror"
  echo "id=$id"
  echo "name=$name"
  echo "host=$host"
  echo "base=$base"

  reachable=0
  best_c=""
  best_t=""
  best_f=""
  last_http=0
  last_err=""

  r=1
  while [ "$r" -le "$ROUNDS" ]; do
    out=$(curl -sS --http1.1 -A "$UA" -o /dev/null --max-time "$LATENCY_TIMEOUT" \
      -w '%{http_code} %{time_connect} %{time_appconnect} %{time_starttransfer}' \
      "$base/dists/$SUITE/Release" 2>&1)
    rc=$?
    if [ "$rc" -ne 0 ]; then
      last_err=$(printf '%s' "$out" | head -n 1)
      r=$((r + 1))
      continue
    fi
    set -- $out
    http=${1:-0}
    c=${2:-0}
    t=${3:-0}
    f=${4:-0}
    if [ "$http" = "200" ]; then
      c_ms=$(ms "$c")
      tls_ms=$(awk -v a="$t" -v b="$c" 'BEGIN { printf "%.0f", (a - b) * 1000 }')
      ttfb_ms=$(ms "$f")
      # 逐项取最优：某一轮偶发抖动不该把整台源判慢。
      if [ -z "$best_f" ] || [ "$ttfb_ms" -lt "$best_f" ]; then
        best_c=$c_ms
        best_t=$tls_ms
        best_f=$ttfb_ms
      fi
      reachable=1
    else
      last_http=$http
    fi
    r=$((r + 1))
  done

  if [ "$reachable" = "1" ]; then
    echo "reachable=1"
    echo "http=200"
    echo "connect_ms=$best_c"
    echo "tls_ms=$best_t"
    echo "ttfb_ms=$best_f"
  else
    echo "reachable=0"
    echo "http=$last_http"
    if [ -n "$last_err" ]; then
      echo "error=$last_err"
    elif [ "$last_http" != "0" ]; then
      echo "error=HTTP $last_http"
    else
      echo "error=未测到（全部轮次都没有结果）"
    fi
    continue
  fi

  # 吞吐：串行，每源最多 BUDGET 秒。404 才换候选文件。
  tp_ok=0
  tp_err=""
  for f in "dists/$SUITE/Contents-amd64.gz" "dists/$SUITE/main/binary-amd64/Packages.gz" "dists/$SUITE/Release"; do
    out=$(curl -sS --http1.1 -A "$UA" -r "0-$MAX_BYTES" -o /dev/null --max-time "$BUDGET" \
      -w '%{http_code} %{size_download} %{speed_download} %{time_total}' \
      "$base/$f" 2>/dev/null)
    rc=$?
    # curl 28 = 撞上 --max-time。这不是失败，是「预算到点的部分测量」：
    # curl 仍会输出 -w 统计，用已下到的字节算速度。否则 Contents（50MB+）
    # 在 6 秒预算内永远测不出吞吐，所有源都「没测到」，名次全空。
    truncated=0
    if [ "$rc" -eq 28 ]; then
      truncated=1
    elif [ "$rc" -ne 0 ]; then
      tp_err="curl 失败（exit $rc：28 超时 / 6 DNS / 7 连不上 / 60 证书）"
      break
    fi
    set -- $out
    http=${1:-0}
    bytes=${2:-0}
    secs=${4:-0}
    case "$http" in
    200 | 206)
      n=$(awk -v b="$bytes" 'BEGIN { printf "%.0f", b }')
      if [ "${n:-0}" -gt 0 ]; then
        tp_ok=1
        kbps=$(awk -v n="$n" -v t="$secs" 'BEGIN { if (t <= 0) t = 0.001; printf "%.1f", (n / 1024) / t }')
        echo "throughput_ok=1"
        echo "kbps=$kbps"
        echo "bytes=$n"
        echo "seconds=$(awk -v t="$secs" 'BEGIN { printf "%.2f", t }')"
        echo "truncated=$truncated"
        echo "file=$f"
        break
      fi
      tp_err="在 ${BUDGET}s 预算内一个字节都没下到"
      break
      ;;
    404)
      # 这个文件不在这台镜像上：换下一个候选。
      continue
      ;;
    *)
      tp_err="HTTP $http"
      break
      ;;
    esac
  done
  if [ "$tp_ok" = "0" ]; then
    echo "throughput_ok=0"
    echo "throughput_error=${tp_err:-没测到}"
  fi
done
