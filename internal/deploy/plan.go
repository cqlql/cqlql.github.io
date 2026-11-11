// Package deploy 实现 P3a 第一刀：单机 Docker 应用部署的**只读预演**。
//
// 🔴 本包只做只读：不构建镜像、不 compose up、不写远端任何文件、不拿远端锁、
//
//	不落发版台账、不写 state.env、不注册正式发布按钮。
//
// 🔴 命令表是「将执行」的草案，**只打印、不执行**；与 deploy.sh 的人工步骤逐条对齐
//
//	（对齐口径见 docs/deploy.md §4，2026-11-11 按真实脚本校正过）。
//
// 🔴 参数只来自 --server（servers.json）、本机 compose 实测值与内置默认路径；
//
//	§8 的 12 个 PASS_UP_OPS_* 方案键一个都不读（P3b 才分批启用）。
//
// 🔴 只读失败也要回一份**完整快照**：collected=false、数值一律 "—"、不猜 0。
package deploy

import (
	"pass-up/ops/internal/shared"
)

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const (
	// DefaultRemoteDir 与 deploy.env.example 的 REMOTE_DIR、§8 的 DEPLOY_DIR 默认值一致。
	// 第一刀刻意不做成配置项：只读预演的路径写死在这里，避免「还没实现就先配错」。
	DefaultRemoteDir = "/opt/passup"

	ScopeAll     = "all"
	ScopeInfra   = "infra"
	ScopeAI      = "ai"
	ScopeBackend = "backend"
	ScopeWeb     = "web"

	// notCollected 是「没采到」的唯一展示值，绝不写 0 / 空串 / 猜测值。
	notCollected = "—"
)

var validScopes = map[string]bool{
	ScopeAll: true, ScopeInfra: true, ScopeAI: true, ScopeBackend: true, ScopeWeb: true,
}

// Command 是一条「将执行」的命令草案；第一刀只打印它。
type Command struct {
	Phase string `json:"phase"`
	Cmd   string `json:"cmd"`
	Note  string `json:"note"`
}

// Check 是一项只读预检结果。Value 没采到恒为 notCollected。
type Check struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Value  string `json:"value"`
	Detail string `json:"detail,omitempty"`
}

// Preflight 是远端只读快照。所有切片恒非 nil（空数组红线：Go nil slice 编成 null）。
type Preflight struct {
	Collected     bool     `json:"collected"`
	Host          string   `json:"host"`
	Error         string   `json:"error,omitempty"`
	Checks        []Check  `json:"checks"`
	EnvLineEnding string   `json:"env_line_ending"` // crlf / lf / missing / unknown
	Blockers      []string `json:"blockers"`
	Warnings      []string `json:"warnings"`
}

// Alignment 是「新工具阶段 ↔ deploy.sh 人工步骤」的一行对照。
type Alignment struct {
	Ours   string `json:"ours"`
	Theirs string `json:"theirs"`
	Diff   string `json:"diff"`
}

// Plan 是唯一的只读计划结构，人读报告与 --json 共用同一份数据。
type Plan struct {
	Server      string      `json:"server"`
	Host        string      `json:"host"`
	Scope       string      `json:"scope"`
	RemoteDir   string      `json:"remote_dir"`
	ImagePrefix string      `json:"image_prefix"`
	ImageTag    string      `json:"image_tag"`
	Preflight   Preflight   `json:"preflight"`
	Alignments  []Alignment `json:"alignments"`
	Commands    []Command   `json:"commands"`
	Impact      []string    `json:"impact"`
	Warnings    []string    `json:"warnings"`
	Blockers    []string    `json:"blockers"`
	Available   bool        `json:"available"`
	Note        string      `json:"note"`
}

// PlanRequest 是 BuildPlan 的全部输入。纯函数，方便单测钉死命令拼装与空数组。
type PlanRequest struct {
	Server      string
	Host        string
	Scope       string
	ImagePrefix string
	ImageTag    string
	RepoPaths   RepoPaths
}

// RepoPaths 记录本机三个兄弟仓的存在性；第一刀只报告，不构建。
type RepoPaths struct {
	OpsDir  string
	Backend bool
	AI      bool
	Web     bool
}

