package ui

import (
	"bytes"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
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
