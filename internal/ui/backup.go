package ui

// 界面上的备份能力部署：预检（--dry-run）/ 安装 / 远端自检。
//
// 🔴 这是界面里**第二个写操作**，边界比「一键免密 sudo」更严（docs/ui.md §9）：
//   - 安装必须 `confirm == "yes"`，且服务端自己先跑一遍 --dry-run，预检不过就不安装；
//   - 目标机只认 servers.json 里的 name，未知 name 直接 404，不接受任意 host；
//   - sudo 密码只在本次请求的内存里，经子进程 stdin 交给 CLI，不落盘、不进日志；
//   - 任务脱离 HTTP 请求运行：刷新页面不会打断已经开始的远端安装；
//   - 一台机器同时只跑一个任务（409），界面不开放 --force/--run-now/--install-deps。
//
// 执行器 BackupRunner 由 main 注入（ui 不能 import backup），日志经 backupLogWriter
// 回流到页面，写入时按行脱敏，避免任何远端回显把密码带进任务日志。

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// BackupRunner 执行一条 backup 子命令；args 不含 "backup" 前缀。
// 返回进程退出码，输出（stdout + stderr）写进 out。由 main.go 注入，测试塞假实现。
type BackupRunner func(args []string, password string, out io.Writer) int

type BackupMode string

const (
	backupPreflight BackupMode = "preflight"
	backupDeploy    BackupMode = "deploy"
	backupVerify    BackupMode = "verify"
)

// 日志留在内存里给页面轮询；上限只是防止一个跑飞的子进程把界面进程撑爆。
const maxBackupLogBytes = 256 << 10

type backupTask struct {
	mu        sync.Mutex
	running   bool
	done      bool
	mode      BackupMode
	server    string
	component string
	log       bytes.Buffer
	truncated bool
	exitCode  int
	startedAt time.Time
	endedAt   time.Time
	// secret 只在任务运行期间存在：写日志时替换成 ***，任务结束立刻清空。
	secret string
}

type backupTaskView struct {
	Running   bool   `json:"running"`
	Done      bool   `json:"done"`
	Mode      string `json:"mode"`
	Server    string `json:"server"`
	Component string `json:"component"`
	ExitCode  int    `json:"exit_code"`
	Log       string `json:"log"`
	Next      int    `json:"next"`
	StartedAt string `json:"started_at,omitempty"`
	EndedAt   string `json:"ended_at,omitempty"`
}

func (t *backupTask) start(mode BackupMode, server, component, secret string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.running {
		return false
	}
	t.log.Reset()
	t.truncated = false
	t.running = true
	t.done = false
	t.mode = mode
	t.server = server
	t.component = component
	t.exitCode = 0
	t.startedAt = time.Now()
	t.endedAt = time.Time{}
	t.secret = secret
	return true
}

func (t *backupTask) append(s string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.secret != "" {
		s = strings.ReplaceAll(s, t.secret, "***")
	}
	if t.truncated {
		return
	}
	if t.log.Len()+len(s) > maxBackupLogBytes {
		remain := maxBackupLogBytes - t.log.Len()
		if remain > 0 {
			t.log.WriteString(s[:remain])
		}
		t.log.WriteString("\n[日志已达上限，后续输出已省略]\n")
		t.truncated = true
		return
	}
	t.log.WriteString(s)
}

func (t *backupTask) finish(code int) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.exitCode = code
	t.running = false
	t.done = true
	t.endedAt = time.Now()
	t.secret = ""
}

// view 返回从 after 字节之后的增量日志。after 由上一次响应的 next 给出，
// 所以切片边界永远落在上次的日志末尾，不会把中文截成半个字。
func (t *backupTask) view(after int) backupTaskView {
	t.mu.Lock()
	defer t.mu.Unlock()
	all := t.log.String()
	if after < 0 {
		after = 0
	}
	if after > len(all) {
		after = len(all)
	}
	v := backupTaskView{
		Running:   t.running,
		Done:      t.done,
		Mode:      string(t.mode),
		Server:    t.server,
		Component: t.component,
		ExitCode:  t.exitCode,
		Log:       all[after:],
		Next:      len(all),
	}
	if !t.startedAt.IsZero() {
		v.StartedAt = t.startedAt.Format(time.RFC3339)
	}
	if !t.endedAt.IsZero() {
		v.EndedAt = t.endedAt.Format(time.RFC3339)
	}
	return v
}

// backupLogWriter 按行转发，理由有两个：整行才做密码替换（不会漏掉跨 chunk 的一半），
// 并且切片边界落在换行处，不会把远端输出的 UTF-8 汉字切坏。
type backupLogWriter struct {
	mu   sync.Mutex
	buf  bytes.Buffer
	task *backupTask
}

func (w *backupLogWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	_, _ = w.buf.Write(p)
	for {
		line, err := w.buf.ReadString('\n')
		if err != nil {
			// ReadString 在 EOF 时返回剩余内容，放回去等下一块拼完整。
			_, _ = w.buf.WriteString(line)
			break
		}
		w.task.append(line)
	}
	return len(p), nil
}

