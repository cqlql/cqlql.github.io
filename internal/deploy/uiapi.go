package deploy

// P3b-3：界面侧的**同源**入口。CLI 的 --dry-run / release / releases 与界面共用
// 同一份预演、同一份发布状态机、同一份只读历史投影，界面不另算指标、不另起采集。
//
// 🔴 本文件不改任何 P3b-1 / P3b-2 判据：进度钩子只是把报告里本来就有的行实时推出去；
//    台账仍由执行链路在任务结束时 append 一条；预演仍零写入、不拿远端锁。
// 🔴 界面不接受任意本机路径：配置目录由 UIDefaultConfigDir() 固定解析（与
//    POST /api/open-servers-file 的「路径由服务端解析」同口径），人按该路径备好
//    .env / compose / secrets/ / www，工具不擅自读生产 .env、不擅自同步 52 键凭证。
// 🔴 0 新键：没有读、也没有写任何 PASS_UP_OPS_* 配置键。
// 🔴 不写远端 state.env、不产生 kind=rollback（P4）、不做 ps / logs。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ---- 进度事件：报告里已有内容的实时投影 ----

type ProgressKind string

const (
	ProgressLog       ProgressKind = "log"
	ProgressGate      ProgressKind = "gate"
	ProgressStage     ProgressKind = "stage"
	ProgressStageSkip ProgressKind = "stage-skip"
	ProgressFail      ProgressKind = "fail"
	ProgressDone      ProgressKind = "done"
)

// ProgressEvent 是「一条报告行 / 一个阶段 / 一道门禁」的实时事件。
// 🔴 界面只用它渲染步骤条与日志，绝不拿事件自己算「发布成功」——
//
//	completed / failed_stage 只认最终 ReleaseReport。
type ProgressEvent struct {
	Kind      ProgressKind `json:"kind"`
	Name      string       `json:"name,omitempty"`
	Stage     string       `json:"stage,omitempty"`
	Detail    string       `json:"detail"`
	Completed bool         `json:"completed,omitempty"`
}

type ProgressFunc func(ProgressEvent)

// UIDefaultConfigDir 是界面发布唯一认的本机配置目录。
// 🔴 不是配置项、不进 ops.env、接口不接受路径：少一个能配错的机会（§11.7 结论 F）。
//
//	人要把 .env / compose / Caddyfile / secrets/ / www/ 放进来；缺 .env 时
//	UIPrecheck 会点名挡住，工具不擅自去兄弟仓读生产配置。
func UIDefaultConfigDir() string {
	return filepath.Join(shared.UserConfigDir(), "deploy", "config")
}

// ValidScope 给界面 / CLI 共用一份范围白名单。
func ValidScope(s string) bool { return validScopes[s] }

// StageNames 是六阶段条的唯一名字表；界面不硬编码阶段名。
func StageNames() []string { return append([]string{}, stageOrder...) }

// UIReleaseTimeout 与 CLI 的 releaseTimeout 同源，根包不再抄一个数字。
func UIReleaseTimeout() time.Duration { return releaseTimeout }

// UIBumpWhitelist 是台账 bump 字段的允许值（界面「更新类型」的英文键）。
// 🔴 它只是人读元信息，不拼进任何命令、不是镜像 tag（§10.1）。
func ValidBump(s string) bool {
	switch s {
	case "", "major", "minor", "patch", "manual":
		return true
	default:
		return false
	}
}

// ---- 只读预演：CLI 与界面共用一份组装逻辑 ----

// buildDryRunPlan 是 P3a 只读预演的唯一组装点（CmdDeploy 与界面 GET 都调它）。
// 🔴 全程真实 ssh 只读、不拿锁、不写远端、不落台账；失败也回完整快照靠 Collect。
func buildDryRunPlan(ctx context.Context, server, scope string) (Plan, error) {
	if !ValidScope(scope) {
		return Plan{}, fmt.Errorf("未知发布范围：%s（可选 %s）", scope, JoinScopeNames())
	}
	cfg, err := shared.LoadConfig()
	if err != nil {
		return Plan{}, err
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		return Plan{}, err
	}
	srv, err := list.Resolve(server, cfg.DefaultServer)
	if err != nil {
		return Plan{}, err
	}
	t := shared.NewSSHTarget(srv)
	host := HostLabel(t)

	exe, err := os.Executable()
	if err != nil {
		exe = ""
	}
	opsDir := filepath.Dir(exe)
	repos := DetectRepos(opsDir)
	prefix := notCollected
	if repos.Backend {
		if v, e := ReadImagePrefix(filepath.Join(filepath.Dir(opsDir), "pass-up.backend", "docker")); e == nil {
			prefix = v
		}
	}

	pf := Collect(ctx, t, host)
	p := BuildPlan(pf, PlanRequest{
		Server:      srv.Name,
		Host:        host,
		Scope:       scope,
		ImagePrefix: prefix,
		ImageTag:    notCollected, // 只读预演不构建、不采集 git commit，不猜值
		RepoPaths:   repos,
	})
	p.Warnings = append(p.Warnings, "镜像 tag 未采集（第一刀不构建）；`<tag>` 是占位，P3b 才按 git 短 commit 取值")
	if w := roleWarning(srv.Name, srv.Role); w != "" {
		p.Warnings = append(p.Warnings, w)
	}
	return p, nil
}

