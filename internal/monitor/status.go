package monitor

// 备份监控快照：CLI 表格、`--json` 与 P2+ 网页共用这一份，前端不再算指标。
//
// 🔴 数值字段一律 *float64：没采到是 null，不是 0（AGENTS.md 硬约束 3）。
// 🔴 problems 恒初始化为空 slice：Go 的 nil slice 编成 null，前端 .map 会白屏
//    （见 internal/component/status.go 顶部注释）。
// 🔴 checked_at / latency_ms 才用本机时间；新鲜度只用远端两个 epoch 相减。
// 🔴 连不上仍返回完整快照：connection.ok=false + 四段 collected=false + danger，
//    不把「备份服务器连不上」变成只有一行报错的异常（docs/backup-monitor.md §4）。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// CollectTimeout 是整段 ssh 采集的上限，CLI 与 P2+ 界面共用。
const CollectTimeout = 30 * time.Second

// ScriptRunner 让采集 / 判定与真实 ssh 分离：*shared.SSHTarget 隐式实现，
// 单测注入假输出，全项目不写需要真实 SSH 的单测。
type ScriptRunner interface {
	RunScript(ctx context.Context, script string) (string, error)
}

type Problem struct {
	Level string `json:"level"` // danger / warn
	Text  string `json:"text"`
}

type Connection struct {
	OK        bool     `json:"ok"`
	LatencyMS *float64 `json:"latency_ms"`
	Error     string   `json:"error"`
}

type PGStatus struct {
	Collected           bool     `json:"collected"`
	HasSuccess          bool     `json:"has_success"`
	LastSuccessRaw      string   `json:"last_success_raw"`
	LastSuccessAgeHours *float64 `json:"last_success_age_hours"`
	HasLatest           bool     `json:"has_latest"`
	LatestPath          string   `json:"latest_path"`
	LatestSizeMB        *float64 `json:"latest_size_mb"`
	LatestAgeHours      *float64 `json:"latest_age_hours"`
	TotalMB             *float64 `json:"total_mb"`
}

type MinIOStatus struct {
	Collected           bool     `json:"collected"`
	HasSuccess          bool     `json:"has_success"`
	LastSuccessRaw      string   `json:"last_success_raw"`
	LastSuccessAgeHours *float64 `json:"last_success_age_hours"`
	LogSizeMB           *float64 `json:"log_size_mb"`
	DataSizeMB          *float64 `json:"data_size_mb"`
}

type DiskStatus struct {
	Collected bool     `json:"collected"`
	TotalMB   *float64 `json:"total_mb"`
	FreeMB    *float64 `json:"free_mb"`
	UsedPct   *float64 `json:"used_pct"`
}

type Status struct {
	Host       string      `json:"host"` // user@host:port，绝不含私钥路径
	CheckedAt  string      `json:"checked_at"`
	RemoteHost string      `json:"remote_host"`
	Connection Connection  `json:"connection"`
	PG         PGStatus    `json:"pg"`
	MinIO      MinIOStatus `json:"minio"`
	Disk       DiskStatus  `json:"disk"`
	Problems   []Problem   `json:"problems"`

	// 解析期用：远端 META.now_epoch。不上报、不参与 JSON。
	nowEpoch float64
	hasNow   bool
}

func emptyStatus() Status {
	return Status{
		Connection: Connection{OK: false},
		PG:         PGStatus{},
		MinIO:      MinIOStatus{},
		Disk:       DiskStatus{},
		Problems:   []Problem{},
	}
}

func floatPtr(v float64) *float64 { return &v }

func round1(v float64) float64 { return math.Round(v*10) / 10 }

func hasDanger(s Status) bool {
	for _, p := range s.Problems {
		if p.Level == "danger" {
			return true
		}
	}
	return false
}

// privatePathRe 兜底挡住 ssh 报错里的私钥路径：RunScript 已经只说 user@host，
// 这里再挡一层，注入的假 runner / 未来新链路也不会把路径带进 JSON。
var privatePathRe = regexp.MustCompile(`(?i)([^\s'"|]*\.ssh[/\\][^\s'"|]+|id_[A-Za-z0-9_-]+|BEGIN [A-Z ]*PRIVATE KEY)`)

func connectionError(err error) string {
	if err == nil {
		return ""
	}
	msg := privatePathRe.ReplaceAllString(err.Error(), "<已隐去>")
	msg = shared.FirstLine(msg)
	if msg == "" {
		return "连接失败（远端未给出可读原因）"
	}
	return msg
}

