#!/bin/sh
# 锚点与 map 对账。
# 用法: verify-anchors.sh <主体文件> <map文件>
#
# 需要 grep / sed / awk / sort / uniq / comm（Git Bash、WSL、Linux、macOS 均可）。

set -eu

BODY=${1:?用法: verify-anchors.sh <主体文件> <map文件>}
MAP=${2:?用法: verify-anchors.sh <主体文件> <map文件>}

BODY_SLUGS=$(mktemp)
MAP_REFS=$(mktemp)
trap 'rm -f "$BODY_SLUGS" "$MAP_REFS"' EXIT

echo "① 锚点总数（与 map 状态行对账）"
N=$(grep -c "@section" "$BODY" || true)
echo "   $N 个"

echo "① slug 重复（应无输出）"
grep -n "@section" "$BODY" \
  | sed 's/.*@section \([^ ]*\).*/\1/' \
  | sort | uniq -d

echo "② map 引用了但源文件没有的 slug（应无输出）"
grep -o '@section [a-z0-9-]*' "$BODY" | awk '{print $2}' | sort -u > "$BODY_SLUGS"
# 只取表格第二列：全文反引号全量匹配会把 CLI 动词、场景键当成锚点，必然误报。
grep '^| ' "$MAP" \
  | sed 's/^|[^|]*|//' \
  | grep -o '`[a-z][a-z0-9-]*`' \
  | tr -d '`' | sort -u > "$MAP_REFS"
comm -23 "$MAP_REFS" "$BODY_SLUGS"

echo "③ 纯补锚点那次：只允许注释行变化（手工执行）"
echo "   git diff --unified=0 $BODY"
