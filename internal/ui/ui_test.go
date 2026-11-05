package ui

import (
	"pass-up/ops/internal/shared"
)

import (
	"bytes"
	"errors"
	"io/fs"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

// fakeDist 造一份「构建好的」前端产物。
//
// 用 fstest.MapFS 而不是真实嵌入的 web/dist：这样 `go test ./...` 在
// 全新 clone（dist 里只有 .gitkeep）上也是绿的，测试不依赖「前端构建了没有」。
func fakeDist(t *testing.T) fs.FS {
	t.Helper()
	sub := distFS(fstest.MapFS{
		"web/dist/index.html":        &fstest.MapFile{Data: []byte(`<!doctype html><div id="root"></div>`)},
		"web/dist/assets/app-abc.js": &fstest.MapFile{Data: []byte("console.log(1)")},
	})
	if sub == nil {
		t.Fatal("distFS 取不到 web/dist（fake FS 的路径写错了？）")
	}
	return sub
}

func newState(t *testing.T, files fs.FS) *uiState {
	t.Helper()
	return &uiState{token: "tok", origin: "http://127.0.0.1:7788", files: files}
}

func serve(u *uiState, method, target string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	return w
}

// 图标与前端产物是**公开**的：浏览器请求 <script src> 时带不上自定义头，
// 也拿不到地址栏里的 ?token=。边界在 API，不在这两块（见 docs/ui.md §4）。
func TestFaviconIsPublic(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodGet, "/favicon.ico", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("不带 token 取 favicon 的状态码 = %d，想要 200", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "image/x-icon" {
		t.Fatalf("Content-Type = %q", ct)
	}
	if !bytes.Equal(w.Body.Bytes(), IconBytes) {
		t.Fatal("favicon 与嵌入的图标不是同一份字节")
	}
}

func TestAssetsArePublicAndCachedForever(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodGet, "/assets/app-abc.js", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("不带 token 取 assets 的状态码 = %d，想要 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), "console.log") {
		t.Fatalf("产物内容不对：%q", w.Body.String())
	}
	// 文件名带内容哈希，可以放心 immutable；index.html 才是 no-store。
	if cc := w.Header().Get("Cache-Control"); !strings.Contains(cc, "immutable") {
		t.Fatalf("Cache-Control = %q，想要 immutable", cc)
	}
}

func TestIndexNeedsToken(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodGet, "/", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("不带 token 打开页面的状态码 = %d，想要 401", w.Code)
	}
	// 页面场景给人看：必须是一句能照做的中文提示，不是 JSON。
	if !strings.Contains(w.Body.String(), "需要访问令牌") {
		t.Fatalf("401 页面没有说明该怎么做：%q", w.Body.String())
	}
}

func TestIndexServedWithToken(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodGet, "/?token=tok", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("状态码 = %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `id="root"`) {
		t.Fatalf("页面内容不对：%q", w.Body.String())
	}
	if cc := w.Header().Get("Cache-Control"); cc != "no-store" {
		t.Fatalf("index.html 的 Cache-Control = %q，想要 no-store", cc)
	}
}

func TestAPINeedsToken(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodGet, "/api/servers", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("状态码 = %d，想要 401", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Fatalf("接口 401 应该是 JSON，实际 Content-Type = %q", ct)
	}
}

// 写操作还要校验 Origin：别的网页不能借浏览器把请求打到本机这个服务上。
func TestWriteRejectsForeignOrigin(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/check?token=tok",
		map[string]string{"Origin": "http://evil.example"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("状态码 = %d，想要 403", w.Code)
	}
}

// 全新 clone（dist 里只有 .gitkeep）时最可能看到的一页：
// 必须是「怎么构建」的说明，而不是白屏或 500。
func TestNotBuiltExplainsHowToBuild(t *testing.T) {
	w := serve(newState(t, nil), http.MethodGet, "/?token=tok", nil)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("状态码 = %d，想要 503", w.Code)
	}
	if !strings.Contains(w.Body.String(), "npm run build") {
		t.Fatalf("未构建的提示里没有构建命令：%q", w.Body.String())
	}
}

// 单页应用回退：非 /api 的 GET 一律回 index.html（以后加视图不用动 Go）。
func TestSPAFallbackServesIndex(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodGet, "/status?token=tok", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("状态码 = %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `id="root"`) {
		t.Fatalf("回退没有回 index.html：%q", w.Body.String())
	}
}

// ---- 后台网页模式带来的两个新行为：关闭界面、配置未就绪时仍能起页面 ----

func TestShutdownNeedsToken(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/shutdown", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("不带 token 关界面 = %d，想要 401", w.Code)
	}
}