// Collect 跑一次只读采集并返回完整快照；连接失败不提前 return。
func Collect(ctx context.Context, r ScriptRunner, cfg Config, server string) Status {
	s := emptyStatus()
	s.Host = server
	s.CheckedAt = time.Now().Format(time.RFC3339)

	ctx, cancel := context.WithTimeout(ctx, CollectTimeout)
	defer cancel()

	start := time.Now()
	out, err := r.RunScript(ctx, probeScript(cfg))
	s.Connection.LatencyMS = floatPtr(float64(time.Since(start).Milliseconds()))
	if err != nil {
		s.Connection.Error = connectionError(err)
	} else {
		s.Connection.OK = true
		parsed := parseSections(out)
		s.RemoteHost, s.PG, s.MinIO, s.Disk = parsed.RemoteHost, parsed.PG, parsed.MinIO, parsed.Disk
	}
	assess(&s, cfg)
	return s
}

// parseSections 是纯函数：按 ==XXX 切块、块内按固定行序取值。
// 分节之间顺序可乱；缺行即该块 collected=false；`-` 表示该字段没采到。
// 🔴 段的 collected = 分节齐全且至少有一个字段成功解析 —— 全 `-` 不算采到，
//
//	但「心跳没采到、dump 采到了」仍要保留 dump（问题清单另报心跳异常）。
func parseSections(out string) Status {
	s := emptyStatus()
	blocks := map[string][]string{}
	cur := ""
	for _, raw := range strings.Split(out, "\n") {
		line := strings.TrimSuffix(raw, "\r")
		if strings.HasPrefix(line, "==") {
			cur = strings.TrimPrefix(line, "==")
			if _, ok := blocks[cur]; !ok {
				blocks[cur] = []string{}
			}
			continue
		}
		if cur == "" || strings.TrimSpace(line) == "" {
			continue
		}
		blocks[cur] = append(blocks[cur], line)
	}

	if meta := blocks["META"]; len(meta) >= 2 {
		if v, ok := field(meta, 0); ok {
			s.RemoteHost = v
		}
		if v, ok := number(meta[1]); ok {
			s.nowEpoch, s.hasNow = v, true
		}
	}

	if pg := blocks["PG"]; len(pg) > 0 {
		got := 0
		if raw, ok := field(pg, 0); ok {
			s.PG.HasSuccess, s.PG.LastSuccessRaw = true, raw
			got++
		}
		if v, ok := numberAt(pg, 1); ok {
			got++
			if s.hasNow {
				s.PG.LastSuccessAgeHours = floatPtr(round1((s.nowEpoch - v) / 3600))
			}
		}
		if latest, ok := field(pg, 2); ok {
			parts := strings.SplitN(latest, "|", 3)
			if len(parts) == 3 {
				got++
				if parts[2] != "" && parts[2] != "-" {
					s.PG.HasLatest, s.PG.LatestPath = true, parts[2]
				}
				if v, ok := number(parts[0]); ok && s.hasNow {
					s.PG.LatestAgeHours = floatPtr(round1((s.nowEpoch - v) / 3600))
				}
				if v, ok := number(parts[1]); ok {
					s.PG.LatestSizeMB = floatPtr(round1(v / 1024 / 1024))
				}
			}
		}
		if v, ok := numberAt(pg, 3); ok {
			got++
			s.PG.TotalMB = floatPtr(round1(v / 1024))
		}
		// 缺行即整段 collected=false，但已经采到的心跳 / dump 仍保留。
		s.PG.Collected = got > 0 && len(pg) >= 4
	}

	if m := blocks["MINIO"]; len(m) > 0 {
		got := 0
		if raw, ok := field(m, 0); ok {
			s.MinIO.HasSuccess, s.MinIO.LastSuccessRaw = true, raw
			got++
		}
		if v, ok := numberAt(m, 1); ok {
			got++
			if s.hasNow {
				s.MinIO.LastSuccessAgeHours = floatPtr(round1((s.nowEpoch - v) / 3600))
			}
		}
		if v, ok := numberAt(m, 2); ok {
			got++
			s.MinIO.LogSizeMB = floatPtr(round1(v / 1024))
		}
		if v, ok := numberAt(m, 3); ok {
			got++
			s.MinIO.DataSizeMB = floatPtr(round1(v / 1024))
		}
		s.MinIO.Collected = got > 0 && len(m) >= 4
	}

	if d := blocks["DISK"]; len(d) > 0 {
		got := 0
		if line, ok := field(d, 0); ok {
			parts := strings.SplitN(line, "|", 3)
			if len(parts) == 3 {
				if v, ok := number(parts[0]); ok {
					got++
					s.Disk.TotalMB = floatPtr(round1(v))
				}
				if v, ok := number(parts[1]); ok {
					got++
					s.Disk.FreeMB = floatPtr(round1(v))
				}
				if v, ok := number(parts[2]); ok {
					got++
					s.Disk.UsedPct = floatPtr(round1(v))
				}
			}
		}
		s.Disk.Collected = got > 0 && len(d) >= 1
	}
	return s
}

