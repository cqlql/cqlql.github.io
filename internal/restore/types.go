package restore

// 备份恢复（把备份端数据写回生产端）的共用数据契约。
//
// 🔴 与「备份监控」同口径（AGENTS.md 硬约束 3）：没采到是 collected=false + "—"/null，
//    不许用 0 兜底；连不上仍回一份字段齐全的完整快照，不把整页打白。
// 🔴 只放白名单非凭证字段：私钥路径 / SRC_KEY / DEST_SECRET / PG_SSH_KEY 一律不进
//    结构体、HTTP 响应与任务日志（硬约束 8）。URL 只留 scheme + host:port。
// 🔴 工具不读 crontab：CronStatus 恒为「不采集」，「停定时备份」是人的显式声明，
//    由 plan 的 cron_confirmed / Gate.Checks 承载，不是采集事实（分册 §5.0 R1）。
// 🔴 --server 只认备份机：生产端由该机 backup.env 的 PG_SSH_HOST / SRC_URL 决定，
//    这里只回显，接口不接受另行指定生产主机（R2 / 硬约束 12）。

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

const (
	CompPG    = "pg"
	CompMinio = "minio"

	// DefaultTestDB 是 PG 恢复的默认目标：先恢复到临时库验证，再谈生产覆盖。
	DefaultTestDB = "restore_test"

	NotCollected = "—"
)

var (
	candidateIDRe = regexp.MustCompile(`^[A-Za-z0-9._/-]{1,180}$`)
	dbRe          = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]{0,62}$`)
	bucketRe      = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{1,62}$`)
	remotePathRe  = regexp.MustCompile(`^/[A-Za-z0-9._/-]+$`)
	// 与 monitor.connectionError 同口径：注入的假 runner / 未来新链路也挡一层。
	privatePathRe = regexp.MustCompile(`(?i)([^\s'"|]*\.ssh[/\\][^\s'"|]+|id_[A-Za-z0-9_-]+|BEGIN [A-Z ]*PRIVATE KEY|Identity file[^\n]*)`)
)

const (
	cronStatus = "不采集（工具不读 crontab）"
	cronNote   = "「已停定时备份」是人在 §3.0 前置清单里的显式声明，不是采集结果；" +
		"工具不跑 crontab -l、不自动停 / 自动装定时任务。未确认即全局阻塞。"
	directionPG    = "备份端 dump → scp 主服务器 /tmp → docker cp 进容器 → pg_restore -j；全局对象 globals_*.sql → psql -d postgres"
	directionMinio = "备份端 DEST_* 桶 → mc mirror --overwrite → 生产端 SRC_* 桶（SRC_ 是生产端、DEST_ 是备份端，别搞反）"
)

// Candidate 是一行恢复点。PG 的 ID 是**相对备份根目录**的路径（不含 ..），
// MinIO 的 ID 是生产端桶名。🔴 真实远端路径永远由 Go 侧按 Snapshot.PGRoot 拼，
// 接口不接收任意路径；选中行先查表再执行（分册 §5.2）。
type Candidate struct {
	ID          string   `json:"id"`
	Label       string   `json:"label"`
	Target      string   `json:"target"`
	Time        string   `json:"time"`
	Size        string   `json:"size"`
	SizeBytes   int64    `json:"size_bytes"`
	Grade       string   `json:"grade"`
	Checksum    string   `json:"checksum"`
	Archive     string   `json:"archive"`
	Freshness   string   `json:"freshness"`
	Objects     string   `json:"objects"`
	Synced      string   `json:"synced"`
	Selectable  bool     `json:"selectable"`
	RowBlockers []string `json:"row_blockers"`
}

// Snapshot 是 GET /api/restore/candidates 的完整返回。
type Snapshot struct {
	Server     string `json:"server"`
	Component  string `json:"component"`
	CheckedAt  string `json:"checked_at"`
	Identity   string `json:"identity"`
	Host       string `json:"host"`
	Collected  bool   `json:"collected"`
	Error      string `json:"error,omitempty"`
	CronStatus string `json:"cron_status"`
	CronNote   string `json:"cron_note"`
	Heartbeat  string `json:"heartbeat"`
	DiskFree   string `json:"disk_free"`
	// DiskFreeKB 没采到是 JSON null，不是 0（硬约束 3：不许用 0 兜底）。
	DiskFreeKB  *int64      `json:"disk_free_kb"`
	PGRoot      string      `json:"pg_root"`
	PGHost      string      `json:"pg_host"`
	PGPort      string      `json:"pg_port"`
	PGDB        string      `json:"pg_db"`
	PGContainer string      `json:"pg_container"`
	PGJobs      string      `json:"pg_jobs"`
	SrcURL      string      `json:"src_url"`
	SrcBuckets  string      `json:"src_buckets"`
	DestURL     string      `json:"dest_url"`
	DestPrefix  string      `json:"dest_prefix"`
	Direction   string      `json:"direction"`
	ScriptsOK   bool        `json:"scripts_ok"`
	Candidates  []Candidate `json:"candidates"`
	Blockers    []string    `json:"blockers"`
	Warnings    []string    `json:"warnings"`
}

