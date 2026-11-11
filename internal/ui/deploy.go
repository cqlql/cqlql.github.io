package ui

// P3b-3：第 8 个导航项「应用部署」的四个接口与界面任务状态。
//
// 🔴 依赖方向：ui **不 import deploy**。预演 / 发布 / 历史 / 校验全部经 DeployAPI
//    由 main.go 注入（实现在根包 deployrun.go），与 monitorProbe / restoreProbe 同构。
// 🔴 门禁照抄硬约束 21 的六道门并加严：token + Origin + POST + confirm=="yes" +
//    三项勾选 + 服务端自己再跑一遍只读预检 + server 只认清单 + 任务锁 409 +
//    任务脱离 r.Context()（刷新页面不打断已经开始的发布）。
// 🔴 发布按钮默认不可用：前端按「预演通过 + 发版信息合法 + 二次确认」才算可点，
//    服务端不信任前端，逐字再验一遍。0 新键、不收任何本机路径、不做 P4 回滚。
// 🔴 只读失败回 ok=true + data.error + 完整空视图；数组恒为 []（不是 null），
//    ui.md §11.4-5 / §12.5-3 的白屏事故口径，服务端与前端各挡一道。

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ---- 注入契约（根包适配 deploy 包，ui 只认这些纯数据结构）----

type DeployEvent struct {
	Kind      string `json:"kind"`
	Name      string `json:"name,omitempty"`
	Stage     string `json:"stage,omitempty"`
	Detail    string `json:"detail"`
	Completed bool   `json:"completed,omitempty"`
}

type DeployStageView struct {
	Name   string `json:"name"`
	Status string `json:"status"` // wait / running / ok / skip / fail
	Detail string `json:"detail,omitempty"`
}

type DeployGateView struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail"`
}

type DeployReleaseRequest struct {
	Confirm        string `json:"confirm"`
	Server         string `json:"server"`
	Scope          string `json:"scope"`
	ReleaseVersion string `json:"release_version"`
	ReleaseNote    string `json:"release_note"`
	Bump           string `json:"bump"`
	Checks         []bool `json:"checks"`
}

// DeployAPI 由 main.go 注入；nil = 这个构建没有部署能力（接口回 501）。
// 所有方法都不得要求 ui 了解 deploy 包的类型。
type DeployAPI interface {
	// Plan 是 P3a 只读预演的完整快照（失败也回完整空视图）。
	Plan(server, scope string) json.RawMessage
	// History 是 P3b-2 只读台账投影（items 恒非 nil）。
	History(server string) json.RawMessage
	// Release 跑六道门 + 六阶段 + 台账 append；返回最终报告与退出码。
	Release(req DeployReleaseRequest, taskID string, emit func(DeployEvent)) (json.RawMessage, int)
	// Precheck 是写动作前服务端自己再跑一遍的只读预检门。
	Precheck(server, scope string) (bool, string)
	Validate(version, note string) error
	ValidScope(scope string) bool
	ValidBump(bump string) bool
	Stages() []string
}

// ---- 界面任务视图 ----

type deployViewState struct {
	mu        sync.Mutex
	taskID    string
	server    string
	scope     string
	stages    []string
	done      map[string]DeployStageView
	failed    string
	gates     []DeployGateView
	report    json.RawMessage
	errText   string
	startedAt time.Time
	endedAt   time.Time
}

func newDeployViewState(stages []string) *deployViewState {
	return &deployViewState{stages: append([]string{}, stages...), done: map[string]DeployStageView{}, gates: []DeployGateView{}}
}

func (s *deployViewState) reset(taskID, server, scope string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.taskID, s.server, s.scope = taskID, server, scope
	s.done = map[string]DeployStageView{}
	s.failed = ""
	s.gates = []DeployGateView{}
	s.report = nil
	s.errText = ""
	s.startedAt = time.Now()
	s.endedAt = time.Time{}
}