// emptyPreflight 是连不上 / 配置错时的完整快照：九项检查**一项不少**、值恒 "—"、
// 所有数组恒 []。不返回空数组让人误以为「没有这项检查」，也不拿 0 兜底。
func emptyPreflight(host, reason string) Preflight {
	checks := make([]Check, 0, len(PreflightCheckNames()))
	for _, name := range PreflightCheckNames() {
		checks = append(checks, Check{Name: name, OK: false, Value: notCollected, Detail: "未采集，不猜值"})
	}
	return Preflight{
		Collected:     false,
		Host:          host,
		Error:         reason,
		Checks:        checks,
		EnvLineEnding: "unknown",
		Blockers:      []string{"远端只读预检没采到：" + reason},
		Warnings:      []string{},
	}
}

var imageRefRe = regexp.MustCompile(`(?m)^\s*image:\s*([^\s#]+)/backend-java:`)

// ReadImagePrefix 从本机 backend 仓的 compose 里读镜像前缀，而不是让人配。
// 读不到就返回空串 + 错误，由调用方显示 "—"（未采集），**不猜默认值**。
// 前缀必须逐字等于 compose 的 image:，否则 save/load 后 compose 会去找不存在的 tag。
func ReadImagePrefix(backendDockerDir string) (string, error) {
	b, err := os.ReadFile(filepath.Join(backendDockerDir, "docker-compose.yml"))
	if err != nil {
		return "", fmt.Errorf("读不到 backend compose（%w）", err)
	}
	m := imageRefRe.FindSubmatch(b)
	if m == nil {
		return "", fmt.Errorf("compose 里没有 <prefix>/backend-java:<tag> 形式的 image:")
	}
	return string(m[1]), nil
}

// DetectRepos 只做存在性检查，不读配置、不执行 git。
func DetectRepos(opsDir string) RepoPaths {
	parent := filepath.Dir(opsDir)
	has := func(name, probe string) bool {
		_, err := os.Stat(filepath.Join(parent, name, probe))
		return err == nil
	}
	return RepoPaths{
		OpsDir:  opsDir,
		Backend: has("pass-up.backend", "docker"),
		AI:      has("pass-up.ai", "docker"),
		Web:     has("pass-up.frontend", "package.json"),
	}
}

// DeployScriptSteps 是 2026-11-11 实读 `pass-up.backend/docker/deploy.sh` 得到的
// 人工步骤。🔴 旧文档里「load 后再补 tag」是错的：脚本没有 docker tag；
// Step 4 也不是「只发 backend」，而是整个 docker/ 目录 rsync --delete。
// 逐条对齐以这里的真实内容为准（docs/deploy.md §4）。
func DeployScriptSteps() []Command {
	return []Command{
		{Phase: "1/5 本机构建", Cmd: `DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile -t "$FULL_IMAGE" --build-arg VERSION/GIT_COMMIT/BUILD_TIME ..`, Note: "IMAGE_NAME 来自 deploy.env（passup/backend-java）"},
		{Phase: "2/5 导出 tar", Cmd: `docker save -o "$LOCAL_TAR" "$FULL_IMAGE"`, Note: "本机临时 tar，cleanup 时删除"},
		{Phase: "3/5 传输 tar", Cmd: `ssh <host> 'mkdir -p <tar父目录>' && scp "$LOCAL_TAR" <host>:$REMOTE_IMAGE_TAR`, Note: "tar 落到远端磁盘"},
		{Phase: "4/5 同步配置", Cmd: `rsync -avz --delete -e "ssh -p 22" --exclude 'deploy.env*' --exclude 'deploy.sh' --exclude '.env.example' --exclude 'Dockerfile.dev' --exclude 'docker-compose.dev.yml' docker/ <host>:$REMOTE_DIR/`, Note: "整目录 --delete；会连带删 secrets/ 里远端独有文件"},
		{Phase: "5/5 load + 重建", Cmd: `docker load -i "$REMOTE_IMAGE_TAR" && rm -f "$REMOTE_IMAGE_TAR" && export IMAGE_TAG=<tag> && docker compose -f docker-compose.yml up -d --no-build backend-java`, Note: "🔴 没有 docker tag；失败回退 rm -s -f backend-java 再 up；最后 compose ps"},
	}
}

