package ui

import (
	"pass-up/ops/internal/servers"
	"pass-up/ops/internal/shared"
)

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// distRoot 是前端产物在嵌入 FS 里的位置，与 webdist.go 的 `//go:embed all:web/dist` 对应。
const distRoot = "web/dist"

// IconBytes 是界面图标（多尺寸 ICO）：/favicon.ico 直接读内存，配置目录的
// ops.ico 由 WriteIcon 落盘给桌面快捷方式用。只嵌一份，两处同源。
//
//go:embed ops.ico
var IconBytes []byte

// 🔴 界面只监听 127.0.0.1；页面与 /api 校验 token，写操作 POST 且校验 Origin。
//
// 静态产物（/assets/*、/favicon.ico）**不过 token**，这是有意的：
// 它们是代码与图标，不含任何数据；而浏览器请求 <script src> 时既带不上自定义头、
// 也拿不到地址栏里的 ?token=。真正的边界是 API —— 拿不到 token 就调不通任何接口。
// 详见 docs/ui.md §4。
type uiState struct {
	opMu   sync.Mutex // 串行化检查/写操作，避免并发读写同一份状态
	mu     sync.Mutex
	list   *shared.ServerList
	states map[string]shared.ServerStatus
	token  string
	origin string
	// files 是 web/dist 的子 FS；前端未构建时为 nil（页面会明确说明，而不是白屏）。
	files fs.FS
}

// CmdUI 启动只读界面。static 通常是根包的 webDist；
// 测试可以传 fstest.MapFS，从而不依赖「前端构建了没有」。
func CmdUI(args []string, static fs.FS) int {
	port := 7788
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--port":
			if i+1 >= len(args) {
				fmt.Fprintln(os.Stderr, "ERROR: --port 缺少参数")
				return 2
			}
			i++
			n, err := strconv.Atoi(args[i])
			if err != nil {
				fmt.Fprintf(os.Stderr, "ERROR: 端口不是数字：%s\n", args[i])
				return 2
			}
			port = n
		case strings.HasPrefix(a, "--port="):
			n, err := strconv.Atoi(strings.TrimPrefix(a, "--port="))
			if err != nil {
				fmt.Fprintf(os.Stderr, "ERROR: 端口不是数字：%s\n", a)
				return 2
			}
			port = n
		case a == "-h" || a == "--help":
			uiUsage()
			return 0
		default:
			fmt.Fprintf(os.Stderr, "ERROR: 未知参数：%s\n", a)
			return 2
		}
	}
	if port < 0 || port > 65535 {
		fmt.Fprintf(os.Stderr, "ERROR: 端口超出 0-65535：%d\n", port)
		return 2
	}

	// 界面启动就保证配置目录里的 ops.ico 与嵌入的图标一致；写失败不影响界面。
	WriteIcon(shared.UserConfigDir())

	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	token, err := randomToken()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 生成访问令牌失败：%v\n", err)
		return 1
	}

	ln, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)))
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 监听 127.0.0.1:%d 失败：%v\n", port, err)
		return 1
	}
	actual := ln.Addr().(*net.TCPAddr).Port

	u := &uiState{
		list:   list,
		states: shared.LoadServerState(list.Path),
		token:  token,
		origin: fmt.Sprintf("http://127.0.0.1:%d", actual),
		files:  distFS(static),
	}
	fmt.Printf("服务器管理界面：http://127.0.0.1:%d/?token=%s\n", actual, token)
	if u.files == nil {
		fmt.Println("WARN: 前端产物未嵌入（web/dist 为空）。先构建：cd web && npm install && npm run build，再重新 go build。")
	}
	fmt.Println("退出：Ctrl+C")

	srv := &http.Server{Handler: u, ReadHeaderTimeout: 10 * time.Second}
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		fmt.Fprintf(os.Stderr, "ERROR: 界面服务退出：%v\n", err)
		return 1
	}
	return 0
}

// distFS 取出 web/dist 子目录；取不到（未构建 / 传了 nil）返回 nil，
// 由 serveIndex 统一给出「前端还没构建」的说明页。
func distFS(static fs.FS) fs.FS {
	if static == nil {
		return nil
	}
	sub, err := fs.Sub(static, distRoot)
	if err != nil {
		return nil
	}
	// fs.Sub 对空目录也会成功，所以再确认 index.html 真的在。
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil
	}
	return sub
}

func uiUsage() {
	fmt.Print(`用法:
  ops ui [--port 7788]

只监听 127.0.0.1；地址带随机 token；写操作只接受清单里的 name。
页面来自 web/dist（构建：cd web && npm install && npm run build）。
`)
}

func randomToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (u *uiState) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")

	// ---- 静态产物：不过 token（理由见 uiState 的注释）----
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		switch {
		case r.URL.Path == "/favicon.ico":
			w.Header().Set("Content-Type", "image/x-icon")
			w.Header().Set("Cache-Control", "public, max-age=86400")
			_, _ = w.Write(IconBytes)
			return
		case strings.HasPrefix(r.URL.Path, "/assets/"):
			u.serveAsset(w, r)
			return
		}
	}

	// ---- 其余（页面与 /api）一律要 token ----
	if !u.tokenOK(r) {
		u.writeUnauthorized(w, r)
		return
	}
	if origin := r.Header.Get("Origin"); origin != "" && origin != u.origin {
		writeAPI(w, http.StatusForbidden, apiResponse{Error: "Origin 不允许"})
		return
	}

	switch {
	case r.Method == http.MethodGet && !strings.HasPrefix(r.URL.Path, "/api/"):
		// 单页应用：除 /api 与 /assets 之外的 GET 都回 index.html。
		// 只认这两个前缀（而不是「文件不存在就回退」）—— 后者会把构建产物缺失
		// 伪装成一个语法错误的 HTML，比 404 难查得多。
		u.serveIndex(w)
	case r.Method == http.MethodGet && r.URL.Path == "/api/servers":
		u.handleServers(w)
	case r.Method == http.MethodPost && r.URL.Path == "/api/check":
		u.handleCheck(w, r)
	case r.Method == http.MethodPost && r.URL.Path == "/api/apply-sudo":
		u.handleApplySudo(w, r)
	default:
		writeAPI(w, http.StatusNotFound, apiResponse{Error: "not found"})
	}
}

// serveAsset 托管 web/dist/assets/*。
//
// 文件名带内容哈希，所以可以放心长缓存：构建一变，文件名跟着变，
// 旧缓存永远不会被新页面引用。
func (u *uiState) serveAsset(w http.ResponseWriter, r *http.Request) {
	if u.files == nil {
		http.Error(w, "前端产物未嵌入："+buildHint, http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.FileServer(http.FS(u.files)).ServeHTTP(w, r)
}

func (u *uiState) serveIndex(w http.ResponseWriter) {
	// index.html 必须 no-store：它决定引用哪一组带哈希的产物，
	// 缓存住它就会在重新构建之后继续引用已经不存在的旧文件名。
	w.Header().Set("Cache-Control", "no-store")
	if u.files == nil {
		u.writeNotBuilt(w)
		return
	}
	idx, err := fs.ReadFile(u.files, "index.html")
	if err != nil {
		u.writeNotBuilt(w)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(idx)
}

const buildHint = "cd web && npm install && npm run build，然后重新 go build -o ops.exe ."

// writeNotBuilt 是「前端没构建」的唯一出口。
// 它必须是**一页能看懂的 HTML**，而不是 500 或白屏 —— 这是全新 clone 之后
// 最可能遇到的第一个状态（dist 里只有 .gitkeep）。
func (u *uiState) writeNotBuilt(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusServiceUnavailable)
	_, _ = io.WriteString(w, `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>ops ui：前端未构建</title>
<body style="font:14px/1.6 -apple-system,'Segoe UI','Microsoft YaHei',sans-serif;padding:32px;max-width:720px">
<h1 style="font-size:18px">前端产物未嵌入</h1>
<p>这个 ops.exe 是在前端构建之前编出来的，所以二进制里没有页面。</p>
<p>构建一次再重新编译：</p>
<pre style="background:#f2f3f5;padding:12px;border-radius:8px">`+buildHint+`</pre>
<p style="color:#6b7280">后端接口本身是好的：<code>/api/servers</code> 仍然可用。</p>
</body></html>`)
}

// writeUnauthorized 区分页面与接口：
// 页面给人看（说清该用什么地址打开），接口给程序看（JSON 信封）。
func (u *uiState) writeUnauthorized(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		writeAPI(w, http.StatusUnauthorized, apiResponse{Error: "token 无效"})
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = io.WriteString(w, `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>ops ui：需要访问令牌</title>
<body style="font:14px/1.6 -apple-system,'Segoe UI','Microsoft YaHei',sans-serif;padding:32px;max-width:720px">
<h1 style="font-size:18px">需要访问令牌</h1>
<p>界面只接受 <code>ops ui</code> 启动时打印的那个地址（带 <code>?token=</code>）。</p>
<p>回到终端，复制「服务器管理界面：http://127.0.0.1:…/?token=…」整行重新打开。</p>
</body></html>`)
}

func (u *uiState) tokenOK(r *http.Request) bool {
	t := r.URL.Query().Get("token")
	if t == "" {
		t = r.Header.Get("X-Ops-Token")
	}
	return subtle.ConstantTimeCompare([]byte(t), []byte(u.token)) == 1
}

func (u *uiState) reload() error {
	cfg, err := shared.LoadConfig()
	if err != nil {
		return err
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		return err
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	u.list = list
	u.states = shared.LoadServerState(list.Path)
	return nil
}

type apiResponse struct {
	OK    bool   `json:"ok"`
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

func writeAPI(w http.ResponseWriter, code int, v apiResponse) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func (u *uiState) handleServers(w http.ResponseWriter) {
	u.opMu.Lock()
	defer u.opMu.Unlock()
	if err := u.reload(); err != nil {
		writeAPI(w, http.StatusInternalServerError, apiResponse{Error: err.Error()})
		return
	}
	u.mu.Lock()
	list, states := u.list, u.states
	u.mu.Unlock()
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: struct {
		ServersFile string              `json:"servers_file"`
		Default     string              `json:"default,omitempty"`
		Servers     []shared.ServerInfo `json:"servers"`
	}{list.Path, list.Default, servers.ServerInfos(list, states)}})
}

type checkRequest struct {
	Name string `json:"name"`
}

func (u *uiState) handleCheck(w http.ResponseWriter, r *http.Request) {
	u.opMu.Lock()
	defer u.opMu.Unlock()
	var req checkRequest
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求体过大"})
		return
	}
	if len(body) > 0 {
		if err := json.Unmarshal(body, &req); err != nil {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求格式错误"})
			return
		}
	}
	if err := u.reload(); err != nil {
		writeAPI(w, http.StatusInternalServerError, apiResponse{Error: err.Error()})
		return
	}
	u.mu.Lock()
	list := u.list
	states := u.states
	u.mu.Unlock()

	var targets []*shared.Server
	if req.Name == "" || req.Name == "all" {
		for i := range list.Servers {
			targets = append(targets, &list.Servers[i])
		}
	} else {
		s, err := list.Get(req.Name)
		if err != nil {
			writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
			return
		}
		targets = []*shared.Server{s}
	}

	rows := make([]shared.CheckRow, 0, len(targets))
	for _, s := range targets {
		ctx, cancel := context.WithTimeout(context.Background(), servers.TimeoutServerCheck)
		st := servers.CheckServer(ctx, s)
		cancel()
		states[s.Name] = st
		rows = append(rows, shared.CheckRow{Name: s.Name, Role: s.Role, ServerStatus: st})
	}
	if err := shared.SaveServerState(list.Path, states); err != nil {
		fmt.Fprintf(os.Stderr, "WARN: 保存检查结果失败：%v\n", err)
	}
	u.mu.Lock()
	u.states = states
	u.mu.Unlock()
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: rows})
}

