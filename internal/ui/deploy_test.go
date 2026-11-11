package ui

// P3b-3 界面单测：四个接口的门禁与空数组红线、任务锁、六阶段进度、增量日志。
// 全部用假 DeployAPI，不连真机、不跑 ssh、不写台账、不做正式发布。

import (
	"pass-up/ops/internal/shared"
)

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

var deployTestStages = []string{"预检", "配置同步", "构建", "传输", "拉起", "健康门"}

type fakeDeployAPI struct {
	mu             sync.Mutex
	planRaw        json.RawMessage
	historyRaw     json.RawMessage
	precheckOK     bool
	precheckDetail string
	reportRaw      json.RawMessage
	code           int
	releaseCalls   int
	block          chan struct{}
}

func (f *fakeDeployAPI) Stages() []string           { return append([]string{}, deployTestStages...) }
func (f *fakeDeployAPI) ValidScope(s string) bool   { return s == "all" || s == "ai" || s == "web" }
func (f *fakeDeployAPI) ValidBump(s string) bool    { return s == "" || s == "patch" || s == "manual" }
func (f *fakeDeployAPI) Validate(v, n string) error { return nil }
func (f *fakeDeployAPI) Plan(string, string) json.RawMessage {
	if f.planRaw == nil {
		return json.RawMessage(`{"available":true,"checks":[],"commands":[],"warnings":[]}`)
	}
	return f.planRaw
}
func (f *fakeDeployAPI) History(string) json.RawMessage {
	if f.historyRaw == nil {
		return json.RawMessage(`{"items":[]}`)
	}
	return f.historyRaw
}
func (f *fakeDeployAPI) Precheck(string, string) (bool, string) {
	return f.precheckOK, f.precheckDetail
}
func (f *fakeDeployAPI) Release(_ DeployReleaseRequest, _ string, emit func(DeployEvent)) (json.RawMessage, int) {
	f.mu.Lock()
	f.releaseCalls++
	f.mu.Unlock()
	for _, ev := range []DeployEvent{
		{Kind: "log", Detail: "[门禁通过] 只读预检门：九项前置齐全"},
		{Kind: "gate", Name: "只读预检门", Detail: "九项前置齐全"},
		{Kind: "stage", Stage: "预检", Detail: "只读预检与双锁通过"},
		{Kind: "log", Detail: "[阶段完成] 预检：只读预检与双锁通过"},
		{Kind: "stage", Stage: "构建", Detail: "三条构建链完成"},
	} {
		emit(ev)
	}
	if f.block != nil {
		<-f.block
	}
	raw := f.reportRaw
	if raw == nil {
		raw = json.RawMessage(`{"completed":true,"failed_stage":"","note":"发布链路执行完成；报告只报脚本结果。","ledger_recorded":true,"duration_ms":12}`)
	}
	return raw, f.code
}

func (f *fakeDeployAPI) calls() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.releaseCalls
}

func deployTestState(t *testing.T, api DeployAPI) *uiState {
	t.Helper()
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	writeValidConfig(t, dir)
	u := newState(t, fakeDist(t))
	u.deployAPI = api
	u.deployView = newDeployViewState(api.Stages())
	return u
}

func serveDeployGet(u *uiState, target string) *httptest.ResponseRecorder {
	sep := "?"
	if strings.Contains(target, "?") {
		sep = "&"
	}
	req := httptest.NewRequest(http.MethodGet, target+sep+"token=tok", nil)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	return w
}

func serveDeployPost(u *uiState, body string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/deploy/release?token=tok", strings.NewReader(body))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	return w
}

const validDeployReleaseBody = `{"confirm":"yes","server":"bk","scope":"all","release_version":"1.16.1","release_note":"修复若干问题","bump":"patch","checks":[true,true,true]}`

func decodeDeployBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out struct {
		OK   bool           `json:"ok"`
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("响应不是 JSON：%v / %s", err, w.Body.String())
	}
	return out.Data
}

func TestDeployEndpointsNeedToken(t *testing.T) {
	u := deployTestState(t, &fakeDeployAPI{})
	for _, target := range []string{"/api/deploy/plan", "/api/deploy/releases", "/api/deploy/task"} {
		req := httptest.NewRequest(http.MethodGet, target, nil)
		w := httptest.NewRecorder()
		u.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("GET %s 不带 token = %d，想要 401", target, w.Code)
		}
	}
	req := httptest.NewRequest(http.MethodPost, "/api/deploy/release", strings.NewReader(validDeployReleaseBody))
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("POST /api/deploy/release 不带 token = %d，想要 401", w.Code)
	}
}

