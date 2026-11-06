package ui

import (
	"pass-up/ops/internal/restart"
)

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

// ---------------------------------------------------------------------------
// 「重启 ops ui 自己」
// ---------------------------------------------------------------------------
//
// 它是唯一会让**服务本体**消失的动作，所以比其它本机动作更该单独把守：
// 显式点击 + 二次确认弹窗 + 绑进程实例的确认令牌（不要求输 yes —— 它是本机动作，
// 而二次确认已经把影响面逐条摊开了）。
//
// 它解决的事情很具体：开发时「改代码 → npm test/typecheck/build → go build →
// 关界面 → 重新双击」一直是纯手工五步，漏掉任何一步的症状都是同一句
// 「我明明改了，界面怎么没变」。
//
// ⚠️ **重建失败就什么都不做**：它可能构建出一个起不来的二进制，而交接之后
// 就没有回头路了。顺序是「先重建、重建成功才交接」。
//
// ⚠️ **交接失败不许退出进程**：退出而新进程没起来 = 服务彻底没了，界面只会
// 显示「连不上」。前端的判据是 boot_id —— 没变就会如实报「重启没有完成」。

// 三个包级变量**只为可测**：真实重建要几十秒，真起进程会把测试进程换掉。
var (
	rebuildForRestart = func(ctx context.Context, root, exe string, logf func(string)) (restart.Result, error) {
		return restart.Rebuild(ctx, root, exe, logf)
	}
	restartSpawn = restart.Spawn
	// restartDelay 是「响应发出去」与「进程退出」之间的等待。
	// 必须有：退出之后连接会被切断，不等一下浏览器拿到的是「连接被重置」，
	// 而不是「已受理，正在重启」。同时也给前端留出开始轮询 health 的时间。
	restartDelay = 500 * time.Millisecond
)

// newBootID 生成**这个进程实例**的标识。取不到随机数也要给一个能区分实例的值，
// 不返回空串：空串会让前端把「没重启」和「重启成功」看成一样。
func newBootID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

type healthView struct {
	OK     bool   `json:"ok"`
	BootID string `json:"boot_id"`
}

// restartView 是「重启」那一块的事实（GET /api/restart）。
type restartView struct {
	// Confirm 绑「这个进程实例 + 当前端口 + 当前令牌」，页面陈旧就得重新确认。
	Confirm string `json:"confirm_token"`
	// Impact 是影响面原文（确认对话框里逐条摊开）。
	Impact []string `json:"impact"`
	// BuildCommand 是「先重建」实际会跑的命令（给人看的）。
	BuildCommand []string `json:"build_command"`
	// BinaryStale 表示二进制（或它嵌的前端产物 / 备份脚本）比源码旧。
	// 前端据此把「先重建」默认勾上，比让人记住「改了代码要勾」可靠得多。
	BinaryStale bool   `json:"binary_stale"`
	StaleReason string `json:"stale_reason,omitempty"`
	// LogPath 是新进程的输出日志：启动失败的原因只在那里。
	LogPath string `json:"log_path"`
	Port    int    `json:"port"`
	Exe     string `json:"exe"`
	// ExeExists 为假时没什么可重启的（exe 没了只能重新构建）。
	ExeExists bool `json:"exe_exists"`
	// TaskRunning 让弹窗提前说清「现在有任务在跑」。真正的拦截在 POST 里。
	TaskRunning bool   `json:"task_running"`
	Note        string `json:"note,omitempty"`
}

type restartRequest struct {
	Rebuild bool   `json:"rebuild"`
	Confirm string `json:"confirm"`
}

// restartImpact 是确认对话框里的影响面原文。
// ⚠️ 刻意不用 Markdown 加粗：这几行直接塞进 JSX 当纯文本渲染，星号会原样显示。
var restartImpact = []string{
	"重启会中断正在跑的备份预检 / 安装 / 自检任务，以及页面上的任务日志 —— 有任务在跑时这里会直接拒绝重启。",
	"新进程沿用当前端口与访问令牌重新起来，页面会自动回来，不用重新复制地址、不用重新双击启动器。",
	"勾了「先重建」会先跑 npm test / npm run typecheck / npm run build（前端代码改了要 30~40 秒）" +
		"与 go build -o ops.next.exe .。重建失败就什么都不做，服务照旧在跑 —— 那是最要紧的一条。",
	"⚠️ Windows 上没有 exec：重启是「本进程退出 + 另一个进程接手」。" +
		"新进程的输出写进 ops-ui.log（见下面的路径），启动失败的原因只在那里，不在原来那个窗口里。",
	"重启期间页面会断连几秒，属正常。进程到底换没换，是按 /api/health 里的 boot_id 判断的，" +
		"不是按「服务还在」判断 —— 后者在交接失败时同样成立。",
}