func numberAt(lines []string, i int) (float64, bool) {
	if i >= len(lines) {
		return 0, false
	}
	return number(lines[i])
}

// field 把 `-` / 空行统一当「没采到」。
func field(lines []string, i int) (string, bool) {
	if i >= len(lines) {
		return "", false
	}
	v := strings.TrimSpace(lines[i])
	if v == "" || v == "-" {
		return "", false
	}
	return v, true
}

// number 容忍 `%` 后缀（df 的已用率）、拒绝 NaN / Inf / 负数；超大数用 float64 不溢出。
func number(s string) (float64, bool) {
	v := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(s), "%"))
	if v == "" || v == "-" {
		return 0, false
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil || math.IsNaN(f) || math.IsInf(f, 0) || f < 0 {
		return 0, false
	}
	return f, true
}

// assess 是 danger / warn 阈值的唯一定义处；每次调用都重建 problems（幂等）。
func assess(s *Status, cfg Config) {
	s.Problems = []Problem{}
	add := func(level string, format string, a ...any) {
		s.Problems = append(s.Problems, Problem{Level: level, Text: fmt.Sprintf(format, a...)})
	}

	if !s.Connection.OK {
		add("danger", "连不上备份服务器：%s", valueOr(s.Connection.Error, "连接失败"))
	}

	if !s.PG.Collected {
		add("danger", "PG 备份状态没采到（心跳 / 目录不可读，或采集脚本没跑完）")
	} else {
		if !s.PG.HasSuccess {
			add("danger", "读不到 PG 心跳（从未成功过，或日志目录不可读）")
		}
		if s.PG.LastSuccessAgeHours != nil && cfg.PGStaleHours > 0 &&
			*s.PG.LastSuccessAgeHours > cfg.PGStaleHours {
			add("danger", "距上次 PG 成功 %.1f 小时，超过阈值 %.1fh", *s.PG.LastSuccessAgeHours, cfg.PGStaleHours)
		}
		if s.PG.HasSuccess && !s.PG.HasLatest {
			add("warn", "有 PG 成功记录，但备份目录里找不到 .dump 文件")
		}
		if s.PG.LatestSizeMB != nil && *s.PG.LatestSizeMB == 0 {
			add("warn", "最新 .dump 是 0 字节")
		}
	}

	if !s.MinIO.Collected {
		add("danger", "MinIO 备份状态没采到（心跳 / 目录不可读，或采集脚本没跑完）")
	} else {
		if !s.MinIO.HasSuccess {
			add("danger", "读不到 MinIO 心跳（从未成功过，或日志目录不可读）")
		}
		if s.MinIO.LastSuccessAgeHours != nil && cfg.MinioStaleHours > 0 &&
			*s.MinIO.LastSuccessAgeHours > cfg.MinioStaleHours {
			add("danger", "距上次 MinIO 成功 %.1f 小时，超过阈值 %.1fh", *s.MinIO.LastSuccessAgeHours, cfg.MinioStaleHours)
		}
		if cfg.MinioData != "" && s.MinIO.DataSizeMB == nil {
			add("warn", "配置了 MinIO 数据目录，却读不到它的占用")
		}
	}

	if !s.Disk.Collected {
		add("danger", "df 采集失败（不是「剩余 0 MB」）：拿不到挂载点的磁盘信息")
	} else if s.Disk.UsedPct != nil && cfg.DiskWarnPct > 0 && *s.Disk.UsedPct >= cfg.DiskWarnPct {
		add("danger", "磁盘已用 %.0f%%，达到告警阈值 %.0f%%", *s.Disk.UsedPct, cfg.DiskWarnPct)
	}
}

func valueOr(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

// FailureStatus 给「配置 / 用法错」也回一份完整快照（--json 三种退出码都输出快照）。
// P2+ 网页在严格 LoadConfig / LoadServers 失败时同样用它，避免界面自己拼一套空快照。
func FailureStatus(host, reason string) Status {
	s := emptyStatus()
	s.Host = host
	s.CheckedAt = time.Now().Format(time.RFC3339)
	s.Connection.Error = connectionError(errors.New(reason))
	s.Problems = []Problem{{Level: "danger", Text: s.Connection.Error}}
	return s
}