func TestDeployReleaseRejectsForeignOrigin(t *testing.T) {
	u := deployTestState(t, &fakeDeployAPI{precheckOK: true})
	w := serveDeployPost(u, validDeployReleaseBody, map[string]string{"Origin": "http://evil.local"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("外来 Origin = %d，想要 403", w.Code)
	}
}

func TestDeployPlanNormalizesArrays(t *testing.T) {
	u := deployTestState(t, &fakeDeployAPI{
		planRaw: json.RawMessage(`{"available":false,"error":"连不上目标机"}`),
	})
	w := serveDeployGet(u, "/api/deploy/plan?server=bk&scope=all")
	if w.Code != http.StatusOK {
		t.Fatalf("只读预演失败也要 200，实得 %d", w.Code)
	}
	d := decodeDeployBody(t, w)
	for _, k := range []string{"checks", "alignments", "commands", "impact", "warnings", "blockers"} {
		v, ok := d[k]
		if !ok || v == nil {
			t.Fatalf("%s 缺失 / 为 null：%v", k, d)
		}
		if _, ok := v.([]any); !ok {
			t.Fatalf("%s 不是数组：%T", k, v)
		}
	}
	if d["error"] != "连不上目标机" {
		t.Errorf("失败原因没带回来：%v", d["error"])
	}
}

func TestDeployHistoryEmptyArrayRedLine(t *testing.T) {
	for _, raw := range []json.RawMessage{
		json.RawMessage(`{"error":"台账读取失败","items":null}`),
		json.RawMessage(`{"error":"台账第 4 行解析失败"}`),
		json.RawMessage(`not-json`),
	} {
		u := deployTestState(t, &fakeDeployAPI{historyRaw: raw})
		w := serveDeployGet(u, "/api/deploy/releases?server=bk")
		if w.Code != http.StatusOK {
			t.Fatalf("%s → %d，想要 200（失败不许回 5xx）", raw, w.Code)
		}
		var env struct {
			OK   bool           `json:"ok"`
			Data map[string]any `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil || !env.OK {
			t.Fatalf("%s → ok 必须为 true：%s", raw, w.Body.String())
		}
		items, ok := env.Data["items"].([]any)
		if !ok || items == nil {
			t.Fatalf("%s → items 必须是数组 []：%v", raw, env.Data["items"])
		}
		if len(items) != 0 {
			t.Fatalf("%s → 失败时不许回半截历史：%v", raw, items)
		}
		if errText, _ := env.Data["error"].(string); errText == "" {
			t.Errorf("%s → 失败原因要如实带回：%v", raw, env.Data)
		}
	}
}

func TestDeployReleaseGateRejects(t *testing.T) {
	api := &fakeDeployAPI{precheckOK: true}
	u := deployTestState(t, api)
	bodies := []string{
		`{"server":"bk","scope":"all","release_version":"1.16.1","checks":[true,true,true]}`,                                       // 少 yes
		`{"confirm":"YES","server":"bk","scope":"all","release_version":"1.16.1","checks":[true,true,true]}`,                       // yes 大小写
		`{"confirm":"yes","server":"bk","scope":"all","release_version":"1.16.1","checks":[true,false,true]}`,                      // 少勾选
		`{"confirm":"yes","server":"bk","scope":"all","release_version":"1.16.1","checks":[true,true]}`,                            // 勾选数量不对
		`{"confirm":"yes","server":"bk","scope":"ghost","release_version":"1.16.1","checks":[true,true,true]}`,                     // 范围白名单
		`{"confirm":"yes","server":"bk","scope":"all","release_version":"1.16.1","bump":"evil","checks":[true,true,true]}`,         // 更新类型
		`{"confirm":"yes","server":"bk","scope":"all","release_version":"1.16.1","config_dir":"C:/tmp","checks":[true,true,true]}`, // 任意路径
		`{"confirm":"yes","server":"bk","scope":"all","release_version":"1.16.1","no_build":true,"checks":[true,true,true]}`,       // 未开放参数
	}
	for _, b := range bodies {
		if w := serveDeployPost(u, b, nil); w.Code != http.StatusBadRequest {
			t.Errorf("%s → %d，想要 400：%s", b, w.Code, w.Body.String())
		}
	}
	if got := api.calls(); got != 0 {
		t.Fatalf("门禁没过却执行了 %d 次发布", got)
	}
}

func TestDeployReleasePrecheckIsServerSideGate(t *testing.T) {
	api := &fakeDeployAPI{precheckOK: false, precheckDetail: "只读预演没跑通：ssh 255"}
	u := deployTestState(t, api)
	w := serveDeployPost(u, validDeployReleaseBody, nil)
	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "服务端预检门未过") {
		t.Fatalf("服务端预检门要挡住：%d / %s", w.Code, w.Body.String())
	}
	if got := api.calls(); got != 0 {
		t.Fatalf("预检没过却执行了 %d 次发布", got)
	}
}

func TestDeployReleaseUnknownServerIs404(t *testing.T) {
	api := &fakeDeployAPI{precheckOK: true}
	u := deployTestState(t, api)
	body := strings.Replace(validDeployReleaseBody, `"server":"bk"`, `"server":"ghost"`, 1)
	if w := serveDeployPost(u, body, nil); w.Code != http.StatusNotFound {
		t.Fatalf("未知目标机 = %d，想要 404：%s", w.Code, w.Body.String())
	}
}

func TestDeployReleaseConflictWhenTaskBusy(t *testing.T) {
	api := &fakeDeployAPI{precheckOK: true}
	u := deployTestState(t, api)
	if !u.ensureTask().start(backupVerify, "bk", "all", "") {
		t.Fatal("测试前置：占锁失败")
	}
	if w := serveDeployPost(u, validDeployReleaseBody, nil); w.Code != http.StatusConflict {
		t.Fatalf("任务在跑时 = %d，想要 409：%s", w.Code, w.Body.String())
	}
	if got := api.calls(); got != 0 {
		t.Fatalf("撞锁时执行了 %d 次发布", got)
	}
	u.ensureTask().finish(0)
}

func TestDeployReleaseRunAndTaskView(t *testing.T) {
	api := &fakeDeployAPI{precheckOK: true}
	u := deployTestState(t, api)
	w := serveDeployPost(u, validDeployReleaseBody, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("发布任务启动 = %d：%s", w.Code, w.Body.String())
	}
	d := decodeDeployBody(t, w)
	if d["started"] != true || d["task_id"] == "" || d["task_id"] == nil {
		t.Fatalf("启动响应缺 task_id：%v", d)
	}
	deadline := time.Now().Add(3 * time.Second)
	for !u.ensureTask().view(0).Done && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if !u.ensureTask().view(0).Done {
		t.Fatal("部署任务没在 3 秒内结束")
	}
	tw := serveDeployGet(u, "/api/deploy/task?after=0")
	if tw.Code != http.StatusOK {
		t.Fatalf("任务快照 = %d", tw.Code)
	}
	d = decodeDeployBody(t, tw)
	stages, ok := d["stages"].([]any)
	if !ok || len(stages) != len(deployTestStages) {
		t.Fatalf("六阶段条不完整：%v", d["stages"])
	}
	first, _ := stages[0].(map[string]any)
	if first["status"] != "ok" {
		t.Errorf("预检阶段应已完成：%v", first)
	}
	gates, _ := d["gates"].([]any)
	if len(gates) == 0 {
		t.Error("门禁结果没随任务快照回来")
	}
	report, _ := d["report"].(map[string]any)
	if report == nil || report["completed"] != true {
		t.Errorf("最终报告缺失 / 不是如实报告：%v", d["report"])
	}
	logText, _ := d["log"].(string)
	for _, want := range []string{"[门禁通过]", "[阶段完成]", "台账只在任务结束时 append"} {
		if !strings.Contains(logText, want) {
			t.Errorf("实时日志缺 %q：%q", want, logText)
		}
	}
	next, _ := d["next"].(float64)
	if next <= 0 {
		t.Fatalf("增量游标不对：%v", d["next"])
	}
	// 增量轮询：游标之后不应再把同一段日志发第二遍。
	d2 := decodeDeployBody(t, serveDeployGet(u, "/api/deploy/task?after="+strconv.Itoa(int(next))))
	if got, _ := d2["log"].(string); got != "" {
		t.Errorf("增量日志重复了：%q", got)
	}
	if api.calls() != 1 {
		t.Errorf("发布执行了 %d 次，想要 1 次", api.calls())
	}
}

func TestDeployReleaseModeIsNotABackupMode(t *testing.T) {
	if _, ok := parseBackupMode(string(deployReleaseMode)); ok {
		t.Error("deploy-release 不许被 POST /api/backup/run 当成备份模式")
	}
	if isBackupWriteMode(deployReleaseMode) {
		t.Error("deploy-release 不该进备份写模式判定")
	}
	if modeLabel(deployReleaseMode) != "应用部署正式发布" {
		t.Errorf("任务标签不对：%q", modeLabel(deployReleaseMode))
	}
}