// planBaseline 是新工具「将执行」的 7 条命令草案，与原型 PLAN_BASE 同序。
// 🔴 第一刀一条都不执行，只打印；第 2 条（拿锁）明确标注属于 P3b。
func planBaseline(req PlanRequest) []Command {
	host := req.Server
	dir := DefaultRemoteDir
	quote := shared.ShQuote
	return []Command{
		{Phase: "只读预检", Cmd: "ssh " + host + " " + quote("docker info && test -w /data/postgres && test -r "+dir+"/docker/secrets/"), Note: "只读；连不上回完整快照"},
		{Phase: "加锁（P3b）", Cmd: "ssh " + host + " " + quote("flock -n "+dir+"/.deploy/lock -c true"), Note: "🔴 第一刀不拿锁：拿锁会写远端文件"},
		{Phase: "配置同步", Cmd: "ssh " + host + " " + quote("tr -cd '\\r' < "+dir+"/docker/.env | wc -c") + " → 检出 CR 才 rsync 后 sed -i 's/\\r$//'", Note: "CRLF 按远端探测结果归一化；secrets/ 不用 --delete，www/ 才用"},
		{Phase: "本机构建", Cmd: "docker build -f docker/Dockerfile -t <prefix>/{backend-java,ai}:<tag> .", Note: "<prefix> 逐字取自 compose 的 image:"},
		{Phase: "传输", Cmd: "docker save <prefix>/backend-java:<tag> | ssh " + host + " " + quote("docker load"), Note: "流转不落盘；不做 load 后再 tag 的绕路"},
		{Phase: "拉起", Cmd: "IMAGE_TAG=<tag> docker compose -f docker-compose.base.yml -f docker-compose.yml up -d", Note: "不 down -v、不删 /data、不加 --remove-orphans"},
		{Phase: "健康门", Cmd: "ssh " + host + " " + quote("curl -fsS 127.0.0.1:8009/actuator/health/readiness") + " × 2", Note: "连续 2 次 200；失败停在该阶段、不写「服务已恢复正常」"},
	}
}

// scopeIndex 与原型 SCOPES 一致：场景/范围是正交维度，这里只按范围取命令子集。
var scopeIndex = map[string][]int{
	ScopeAll:     {0, 1, 2, 3, 4, 5, 6},
	ScopeInfra:   {0, 1, 5, 6},
	ScopeAI:      {0, 1, 2, 3, 4, 5, 6},
	ScopeBackend: {0, 1, 2, 3, 4, 5, 6},
	ScopeWeb:     {0, 1, 2, 5, 6},
}

// BuildPlan 是纯函数：把只读快照 + 请求投影成一份完整计划。
// 所有切片恒非 nil；连不上时也产出完整计划（available=false），不白屏、不猜 0。
func BuildPlan(pf Preflight, req PlanRequest) Plan {
	if req.Scope == "" {
		req.Scope = ScopeAll
	}
	if req.ImagePrefix == "" {
		req.ImagePrefix = notCollected
	}
	if req.ImageTag == "" {
		req.ImageTag = notCollected
	}

	p := Plan{
		Server:      req.Server,
		Host:        pf.Host,
		Scope:       req.Scope,
		RemoteDir:   DefaultRemoteDir,
		ImagePrefix: req.ImagePrefix,
		ImageTag:    req.ImageTag,
		Preflight:   pf,
		Alignments:  []Alignment{},
		Commands:    []Command{},
		Impact: []string{
			"正式发布会改：远端 .env / compose / Caddyfile（先备份到 .deploy/backup/<时间戳>/）",
			"正式发布会改：镜像 tag 与容器重建；www 用 --delete 覆盖纯构建产物",
			"不会改：/data（不 down -v）、其它 compose 项目（不加 --remove-orphans）",
			"不会改：数据库 schema（Flyway 单向）、crontab / 定时任务、备份链路",
			"不会改：secrets/ 的既有文件（不用 --delete，权限保持 600）",
			"不打印：私钥路径、secrets/ 内容、.env 全文",
		},
		Warnings: []string{
			"远端 docker/.env 换行先只读探测，检出 CR 才归一化；本机检出为 LF，不作判据（§3.2）",
			"镜像前缀逐字等于 compose 的 image:；远端注入 IMAGE_TAG（§3.3 / 硬约束 5）",
			"首期不删 deploy.sh；对齐完成后也不在本轮停用（§4）",
			"发版号只是元信息、不是镜像 tag；第一刀不落台账、不写 state.env（§10）",
		},
		Blockers:  []string{},
		Available: false,
		Note:      "🔴 本次仅预演、未改动远端任何文件；预演通过 ≠ 可以发布。",
	}

	// 与 deploy.sh 人工步骤的逐条对照（P3a 的核心验收）。
	for _, a := range deployScriptAlignments() {
		p.Alignments = append(p.Alignments, a)
	}

	// 范围非法属于调用方 bug，这里保守地当成全局阻塞，不生成任何计划命令。
	idx, ok := scopeIndex[req.Scope]
	if !ok {
		p.Blockers = append(p.Blockers, "未知发布范围："+req.Scope)
		p.Commands = []Command{}
		return p
	}
	base := planBaseline(req)
	for _, i := range idx {
		if i >= 0 && i < len(base) {
			p.Commands = append(p.Commands, base[i])
		}
	}

	if req.ImagePrefix == notCollected {
		p.Warnings = append(p.Warnings, "镜像引用未采集（本机没有 backend 兄弟仓或 compose 里没读到 image:）；正式发布前必须逐字核对，工具不猜默认值")
	}
	if !req.RepoPaths.Backend {
		p.Warnings = append(p.Warnings, "本机缺 pass-up.backend 兄弟仓：第一刀不构建，仅提示；P3b 构建前必须就绪")
	}
	if !req.RepoPaths.AI {
		p.Warnings = append(p.Warnings, "本机缺 pass-up.ai 兄弟仓：第一刀不构建，仅提示")
	}
	if !validScopes[req.Scope] {
		// 上面已 return，留着防后续改动漏判。
		p.Blockers = append(p.Blockers, "未知发布范围："+req.Scope)
	}

	p.Blockers = append(p.Blockers, pf.Blockers...)
	p.Warnings = append(p.Warnings, pf.Warnings...)

	// 全局阻塞：预演没采到 / 预检有 blocking。运行期结果（撞锁、构建失败、
	// 健康门失败）不是预演阻塞，第一刀根本不执行，所以不在这里出现。
	p.Available = pf.Collected && len(p.Blockers) == 0
	return p
}

