#!/usr/bin/env bash
# 结构验证：只检查「规范有没有被遵守」，不检查「规范有没有用」。
# 用法：bash check-agents.sh [仓库路径]（默认当前目录）
# 退出码：0 全通过；1 有 FAIL。
#
# 含「按栈选装」校验（SKILL.md §0.5）：探测目标仓技术栈，检查实例里有没有
# 残留不适用的 〔前端〕/〔后端〕/〔Java〕 标记，以及该不该有 docs/sql-orm.md。
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

# ── 栈探测（SKILL.md §0.5 第一步）─────────────────────────────
# 根目录 + 一级子目录都看，兼容 modules/ 、apps/ 这类布局
java=0; go=0; py=0; net=0; fe=0; db=0
{
  [ -f "$ROOT/pom.xml" ] || [ -f "$ROOT/build.gradle" ] || [ -f "$ROOT/build.gradle.kts" ] || \
  ls "$ROOT"/*/pom.xml >/dev/null 2>&1 || ls "$ROOT"/*/build.gradle >/dev/null 2>&1
} && java=1
{ [ -f "$ROOT/go.mod" ] || ls "$ROOT"/*/go.mod >/dev/null 2>&1; } && go=1
{ [ -f "$ROOT/pyproject.toml" ] || [ -f "$ROOT/requirements.txt" ]; } && py=1
{
  ls "$ROOT"/*.csproj >/dev/null 2>&1 || ls "$ROOT"/*.sln >/dev/null 2>&1 || \
  ls "$ROOT"/*/*.csproj >/dev/null 2>&1
} && net=1
if [ -f "$ROOT/package.json" ] && \
   grep -qE '"(vue|react|react-dom|next|nuxt|svelte|@tarojs/taro|@tarojs/cli)"[[:space:]]*:' \
     "$ROOT/package.json" 2>/dev/null; then fe=1; fi

backend=$(( java + go + py + net ))
if [ "$backend" -gt 0 ] && [ "$fe" -eq 0 ]; then
  stack_name="后端"; forbid="〔前端〕"
  # 非 Java 的后端仓（Go / Python / .NET）也要把 〔Java〕 节删掉
  [ "$java" -eq 0 ] && forbid="$forbid 〔Java〕"
elif [ "$fe" -eq 1 ] && [ "$backend" -eq 0 ]; then
  stack_name="前端"; forbid="〔后端〕 〔Java〕"
elif [ "$fe" -eq 1 ] && [ "$backend" -gt 0 ]; then
  stack_name="前后端混合"; forbid=""
else
  stack_name="未识别"; forbid=""
fi

# 数据访问层信号（决定 sql-orm.md 该不该存在）
for d in db/migration migrations src/main/resources/db/migration src/main/resources/db \
         alembic prisma database sql; do
  [ -d "$ROOT/$d" ] && db=1
done
for f in alembic.ini flyway.conf prisma/schema.prisma; do
  [ -f "$ROOT/$f" ] && db=1
done
grep -qsE 'data-jpa|hibernate|mybatis|mybatis-plus|gorm\.io|sqlalchemy|EntityFramework|prisma|typeorm' \
  "$ROOT/pom.xml" "$ROOT/build.gradle" "$ROOT/build.gradle.kts" "$ROOT/go.mod" \
  "$ROOT/requirements.txt" "$ROOT/pyproject.toml" 2>/dev/null && db=1

echo "栈：$stack_name$([ "$db" = "1" ] && echo " + 数据访问层")"
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
check_doc() {  # $1=文件名 $2=必需(1)/可选(0) $3=可选时的说明
  if [ -f "$ROOT/docs/$1" ]; then
    pass "实例 $1" "$(wc -l < "$ROOT/docs/$1" | tr -d ' ') 行"
  elif [ "$2" = "1" ]; then
    fail "实例 $1" "缺失"
  else
    warn "实例 $1" "未装${3:+（$3）}"
  fi
}
check_doc code-design.md 1
check_doc code-validation.md 1
check_doc doc-conventions.md 1

# sql-orm：只该出现在「后端 + 有数据访问层」的仓（SKILL.md §0.5）
if [ -f "$ROOT/docs/sql-orm.md" ]; then
  if [ "$db" = "1" ]; then
    pass "实例 sql-orm.md" "$(wc -l < "$ROOT/docs/sql-orm.md" | tr -d ' ') 行"
  else
    warn "实例 sql-orm.md" "未探测到数据访问层信号；确实没有 DB 就删掉（§0.5 文件级取舍）"
  fi
elif [ "$db" = "1" ]; then
  warn "实例 sql-orm.md" "有数据访问层但未装；阶段 3（第一次真实 SQL 改动）再建"
else
  pass "实例 sql-orm.md" "未装（无数据访问层，正确）"
fi

# ── 按栈裁剪：实例里不该留别的栈的节 ─────────────────────────
# 统计标记出现次数（跳过 `>` 开头的说明块）
count_tag() { awk -v t="$1" 'substr($0,1,1)==">"{next}{n=gsub(t,"x");s+=n} END{print s+0}' "$2"; }
lines_of()  { awk -v t="$1" 'substr($0,1,1)==">"{next} index($0,t){printf "%s%d",(n++?",":""),NR}' "$2"; }

if [ -n "$forbid" ]; then
  residue=0; detail=""
  for f in code-design.md code-validation.md sql-orm.md; do
    [ -f "$ROOT/docs/$f" ] || continue
    for t in $forbid; do
      c=$(count_tag "$t" "$ROOT/docs/$f")
      [ "$c" -eq 0 ] && continue
      residue=$((residue+c))
      detail="$detail
           $f：$t $c 处（行 $(lines_of "$t" "$ROOT/docs/$f")）"
    done
  done
  if [ "$residue" -eq 0 ]; then
    pass "按栈裁剪" "无残留（栈：$stack_name）"
  else
    warn "按栈裁剪" "残留 $residue 处不适用标记，删掉或改成本栈写法$detail"
  fi
fi

# 说明块（`> 节标题后的 …`）是脚手架的说明书，裁完就该删
legend=""
for f in code-design.md code-validation.md sql-orm.md; do
  [ -f "$ROOT/docs/$f" ] || continue
  if awk '/节标题后的/{f=1} END{exit !f}' "$ROOT/docs/$f"; then
    legend="$legend $f"
  fi
done
[ -n "$legend" ] && warn "标记说明块" "仍残留，裁完应删掉：$legend"

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
    echo "  · 阶段 0：加任务路由表（骨架见 assets/AGENTS-template.md）"
  [ -f "$ROOT/docs/code-design.md" ] || \
    echo "  · 阶段 1（第一个功能落地后）：补 docs/code-design.md，按 §0.5 裁掉不适用节"
  [ -f "$ROOT/docs/code-validation.md" ] || \
    echo "  · 阶段 2（第一次 L3 改动前）：补 docs/code-validation.md，工具映射先留空"
  [ -n "${missing:-}" ] && \
    echo "  · 路由表指向了不存在的 docs：删掉该行（没装那份规范就别留指针），或按 §0.5 补上"
  exit 1
fi
