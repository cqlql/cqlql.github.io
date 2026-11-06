package ui

import (
	"pass-up/ops/internal/shared"
)

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// 备份部署是界面里第二个写操作，测试重点是**边界**，不是真的去连 SSH：
// 确认门、预检门、只认清单 name、密码脱敏、并发互斥、日志增量。

func backupState(t *testing.T, runner BackupRunner) *uiState {
	t.Helper()
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	writeValidConfig(t, dir)
	u := newState(t, fakeDist(t))
	u.runner = runner
	return u
}

func serveBackupRun(u *uiState, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run?token=tok", strings.NewReader(body))
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	return w
}

type recordedCall struct {
	args     []string
	password string
}

type fakeBackupRunner struct {
	mu       sync.Mutex
	calls    []recordedCall
	codes    []int
	onCall   func(n int, args []string, out io.Writer)
	block    chan struct{}
	entered  chan struct{}
	enteredN int
}

func (f *fakeBackupRunner) run(args []string, password string, out io.Writer) int {
	f.mu.Lock()
	n := len(f.calls)
	f.calls = append(f.calls, recordedCall{args: append([]string{}, args...), password: password})
	f.mu.Unlock()

	if f.entered != nil && n == f.enteredN {
		close(f.entered)
	}
	if f.block != nil {
		<-f.block
	}
	if f.onCall != nil {
		f.onCall(n, args, out)
	}
	code := 0
	if n < len(f.codes) {
		code = f.codes[n]
	}
	return code
}

func (f *fakeBackupRunner) snapshot() []recordedCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]recordedCall{}, f.calls...)
}

func waitBackupTask(t *testing.T, u *uiState) backupTaskView {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for {
		v := u.ensureTask().view(0)
		if v.Done {
			return v
		}
		if time.Now().After(deadline) {
			t.Fatal("备份任务没在 3 秒内结束")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestBackupEndpointsNeedToken(t *testing.T) {
	u := backupState(t, func([]string, string, io.Writer) int { return 0 })
	if w := serve(u, http.MethodPost, "/api/backup/run", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("不带 token 启动部署 = %d，想要 401", w.Code)
	}
	if w := serve(u, http.MethodGet, "/api/backup/task", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("不带 token 读任务 = %d，想要 401", w.Code)
	}
	if w := serve(u, http.MethodGet, "/api/backup/task?token=tok", nil); w.Code != http.StatusOK {
		t.Fatalf("带 token 读任务 = %d，想要 200", w.Code)
	}
}

func TestBackupRunRejectsForeignOrigin(t *testing.T) {
	u := backupState(t, func([]string, string, io.Writer) int { return 0 })
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run?token=tok", strings.NewReader(`{"mode":"deploy","name":"bk","confirm":"yes"}`))
	req.Header.Set("Origin", "http://evil.example")
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("外部 Origin = %d，想要 403", w.Code)
	}
}

func TestBackupDeployNeedsYes(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	for _, body := range []string{
		`{"mode":"deploy","name":"bk"}`,
		`{"mode":"deploy","name":"bk","confirm":"YES"}`,
		`{"mode":"deploy","name":"bk","confirm":"true"}`,
	} {
		if w := serveBackupRun(u, body); w.Code != http.StatusBadRequest {
			t.Errorf("%s → %d，想要 400", body, w.Code)
		}
	}
	if got := len(f.snapshot()); got != 0 {
		t.Fatalf("没确认却执行了 %d 次命令", got)
	}
}

func TestBackupRunValidatesInput(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	cases := []struct {
		body string
		code int
	}{
		{`{"mode":"rm-rf","name":"bk"}`, http.StatusBadRequest},
		{`{"mode":"preflight","name":"bk","component":"../etc"}`, http.StatusBadRequest},
		{`{"mode":"preflight"}`, http.StatusBadRequest},
		{`{"mode":"preflight","name":"not-in-list"}`, http.StatusNotFound},
	}
	for _, c := range cases {
		if w := serveBackupRun(u, c.body); w.Code != c.code {
			t.Errorf("%s → %d，想要 %d", c.body, w.Code, c.code)
		}
	}
	if got := len(f.snapshot()); got != 0 {
		t.Fatalf("非法输入却执行了 %d 次命令", got)
	}
}

func TestBackupRunnerNotWired(t *testing.T) {
	u := backupState(t, nil)
	w := serveBackupRun(u, `{"mode":"preflight","name":"bk"}`)
	if w.Code != http.StatusNotImplemented {
		t.Fatalf("没注入执行器 = %d，想要 501", w.Code)
	}
}

// 预检门在**服务端**：预检失败时绝不执行安装，哪怕前端跳过预检、直接调 API。
func TestBackupDeployStopsWhenPreflightFails(t *testing.T) {
	f := &fakeBackupRunner{codes: []int{1}}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, `{"mode":"deploy","name":"bk","confirm":"yes"}`); w.Code != http.StatusOK {
		t.Fatalf("启动任务 = %d", w.Code)
	}
	v := waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 1 {
		t.Fatalf("预检失败后仍执行了 %d 次命令，想要 1 次：%+v", len(calls), calls)
	}
	if !strings.Contains(strings.Join(calls[0].args, " "), "--dry-run") {
		t.Errorf("第一次调用应该是预检：%v", calls[0].args)
	}
	if v.ExitCode != 1 || !strings.Contains(v.Log, "预检没过") {
		t.Errorf("退出码 / 日志不对：code=%d log=%q", v.ExitCode, v.Log)
	}
}

func TestBackupDeployRunsOnlyAfterPreflightPasses(t *testing.T) {
	f := &fakeBackupRunner{codes: []int{0, 0}}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, `{"mode":"deploy","name":"bk","component":"pg","confirm":"yes"}`); w.Code != http.StatusOK {
		t.Fatalf("启动任务 = %d", w.Code)
	}
	v := waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 2 {
		t.Fatalf("想要预检 + 安装两次调用，实得 %d：%+v", len(calls), calls)
	}
	if !strings.Contains(strings.Join(calls[0].args, " "), "--dry-run") {
		t.Errorf("第一次应该是 --dry-run：%v", calls[0].args)
	}
	if strings.Contains(strings.Join(calls[1].args, " "), "--dry-run") {
		t.Errorf("第二次不该带 --dry-run：%v", calls[1].args)
	}
	if !strings.Contains(strings.Join(calls[1].args, " "), "pg") {
		t.Errorf("组件没传下去：%v", calls[1].args)
	}
	if v.ExitCode != 0 || !strings.Contains(v.Log, "预检通过") {
		t.Errorf("退出码 / 日志不对：code=%d log=%q", v.ExitCode, v.Log)
	}
}

