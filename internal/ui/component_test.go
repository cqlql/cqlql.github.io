package ui

// 环境组件接口的边界测试：确认门、服务端预检门、注册表白名单、只认清单 name、
// 单任务 409、以及与备份部署共用任务锁（重启门因此自动覆盖）。

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
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
		"/api/components/image",
	} {
		method := http.MethodGet
		if strings.HasSuffix(target, "/run") || strings.HasSuffix(target, "/image") {
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
		{"未接入组件", `{"verb":"install","component":"future","name":"bk","confirm":"yes"}`, http.StatusBadRequest},
		{"未注册组件", `{"verb":"install","component":"../../etc","name":"bk","confirm":"yes"}`, http.StatusBadRequest},
		{"未知动词", `{"verb":"force","component":"docker","name":"bk","confirm":"yes"}`, http.StatusBadRequest},
		{"导入动词不走这个接口", `{"verb":"image-load","component":"minio","name":"bk","confirm":"yes"}`, http.StatusBadRequest},
		{"未知 name", `{"verb":"install","component":"docker","name":"evil","confirm":"yes"}`, http.StatusNotFound},
		{"缺 name", `{"verb":"install","component":"docker","confirm":"yes"}`, http.StatusBadRequest},
	}
	for _, c := range cases {
		if w := serveComponentRun(u, c.body); w.Code != c.want {
			t.Errorf("%s = %d，想要 %d；响应 %s", c.name, w.Code, c.want, w.Body.String())
		}
	}
}

// 2026-11-07：update / uninstall 的附加参数门（docs/components.md §8.3 / §8.4）。
// 前端勾没勾不算数，服务端按同一份 ValidateActionFlags 再验一次。
func TestComponentRunExtraFlagGates(t *testing.T) {
	cases := []struct {
		name, body string
		want       int
	}{
		{"卸引擎缺必勾", `{"verb":"uninstall","component":"docker","name":"bk","confirm":"yes"}`, 400},
		{"删数据给安装", `{"verb":"install","component":"minio","name":"bk","confirm":"yes","purge_data":true}`, 400},
		{"卸 MinIO 带引擎确认", `{"verb":"uninstall","component":"minio","name":"bk","confirm":"yes","ack_downstream":true}`, 400},
		{"安装带镜像引用", `{"verb":"install","component":"minio","name":"bk","confirm":"yes","image_ref":"minio/minio:R2"}`, 400},
		{"更新带非法镜像引用", `{"verb":"update","component":"minio","name":"bk","confirm":"yes","image_ref":"minio/minio:R2;rm -rf /"}`, 400},
		{"卸引擎带代理", `{"verb":"uninstall","component":"docker","name":"bk","confirm":"yes","ack_downstream":true,"proxy":"http://x:7897"}`, 400},
		{"更新 Docker 带代理", `{"verb":"update","component":"docker","name":"bk","confirm":"yes","proxy":"http://x:7897"}`, 200},
		{"更新 MinIO 带镜像引用", `{"verb":"update","component":"minio","name":"bk","confirm":"yes","image_ref":"minio/minio:R2"}`, 200},
		{"卸 MinIO 勾删数据", `{"verb":"uninstall","component":"minio","name":"bk","confirm":"yes","purge_data":true}`, 200},
		{"卸引擎带确认", `{"verb":"uninstall","component":"docker","name":"bk","confirm":"yes","ack_downstream":true}`, 200},
	}
	for _, c := range cases {
		u := backupState(t, func([]string, string, io.Writer) int { return 0 })
		w := serveComponentRun(u, c.body)
		if w.Code != c.want {
			t.Errorf("%s = %d，想要 %d；响应 %s", c.name, w.Code, c.want, w.Body.String())
		}
		if w.Code == http.StatusOK {
			waitBackupTask(t, u)
		} else if u.backupBusy() {
			t.Errorf("%s 被拒绝后不该占住任务锁", c.name)
		}
	}
}