// restartConfirmToken 绑「这个进程实例 + 端口 + 令牌」。
//
// 本次重启**不改任何配置**，它改的是「哪个进程在跑」。所以需要确认的事实是
// 「重启后会按哪个端口、哪份凭据起来」；进程一换（页面是上一个实例打开的），
// 刚才看到的那份对照就不成立了，令牌必须失效。它不是权限，只是「看到过当前事实」的证明。
func (u *uiState) restartConfirmToken() string {
	h := sha256.New()
	fmt.Fprintf(h, "v1\x00ops-restart\x00%s\x00%d\x00%s", u.bootID, u.port, u.token)
	return "sha256:" + hex.EncodeToString(h.Sum(nil))
}

func (u *uiState) restartLogPath() string {
	if u.configDir == "" {
		return ""
	}
	return filepath.Join(u.configDir, uiLogName)
}

func (u *uiState) setServer(s *http.Server) {
	u.srvMu.Lock()
	u.srv = s
	u.srvMu.Unlock()
}

// shutdownServer 关监听并等在途请求（最多 timeout）。
// 这一步顺带把监听地址让出来 —— 接手进程正是在等这个。
func (u *uiState) shutdownServer(timeout time.Duration) {
	u.srvMu.Lock()
	s := u.srv
	u.srvMu.Unlock()
	if s == nil { // 单测里没有真起 http.Server
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	_ = s.Shutdown(ctx)
}

func (u *uiState) restartViewFor() restartView {
	v := restartView{
		Confirm:      u.restartConfirmToken(),
		Impact:       restartImpact,
		BuildCommand: []string{"go build -o ops.next.exe ."},
		LogPath:      u.restartLogPath(),
		Port:         u.port,
		TaskRunning:  u.backupBusy(),
	}
	if target, err := restart.TargetExe(); err == nil {
		v.Exe = target
		if st, e := os.Stat(target); e == nil && !st.IsDir() {
			v.ExeExists = true
		}
		root := restart.SourceRoot(target)
		stale := restart.Check(root, target)
		v.BinaryStale, v.StaleReason = stale.Any(), stale.Reason()
		v.BuildCommand = restart.BuildCommands(root, stale)
	}

	// 接手进程要从 ui.json 复用端口与令牌。读不到 / 对不上就**不给按钮**：
	// 那意味着重启后页面会掉线，而界面会把一次成功的重启误报成失败。
	info, err := readUIInfo(u.configDir)
	switch {
	case err != nil:
		v.Note = "读不到 " + uiInfoPath(u.configDir) + "：接手进程没法沿用端口与令牌，这里不给重启按钮。"
	case info.Port != u.port || info.Token != u.token:
		v.Note = "ui.json 与当前进程不一致，重启后页面会掉线 —— 请刷新页面，或点「关闭界面」后重新双击启动器。"
	case v.Exe == "" || !v.ExeExists:
		v.Note = "拿不到或找不到正式 exe（ops.exe）—— 没什么可重启的，先重新 go build。"
	}
	return v
}

// ------------------------------ GET /api/health ------------------------------

func (u *uiState) handleHealth(w http.ResponseWriter) {
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: healthView{OK: true, BootID: u.bootID}})
}

// ------------------------------ GET /api/restart ------------------------------

func (u *uiState) handleRestartView(w http.ResponseWriter) {
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: u.restartViewFor()})
}

// ------------------------------ POST /api/restart ------------------------------

