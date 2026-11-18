#!/usr/bin/env bash
# 结构验证：只检查「规范有没有被遵守」，不检查「规范有没有用」。
# 用法：bash check-agents.sh [仓库路径]（默认当前目录）
# 退出码：0 全通过；1 有 FAIL。
set -u

ROOT="${1:-.}"
A="$ROOT/AGENTS.md"
MAX_LINES=220
MAX_BYTES=16896   # 16.5KB
fails=0

pass() { printf '  [PASS] %-24s %s\n' "$1" "$2"; }
fail() { printf '  [FAIL] %-24s %s\n' "$1" "$2"; fails=$((fails+1)); }
warn() { printf '  [WARN] %-24s %s\n' "$1" "$2"; }

echo "检查目标：$ROOT"
echo "────────────────────────────────────────────────────────────"

if [ ! -f "$A" ]; then
  fail "AGENTS.md" "不存在"
  echo; echo "结论：FAIL（$fails 项）"; exit 1
fi

lines=$(wc -l < "$A" | tr -d ' ')
bytes=$(wc -c < "$A" | tr -d ' ')
kb=$(awk -v b="$bytes" 'BEGIN{printf "%.1f", b/1024}')

[ "$lines" -le "$MAX_LINES" ] && pass "行数" "$lines ≤ $MAX_LINES" \
  || fail "行数" "$lines > $MAX_LINES（超 $((lines-MAX_LINES)) 行）"

if [ "$bytes" -le "$MAX_BYTES" ]; then
  pass "体积" "${kb}KB ≤ 16.5KB"
else
  fail "体积" "${kb}KB > 16.5KB（超 $(awk -v b="$bytes" -v m="$MAX_BYTES" 'BEGIN{printf "%.1f", (b-m)/1024}')KB）"
fi

# 注：git-bash 下 grep 对 emoji 匹配不可靠，用 awk 的 gsub 计数
reds=$(awk '{n=gsub(/🔴/,"x"); t+=n} END{print t+0}' "$A")
if [ "$reds" -ge 10 ] && [ "$reds" -le 20 ]; then
  pass "🔴 条数" "$reds（10~20）"
else
  warn "🔴 条数" "$reds（建议 10~20；满屏红点 = 没有红点）"
fi

# ── 任务路由表 ────────────────────────────────────────────────
if grep -qE '^#{2,3} .*任务路由' "$A"; then
  rows=$(awk '/^#{2,3} .*任务路由/{f=1;next} /^## /{f=0} f' "$A" | grep -c '^|' || true)
  rows=$((rows>2 ? rows-2 : 0))
  if [ "$rows" -ge 1 ] && [ "$rows" -le 8 ]; then
    pass "任务路由表" "$rows 行数据（≤8）"
  else
    fail "任务路由表" "$rows 行数据（上限 8）"
  fi
  # 表内引用的 docs 文件是否真实存在
  missing=""
  for f in $(awk '/^#{2,3} .*任务路由/{f=1;next} /^## /{f=0} f' "$A" \
             | grep -o 'docs/[A-Za-z0-9_./-]*\.md' | sort -u); do
    [ -f "$ROOT/$f" ] || missing="$missing $f"
  done
  if [ -z "$missing" ]; then
    pass "路由表目标文件" "全部存在"
  else
    fail "路由表目标文件" "悬空:$missing"
  fi
else
  fail "任务路由表" "未找到「## 任务路由」节"
fi

# ── 实例文档 ─────────────────────────────────────────────────
check_doc() {  # $1=文件名 $2=是否必需(1/0)
  if [ -f "$ROOT/docs/$1" ]; then
    pass "实例 $1" "$(wc -l < "$ROOT/docs/$1" | tr -d ' ') 行"
  elif [ "$2" = "1" ]; then
    fail "实例 $1" "缺失"
  else
    warn "实例 $1" "缺失（仅后端仓必需）"
  fi
}
check_doc code-design.md 1
check_doc code-validation.md 1
check_doc doc-conventions.md 1
if [ -f "$ROOT/pom.xml" ] || [ -f "$ROOT/build.gradle" ] || [ -f "$ROOT/build.gradle.kts" ]; then
  check_doc sql-orm.md 1
else
  check_doc sql-orm.md 0
fi

echo "────────────────────────────────────────────────────────────"
if [ "$fails" -eq 0 ]; then
  echo "结论：PASS"; exit 0
else
  echo "结论：FAIL（$fails 项）"
  echo
  echo "下一步（按阶段，不要一次全补 —— 见 SKILL.md §0）："
  [ -f "$A" ] && [ "$bytes" -gt "$MAX_BYTES" ] && \
    echo "  · 体积超限：压缩 §2 摘要列，别删红线；或把路由表压到 5 行"
  grep -qE '^#{2,3} .*任务路由' "$A" 2>/dev/null || \
    echo "  · 阶段 0：加 §0.3 任务路由表（骨架见 assets/AGENTS-template.md）"
  [ -f "$ROOT/docs/code-validation.md" ] || \
    echo "  · 阶段 2（第一次 L3 改动前）：补 docs/code-validation.md"
  [ -f "$ROOT/docs/sql-orm.md" ] || [ ! -f "$ROOT/pom.xml" ] || \
    echo "  · 阶段 3（第一次真实 SQL 改动时）：补 docs/sql-orm.md，没改动就留着不建"
  exit 1
fi