func (w *backupLogWriter) Flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.buf.Len() > 0 {
		w.task.append(w.buf.String())
		w.buf.Reset()
	}
}

func (u *uiState) ensureTask() *backupTask {
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.task == nil {
		u.task = &backupTask{}
	}
	return u.task
}

func (u *uiState) backupBusy() bool {
	t := u.ensureTask()
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.running
}

type backupRunRequest struct {
	Mode      string `json:"mode"`
	Name      string `json:"name"`
	Component string `json:"component"`
	Password  string `json:"password"`
	Confirm   string `json:"confirm"`
}

func parseBackupMode(s string) (BackupMode, bool) {
	switch BackupMode(s) {
	case backupPreflight, backupDeploy, backupVerify:
		return BackupMode(s), true
	default:
		return "", false
	}
}

// 组件白名单：CLI 的 parseComponents 还接受 postgres 等别名，界面只给这三个，
// 免得把「用户随手填的字符串」变成一条会改远端的命令参数。
func normalizeComponent(s string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "", "all":
		return "all", true
	case "pg", "minio":
		return strings.ToLower(strings.TrimSpace(s)), true
	default:
		return "", false
	}
}

func backupCommandArgs(mode BackupMode, name, component string) []string {
	switch mode {
	case backupPreflight:
		return []string{"deploy", component, "--server", name, "--dry-run"}
	case backupDeploy:
		return []string{"deploy", component, "--server", name}
	default:
		return []string{"verify", component, "--server", name}
	}
}

// handleBackupRun 启动一个后台任务并立刻返回；日志由 GET /api/backup/task 轮询。
// 不用 r.Context()：浏览器刷新/关标签页绝不能把已经开始的远端安装掐断。
func (u *uiState) handleBackupRun(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求体过大"})
		return
	}
	var req backupRunRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求格式错误"})
		return
	}
	mode, ok := parseBackupMode(req.Mode)
	if !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知模式（可选 preflight / deploy / verify）"})
		return
	}
	component, ok := normalizeComponent(req.Component)
	if !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知组件（可选 all / pg / minio）"})
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if mode == backupDeploy && req.Confirm != "yes" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "安装是写操作：请输入 yes 确认"})
		return
	}
	if u.runner == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有备份部署能力"})
		return
	}
	if err := u.reload(); err != nil {
		writeAPI(w, http.StatusServiceUnavailable, apiResponse{Error: "配置还没准备好：" + err.Error()})
		return
	}
	u.mu.Lock()
	list := u.list
	u.mu.Unlock()
	if _, err := list.Get(req.Name); err != nil {
		// 只认清单里的 name：界面绝不能变成「代理任意主机」的入口。
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}

	task := u.ensureTask()
	if !task.start(mode, req.Name, component, req.Password) {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "已有备份任务在运行，等它结束再试"})
		return
	}
	go u.runBackupTask(task, mode, req.Name, component,
		backupCommandArgs(mode, req.Name, component), req.Password)

	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]any{
		"started":   true,
		"mode":      string(mode),
		"server":    req.Name,
		"component": component,
	}})
}

func (u *uiState) runBackupTask(t *backupTask, mode BackupMode, server, component string, args []string, password string) {
	lw := &backupLogWriter{task: t}
	fmt.Fprintf(lw, "==> 开始：%s %s（目标：%s）\n", modeLabel(mode), component, server)

	code := 0
	if mode == backupDeploy {
		// 预检门放在**服务端**：前端不点预检、或直接调 API，也绕不过这一步。
		// 菜单里是「预检通过 + 输入 yes」，这里是同一条规则。
		fmt.Fprintln(lw, "==> 服务端预检（--dry-run，不改远端）")
		pre := append(append([]string{}, args...), "--dry-run")
		code = u.runner(pre, password, lw)
		if code != 0 {
			fmt.Fprintln(lw, "预检没过，不执行安装；远端没有被修改。")
			lw.Flush()
			t.finish(code)
			return
		}
		fmt.Fprintln(lw, "==> 预检通过，开始安装（会写远端 crontab / logrotate / 目录）")
	}
	code = u.runner(args, password, lw)
	if code == 0 {
		fmt.Fprintln(lw, "==> 完成。")
	} else {
		fmt.Fprintf(lw, "==> 结束，退出码 %d。请跑一次「远端自检」复核远端状态。\n", code)
	}
	lw.Flush()
	t.finish(code)
}

func modeLabel(m BackupMode) string {
	switch m {
	case backupPreflight:
		return "备份部署预检"
	case backupDeploy:
		return "安装 / 升级备份能力"
	case componentInstallMode:
		return "安装环境组件"
	case componentUpdateMode:
		return "更新环境组件"
	case componentUninstallMode:
		return "卸载环境组件"
	case componentImageMode:
		return "导入离线镜像"
	case componentImageCopyMode:
		return "从服务器复制镜像"
	default:
		return "远端自检"
	}
}

func (u *uiState) handleBackupTask(w http.ResponseWriter, r *http.Request) {
	after, err := strconv.Atoi(r.URL.Query().Get("after"))
	if err != nil {
		after = 0
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: u.ensureTask().view(after)})
}
