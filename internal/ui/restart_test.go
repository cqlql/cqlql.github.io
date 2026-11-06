package ui

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pass-up/ops/internal/restart"
)

func restartTestState(t *testing.T) *uiState {
	t.Helper()
	dir := t.TempDir()
	u := &uiState{
		token:     "tok",
		origin:    "http://127.0.0.1:7788",
		bootID:    "boot-1",
		port:      7788,
		configDir: dir,
		task:      &backupTask{},
	}
	if err := writeUIInfo(dir, uiInfo{Port: 7788, Token: "tok"}); err != nil {
		t.Fatal(err)
	}
	return u
}

func withRestartStubs(t *testing.T) (*[]string, *bool) {
	t.Helper()
	oldDelay, oldRebuild, oldSpawn, oldExit := restartDelay, rebuildForRestart, restartSpawn, exitProcess
	restartDelay = 0
	rebuildForRestart = func(context.Context, string, string, func(string)) (restart.Result, error) {
		return restart.Result{Output: "fake build output"}, nil
	}
	spawned := &[]string{}
	exited := new(bool)
	restartSpawn = func(exe string, argv []string, _ *os.File) error {
		*spawned = append([]string{exe}, argv...)
		return nil
	}
	exitProcess = func(int) { *exited = true }
	t.Cleanup(func() {
		restartDelay, rebuildForRestart, restartSpawn, exitProcess = oldDelay, oldRebuild, oldSpawn, oldExit
	})
	return spawned, exited
}

func postRestart(t *testing.T, u *uiState, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, "/api/restart?token=tok", strings.NewReader(body))
	r.Header.Set("Origin", u.origin)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, r)
	return w
}