// DryRunPlan 给界面 GET /api/deploy/plan；与 `ops deploy --dry-run --json` 同源。
func DryRunPlan(ctx context.Context, server, scope string) (Plan, error) {
	return buildDryRunPlan(ctx, server, scope)
}

// EmptyPlan 是「连不上 / 配置错」也回的完整空视图：所有数组恒非 nil。
// 🔴 空数组红线（ui.md §11.4-5 / §12.5-3）：Go nil slice 编 JSON 是 null，
//
//	前端 .find 会白屏；这里与前端 normalize 各挡一道。
func EmptyPlan(server, scope, reason string) Plan {
	return Plan{
		Server: server, Scope: scope, Host: "—",
		RemoteDir: DefaultRemoteDir, ImagePrefix: notCollected, ImageTag: notCollected,
		Preflight: Preflight{
			Collected: false, Host: "—", Error: reason,
			Checks: []Check{}, Blockers: []string{}, Warnings: []string{},
			EnvLineEnding: "unknown",
		},
		Alignments: []Alignment{}, Commands: []Command{},
		Impact: []string{}, Warnings: []string{reason},
		Blockers: []string{reason}, Available: false,
		Note: "只读预演没能生成可执行计划；远端没有被修改。",
	}
}

// ---- 只读发版历史 ----

// HistoryData 是界面 GET /api/deploy/releases 的 data 形状。
type HistoryData struct {
	Items  []ReleaseEvent `json:"items"`
	Server string         `json:"server,omitempty"`
	Error  string         `json:"error,omitempty"`
}

// ReadHistory 复用 P3b-2 的只读投影；items 恒非 nil。
func ReadHistory(server string) HistoryData {
	h := ReadReleaseHistory(ReleaseLogPath(shared.UserConfigDir()), server)
	items := h.Data.Items
	if items == nil {
		items = []ReleaseEvent{}
	}
	return HistoryData{Items: items, Server: server, Error: h.Data.Error}
}

// ---- 界面正式发布：与 CLI release 同一条主链路 ----

type UIReleaseInput struct {
	Server, Scope               string
	ReleaseVersion, ReleaseNote string
	Bump                        string
	TaskID                      string
}

// UIPrecheck 是写动作前的服务端预检门（门 3）：
// ① P3a 只读预演 available=false / 采不到就挡；② 本机固定配置目录缺 .env 点名挡。
// 🔴 前端点没点过预演都不算数，服务端每次写动作自己再跑一遍（硬约束 21 ②）。
// 🔴 结论 B：本机不读 .env 的值、不打印、不擅自同步，只判文件在不在。
func UIPrecheck(server, scope string) (bool, string) {
	// ① 本机前置先判：纯本地、零网络，缺配置时不必白跑一次 ssh 预演。
	// 🔴 只判文件在不在，不打开、不读值、不打印（结论 B）。
	envPath := filepath.Join(UIDefaultConfigDir(), ".env")
	st, statErr := os.Stat(envPath)
	if statErr != nil || !st.Mode().IsRegular() {
		return false, fmt.Sprintf("发布前置：本机配置目录缺 .env（工具不擅自读生产配置、不擅自同步凭证）；"+
			"请由人把 .env / compose / secrets/ / www/ 备到 %s", UIDefaultConfigDir())
	}
	// ② 服务端自己再跑一遍 P3a 只读预演，前端点没点过都不算数。
	ctx, cancel := context.WithTimeout(context.Background(), collectTimeout)
	defer cancel()
	p, err := buildDryRunPlan(ctx, server, scope)
	if err != nil {
		return false, "只读预演没跑通：" + scrub(err.Error())
	}
	if !p.Preflight.Collected {
		return false, "远端只读预检没采到（collected=false），不开始正式发布"
	}
	if !p.Available || len(p.Blockers) > 0 {
		return false, "只读预演有全局阻塞：" + strings.Join(p.Blockers, "；")
	}
	return true, ""
}