// 密码经参数交给子进程 stdin，但**绝不能**出现在轮询拿到的日志里
// （远端脚本万一 echo 了一行，界面上就会看到明文）。
func TestBackupLogRedactsPassword(t *testing.T) {
	const secret = "super-secret-123"
	f := &fakeBackupRunner{onCall: func(_ int, _ []string, out io.Writer) {
		_, _ = io.WriteString(out, "sudo 提示："+secret+"\n")
	}}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, `{"mode":"deploy","name":"bk","confirm":"yes","password":"`+secret+`"}`); w.Code != http.StatusOK {
		t.Fatalf("启动任务 = %d", w.Code)
	}
	v := waitBackupTask(t, u)
	if strings.Contains(v.Log, secret) {
		t.Errorf("日志里出现了明文密码：%q", v.Log)
	}
	if !strings.Contains(v.Log, "***") {
		t.Errorf("日志里没有脱敏标记：%q", v.Log)
	}
	for _, c := range f.snapshot() {
		if c.password != secret {
			t.Errorf("密码没原样交给执行器：%q", c.password)
		}
	}
}

func TestBackupTaskLogIsIncremental(t *testing.T) {
	f := &fakeBackupRunner{onCall: func(_ int, _ []string, out io.Writer) {
		_, _ = io.WriteString(out, "第一行\n第二行\n")
	}}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, `{"mode":"verify","name":"bk"}`); w.Code != http.StatusOK {
		t.Fatalf("启动任务 = %d", w.Code)
	}
	waitBackupTask(t, u)

	all := u.ensureTask().view(0)
	if all.Next != len(all.Log) {
		t.Fatalf("next=%d 但日志长度=%d", all.Next, len(all.Log))
	}
	tail := u.ensureTask().view(all.Next)
	if tail.Log != "" || tail.Next != all.Next {
		t.Errorf("增量轮询应该拿到空日志：log=%q next=%d", tail.Log, tail.Next)
	}
	// 中文按字节偏移取增量不会切出半个字：after 是上一次日志的完整字节末尾。
	if !strings.Contains(all.Log, "第二行") {
		t.Errorf("日志丢了中文内容：%q", all.Log)
	}
}

func TestBackupRejectsConcurrentTasks(t *testing.T) {
	entered := make(chan struct{})
	block := make(chan struct{})
	f := &fakeBackupRunner{entered: entered, block: block}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, `{"mode":"preflight","name":"bk"}`); w.Code != http.StatusOK {
		t.Fatalf("第一个任务 = %d", w.Code)
	}
	<-entered
	w := serveBackupRun(u, `{"mode":"preflight","name":"bk"}`)
	if w.Code != http.StatusConflict {
		t.Errorf("并发启动第二个任务 = %d，想要 409", w.Code)
	}
	close(block)
	waitBackupTask(t, u)
	if got := len(f.snapshot()); got != 1 {
		t.Errorf("并发时执行了 %d 次命令，想要 1 次", got)
	}
}

func TestApplySudoBlockedWhileBackupRunning(t *testing.T) {
	u := backupState(t, func([]string, string, io.Writer) int { return 0 })
	if !u.ensureTask().start(backupDeploy, "bk", "all", "") {
		t.Fatal("任务没抢到锁")
	}
	req := httptest.NewRequest(http.MethodPost, "/api/apply-sudo?token=tok",
		strings.NewReader(`{"name":"bk","password":"x"}`))
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("部署中配置免密 sudo = %d，想要 409", w.Code)
	}
}

func TestBackupCommandArgs(t *testing.T) {
	cases := []struct {
		mode BackupMode
		want string
	}{
		{backupPreflight, "deploy all --server bk --dry-run"},
		{backupDeploy, "deploy all --server bk"},
		{backupVerify, "verify all --server bk"},
	}
	for _, c := range cases {
		if got := strings.Join(backupCommandArgs(c.mode, "bk", "all"), " "); got != c.want {
			t.Errorf("%s → %q，想要 %q", c.mode, got, c.want)
		}
	}
}
