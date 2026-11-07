package ui

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// 界面「安装缺少依赖」的六道门：GET 只读、name/组件/pg_major 白名单、
// POST confirm=yes、服务端先跑 --dry-run、与 deploy 共用同一把任务锁。

func serveBackupDeps(u *uiState, query string) *httptest.ResponseRecorder {
	return serve(u, http.MethodGet, "/api/backup/deps?token=tok&"+query, nil)
}

func depsData(w *httptest.ResponseRecorder) map[string]any {
	var body struct {
		OK   bool           `json:"ok"`
		Data map[string]any `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return body.Data
}

func TestBackupDepsEndpointNeedsToken(t *testing.T) {
	u := backupState(t, func([]string, string, io.Writer) int { return 0 })
	if w := serve(u, http.MethodGet, "/api/backup/deps?name=bk", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("不带 token 读依赖状态 = %d，想要 401", w.Code)
	}
}

func TestBackupDepsEndpointIsReadOnly(t *testing.T) {
	f := &fakeBackupRunner{onCall: func(_ int, _ []string, out io.Writer) {
		fmt.Fprint(out, `{"server":"bk","component":"all","collected":true,"items":[],"missing":["mc"],"optional":[],"plan":[],"docs":[]}`)
	}}
	u := backupState(t, f.run)
	w := serveBackupDeps(u, "name=bk&component=all")
	if w.Code != http.StatusOK {
		t.Fatalf("只读依赖状态 = %d：%s", w.Code, w.Body.String())
	}
	calls := f.snapshot()
	if len(calls) != 1 {
		t.Fatalf("只读接口执行了 %d 条命令，想要 1 条", len(calls))
	}
	got := strings.Join(calls[0].args, " ")
	if got != "deps all --server bk --json" {
		t.Errorf("只读命令 = %q，想要 deps all --server bk --json", got)
	}
	if calls[0].password != "" {
		t.Error("只读状态不该带 sudo 密码")
	}
	data := depsData(w)
	if data["collected"] != true {
		t.Errorf("data.collected = %v：%v", data["collected"], data)
	}
}

func TestBackupDepsEndpointGates(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	cases := []struct {
		query string
		want  int
	}{
		{"name=", http.StatusBadRequest},
		{"name=bk&component=postgres", http.StatusBadRequest},
		{"name=bk&component=all&pg_major=abc", http.StatusBadRequest},
		{"name=bk&component=all&pg_major=100", http.StatusBadRequest},
		{"name=not-in-list&component=all", http.StatusNotFound},
	}
	for _, c := range cases {
		if w := serveBackupDeps(u, c.query); w.Code != c.want {
			t.Errorf("%s → %d，想要 %d", c.query, w.Code, c.want)
		}
	}
	if len(f.snapshot()) != 0 {
		t.Errorf("被拦下的请求仍执行了 %d 条命令", len(f.snapshot()))
	}
	w := serveBackupDeps(u, "name=bk&component=pg&pg_major=16")
	if w.Code != http.StatusOK {
		t.Fatalf("合法 pg_major = %d", w.Code)
	}
	got := strings.Join(f.snapshot()[0].args, " ")
	if !strings.Contains(got, "--pg-major 16") || !strings.Contains(got, "--json") {
		t.Errorf("只读命令没带上 pg_major：%q", got)
	}
}

func TestBackupDepsEndpointBadJSONStaysPageFriendly(t *testing.T) {
	f := &fakeBackupRunner{onCall: func(_ int, _ []string, out io.Writer) {
		fmt.Fprint(out, "ssh: connection refused")
	}}
	u := backupState(t, f.run)
	w := serveBackupDeps(u, "name=bk&component=all")
	if w.Code != http.StatusOK {
		t.Fatalf("解析失败也应该回 200 + data.error = %d", w.Code)
	}
	data := depsData(w)
	if data["collected"] != false || data["error"] == "" {
		t.Errorf("失败时 collected=false + error：%v", data)
	}
	if _, ok := data["items"].([]any); !ok {
		t.Errorf("items 必须是数组而不是 null：%v", data["items"])
	}
}

func TestBackupRunDepsNeedsYes(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	for _, body := range []string{
		`{"mode":"deps","name":"bk"}`,
		`{"mode":"deps","name":"bk","confirm":"YES"}`,
	} {
		if w := serveBackupRun(u, body); w.Code != http.StatusBadRequest {
			t.Errorf("%s → %d，想要 400", body, w.Code)
		}
	}
	if len(f.snapshot()) != 0 {
		t.Fatalf("没确认却执行了 %d 次命令", len(f.snapshot()))
	}
}

func TestBackupRunDepsExtraFlagGates(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	for _, body := range []string{
		`{"mode":"deploy","name":"bk","confirm":"yes","pg_major":16}`,
		`{"mode":"preflight","name":"bk","pg_major":16}`,
		`{"mode":"deps","name":"bk","confirm":"yes","pg_major":100}`,
		`{"mode":"deps","name":"bk","confirm":"yes","pg_major":-1}`,
	} {
		if w := serveBackupRun(u, body); w.Code != http.StatusBadRequest {
			t.Errorf("%s → %d，想要 400", body, w.Code)
		}
	}
	if len(f.snapshot()) != 0 {
		t.Errorf("非法参数仍执行了 %d 条命令", len(f.snapshot()))
	}
}

func TestBackupRunDepsDryRunGate(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, `{"mode":"deps","name":"bk","component":"minio","confirm":"yes","pg_major":16,"password":"s3cr3t"}`); w.Code != http.StatusOK {
		t.Fatalf("提交安装依赖 = %d：%s", w.Code, w.Body.String())
	}
	view := waitBackupTask(t, u)
	if view.Mode != "deps" || view.ExitCode != 0 {
		t.Errorf("任务视图 = %+v", view)
	}
	calls := f.snapshot()
	if len(calls) != 2 {
		t.Fatalf("执行了 %d 条命令，想要 预检 + 正式 各 1 条", len(calls))
	}
	pre, run := strings.Join(calls[0].args, " "), strings.Join(calls[1].args, " ")
	if !strings.HasPrefix(pre, "deps minio --server bk") || !strings.HasSuffix(pre, "--dry-run") {
		t.Errorf("服务端预检命令不对：%q", pre)
	}
	if strings.Contains(run, "--dry-run") {
		t.Errorf("正式动作不该带 --dry-run：%q", run)
	}
	for _, args := range []string{pre, run} {
		if !strings.Contains(args, "--pg-major 16") {
			t.Errorf("预检与正式动作必须带同一组参数：%q", args)
		}
		if strings.Contains(args, "--install-deps") || strings.Contains(args, "--force") || strings.Contains(args, "--run-now") {
			t.Errorf("界面不该开放这些开关：%q", args)
		}
		if !strings.HasPrefix(args, "deps ") {
			t.Errorf("必须走独立 deps 子命令，不能变成 deploy：%q", args)
		}
	}
	for _, c := range calls {
		if c.password != "s3cr3t" {
			t.Errorf("密码没经 stdin 交给子进程：%q", c.password)
		}
	}
	if strings.Contains(view.Log, "s3cr3t") {
		t.Error("任务日志泄漏了 sudo 密码")
	}
}

// deps 与 deploy 共用同一把后台任务锁：装依赖时再来一个安装请求必须 409。
func TestBackupRunDepsSharesTaskLock(t *testing.T) {
	entered := make(chan struct{})
	block := make(chan struct{})
	f := &fakeBackupRunner{entered: entered, block: block}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, `{"mode":"deps","name":"bk","confirm":"yes"}`); w.Code != http.StatusOK {
		t.Fatalf("提交安装依赖 = %d", w.Code)
	}
	<-entered
	if w := serveBackupRun(u, `{"mode":"deploy","name":"bk","confirm":"yes"}`); w.Code != http.StatusConflict {
		t.Errorf("依赖安装期间再来一个 deploy = %d，想要 409", w.Code)
	}
	close(block)
	waitBackupTask(t, u)
	if got := len(f.snapshot()); got != 2 {
		t.Errorf("并发时执行了 %d 条命令，想要 deps 的预检 + 正式 共 2 条", got)
	}
}

func TestBackupRunDepsPreflightFailureStops(t *testing.T) {
	f := &fakeBackupRunner{codes: []int{1}}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, `{"mode":"deps","name":"bk","confirm":"yes"}`); w.Code != http.StatusOK {
		t.Fatalf("提交 = %d", w.Code)
	}
	waitBackupTask(t, u)
	if got := len(f.snapshot()); got != 1 {
		t.Errorf("预检失败后执行了 %d 条命令，想要 1 条", got)
	}
}

func TestNormalizeUninstallTargets(t *testing.T) {
	got, err := normalizeUninstallTargets([]string{" MC ", "pg_client", "mc"})
	if err != nil || strings.Join(got, ",") != "mc,pg_client" {
		t.Errorf("归一化 / 去重 = %v, %v", got, err)
	}
	for _, in := range [][]string{nil, {"cron"}, {"docker"}, {"mc", "/usr/bin/mc"}} {
		if _, err := normalizeUninstallTargets(in); err == nil {
			t.Errorf("%v 不该通过（会变成远端 rm / apt remove 的参数）", in)
		}
	}
}

func TestBackupRunDepsUninstallGates(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	for _, body := range []string{
		`{"mode":"deps-uninstall","name":"bk","targets":["mc"]}`,
		`{"mode":"deps-uninstall","name":"bk","confirm":"yes"}`,
		`{"mode":"deps-uninstall","name":"bk","confirm":"yes","targets":["cron"]}`,
		`{"mode":"deps-uninstall","name":"bk","confirm":"yes","targets":["mc"],"pg_major":16}`,
		`{"mode":"deps","name":"bk","confirm":"yes","targets":["mc"]}`,
	} {
		if w := serveBackupRun(u, body); w.Code != http.StatusBadRequest {
			t.Errorf("%s → %d，想要 400", body, w.Code)
		}
	}
	if got := len(f.snapshot()); got != 0 {
		t.Errorf("被拦下的请求仍执行了 %d 条命令", got)
	}
}

func TestBackupRunDepsUninstallDryRunGate(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	body := `{"mode":"deps-uninstall","name":"bk","confirm":"yes","targets":["mc","pg_client"],"password":"s3cr3t"}`
	if w := serveBackupRun(u, body); w.Code != http.StatusOK {
		t.Fatalf("提交卸载 = %d：%s", w.Code, w.Body.String())
	}
	view := waitBackupTask(t, u)
	if view.Mode != "deps-uninstall" || view.ExitCode != 0 {
		t.Errorf("任务视图 = %+v", view)
	}
	calls := f.snapshot()
	if len(calls) != 2 {
		t.Fatalf("执行了 %d 条命令，想要 预检 + 正式 各 1 条", len(calls))
	}
	pre, run := strings.Join(calls[0].args, " "), strings.Join(calls[1].args, " ")
	if !strings.HasPrefix(pre, "deps-uninstall --server bk") || !strings.HasSuffix(pre, "--dry-run") {
		t.Errorf("服务端预检命令不对：%q", pre)
	}
	if strings.Contains(run, "--dry-run") {
		t.Errorf("正式动作不该带 --dry-run：%q", run)
	}
	for _, args := range []string{pre, run} {
		if !strings.Contains(args, "--target mc --target pg_client") {
			t.Errorf("预检与正式动作必须带同一组 --target：%q", args)
		}
		if strings.Contains(args, "--install-deps") || strings.Contains(args, "--force") || strings.Contains(args, "--run-now") {
			t.Errorf("界面不该开放这些开关：%q", args)
		}
		if strings.Contains(args, "deploy") {
			t.Errorf("卸载必须走独立子命令，不能变成 deploy：%q", args)
		}
	}
	if strings.Contains(view.Log, "s3cr3t") {
		t.Error("任务日志泄漏了 sudo 密码")
	}
}