func TestShutdownStopsProcess(t *testing.T) {
	old := exitProcess
	called := make(chan int, 1)
	exitProcess = func(code int) { called <- code }
	t.Cleanup(func() { exitProcess = old })

	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/shutdown?token=tok", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("状态码 = %d，想要 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"stopping":true`) {
		t.Fatalf("响应里没有 stopping：%q", w.Body.String())
	}
	select {
	case code := <-called:
		if code != 0 {
			t.Errorf("退出码 = %d，想要 0（守护见到 0 就不再拉起）", code)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("点了关闭界面却没有结束进程")
	}
}

// 首次双击时 ops init 生成的是**空** servers.json，界面必须照样起来，
// 并给人一页能照做的说明，而不是在隐藏窗口里静默退出。
func TestSetupHintExplainsNextStep(t *testing.T) {
	t.Setenv(shared.ConfigDirEnv, t.TempDir())
	u := newState(t, fakeDist(t))
	u.setupErr = errors.New("读不到服务器清单")

	w := serve(u, http.MethodGet, "/?token=tok", nil)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("状态码 = %d，想要 503", w.Code)
	}
	body := w.Body.String()
	for _, want := range []string{"配置还没准备好", "ops init", "servers.json", "重新加载"} {
		if !strings.Contains(body, want) {
			t.Errorf("说明页缺少 %q：%q", want, body)
		}
	}
}

// 补完配置后**刷新即可**，不用重启界面：隐藏窗口模式下没人能去重启。
func TestSetupHintRecoversAfterConfigFixed(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	u := newState(t, fakeDist(t))
	u.setupErr = errors.New("待补")

	if w := serve(u, http.MethodGet, "/?token=tok", nil); w.Code != http.StatusServiceUnavailable {
		t.Fatalf("第一次请求应为 503，实得 %d", w.Code)
	}
	writeValidConfig(t, dir)
	w := serve(u, http.MethodGet, "/?token=tok", nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `id="root"`) {
		t.Fatalf("配置补完后刷新应回到正常页面，实得 %d / %q", w.Code, w.Body.String())
	}
	if u.setupErr != nil {
		t.Error("reload 成功后 setupErr 应该被清掉")
	}
}

func writeValidConfig(t *testing.T, dir string) {
	t.Helper()
	servers := filepath.Join(dir, "servers.json")
	list := `{"servers":[{"name":"bk","role":"backup","host":"10.0.0.1","user":"ubuntu"}]}`
	if err := os.WriteFile(servers, []byte(list), 0o600); err != nil {
		t.Fatal(err)
	}
	env := "PASS_UP_OPS_SERVERS_FILE=" + servers + "\n"
	if err := os.WriteFile(filepath.Join(dir, "ops.env"), []byte(env), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestAPINeedsConfigReturns503(t *testing.T) {
	t.Setenv(shared.ConfigDirEnv, t.TempDir())
	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/check?token=tok", nil)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("配置缺失时 /api/check = %d，想要 503", w.Code)
	}
	if !strings.Contains(w.Body.String(), "配置还没准备好") {
		t.Fatalf("503 没说清原因：%q", w.Body.String())
	}
}

// ---- 桌面快捷方式：实现与 `ops shortcut` 同一份，由 main 注入 ----

func TestShortcutNeedsToken(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/shortcut", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("不带 token 建快捷方式 = %d，想要 401", w.Code)
	}
}

func TestShortcutReturnsPaths(t *testing.T) {
	u := newState(t, fakeDist(t))
	u.createShortcut = func() (shared.ShortcutInfo, error) {
		return shared.ShortcutInfo{
			Path:     `C:\Users\x\Desktop\Pass-up · 运维.lnk`,
			Launcher: `D:\_work\pass-up\pass-up.ops\启动运维.cmd`,
			Icon:     `C:\Users\x\AppData\Roaming\pass-up\ops.ico`,
		}, nil
	}
	w := serve(u, http.MethodPost, "/api/shortcut?token=tok", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("状态码 = %d，想要 200", w.Code)
	}
	body := w.Body.String()
	for _, want := range []string{".lnk", "启动运维.cmd", "ops.ico"} {
		if !strings.Contains(body, want) {
			t.Errorf("响应里缺少 %q：%q", want, body)
		}
	}
}

func TestShortcutFailureIsReported(t *testing.T) {
	u := newState(t, fakeDist(t))
	u.createShortcut = func() (shared.ShortcutInfo, error) {
		return shared.ShortcutInfo{}, errors.New("找不到 PowerShell")
	}
	w := serve(u, http.MethodPost, "/api/shortcut?token=tok", nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("失败时状态码 = %d，想要 500", w.Code)
	}
	if !strings.Contains(w.Body.String(), "找不到 PowerShell") {
		t.Fatalf("失败原因没回给界面：%q", w.Body.String())
	}
}

// 建快捷方式只碰本机桌面：配置还没准备好时也必须能用（别的接口这时都是 503）。
func TestShortcutWorksWithoutConfig(t *testing.T) {
	t.Setenv(shared.ConfigDirEnv, t.TempDir())
	u := newState(t, fakeDist(t))
	u.setupErr = errors.New("配置还没准备好")
	u.createShortcut = func() (shared.ShortcutInfo, error) {
		return shared.ShortcutInfo{Path: "x.lnk"}, nil
	}
	if w := serve(u, http.MethodPost, "/api/shortcut?token=tok", nil); w.Code != http.StatusOK {
		t.Fatalf("配置缺失时建快捷方式 = %d，想要 200", w.Code)
	}
}

func TestShortcutNotWired(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/shortcut?token=tok", nil)
	if w.Code != http.StatusNotImplemented {
		t.Fatalf("没有注入实现时 = %d，想要 501", w.Code)
	}
}

// ---- 端口：同机的 suikouji ops 也默认 7788，双击必须能自己让开 ----

func TestUIListenSkipsBusyPort(t *testing.T) {
	busy, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer busy.Close()
	base := busy.Addr().(*net.TCPAddr).Port

	ln, actual, err := uiListen(base, false)
	if err != nil {
		t.Fatalf("默认端口被占时应自动递增，实得错误：%v", err)
	}
	defer ln.Close()
	if actual <= base {
		t.Errorf("实际端口 = %d，应该大于被占用的 %d", actual, base)
	}
}

// 显式 --port 是用户的明确要求：被占就报错，不能偷偷换端口。
func TestUIListenExplicitPortIsStrict(t *testing.T) {
	busy, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer busy.Close()
	base := busy.Addr().(*net.TCPAddr).Port

	if _, _, err := uiListen(base, true); err == nil {
		t.Fatal("显式端口被占用时应报错，不能静默递增")
	}
}
