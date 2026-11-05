package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed ui/index.html
var uiFiles embed.FS

// uiIcon 是界面图标（多尺寸 ICO）：/favicon.ico 直接读内存，配置目录的
// ops.ico 由 writeIcon 落盘给桌面快捷方式用。只嵌一份，两处同源。
//
//go:embed ui/ops.ico
var uiIcon []byte

// faviconTokenPlaceholder：浏览器请求 favicon 不会带自定义 header，
// 所以把 token 拼进 URL，仍然走 ServeHTTP 的 token 校验。
const faviconTokenPlaceholder = "__OPS_TOKEN__"

// 🔴 界面只监听 127.0.0.1；每个请求校验 token，写操作 POST 且校验 Origin。
type uiState struct {
	opMu   sync.Mutex // 串行化检查/写操作，避免并发读写同一份状态
	mu     sync.Mutex
	list   *serverList
	states map[string]serverStatus
	token  string
	origin string
}

func cmdUI(args []string) int {
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
	writeIcon(userConfigDir())

	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	list, err := loadServers(cfg)
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
		states: loadServerState(list.Path),
		token:  token,
		origin: fmt.Sprintf("http://127.0.0.1:%d", actual),
	}
	fmt.Printf("服务器管理界面：http://127.0.0.1:%d/?token=%s\n", actual, token)
	fmt.Println("退出：Ctrl+C")

	srv := &http.Server{Handler: u, ReadHeaderTimeout: 10 * time.Second}
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		fmt.Fprintf(os.Stderr, "ERROR: 界面服务退出：%v\n", err)
		return 1
	}
	return 0
}

func uiUsage() {
	fmt.Print(`用法:
  ops ui [--port 7788]

只监听 127.0.0.1；地址带随机 token；写操作只接受清单里的 name。
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
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if !u.tokenOK(r) {
		writeAPI(w, http.StatusUnauthorized, apiResponse{Error: "token 无效"})
		return
	}
	if origin := r.Header.Get("Origin"); origin != "" && origin != u.origin {
		writeAPI(w, http.StatusForbidden, apiResponse{Error: "Origin 不允许"})
		return
	}

	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/":
		page, err := uiFiles.ReadFile("ui/index.html")
		if err != nil {
			http.Error(w, "页面加载失败", http.StatusInternalServerError)
			return
		}
		page = bytes.ReplaceAll(page, []byte(faviconTokenPlaceholder), []byte(u.token))
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(page)
	case r.Method == http.MethodGet && r.URL.Path == "/favicon.ico":
		w.Header().Set("Content-Type", "image/x-icon")
		w.Write(uiIcon)
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

func (u *uiState) tokenOK(r *http.Request) bool {
	t := r.URL.Query().Get("token")
	if t == "" {
		t = r.Header.Get("X-Ops-Token")
	}
	return subtle.ConstantTimeCompare([]byte(t), []byte(u.token)) == 1
}

func (u *uiState) reload() error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}
	list, err := loadServers(cfg)
	if err != nil {
		return err
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	u.list = list
	u.states = loadServerState(list.Path)
	return nil
}

type apiResponse struct {
	OK    bool   `json:"ok"`
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

func writeAPI(w http.ResponseWriter, code int, v apiResponse) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
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
		ServersFile string       `json:"servers_file"`
		Default     string       `json:"default,omitempty"`
		Servers     []serverInfo `json:"servers"`
	}{list.Path, list.Default, serverInfos(list, states)}})
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

	var targets []*server
	if req.Name == "" || req.Name == "all" {
		for i := range list.Servers {
			targets = append(targets, &list.Servers[i])
		}
	} else {
		s, err := list.get(req.Name)
		if err != nil {
			writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
			return
		}
		targets = []*server{s}
	}

	rows := make([]checkRow, 0, len(targets))
	for _, s := range targets {
		ctx, cancel := context.WithTimeout(context.Background(), timeoutServerCheck)
		st := checkServer(ctx, s)
		cancel()
		states[s.Name] = st
		rows = append(rows, checkRow{Name: s.Name, Role: s.Role, serverStatus: st})
	}
	if err := saveServerState(list.Path, states); err != nil {
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

	s, err := list.get(req.Name)
	if err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeoutApplySudo)
	outcome, err := applySudo(ctx, s, req.Password, io.Discard)
	cancel()
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
		return
	}

	ctx, cancel = context.WithTimeout(context.Background(), timeoutServerCheck)
	st := checkServer(ctx, s)
	cancel()
	states[s.Name] = st
	if err := saveServerState(list.Path, states); err != nil {
		fmt.Fprintf(os.Stderr, "WARN: 保存检查结果失败：%v\n", err)
	}
	u.mu.Lock()
	u.states = states
	u.mu.Unlock()

	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: struct {
		Message    string       `json:"message"`
		AlreadyOK  bool         `json:"already_ok"`
		Changed    bool         `json:"changed"`
		BackupPath string       `json:"backup_path,omitempty"`
		Status     serverStatus `json:"status"`
	}{outcome.Message, outcome.AlreadyOK, outcome.Changed, outcome.BackupPath, st}})
}

// writeIcon 把嵌入的图标落到配置目录，供 .lnk 的 IconLocation 使用。
// 只在缺失或内容不同时写；失败一律忽略——图标不该让界面起不来。
// 调用方 ensureIcon 会补一次 Stat，避免快捷方式假装成功却拿到空白图标。
func writeIcon(dir string) {
	if dir == "" {
		return
	}
	path := filepath.Join(dir, "ops.ico")
	if b, err := os.ReadFile(path); err == nil && bytes.Equal(b, uiIcon) {
		return
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return
	}
	_ = os.WriteFile(path, uiIcon, 0o644)
}