func (s *deployViewState) onEvent(ev DeployEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()
	switch ev.Kind {
	case "gate":
		s.gates = append(s.gates, DeployGateView{Name: ev.Name, OK: true, Detail: ev.Detail})
	case "stage":
		s.done[ev.Stage] = DeployStageView{Name: ev.Stage, Status: "ok", Detail: ev.Detail}
	case "stage-skip":
		s.done[ev.Stage] = DeployStageView{Name: ev.Stage, Status: "skip", Detail: ev.Detail}
	case "fail":
		ok := false
		s.gates = append(s.gates, DeployGateView{Name: ev.Name, OK: ok, Detail: ev.Detail})
		s.failed = ev.Stage
	}
}

func (s *deployViewState) finish(report json.RawMessage, code int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.report = report
	s.endedAt = time.Now()
	if code != 0 && s.errText == "" {
		s.errText = fmt.Sprintf("任务结束，退出码 %d；失败停在日志里的阶段，不自动回滚、不自动修复。", code)
	}
}

// stagesViewLocked 由已完成阶段 + 运行态推断，前端不自己算状态。
// 只有 running 时把第一个未完成阶段标成「进行中」；结束后未完成的保持 wait。
// 🔴 调用方必须已持有 s.mu：snapshot 自己持锁，不能反过来再调加锁版本（会死锁）。
func (s *deployViewState) stagesViewLocked(running bool) []DeployStageView {
	out := make([]DeployStageView, 0, len(s.stages))
	pendingMarked := false
	for _, name := range s.stages {
		if v, ok := s.done[name]; ok {
			out = append(out, v)
			continue
		}
		if name == s.failed {
			out = append(out, DeployStageView{Name: name, Status: "fail", Detail: "停在这一阶段，现场保留"})
			continue
		}
		if running && !pendingMarked {
			out = append(out, DeployStageView{Name: name, Status: "running"})
			pendingMarked = true
			continue
		}
		out = append(out, DeployStageView{Name: name, Status: "wait"})
	}
	return out
}

func (s *deployViewState) snapshot(running bool) ([]DeployStageView, []DeployGateView, json.RawMessage, string, string, string, string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	gates := append([]DeployGateView{}, s.gates...)
	if gates == nil {
		gates = []DeployGateView{}
	}
	started, ended := "", ""
	if !s.startedAt.IsZero() {
		started = s.startedAt.Format(time.RFC3339)
	}
	if !s.endedAt.IsZero() {
		ended = s.endedAt.Format(time.RFC3339)
	}
	return s.stagesViewLocked(running), gates, s.report, s.errText, s.taskID, started, ended
}

// deployStagesOf 让「没有注入部署能力」的构建也有一个空阶段列表，nil 安全。
func deployStagesOf(api DeployAPI) []string {
	if api == nil {
		return []string{}
	}
	return api.Stages()
}

// ensureDeployView 让直接构造 uiState 的单测也不会 nil panic（与 ensureTask 同理）。
func (u *uiState) ensureDeployView() *deployViewState {
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.deployView == nil {
		stages := []string{}
		if u.deployAPI != nil {
			stages = u.deployAPI.Stages()
		}
		u.deployView = newDeployViewState(stages)
	}
	return u.deployView
}

// ---- 四个接口 ----

// normalizeDeployData 把 Go 侧可能漏掉 / 为 null 的数组键补成 []。
// 🔴 服务端这一层与前端 normalize 各挡一道：界面历史表格 / 预检格永远有数组可渲染。
func normalizeDeployData(raw json.RawMessage, arrayKeys ...string) map[string]json.RawMessage {
	m := map[string]json.RawMessage{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &m); err != nil {
			m = map[string]json.RawMessage{}
			m["error"] = json.RawMessage(strconv.Quote("只读数据不是合法 JSON：" + err.Error()))
		}
	}
	for _, k := range arrayKeys {
		v, ok := m[k]
		if !ok || len(v) == 0 || v[0] != '[' || !json.Valid(v) {
			m[k] = json.RawMessage("[]")
		}
	}
	return m
}