// deployScriptAlignments 把新工具的七个阶段映射到 deploy.sh 的五个人工步骤，
// 并逐条写出差异。判据来自 docs/deploy.md §4（2026-11-11 实读校正版）。
func deployScriptAlignments() []Alignment {
	return []Alignment{
		{Ours: "只读预检", Theirs: "无（脚本只查本机 docker/rsync/ssh/scp 命令存在）", Diff: "新增远端预检：docker / compose / 目录可写 / 端口 / 磁盘 / .env 换行 / 线上版本号"},
		{Ours: "加锁（P3b）", Theirs: "无", Diff: "新增远端锁 + 本地任务锁；第一刀只打印、不拿锁"},
		{Ours: "配置同步", Theirs: "4/5 同步配置", Diff: "脚本整目录 rsync --delete（含 secrets/）；新工具分目录、secrets/ 不用 --delete，并按远端探测结果决定是否去 CRLF"},
		{Ours: "本机构建", Theirs: "1/5 本机构建", Diff: "脚本 tag 来自 deploy.env 的 IMAGE_NAME=passup/backend-java；新工具前缀逐字取自 compose，且同时构建 backend / ai"},
		{Ours: "传输", Theirs: "2/5 导出 tar + 3/5 传输 tar + 5/5 远端 load", Diff: "脚本落远端 tar 再 load（🔴 脚本里没有 docker tag，注释提到的「补 tag」未实现）；新工具 docker save | ssh docker load 流转，不落盘、不做二次 tag"},
		{Ours: "拉起", Theirs: "5/5 up -d --no-build backend-java（失败 rm -s -f 再 up）", Diff: "脚本只用 -f docker-compose.yml、只发 backend；新工具合并 base.yml + yml、按 infra→ai→backend→web，且不 down -v"},
		{Ours: "健康门", Theirs: "无（只有 compose ps）", Diff: "新增连续 2 次 200 的 readiness / health 判定；失败停在该阶段、如实报告"},
	}
}

// EnvEndingText 把探测码翻成人话；"unknown" 绝不说成 LF。
func EnvEndingText(code string) string {
	switch code {
	case "crlf":
		return "CRLF（检出 CR，正式发布路径需归一化）"
	case "lf":
		return "LF（未检出 CR，不做归一化）"
	case "missing":
		return "文件不存在（远端 .env 未就绪，不猜）"
	default:
		return notCollected + "（未采集，不猜）"
	}
}

// JoinScopeNames 给 usage 用。
func JoinScopeNames() string {
	return strings.Join([]string{ScopeAll, ScopeInfra, ScopeAI, ScopeBackend, ScopeWeb}, "|")
}
