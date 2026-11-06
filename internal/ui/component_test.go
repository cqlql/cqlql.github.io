package ui

// 环境组件接口的边界测试：确认门、服务端预检门、注册表白名单、只认清单 name、
// 单任务 409、以及与备份部署共用任务锁（重启门因此自动覆盖）。

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func serveComponentRun(u *uiState, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/components/run?token=tok", strings.NewReader(body))
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	return w
}

func serveComponentGet(u *uiState, target string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	return w
}

func TestComponentEndpointsNeedToken(t *testing.T) {
	u := backupState(t, func([]string, string, io.Writer) int { return 0 })
	for _, target := range []string{
		"/api/components/status?name=bk",
		"/api/components/task",
		"/api/components/run",
	} {
		method := http.MethodGet
		if strings.HasSuffix(target, "/run") {
			method = http.MethodPost
		}
		if w := serve(u, method, target, nil); w.Code != http.StatusUnauthorized {
			t.Errorf("%s 不带 token = %d，想要 401", target, w.Code)
		}
	}
}

func TestComponentRunGates(t *testing.T) {
	u := backupState(t, func([]string, string, io.Writer) int { return 0 })
	cases := []struct {
		name string
		body string
		want int
	}{
		{"缺 confirm", `{"verb":"install","component":"docker","name":"bk"}`, http.StatusBadRequest},
		{"confirm 不是 yes", `{"verb":"install","component":"docker","name":"bk","confirm":"no"}`, http.StatusBadRequest},
		{"planned 组件", `{"verb":"install","component":"minio","name":"bk","confirm":"yes"}`, http.StatusBadRequest},
		{"未注册组件", `{"verb":"install","component":"../../etc","name":"bk","confirm":"yes"}`, http.StatusBadRequest},
		{"未开放动词", `{"verb":"uninstall","component":"docker","name":"bk","confirm":"yes"}`, http.StatusBadRequest},
		{"未知 name", `{"verb":"install","component":"docker","name":"evil","confirm":"yes"}`, http.StatusNotFound},
		{"缺 name", `{"verb":"install","component":"docker","confirm":"yes"}`, http.StatusBadRequest},
	}
	for _, c := range cases {
		if w := serveComponentRun(u, c.body); w.Code != c.want {
			t.Errorf("%s = %d，想要 %d；响应 %s", c.name, w.Code, c.want, w.Body.String())
		}
	}
}

// 服务端自己先跑 --dry-run：前端点了不算数，预检非 0 绝不执行安装。
func TestComponentRunPreflightGate(t *testing.T) {
	f := &fakeBackupRunner{codes: []int{1}}
	u := backupState(t, f.run)
	if w := serveComponentRun(u, `{"verb":"install","component":"docker","name":"bk","confirm":"yes"}`); w.Code != http.StatusOK {
		t.Fatalf("合法请求 = %d：%s", w.Code, w.Body.String())
	}
	v := waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 1 {
		t.Fatalf("预检失败后不该再跑安装，实际调用 %d 次：%+v", len(calls), calls)
	}
	if !strings.Contains(strings.Join(calls[0].args, " "), "--dry-run") {
		t.Errorf("第一次调用必须是 dry-run：%v", calls[0].args)
	}
	if v.ExitCode != 1 || !strings.Contains(v.Log, "预检没过") {
		t.Errorf("任务应以预检失败收尾：%+v", v)
	}
}

// 预检通过时才跑正式安装；密码只经 runner 的 password 参数（子进程 stdin）。
func TestComponentRunDryRunThenInstall(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	w := serveComponentRun(u, `{"verb":"install","component":"docker","name":"bk","confirm":"yes","password":"s3cr3t"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("启动失败：%s", w.Body.String())
	}
	waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 2 {
		t.Fatalf("应该是 预检 + 安装 两次调用，得到 %d", len(calls))
	}
	if !strings.Contains(strings.Join(calls[0].args, " "), "--dry-run") {
		t.Errorf("第一次应为 dry-run：%v", calls[0].args)
	}
	if strings.Contains(strings.Join(calls[1].args, " "), "--dry-run") {
		t.Errorf("第二次不该带 dry-run：%v", calls[1].args)
	}
	for _, c := range calls {
		if c.args[0] != "component" || c.password != "s3cr3t" {
			t.Errorf("参数/密码传递不对：%+v", c)
		}
	}
}

func TestComponentRunSingleTaskMutex(t *testing.T) {
	f := &fakeBackupRunner{block: make(chan struct{}), entered: make(chan struct{})}
	u := backupState(t, f.run)
	if w := serveComponentRun(u, `{"verb":"install","component":"docker","name":"bk","confirm":"yes"}`); w.Code != http.StatusOK {
		t.Fatalf("第一次启动失败：%s", w.Body.String())
	}
	<-f.entered
	if !u.backupBusy() {
		t.Error("组件任务在跑时，重启的 409 门必须能感知到（共用任务锁）")
	}
	if w := serveComponentRun(u, `{"verb":"install","component":"docker","name":"bk","confirm":"yes"}`); w.Code != http.StatusConflict {
		t.Errorf("并发写请求 = %d，想要 409", w.Code)
	}
	close(f.block)
	waitBackupTask(t, u)
}

func TestComponentStatusOnlyKnownName(t *testing.T) {
	runner := func(args []string, _ string, out io.Writer) int {
		fmt.Fprint(out, `{"server":"bk","collected":true,"components":[],"checks":[],"raw":{},"preflight":{"ready":true,"blockers":[],"warnings":[]}}`)
		return 0
	}
	u := backupState(t, runner)
	if w := serveComponentGet(u, "/api/components/status?token=tok"); w.Code != http.StatusBadRequest {
		t.Errorf("缺 name = %d，想要 400", w.Code)
	}
	if w := serveComponentGet(u, "/api/components/status?token=tok&name=evil"); w.Code != http.StatusNotFound {
		t.Errorf("未知 name = %d，想要 404", w.Code)
	}
	w := serveComponentGet(u, "/api/components/status?token=tok&name=bk")
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"ok":true`) {
		t.Errorf("合法只读状态 = %d：%s", w.Code, w.Body.String())
	}
}
