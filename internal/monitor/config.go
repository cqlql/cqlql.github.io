package monitor

// P2a 备份监控的配置与远端只读采集脚本。
//
// 🔴 脚本不落 deploy/ 目录：路径要按 ops.env 动态注入，Go 常量 + ShQuote
//    比模板替换安全，也省一套 embed 与只读扫描的接线（docs/backup-monitor.md §11.1）。
// 🔴 远端脚本只读：不写文件、不提权、不调用会写日志 / 推告警的 *_status.sh；
//    没采到写一行 `-`，Go 侧绝不用 0 兜底（AGENTS.md 硬约束 1 / 3）。

import (
	"pass-up/ops/internal/shared"
)

import (
	"fmt"
	"strings"
)

// Config 是 monitor 包自己的一份路径 / 阈值，避免 shared 被能力包反向依赖。
// 数值只在 assess() 里当阈值用；远端脚本不关心阈值。
type Config struct {
	PGRoot   string
	PGLog    string
	MinioLog string
	// MinioData 为空表示「不采数据目录」：对象多时全量 du 很慢（docs/backup-monitor.md §8）。
	MinioData string
	Disk      string

	PGStaleHours    float64
	MinioStaleHours float64
	DiskWarnPct     float64
}

// ConfigFrom 把本机 ops.env（shared.Config.Monitor）搬进能力包。
// P2+ 的 /api/monitor/status 也走这里，前端不算指标。
func ConfigFrom(c *shared.Config) Config {
	return Config{
		PGRoot:          c.Monitor.PGRoot,
		PGLog:           c.Monitor.PGLog,
		MinioLog:        c.Monitor.MinioLog,
		MinioData:       c.Monitor.MinioData,
		Disk:            c.Monitor.Disk,
		PGStaleHours:    c.Monitor.PGStaleHours,
		MinioStaleHours: c.Monitor.MinioStaleHours,
		DiskWarnPct:     c.Monitor.DiskWarnPct,
	}
}

// probeScript 生成固定 POSIX sh，由 ssh -T ... sh -s 从 stdin 执行。
// 输出分节纯文本（==META / ==PG / ==MINIO / ==DISK），块内每行一个字段、顺序固定。
// 🔴 时间新鲜度只在远端算：心跳是无时区的本地时间，date -d 得到 epoch 后与
//
//	远端 date +%s 相减；拿回本机解析会差 8 小时（AGENTS.md 硬约束 2）。
//
// 🔴 所有路径统一 ShQuote；配置加载时另有一道绝对路径校验。
func probeScript(cfg Config) string {
	var b strings.Builder
	b.WriteString(`#!/bin/sh
# 只读采集：由 ssh -T ... sh -s 从 stdin 执行；stdout 是分节纯文本，没采到写 -
# stderr 由调用方单独收，脚本里不做输出重定向，避免分节文本被污染。
`)
	fmt.Fprintf(&b, "PG_ROOT=%s\n", shared.ShQuote(cfg.PGRoot))
	fmt.Fprintf(&b, "PG_LOG=%s\n", shared.ShQuote(cfg.PGLog))
	fmt.Fprintf(&b, "MINIO_LOG=%s\n", shared.ShQuote(cfg.MinioLog))
	fmt.Fprintf(&b, "MINIO_DATA=%s\n", shared.ShQuote(cfg.MinioData))
	fmt.Fprintf(&b, "DISK=%s\n", shared.ShQuote(cfg.Disk))
	b.WriteString(`
emit_or_dash() {
    if [ -n "$1" ]; then printf '%s\n' "$1"; else printf '%s\n' '-'; fi
}

# 心跳两行：① 原文 ② 远端 date -d 解析出的 epoch；读不到各写一行 -
heartbeat() {
    hb_dir=$1
    if [ -r "$hb_dir/last_success.txt" ]; then
        raw=$(head -n 1 "$hb_dir/last_success.txt")
        emit_or_dash "$raw"
        if [ -n "$raw" ]; then
            ts=$(date -d "$raw" +%s)
            emit_or_dash "$ts"
        else
            printf '%s\n' '-'
        fi
    else
        printf '%s\n' '-'
        printf '%s\n' '-'
    fi
}

# 目录占用（KB）；目录不存在 / 读不到写 -
kb_of() {
    dir=$1
    if [ -d "$dir" ]; then
        kb=$(du -sk "$dir" | awk 'NR==1 {print $1}')
        emit_or_dash "$kb"
    else
        printf '%s\n' '-'
    fi
}

printf '%s\n' '==META'
host=$(hostname)
emit_or_dash "$host"
date +%s

printf '%s\n' '==PG'
heartbeat "$PG_LOG"
if [ -d "$PG_ROOT" ]; then
    latest=$(find "$PG_ROOT" -type f -name '*.dump' -printf '%T@|%s|%p\n' | sort -rn | head -n 1)
    emit_or_dash "$latest"
else
    printf '%s\n' '-'
fi
kb_of "$PG_ROOT"

printf '%s\n' '==MINIO'
heartbeat "$MINIO_LOG"
kb_of "$MINIO_LOG"
if [ -n "$MINIO_DATA" ] && [ -d "$MINIO_DATA" ]; then
    kb=$(du -sk "$MINIO_DATA" | awk 'NR==1 {print $1}')
    emit_or_dash "$kb"
else
    printf '%s\n' '-'
fi

printf '%s\n' '==DISK'
if [ -d "$DISK" ]; then
    line=$(df -P -m "$DISK" | awk 'NR==2 {print $2 "|" $4 "|" $5}')
    emit_or_dash "$line"
else
    printf '%s\n' '-'
fi
`)
	return b.String()
}