func decodeData(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var env struct {
		OK    bool           `json:"ok"`
		Data  map[string]any `json:"data"`
		Error string         `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("响应不是信封 JSON：%v；body=%q", err, w.Body.String())
	}
	if !env.OK {
		t.Fatalf("接口没成功：%s", env.Error)
	}
	return env.Data
}

func TestHealthNeedsToken(t *testing.T) {
	u := restartTestState(t)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/health", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("health 也要过 token，实际 %d", w.Code)
	}
}

func TestHealthReportsBootID(t *testing.T) {
	u := restartTestState(t)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/health?token=tok", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("health 失败：%d", w.Code)
	}
	data := decodeData(t, w)
	if data["ok"] != true || data["boot_id"] != "boot-1" {
		t.Fatalf("boot_id 必须是这个进程实例的标识：%v", data)
	}
}

func TestRestartViewNeedsToken(t *testing.T) {
	u := restartTestState(t)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/restart", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("重启视图也要过 token，实际 %d", w.Code)
	}
}

func TestRestartViewReportsFacts(t *testing.T) {
	u := restartTestState(t)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/restart?token=tok", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("视图失败：%d", w.Code)
	}
	data := decodeData(t, w)
	confirm, _ := data["confirm_token"].(string)
	if !strings.HasPrefix(confirm, "sha256:") {
		t.Fatalf("确认令牌形状不对：%v", data["confirm_token"])
	}
	impact, _ := data["impact"].([]any)
	if len(impact) < 5 {
		t.Fatalf("影响面必须逐条摊开，实际只有 %d 条", len(impact))
	}
	if data["port"] != float64(7788) {
		t.Fatalf("视图里的端口应是实际端口：%v", data["port"])
	}
	if data["note"] != nil && data["note"] != "" {
		t.Fatalf("ui.json 齐备时不该有「不给按钮」的说明：%v", data["note"])
	}
	logPath, _ := data["log_path"].(string)
	if !strings.HasSuffix(logPath, uiLogName) {
		t.Fatalf("日志路径必须指到 ops-ui.log：%q", logPath)
	}
}

func TestRestartViewNotesMissingIdentity(t *testing.T) {
	u := restartTestState(t)
	if err := os.Remove(uiInfoPath(u.configDir)); err != nil {
		t.Fatal(err)
	}
	view := u.restartViewFor()
	if view.Note == "" || !strings.Contains(view.Note, "ui.json") {
		t.Fatalf("读不到 ui.json 时必须不给按钮并说明原因：%+v", view)
	}
}

func TestRestartConfirmTokenBindsInstance(t *testing.T) {
	a := restartTestState(t)
	b := restartTestState(t)
	b.bootID = "boot-2"
	if a.restartConfirmToken() != a.restartConfirmToken() {
		t.Fatal("同一实例的确认令牌必须稳定")
	}
	if a.restartConfirmToken() == b.restartConfirmToken() {
		t.Fatal("换过进程实例后旧页面的确认必须失效")
	}
	c := restartTestState(t)
	c.port = 7789
	if a.restartConfirmToken() == c.restartConfirmToken() {
		t.Fatal("端口变了也要重新确认")
	}
}

func TestRestartRejectsStaleConfirm(t *testing.T) {
	u := restartTestState(t)
	spawned, exited := withRestartStubs(t)
	w := postRestart(t, u, `{"rebuild":false,"confirm":"wrong"}`)
	if w.Code != http.StatusConflict {
		t.Fatalf("确认过期应回 409，实际 %d", w.Code)
	}
	if len(*spawned) != 0 || *exited {
		t.Fatal("被拒的请求不能交接、不能退出进程")
	}
}

func TestRestartRejectsRunningBackupTask(t *testing.T) {
	u := restartTestState(t)
	task := u.task
	task.mu.Lock()
	task.running = true
	task.mu.Unlock()
	spawned, exited := withRestartStubs(t)
	r := httptest.NewRequest(http.MethodPost, "/api/restart?token=tok",
		strings.NewReader(`{"rebuild":false,"confirm":"`+u.restartConfirmToken()+`"}`))
	r.Header.Set("Origin", u.origin)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, r)
	if w.Code != http.StatusConflict || !strings.Contains(w.Body.String(), "正在运行") {
		t.Fatalf("任务在跑时必须硬拒绝并说明：%d %q", w.Code, w.Body.String())
	}
	if len(*spawned) != 0 || *exited {
		t.Fatal("拒绝时不能交接")
	}
}

func TestRestartRebuildFailureDoesNotHandover(t *testing.T) {
	u := restartTestState(t)
	spawned, exited := withRestartStubs(t)
	rebuildForRestart = func(context.Context, string, string, func(string)) (restart.Result, error) {
		return restart.Result{Output: "npm run build 挂了"}, os.ErrPermission
	}
	r := httptest.NewRequest(http.MethodPost, "/api/restart?token=tok",
		strings.NewReader(`{"rebuild":true,"confirm":"`+u.restartConfirmToken()+`"}`))
	r.Header.Set("Origin", u.origin)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, r)
	if w.Code != http.StatusInternalServerError || !strings.Contains(w.Body.String(), "服务照旧在跑") {
		t.Fatalf("重建失败必须明确说「没有重启」：%d %q", w.Code, w.Body.String())
	}
	if len(*spawned) != 0 || *exited {
		t.Fatal("重建失败绝不能交接（服务要照旧在跑）")
	}
}

func TestRestartHandsOverWithRebuild(t *testing.T) {
	u := restartTestState(t)
	spawned, exited := withRestartStubs(t)
	next := filepath.Join(u.configDir, "ops.next.exe")
	rebuildForRestart = func(context.Context, string, string, func(string)) (restart.Result, error) {
		return restart.Result{NewExe: next, GoBuilt: true, Output: "built"}, nil
	}
	r := httptest.NewRequest(http.MethodPost, "/api/restart?token=tok",
		strings.NewReader(`{"rebuild":true,"confirm":"`+u.restartConfirmToken()+`"}`))
	r.Header.Set("Origin", u.origin)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("交接前应回 200：%d %q", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Content-Length"); got == "" || got == "0" {
		t.Fatal("响应必须显式 Content-Length，否则 chunked 结束块永远发不出去")
	}
	data := decodeData(t, w)
	if data["restarting"] != true || data["boot_id"] != "boot-1" {
		t.Fatalf("响应里要带重启前的 boot_id：%v", data)
	}
	if !*exited {
		t.Fatal("交接成功后旧进程必须退出")
	}
	if len(*spawned) != 5 {
		t.Fatalf("接手参数应是 exe + 4 个，实际：%+v", *spawned)
	}
	argv := *spawned
	if argv[0] != next {
		t.Fatalf("重建过就必须从 ops.next.exe 起：%s", argv[0])
	}
	if argv[1] != restart.Subcommand || argv[2] != "127.0.0.1:7788" {
		t.Fatalf("接手子命令与地址不对：%+v", argv)
	}
	if argv[4] != next {
		t.Fatalf("要换上去的新二进制没传给接手进程：%+v", argv)
	}
	if _, err := os.Stat(filepath.Join(u.configDir, uiLogName)); err != nil {
		t.Fatalf("接手进程的输出必须落到 ops-ui.log：%v", err)
	}
}

func TestRestartWithoutRebuildUsesFormalExe(t *testing.T) {
	u := restartTestState(t)
	spawned, _ := withRestartStubs(t)
	r := httptest.NewRequest(http.MethodPost, "/api/restart?token=tok",
		strings.NewReader(`{"rebuild":false,"confirm":"`+u.restartConfirmToken()+`"}`))
	r.Header.Set("Origin", u.origin)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("不重建也要能交接：%d", w.Code)
	}
	argv := *spawned
	if len(argv) != 5 || argv[4] != "-" {
		t.Fatalf("不重建时接手进程不该换二进制：%+v", argv)
	}
	target, err := restart.TargetExe()
	if err != nil {
		t.Fatal(err)
	}
	if argv[0] != target || argv[3] != target {
		t.Fatalf("不重建时「从哪个文件起」与「正式 exe」都应是同一个：%+v", argv)
	}
}

func TestRestartSpawnFailureKeepsServiceAlive(t *testing.T) {
	u := restartTestState(t)
	_, exited := withRestartStubs(t)
	restartSpawn = func(string, []string, *os.File) error { return os.ErrPermission }
	r := httptest.NewRequest(http.MethodPost, "/api/restart?token=tok",
		strings.NewReader(`{"rebuild":false,"confirm":"`+u.restartConfirmToken()+`"}`))
	r.Header.Set("Origin", u.origin)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("200 已经写出去了，不能再塞第二个响应体：%d", w.Code)
	}
	if *exited {
		t.Fatal("接手进程没起来时**绝不退出**，否则服务彻底没了")
	}
}

func TestAcquireSingletonRetryEventuallySucceeds(t *testing.T) {
	old := acquireSingleton
	calls := 0
	acquireSingleton = func(string) (func(), bool) {
		calls++
		if calls < 3 {
			return func() {}, false
		}
		return func() {}, true
	}
	t.Cleanup(func() { acquireSingleton = old })
	release, ok := acquireSingletonRetry("key", 2*time.Second)
	if !ok {
		t.Fatal("旧进程只是慢了几毫秒放行，不该判成接手失败")
	}
	release()
}

func TestAcquireSingletonRetryTimesOut(t *testing.T) {
	old := acquireSingleton
	acquireSingleton = func(string) (func(), bool) { return func() {}, false }
	t.Cleanup(func() { acquireSingleton = old })
	_, ok := acquireSingletonRetry("key", 250*time.Millisecond)
	if ok {
		t.Fatal("一直拿不到锁必须如实失败")
	}
}