func (u *uiState) handleRestart(w http.ResponseWriter, r *http.Request) {
	var req restartRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10))
	// 只认这两个字段，多余的直接拒 —— 请求体是给人抄的宽松输入。
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: `请求体只接受 {"rebuild":true|false,"confirm":"…"}：` + err.Error()})
		return
	}
	// 把请求体读干净再往下走：socket 上还有未读数据时关闭会发 RST，而 RST
	// 有可能让浏览器把**已经完整收到的响应**也丢掉。我们这次不会正常返回。
	_, _ = io.Copy(io.Discard, r.Body)
	_ = r.Body.Close()

	if want := u.restartConfirmToken(); req.Confirm != want {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "确认已过期：这个界面进程在确认之后换过了。请刷新页面再确认一次。"})
		return
	}
	// 🔴 备份部署正在写远端（crontab / 目录 / sudoers），拦腰截断会留下半状态。
	// 与 wsl-manager 的「只提示会中断」不同：这里是硬拒绝，等任务结束再点。
	if u.backupBusy() {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "备份预检 / 安装 / 自检任务正在运行，它正在写远端 —— 没有重启。等任务结束再点。"})
		return
	}
	info, err := readUIInfo(u.configDir)
	if err != nil || info.Port != u.port || info.Token != u.token {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "接手进程要沿用的 ui.json 读不到或已变化 —— 没有重启。刷新页面再试。"})
		return
	}
	target, err := restart.TargetExe()
	if err != nil {
		writeAPI(w, http.StatusInternalServerError, apiResponse{Error: "拿不到正式 exe 路径，没法确定重启后该跑起来的是谁 —— 没有重启。"})
		return
	}

	// ---- 1) 可选：先重建。**失败就到此为止**，服务照旧在跑 ----
	var (
		buildOut string
		newExe   string
	)
	if req.Rebuild {
		logf := func(line string) { fmt.Fprintln(os.Stdout, line) }
		res, err := rebuildForRestart(context.Background(), restart.SourceRoot(target), target, logf)
		buildOut = res.Output
		if err != nil {
			fmt.Printf("· 重启自己：重建失败，没有重启：%v\n", err)
			writeAPI(w, http.StatusInternalServerError, apiResponse{Error: "重建失败，没有重启（服务照旧在跑）。构建输出：\n" + buildOut})
			return
		}
		newExe = res.NewExe
	}

	// ---- 2) 留痕必须在交接之前（交接之后这个进程就没了）----
	fmt.Printf("· 重启自己（本机写操作）：rebuild=%v；新二进制=%q；沿用 127.0.0.1:%d 与原令牌\n",
		req.Rebuild, newExe, u.port)

	// ---- 3) 先回响应再交接 ----
	//
	// ⚠️ 这里刻意**不用 writeAPI + Flush**：Go 在 handler 返回之前 Flush 会退化成
	//    chunked 编码，而结束块要等 handler 返回才写 —— 可下一步就退出进程了，
	//    那个结束块永远发不出去，客户端拿到的是截断报文（Failed to fetch），
	//    于是「重启明明成功了，界面上却报失败」。自己序列化 + 显式 Content-Length，
	//    报文自带边界，写出去就算完整。
	body, err := json.Marshal(apiResponse{OK: true, Data: map[string]any{
		"restarting":   true,
		"rebuild":      req.Rebuild,
		"build_output": buildOut,
		"boot_id":      u.bootID,
	}})
	if err != nil {
		// 连自己的响应都拼不出来 —— **不交接**：那等于用一个看不见的失败换掉整个服务。
		writeAPI(w, http.StatusInternalServerError, apiResponse{Error: "拼响应失败，没有重启：" + err.Error()})
		return
	}
	h := w.Header()
	h.Set("Content-Type", "application/json; charset=utf-8")
	h.Set("Cache-Control", "no-store")
	h.Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(body); err != nil {
		fmt.Printf("!! 重启响应写失败：%v —— 仍然继续（前端会靠 boot_id 自己确认）\n", err)
	}
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// ---- 4) 交出去 ----
	time.Sleep(restartDelay)
	logFile, logErr := openRotatedLog(u.restartLogPath(), uiLogLimit)
	if logErr != nil {
		fmt.Printf("!! 打不开 %s：%v —— 没有重启（服务仍在运行）\n", u.restartLogPath(), logErr)
		return
	}
	defer logFile.Close()

	childExe := target
	if newExe != "" {
		childExe = newExe
	}
	addr := net.JoinHostPort("127.0.0.1", strconv.Itoa(u.port))
	placeholder := newExe
	if placeholder == "" {
		placeholder = "-" // 空参数在 Windows CreateProcess 下不稳，用 "-" 表示「不换二进制」
	}
	argv := []string{restart.Subcommand, addr, target, placeholder}
	if err := restartSpawn(childExe, argv, logFile); err != nil {
		// 交接没成：进程还在 —— 如实记下来，**不要退出**。
		// 上面那个 200 已经写出去了，不能再写第二个响应体；
		// 前端的判据是 boot_id，没变就会如实报「重启没有完成」。
		fmt.Printf("!! 拉起接手进程失败：%v —— 服务仍在运行（没有重启）\n", err)
		return
	}

	u.shutdownServer(3 * time.Second)
	fmt.Println("· 界面进程退出，接手进程正在同一端口上接管")
	exitProcess(0)
}