func (u *uiState) handleDeployPlan(w http.ResponseWriter, r *http.Request) {
	if u.deployAPI == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有应用部署能力"})
		return
	}
	server := strings.TrimSpace(r.URL.Query().Get("server"))
	scope := strings.TrimSpace(r.URL.Query().Get("scope"))
	if scope == "" {
		scope = "all"
	}
	if !u.deployAPI.ValidScope(scope) {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知发布范围（可选 all / infra / ai / backend / web）"})
		return
	}
	if server != "" {
		if err := u.reload(); err != nil {
			writeAPI(w, http.StatusServiceUnavailable, apiResponse{Error: "配置还没准备好：" + err.Error()})
			return
		}
		u.mu.Lock()
		list := u.list
		u.mu.Unlock()
		if _, err := list.Get(server); err != nil {
			writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
			return
		}
	}
	raw := u.deployAPI.Plan(server, scope)
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: normalizeDeployData(raw,
		"checks", "alignments", "commands", "impact", "warnings", "blockers")})
}

func (u *uiState) handleDeployReleases(w http.ResponseWriter, r *http.Request) {
	if u.deployAPI == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有发版历史能力"})
		return
	}
	server := strings.TrimSpace(r.URL.Query().Get("server"))
	// 🔴 只读台账：不连远端、不校验清单（历史里可能有过已删除的机器），
	//    失败也回 ok=true + data.error + items: []，绝不回 ok:false / null。
	raw := u.deployAPI.History(server)
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: normalizeDeployData(raw, "items")})
}

type deployRunResult struct {
	Started bool   `json:"started"`
	TaskID  string `json:"task_id"`
	Server  string `json:"server"`
	Scope   string `json:"scope"`
}

func (u *uiState) handleDeployRelease(w http.ResponseWriter, r *http.Request) {
	if u.deployAPI == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有应用部署能力"})
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求体过大"})
		return
	}
	var req DeployReleaseRequest
	dec := json.NewDecoder(bytes.NewReader(body))
	// 🔴 拒绝未知字段：界面绝不能变成「传任意本机路径 / --no-build / --force」的代理
	//    （配置目录由服务端固定解析，构建来源默认每轮构建，见 deploy.md §11.7 / §11.10）。
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求格式错误或含未允许字段：" + err.Error()})
		return
	}
	if req.Confirm != "yes" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "门 2 未过：必须逐字确认 yes（服务端再验，不缓存、当次有效）"})
		return
	}
	if len(req.Checks) != 3 || !req.Checks[0] || !req.Checks[1] || !req.Checks[2] {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "门 2 未过：三项发布前确认必须全勾"})
		return
	}
	if strings.TrimSpace(req.Server) == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if !u.deployAPI.ValidScope(req.Scope) {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知发布范围"})
		return
	}
	if !u.deployAPI.ValidBump(req.Bump) {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知更新类型"})
		return
	}
	if err := u.deployAPI.Validate(req.ReleaseVersion, req.ReleaseNote); err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "门 5 未过：" + err.Error()})
		return
	}
	// 门 3：服务端自己再跑一遍只读预检，前端点没点过都不算数。
	if ok, detail := u.deployAPI.Precheck(req.Server, req.Scope); !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "服务端预检门未过：" + detail})
		return
	}
	if err := u.reload(); err != nil {
		writeAPI(w, http.StatusServiceUnavailable, apiResponse{Error: "配置还没准备好：" + err.Error()})
		return
	}
	u.mu.Lock()
	list := u.list
	u.mu.Unlock()
	if _, err := list.Get(req.Server); err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}

	task := u.ensureTask()
	if !task.start(deployReleaseMode, req.Server, req.Scope, "") {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "已有后台任务在运行，等它结束再试（发布不排队）"})
		return
	}
	taskID := newDeployTaskID()
	u.ensureDeployView().reset(taskID, req.Server, req.Scope)
	go u.runDeployTask(task, req, taskID)
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: deployRunResult{
		Started: true, TaskID: taskID, Server: req.Server, Scope: req.Scope,
	}})
}