// RunReleaseForUI 是界面后台任务的执行体：六道门 + 六阶段 + 台账 append。
// 返回报告给界面渲染步骤条与如实报告；emit 是进度旁路，失败不影响主链路。
func RunReleaseForUI(ctx context.Context, in UIReleaseInput, emit ProgressFunc) (ReleaseReport, error) {
	if !ValidScope(in.Scope) {
		return ReleaseReport{}, fmt.Errorf("未知发布范围：%s", in.Scope)
	}
	if err := ValidateRelease(in.ReleaseVersion, in.ReleaseNote); err != nil {
		return ReleaseReport{}, err
	}
	if !ValidBump(in.Bump) {
		return ReleaseReport{}, fmt.Errorf("未知更新类型：%s", in.Bump)
	}
	if ok, detail := UIPrecheck(in.Server, in.Scope); !ok {
		return ReleaseReport{}, errors.New("服务端预检门未过：" + detail)
	}
	release, ok := shared.AcquireSingleton(deployLockName)
	if !ok {
		return ReleaseReport{}, errors.New("已有发布任务在跑（跨进程单例锁）；拿不到立刻失败、不排队")
	}
	defer release()

	cfg, err := shared.LoadConfig()
	if err != nil {
		return ReleaseReport{}, err
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		return ReleaseReport{}, err
	}
	srv, err := list.Resolve(in.Server, cfg.DefaultServer)
	if err != nil {
		return ReleaseReport{}, err
	}
	t := shared.NewSSHTarget(srv)

	exe, err := os.Executable()
	if err != nil {
		exe = ""
	}
	opsDir := filepath.Dir(exe)
	parent := filepath.Dir(opsDir)
	prefix, err := ReadImagePrefix(filepath.Join(parent, "pass-up.backend", "docker"))
	if err != nil {
		return ReleaseReport{}, fmt.Errorf("镜像前缀没采到（不猜默认值）：%w", err)
	}
	tag, err := gitShortCommit(opsDir)
	if err != nil {
		return ReleaseReport{}, err
	}

	rcfg := ReleaseConfig{
		Server: srv.Name, Host: HostLabel(t), Scope: in.Scope,
		RemoteDir: DefaultRemoteDir, ImagePrefix: prefix, ImageTag: tag,
		ConfigDir: UIDefaultConfigDir(), AIConfigDir: "",
		BackendRepo:    filepath.Join(parent, "pass-up.backend"),
		AIRepo:         filepath.Join(parent, "pass-up.ai"),
		WebRepo:        filepath.Join(parent, "pass-up.frontend"),
		ReleaseVersion: in.ReleaseVersion, ReleaseNote: in.ReleaseNote,
		NoBuild:      false, // 界面不开放 --no-build：默认每轮构建（§11.10 结论 9）
		Timestamp:    time.Now().Format("20060102-150405"),
		HealthWindow: DefaultHealthWindow, HealthPoll: DefaultHealthPoll,
	}
	rep := RunReleaseWith(ctx, rcfg, &SSHRunner{Target: t}, emit)

	// 台账仍由执行链路在任务结束时 append 一条；撞锁 / 预检 / 校验失败不入账。
	if ShouldRecord(rep) {
		ev := BuildReleaseEvent(rep, rcfg, time.Now())
		ev.Bump = in.Bump
		if in.TaskID != "" {
			ev.TaskID = in.TaskID
		}
		if e := AppendRelease(ReleaseLogPath(shared.UserConfigDir()), ev); e != nil {
			rep.LedgerError = e.Error()
			rep.Warnings = append(rep.Warnings, "发版台账追加失败（不补写、不改变发布结果）："+e.Error())
		} else {
			rep.LedgerRecorded = true
			rep.Warnings = append(rep.Warnings, "发版台账已 append 一条（不覆盖旧记录）")
		}
	}
	return rep, nil
}

// MarshalPlan / MarshalHistory 只是给根包适配层用的便利函数：
// 保证错误路径也回完整空视图，items / checks 等数组恒非 nil。
func MarshalPlan(p Plan) json.RawMessage {
	b, err := json.Marshal(p)
	if err != nil {
		b, _ = json.Marshal(EmptyPlan(p.Server, p.Scope, "只读预演结果编码失败"))
	}
	return b
}

func MarshalHistory(h HistoryData) json.RawMessage {
	if h.Items == nil {
		h.Items = []ReleaseEvent{}
	}
	b, err := json.Marshal(h)
	if err != nil {
		b = []byte(`{"items":[],"error":"发版历史编码失败"}`)
	}
	return b
}

// withError 只给只读视图加一个 error 字段，不覆盖其它字段（界面照常渲染空视图）。
func withError(raw json.RawMessage, msg string) json.RawMessage {
	if msg == "" {
		return raw
	}
	m := map[string]json.RawMessage{}
	if err := json.Unmarshal(raw, &m); err != nil {
		m = map[string]json.RawMessage{}
	}
	b, _ := json.Marshal(msg)
	m["error"] = b
	out, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	return out
}

// UIPlanJSON 是 GET /api/deploy/plan 的完整响应数据（根包只透传）。
// 🔴 连不上 / 配置错也回完整空视图 + error，不回 5xx、不猜 0、不改远端。
func UIPlanJSON(server, scope string) json.RawMessage {
	if !ValidScope(scope) {
		return withError(MarshalPlan(EmptyPlan(server, scope, "未知发布范围")), "未知发布范围")
	}
	ctx, cancel := context.WithTimeout(context.Background(), collectTimeout)
	defer cancel()
	p, err := buildDryRunPlan(ctx, server, scope)
	if err != nil {
		reason := scrub(err.Error())
		return withError(MarshalPlan(EmptyPlan(server, scope, reason)), reason)
	}
	return MarshalPlan(p)
}

// UIHistoryJSON 是 GET /api/deploy/releases 的完整响应数据。
func UIHistoryJSON(server string) json.RawMessage {
	return MarshalHistory(ReadHistory(server))
}