// Plan 是 GET /api/restore/plan 下发的动作计划：判定全在 Go 侧，前端只渲染。
type Plan struct {
	Server        string   `json:"server"`
	Component     string   `json:"component"`
	CandidateID   string   `json:"candidate_id"`
	DB            string   `json:"db"`
	Collected     bool     `json:"collected"`
	Available     bool     `json:"available"`
	Busy          bool     `json:"busy"`
	CronConfirmed bool     `json:"cron_confirmed"`
	Target        string   `json:"target"`
	Impact        []string `json:"impact"`
	Blockers      []string `json:"blockers"`
	Warnings      []string `json:"warnings"`
	Commands      []string `json:"commands"`
	RowBlockers   []string `json:"row_blockers"`
	Note          string   `json:"note"`
}

// Gate 是执行门禁的**唯一**判据来源：CLI 自己构造并校验，界面只把同样的字段
// 传过来（ui 层再做一次字面量校验）。前端的勾选 / 两次库名都在这里逐字复核。
type Gate struct {
	Component       string
	CandidateID     string
	DB              string
	DB2             string
	Confirm         string
	MinioConfirm    string
	Checks          [3]bool
	CronConfirmed   bool
	CoverProduction bool
	Password        string
}

func ValidComponent(s string) bool { return s == CompPG || s == CompMinio }

// ValidCandidateID 挡住任意路径：没有绝对路径、没有 ..、没有 shell 元字符。
func ValidCandidateID(s string) bool {
	return s != "" && !strings.HasPrefix(s, "/") && !strings.Contains(s, "..") &&
		candidateIDRe.MatchString(s)
}

func ValidDB(s string) bool { return dbRe.MatchString(s) }

// safeRemotePath 校验从远端 backup.env 读回来的目录：它可能被人改坏，
// 拼进 sh 命令前必须再过一次（与 shared.Config.validate 同款）。
func safeRemotePath(s string) bool {
	return remotePathRe.MatchString(s) && !strings.Contains(s, "..")
}

// endpoint 只留 scheme + host:port：SRC_URL / DEST_URL 可能带 userinfo 或路径，
// 凭证一律不进 HTTP 响应与日志。
func endpoint(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return NotCollected
	}
	if !strings.Contains(s, "://") {
		s = "http://" + s
	}
	u, err := url.Parse(s)
	if err != nil || u.Host == "" {
		return "（地址无法解析，已隐藏）"
	}
	if u.Scheme == "http" || u.Scheme == "https" {
		return u.Scheme + "://" + u.Host
	}
	return u.Host
}

// safeError 把 ssh / 远端的报错里可能夹带的私钥路径滤掉再截断。
func safeError(raw string) string {
	msg := privatePathRe.ReplaceAllString(raw, "<已隐去>")
	msg = strings.TrimSpace(strings.Join(strings.Fields(msg), " "))
	if msg == "" {
		return "连接失败（远端未给出可读原因）"
	}
	if len(msg) > 240 {
		msg = msg[:240] + "…"
	}
	return msg
}

func humanBytes(n int64) string {
	if n <= 0 {
		return NotCollected
	}
	const mb = 1024 * 1024
	if n < mb {
		return fmt.Sprintf("%.1f KB", float64(n)/1024)
	}
	if n < 1024*mb {
		return fmt.Sprintf("%.1f MB", float64(n)/mb)
	}
	return fmt.Sprintf("%.2f GB", float64(n)/(1024*mb))
}

// FailureSnapshot 给界面用：配置读不出来 / 未知 name 时也要回一份字段齐全的
// 空快照，不许把整页打白（与 GET /api/monitor/status 同口径）。
func FailureSnapshot(server, component, reason string) Snapshot {
	return emptySnapshot(server, component, safeError(reason))
}

// emptySnapshot 是「连不上 / 没配好」时的完整空快照：所有字段都在，
// 数值是 —，Candidates / Blockers / Warnings 恒为非 nil 空 slice（前端 .map 不会白屏）。
func emptySnapshot(server, component, errText string) Snapshot {
	return Snapshot{
		Server:      server,
		Component:   component,
		Identity:    NotCollected,
		Host:        NotCollected,
		Heartbeat:   NotCollected,
		DiskFree:    NotCollected,
		PGRoot:      NotCollected,
		PGHost:      NotCollected,
		PGPort:      NotCollected,
		PGDB:        NotCollected,
		PGContainer: NotCollected,
		PGJobs:      NotCollected,
		SrcURL:      NotCollected,
		SrcBuckets:  NotCollected,
		DestURL:     NotCollected,
		DestPrefix:  NotCollected,
		Direction:   NotCollected,
		Error:       errText,
		CronStatus:  cronStatus,
		CronNote:    cronNote,
		Candidates:  []Candidate{},
		Blockers: []string{
			"没采到备份机上的恢复快照：" + errText,
			"候选 collected=false，数值一律显示 —，不用 0 兜底；修好连接后点「刷新候选」，不缓存这次失败。",
		},
		Warnings: []string{},
	}
}