// 预检与正式动作必须带**同一组**附加参数，否则「预检过了」不代表会这么跑。
func TestComponentRunUpdateUninstallArgs(t *testing.T) {
	cases := []struct {
		name, body, mode string
		wantArgs         []string
	}{
		{
			"更新 MinIO", `{"verb":"update","component":"minio","name":"bk","confirm":"yes","image_ref":"minio/minio:R2"}`,
			"component.update", []string{"update", "--image-ref minio/minio:R2"},
		},
		{
			"卸 MinIO 删数据", `{"verb":"uninstall","component":"minio","name":"bk","confirm":"yes","purge_data":true}`,
			"component.uninstall", []string{"uninstall", "--purge-data"},
		},
		{
			"卸引擎", `{"verb":"uninstall","component":"docker","name":"bk","confirm":"yes","ack_downstream":true}`,
			"component.uninstall", []string{"uninstall", "--ack-downstream"},
		},
		{
			"更新 Docker 走代理", `{"verb":"update","component":"docker","name":"bk","confirm":"yes","proxy":"http://x:7897"}`,
			"component.update", []string{"update", "--proxy http://x:7897"},
		},
	}
	for _, tc := range cases {
		f := &fakeBackupRunner{}
		u := backupState(t, f.run)
		if w := serveComponentRun(u, tc.body); w.Code != http.StatusOK {
			t.Fatalf("%s 启动失败：%s", tc.name, w.Body.String())
		}
		v := waitBackupTask(t, u)
		if v.Mode != tc.mode {
			t.Errorf("%s 任务 mode = %s，想要 %s", tc.name, v.Mode, tc.mode)
		}
		calls := f.snapshot()
		if len(calls) != 2 {
			t.Fatalf("%s 应为 预检 + 正式动作 两次调用，得到 %d", tc.name, len(calls))
		}
		for i, c := range calls {
			joined := strings.Join(c.args, " ")
			for _, want := range tc.wantArgs {
				if !strings.Contains(joined, want) {
					t.Errorf("%s 第 %d 次调用缺少 %q：%v", tc.name, i+1, want, c.args)
				}
			}
		}
		if !strings.Contains(strings.Join(calls[0].args, " "), "--dry-run") ||
			strings.Contains(strings.Join(calls[1].args, " "), "--dry-run") {
			t.Errorf("%s 第一次必须 dry-run、第二次不能带：%+v", tc.name, calls)
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

// ---- 离线镜像导入（multipart）----

func componentImageBody(t *testing.T, fields map[string]string, content, fileName string) (string, []byte) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for _, k := range []string{"verb", "component", "name", "confirm", "password"} {
		if v := fields[k]; v != "" {
			if err := mw.WriteField(k, v); err != nil {
				t.Fatal(err)
			}
		}
	}
	if content != "" {
		part, err := mw.CreateFormFile("image", fileName)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	return mw.FormDataContentType(), buf.Bytes()
}

func serveComponentImage(u *uiState, ctype string, body []byte) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/components/image?token=tok", bytes.NewReader(body))
	req.Header.Set("Content-Type", ctype)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	return w
}

func validImageFields() map[string]string {
	return map[string]string{
		"verb": "image-load", "component": "minio", "name": "bk", "confirm": "yes",
	}
}

func TestComponentImageGates(t *testing.T) {
	u := backupState(t, func([]string, string, io.Writer) int { return 0 })
	cases := []struct {
		name     string
		fields   map[string]string
		content  string
		fileName string
		want     int
	}{
		{"缺 confirm", map[string]string{"verb": "image-load", "component": "minio", "name": "bk"}, "tar", "m.tar", 400},
		{"未知动词", map[string]string{"verb": "uninstall", "component": "minio", "name": "bk", "confirm": "yes"}, "tar", "m.tar", 400},
		{"不支持离线镜像的组件", map[string]string{"verb": "image-load", "component": "docker", "name": "bk", "confirm": "yes"}, "tar", "m.tar", 400},
		{"未知 name", map[string]string{"verb": "image-load", "component": "minio", "name": "evil", "confirm": "yes"}, "tar", "m.tar", 404},
		{"没有文件", validImageFields(), "", "", 400},
		{"后缀不对", validImageFields(), "tar", "m.zip", 400},
		{"空文件", validImageFields(), "", "m.tar", 400},
	}
	for _, c := range cases {
		ctype, body := componentImageBody(t, c.fields, c.content, c.fileName)
		if w := serveComponentImage(u, ctype, body); w.Code != c.want {
			t.Errorf("%s = %d，想要 %d；响应 %s", c.name, w.Code, c.want, w.Body.String())
		}
	}
	// 拒掉的请求不该启动任何后台任务。
	if u.backupBusy() {
		t.Error("被拒绝的导入请求不该占住任务锁")
	}
}

func TestComponentImagePreflightGate(t *testing.T) {
	f := &fakeBackupRunner{codes: []int{1}}
	u := backupState(t, f.run)
	ctype, body := componentImageBody(t, validImageFields(), "fake tar bytes", "minio.tar")
	if w := serveComponentImage(u, ctype, body); w.Code != http.StatusOK {
		t.Fatalf("合法请求 = %d：%s", w.Code, w.Body.String())
	}
	v := waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 1 || !strings.Contains(strings.Join(calls[0].args, " "), "--dry-run") {
		t.Fatalf("预检失败后不该再导入：%+v", calls)
	}
	if v.ExitCode != 1 || !strings.Contains(v.Log, "预检没过") {
		t.Errorf("任务应以预检失败收尾：%+v", v)
	}
}

func TestComponentImageDryRunThenLoadAndCleanup(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	fields := validImageFields()
	fields["password"] = "s3cr3t"
	ctype, body := componentImageBody(t, fields, "fake tar bytes", "minio.tar")
	if w := serveComponentImage(u, ctype, body); w.Code != http.StatusOK {
		t.Fatalf("启动失败：%s", w.Body.String())
	}
	waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 2 {
		t.Fatalf("应为 预检 + 导入 两次调用，得到 %d", len(calls))
	}
	if !strings.Contains(strings.Join(calls[0].args, " "), "--dry-run") ||
		strings.Contains(strings.Join(calls[1].args, " "), "--dry-run") {
		t.Errorf("第一次必须 dry-run、第二次不能带：%+v", calls)
	}
	var tarArg string
	for _, c := range calls {
		joined := strings.Join(c.args, " ")
		if !strings.Contains(joined, "image-load") || !strings.Contains(joined, "--image-tar") {
			t.Errorf("参数不对：%+v", c)
		}
		if c.password != "s3cr3t" {
			t.Errorf("密码应只经 runner 参数（子进程 stdin）：%+v", c)
		}
		for i, a := range c.args {
			if a == "--image-tar" && i+1 < len(c.args) {
				tarArg = c.args[i+1]
			}
		}
	}
	if !strings.HasSuffix(tarArg, ".tar") {
		t.Errorf("镜像包路径应由服务端生成：%q", tarArg)
	}
	if _, err := os.Stat(tarArg); !os.IsNotExist(err) {
		t.Errorf("任务结束后临时镜像包必须删除：%q（err=%v）", tarArg, err)
	}
}

func TestComponentImageSingleTaskMutex(t *testing.T) {
	f := &fakeBackupRunner{block: make(chan struct{}), entered: make(chan struct{})}
	u := backupState(t, f.run)
	ctype, body := componentImageBody(t, validImageFields(), "fake tar bytes", "minio.tar")
	if w := serveComponentImage(u, ctype, body); w.Code != http.StatusOK {
		t.Fatalf("第一次启动失败：%s", w.Body.String())
	}
	<-f.entered
	if !u.backupBusy() {
		t.Error("导入任务在跑时，重启的 409 门必须能感知到")
	}
	if w := serveComponentImage(u, ctype, body); w.Code != http.StatusConflict {
		t.Errorf("并发导入 = %d，想要 409", w.Code)
	}
	close(f.block)
	waitBackupTask(t, u)
}

// 代理是可选的，但格式必须在服务端卡死：它会拼进远端命令字符串。
func TestComponentRunProxyGates(t *testing.T) {
	u := backupState(t, func([]string, string, io.Writer) int { return 0 })
	cases := []struct {
		name, body string
		want       int
	}{
		{"非法代理", `{"verb":"install","component":"docker","name":"bk","confirm":"yes","proxy":"http://x;rm -rf /"}`, http.StatusBadRequest},
		{"带认证信息", `{"verb":"install","component":"docker","name":"bk","confirm":"yes","proxy":"http://u:p@x:7897"}`, http.StatusBadRequest},
		{"端口越界", `{"verb":"install","component":"docker","name":"bk","confirm":"yes","proxy":"http://x:99999"}`, http.StatusBadRequest},
		{"非 docker 组件带代理", `{"verb":"install","component":"minio","name":"bk","confirm":"yes","proxy":"http://x:7897"}`, http.StatusBadRequest},
	}
	for _, c := range cases {
		if w := serveComponentRun(u, c.body); w.Code != c.want {
			t.Errorf("%s = %d，想要 %d；响应 %s", c.name, w.Code, c.want, w.Body.String())
		}
	}
	if u.backupBusy() {
		t.Error("被拒绝的代理请求不该启动后台任务")
	}
}

// 预检与正式安装必须带同一组 --proxy 参数，否则「预检过了」不代表安装会这么跑。
func TestComponentRunProxyPassedToBothCalls(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	body := `{"verb":"install","component":"docker","name":"bk","confirm":"yes","proxy":"http://192.168.1.221:7897"}`
	if w := serveComponentRun(u, body); w.Code != http.StatusOK {
		t.Fatalf("启动失败：%s", w.Body.String())
	}
	waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 2 {
		t.Fatalf("应为 预检 + 安装 两次调用，得到 %d", len(calls))
	}
	for i, c := range calls {
		joined := strings.Join(c.args, " ")
		if !strings.Contains(joined, "--proxy http://192.168.1.221:7897") {
			t.Errorf("第 %d 次调用必须带代理：%v", i+1, c.args)
		}
	}
	if !strings.Contains(strings.Join(calls[0].args, " "), "--dry-run") ||
		strings.Contains(strings.Join(calls[1].args, " "), "--dry-run") {
		t.Errorf("第一次必须 dry-run、第二次不能带：%+v", calls)
	}
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