func newDeployTaskID() string {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err == nil {
		return "ui-" + time.Now().Format("20060102-150405") + "-" + hex.EncodeToString(b)
	}
	return "ui-" + strconv.FormatInt(time.Now().UnixNano(), 10)
}

// runDeployTask 脱离 HTTP 请求运行；日志经 backupLogWriter 按行回流给页面。
func (u *uiState) runDeployTask(t *backupTask, req DeployReleaseRequest, taskID string) {
	lw := &backupLogWriter{task: t}
	fmt.Fprintf(lw, "==> 开始：应用部署正式发布（目标 %s · 范围 %s · 发版号 %s · task_id %s）\n",
		req.Server, req.Scope, req.ReleaseVersion, taskID)
	fmt.Fprintln(lw, "==> 服务端预检门已过（独立一遍只读预演 + 本机固定配置目录 .env 存在）；门 2 / 5 由服务端逐字再验。")
	fmt.Fprintln(lw, "==> 发版号只是人读元信息，不是镜像 tag；备注不写远端、不拼进任何命令。")

	emit := func(ev DeployEvent) {
		u.ensureDeployView().onEvent(ev)
		// 只把 log 事件写进任务日志：gate / stage 事件携带同一份 Detail，
		// 重复写会让日志里每个阶段出现两行。
		if ev.Kind == "log" && ev.Detail != "" {
			fmt.Fprintln(lw, ev.Detail)
		}
	}
	report, code := u.deployAPI.Release(req, taskID, emit)
	u.ensureDeployView().finish(report, code)
	if code == 0 {
		fmt.Fprintln(lw, "==> 结束：报告只报脚本结果；是否可用请看三个健康门，工具不写「服务已恢复正常」。")
	} else {
		fmt.Fprintf(lw, "==> 结束，退出码 %d：停在当前阶段、如实报告、保留现场；健康门失败不自动回滚（rollback 属 P4）。\n", code)
	}
	fmt.Fprintln(lw, "🔴 台账只在任务结束时 append 一条（成功 / 失败都留痕）；进程被 kill / 断电会丢一次尝试，不猜、不补写、不加 running。")
	fmt.Fprintln(lw, "🔴 远端 state.env 本刀不写，线上版本号显示「未采集」；历史只读本机台账，不上送远端。")
	lw.Flush()
	t.finish(code)
}

type deployTaskView struct {
	Running   bool              `json:"running"`
	Done      bool              `json:"done"`
	Mode      string            `json:"mode"`
	Server    string            `json:"server"`
	Scope     string            `json:"scope"`
	ExitCode  int               `json:"exit_code"`
	Log       string            `json:"log"`
	Next      int               `json:"next"`
	Stages    []DeployStageView `json:"stages"`
	Gates     []DeployGateView  `json:"gates"`
	TaskID    string            `json:"task_id"`
	Report    json.RawMessage   `json:"report,omitempty"`
	Error     string            `json:"error,omitempty"`
	StartedAt string            `json:"started_at,omitempty"`
	EndedAt   string            `json:"ended_at,omitempty"`
}

func (u *uiState) handleDeployTask(w http.ResponseWriter, r *http.Request) {
	after, err := strconv.Atoi(r.URL.Query().Get("after"))
	if err != nil {
		after = 0
	}
	t := u.ensureTask()
	v := t.view(after)
	stages, gates, report, errText, taskID, started, ended := u.ensureDeployView().snapshot(v.Running)
	if stages == nil {
		stages = []DeployStageView{}
	}
	if gates == nil {
		gates = []DeployGateView{}
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: deployTaskView{
		Running: v.Running, Done: v.Done, Mode: v.Mode, Server: v.Server,
		Scope: v.Component, ExitCode: v.ExitCode, Log: v.Log, Next: v.Next,
		Stages: stages, Gates: gates, TaskID: taskID, Report: report,
		Error: errText, StartedAt: started, EndedAt: ended,
	}})
}