type applyRequest struct {
	Name     string `json:"name"`
	Password string `json:"password"`
}

func (u *uiState) handleApplySudo(w http.ResponseWriter, r *http.Request) {
	u.opMu.Lock()
	defer u.opMu.Unlock()
	var req applyRequest
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求体过大"})
		return
	}
	if err := json.Unmarshal(body, &req); err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求格式错误"})
		return
	}
	if err := u.reload(); err != nil {
		writeAPI(w, http.StatusInternalServerError, apiResponse{Error: err.Error()})
		return
	}
	u.mu.Lock()
	list := u.list
	states := u.states
	u.mu.Unlock()

	s, err := list.Get(req.Name)
	if err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), servers.TimeoutApplySudo)
	outcome, err := servers.ApplySudo(ctx, s, req.Password, io.Discard)
	cancel()
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
		return
	}

	ctx, cancel = context.WithTimeout(context.Background(), servers.TimeoutServerCheck)
	st := servers.CheckServer(ctx, s)
	cancel()
	states[s.Name] = st
	if err := shared.SaveServerState(list.Path, states); err != nil {
		fmt.Fprintf(os.Stderr, "WARN: 保存检查结果失败：%v\n", err)
	}
	u.mu.Lock()
	u.states = states
	u.mu.Unlock()

	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: struct {
		Message    string              `json:"message"`
		AlreadyOK  bool                `json:"already_ok"`
		Changed    bool                `json:"changed"`
		BackupPath string              `json:"backup_path,omitempty"`
		Status     shared.ServerStatus `json:"status"`
	}{outcome.Message, outcome.AlreadyOK, outcome.Changed, outcome.BackupPath, st}})
}

// WriteIcon 把嵌入的图标落到配置目录，供 .lnk 的 IconLocation 使用。
// 只在缺失或内容不同时写；失败一律忽略——图标不该让界面起不来。
// 调用方 ensureIcon 会补一次 Stat，避免快捷方式假装成功却拿到空白图标。
func WriteIcon(dir string) {
	if dir == "" {
		return
	}
	path := filepath.Join(dir, "ops.ico")
	if b, err := os.ReadFile(path); err == nil && bytes.Equal(b, IconBytes) {
		return
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return
	}
	_ = os.WriteFile(path, IconBytes, 0o644)
}
