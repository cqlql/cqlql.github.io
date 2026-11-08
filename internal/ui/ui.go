package ui

import (
	"pass-up/ops/internal/restart"
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
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
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
	// setupErr 只用来记「配置还读不出来」这个事实（启动日志 / 引导用），
	// 🔴 **不再拦页面**：界面本身就有「配置」页和「打开 servers.json」入口，
	// 把人挡在一页 503 说明上，反而让他没法在界面里把配置补齐。
	// 配置缺失时各 API 仍按自己的语义回 503，前端把它渲染成可操作的引导卡片。
	setupErr error
	// createShortcut 由 main.go 注入：真正的实现在 launcher（它要用 ui.IconBytes
	// 写图标），而 ui 不能反向 import launcher。nil = 这个构建没有该能力。
	createShortcut func() (shared.ShortcutInfo, error)
	// runner 同样由 main.go 注入：备份部署的真正实现在 backup 包，ui 不能 import 它。
	// task 是界面里唯一一个长任务的状态与日志（预检 / 安装 / 自检共用），见 backup.go。
	runner BackupRunner
	task   *backupTask

	// ---- P2+ 备份监控（只读，见 monitor.go）----
	// 缓存 / 时间 / 采集器都可注入：单测不连真实 SSH，也不靠 sleep 等 TTL。
	monitorMu    sync.Mutex
	monitorCache map[string]monitorCacheEntry
	probeMonitor monitorProbe
	monitorNow   func() time.Time

	// ---- 「重启自己」的事实（见 restart.go）----
	// bootID 是**这个进程实例**的标识，/api/health 会带上它。不能用 PID 代替：
	// 重启之后 PID 一定变，但「服务还在」与「重启成功了」必须能分开 —— 交接失败时
	// 旧进程会原地活着，那时说「重启完成」就是假话。
	bootID string
	port   int
	// configDir 只用来定位 ui.json（沿用令牌）与 ops-ui.log（接手进程的输出）。
	configDir string
	// srv 是优雅收尾的入口；重启时先关监听，端口才会让给接手进程。
	srvMu sync.Mutex
	srv   *http.Server
}

// exitProcess 是 /api/shutdown 的测试缝：生产环境就是 os.Exit。
var exitProcess = os.Exit

// CmdUI 启动本机界面。static 通常是根包的 webDist；createShortcut 与 runner 由
// main.go 注入（实现分别在 launcher / 根包，ui 不能反向依赖它们）。
// 测试可以传 fstest.MapFS 与假实现，不依赖「前端构建了没有」、真桌面或真 SSH。
func CmdUI(args []string, static fs.FS, createShortcut func() (shared.ShortcutInfo, error), runner BackupRunner) int {
	// --background 必须在 flag 解析**之前**拦下：它要把后面的参数原样交给
	// 隐藏守护，自己不参与 ui 的参数解析（也只活几百毫秒）。
	if len(args) > 0 && args[0] == "--background" {
		return backgroundUI(args[1:])
	}

	// __takeover 只由「重启接手进程」使用（restart.TakeoverFlag）：同端口、同 token、
	// 不新开浏览器。它和 --background 一样是内部标记，不进 usage，也不该被人手敲。
	takeover := false
	if len(args) > 0 && args[0] == restart.TakeoverFlag {
		takeover = true
		args = args[1:]
	}

	port := defaultUIPort
	noOpen := false
	explicitPort := false
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--no-open":
			noOpen = true
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
			explicitPort = true
		case strings.HasPrefix(a, "--port="):
			n, err := strconv.Atoi(strings.TrimPrefix(a, "--port="))
			if err != nil {
				fmt.Fprintf(os.Stderr, "ERROR: 端口不是数字：%s\n", a)
				return 2
			}
			port = n
			explicitPort = true
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

	dir, err := uiConfigDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	// 界面启动就保证配置目录里的 ops.ico 与嵌入的图标一致；写失败不影响界面。
	WriteIcon(dir)

	// 令牌：重启接手时**必须复用** ui.json 里那一份。
	// 前端的 token 只在内存 + 地址栏里（不落 localStorage），换一个新令牌的话
	// 页面轮询 /api/health 会一直 401，boot_id 永远拿不到 —— 界面会把一次成功的
	// 重启误报成「没重启成」。这就是「沿用当前这组参数」在本仓的确切含义。
	var token string
	if takeover {
		info, ierr := readUIInfo(dir)
		if ierr != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 接手失败，读不到 ui.json 里的端口/令牌：%v\n", ierr)
			fmt.Fprintln(os.Stderr, "       详情见 ops-ui.log；原界面已经退出，请重新双击 启动运维.cmd。")
			return 1
		}
		if explicitPort && port != info.Port {
			fmt.Fprintf(os.Stderr, "ERROR: 接手进程被要求绑 %d，但 ui.json 记的是 %d —— 拒绝悄悄换端口\n", port, info.Port)
			return 1
		}
		token = info.Token
		port = info.Port
		explicitPort = true // 严格绑同一个端口，绝不悄悄换
		noOpen = true       // 页面已经在浏览器里，别再开一个标签页
		fmt.Printf("· 重启接手：沿用 127.0.0.1:%d 与原访问令牌\n", port)
	} else {
		var err error
		token, err = randomToken()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 生成访问令牌失败：%v\n", err)
			return 1
		}
	}

	// 单实例：第二次 `ops ui` 不启第二个进程，只把浏览器指到已有实例。
	// 互斥体由内核持有，进程被强杀也会自动释放，不存在残留锁文件。
	//
	// ⚠️ 接手进程必须**带重试**：旧进程那把互斥体要等它真正 exit 才由内核释放，
	// 而 WaitPortFree 只看端口（关监听发生在 exit 之前），两者之间有几毫秒差。
	// 不重试的话接手进程会误判「已有界面在跑」，只开一个浏览器标签页，服务却没起来。
	var release func()
	var ok bool
	if takeover {
		release, ok = acquireSingletonRetry(uiSingletonKey(dir), takeoverLockTimeout)
		if !ok {
			fmt.Fprintf(os.Stderr, "ERROR: 等了 %s，旧界面进程的单实例互斥体仍没释放，接手失败。\n", takeoverLockTimeout)
			fmt.Fprintln(os.Stderr, "       详情见 ops-ui.log；请重新双击 启动运维.cmd。")
			return 1
		}
	} else {
		release, ok = acquireSingleton(uiSingletonKey(dir))
	}
	if !ok {
		info, ierr := readUIInfo(dir)
		if ierr != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 这个配置目录下已有界面进程，但读不到它的端口/token：%v\n", ierr)
			fmt.Fprintf(os.Stderr, "       先点那个界面的「关闭界面」；或删掉 %s 再试\n", uiInfoPath(dir))
			return 1
		}
		// 显式要了另一个端口却装作没看见，比报错更糟：人会以为自己起在了新端口上。
		if explicitPort && info.Port != port {
			fmt.Fprintf(os.Stderr, "ERROR: 已有界面在 %d 上跑（单实例），显式指定的 --port %d 不会生效。\n", info.Port, port)
			fmt.Fprintln(os.Stderr, "       想换端口就先点页面上的「关闭界面」，再重新打开。")
			return 1
		}
		fmt.Printf("· 已有界面在跑：%s\n", uiURL(info.Port, ""))
		if !noOpen {
			openBrowser(uiURL(info.Port, info.Token))
		}
		return 0
	}
	defer release()

	// 配置 / 清单读不出来也照样起界面：页面给一页能照做的说明，修好之后
	// 刷新即可（serveIndex 每次都会重读），不必重启进程。
	var list *shared.ServerList
	var setupErr error
	cfg, cfgErr := shared.LoadConfig()
	if cfgErr != nil {
		setupErr = cfgErr
	} else if list, err = shared.LoadServers(cfg); err != nil {
		setupErr = err
	}
	ln, actual, err := uiListen(port, explicitPort)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	// port==0 是「让系统分配」，不是「0 被占用」——别把正常情况报成冲突。
	if actual != port && port != 0 {
		// 同机的 suikouji ops 也默认 7788；双击时不避让就永远是「没反应」。
		fmt.Printf("· 端口 %d 被占用，改用 %d\n", port, actual)
	}
	if err := writeUIInfo(dir, uiInfo{Port: actual, Token: token}); err != nil {
		_ = ln.Close()
		fmt.Fprintf(os.Stderr, "ERROR: 写 %s 失败：%v\n", uiInfoPath(dir), err)
		return 1
	}

	states := map[string]shared.ServerStatus{}
	if list != nil {
		states = shared.LoadServerState(list.Path)
	}
	u := &uiState{
		list:           list,
		states:         states,
		token:          token,
		origin:         fmt.Sprintf("http://127.0.0.1:%d", actual),
		files:          distFS(static),
		setupErr:       setupErr,
		createShortcut: createShortcut,
		runner:         runner,
		task:           &backupTask{},
		bootID:         newBootID(),
		port:           actual,
		configDir:      dir,
	}
	fmt.Printf("服务器管理界面：%s\n", uiURL(actual, token))
	if setupErr != nil {
		fmt.Printf("△ 配置还没准备好：%v\n   界面照常打开，可直接在「配置」页补齐；补完刷新即可，不用重启界面。\n", setupErr)
	}
	if u.files == nil {
		fmt.Println("WARN: 前端产物未嵌入（web/dist 为空）。重新双击 启动运维.cmd 会自动补齐；" +
			"手动则 cd web && npm install && npm run build，再重新 go build。")
	}
	fmt.Println("退出：Ctrl+C，或点页面上的「关闭界面」")

	srv := &http.Server{Handler: u, ReadHeaderTimeout: 10 * time.Second}
	u.setServer(srv)
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(stop)
	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}()

	if !noOpen {
		openBrowser(uiURL(actual, token))
	}
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
  ops ui [--port 7788] [--no-open]
  ops ui --background --launcher <启动运维.cmd 的绝对路径> [上面的参数]

第一种是前台：占着终端，Ctrl+C 或页面上的「关闭界面」停。
第二种只由启动器调用：把界面交给隐藏的后台 cmd，自己立刻返回。
已有实例时这两种都只会把浏览器指过去，不启第二个进程。

只监听 127.0.0.1；地址带随机 token；目标机只接受清单里的 name。
页面上的备份部署要显式输入 yes，服务端先跑 --dry-run 预检；sudo 密码只经子进程 stdin。
默认端口 7788，**被占用时自动往后递增**（同机其它工具也可能用 7788）；
显式写了 --port 则严格绑定，被占直接报错，不偷偷换端口。
--no-open 不自动打开浏览器（验收 / 脚本用）。
页面来自 web/dist。产物没构建时，重新双击 启动运维.cmd 会自动补齐；
手动构建则是 cd web && npm install && npm run build，再 go build -o ops.exe .。
`)
}

// defaultUIPort 只是「起点」，不是必须抢到的端口：同机的 suikouji ops 也默认
// 7788，两个工具经常同时开着。绑死一个端口的后果是双击后隐藏窗口里监听失败，
// 浏览器永远不会打开——表现为「双击没反应」，日志里却只有一句 bind 错误。
const (
	defaultUIPort  = 7788
	uiPortMaxTries = 20
)

// uiListen 只绑回环。两条规则：
//   - 未显式给 --port：从起点往后试，被占就递增（双击路径必须总能起来）。
//   - 显式给了 --port：严格绑定，被占就报错——静默换端口等于没尊重用户的要求。
//
// 返回的是**实际**端口（--port 0 时由系统分配），ui.json / origin / 浏览器地址
// 全用这一个值，否则单实例复用与 Origin 校验都会对不上。
func uiListen(requested int, explicit bool) (net.Listener, int, error) {
	tries := uiPortMaxTries
	if explicit {
		tries = 1
	}
	var lastErr error
	for i := 0; i < tries; i++ {
		p := requested + i
		if p < 0 || p > 65535 {
			break
		}
		ln, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(p)))
		if err == nil {
			return ln, ln.Addr().(*net.TCPAddr).Port, nil
		}
		lastErr = err
	}
	if explicit {
		return nil, 0, fmt.Errorf("监听 127.0.0.1:%d 失败：%v\n"+
			"       显式指定的端口被占用；换一个端口，或去掉 --port 让它自动避让", requested, lastErr)
	}
	return nil, 0, fmt.Errorf("从 %d 起连试 %d 个端口都不可用：%w", requested, tries, lastErr)
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
	case r.Method == http.MethodPost && r.URL.Path == "/api/backup/run":
		u.handleBackupRun(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/api/backup/task":
		u.handleBackupTask(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/api/backup/deps":
		// 只读依赖状态；安装走 POST /api/backup/run 的 mode=deps。
		u.handleBackupDeps(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/api/backup/once/plan":
		// 手动备份页的只读动作计划（纯本机，不连远端、不占任务锁）。
		u.handleBackupOncePlan(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/api/backup/once/source":
		// 只读回显「备份对象（生产端）」：复用 compare-env，仅白名单非凭证字段。
		u.handleBackupOnceSource(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/api/monitor/status":
		// P2+ 备份监控：只读快照 + 30s 缓存；连不上也回完整快照（见 monitor.go）。
		u.handleMonitorStatus(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/api/components/status":
		u.handleComponentStatus(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/api/components/images":
		u.handleComponentImages(w, r)
	case r.Method == http.MethodPost && r.URL.Path == "/api/components/run":
		u.handleComponentRun(w, r)
	case r.Method == http.MethodPost && r.URL.Path == "/api/components/image":
		u.handleComponentImage(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/api/components/task":
		u.handleComponentTask(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/api/config":
		u.handleConfigView(w)
	case r.Method == http.MethodGet && r.URL.Path == "/api/config/compare":
		u.handleConfigCompare(w, r)
	case r.Method == http.MethodPost && r.URL.Path == "/api/config/servers":
		u.handleConfigServers(w, r)
	case r.Method == http.MethodPost && r.URL.Path == "/api/config/backup-env":
		u.handleConfigBackupEnv(w, r)
	case r.Method == http.MethodPost && r.URL.Path == "/api/config/sync-env":
		u.handleConfigSyncEnv(w, r)
	case r.Method == http.MethodPost && r.URL.Path == "/api/shortcut":
		u.handleShortcut(w)
	case r.Method == http.MethodPost && r.URL.Path == "/api/open-servers-file":
		u.handleOpenServersFile(w)
	case r.Method == http.MethodGet && r.URL.Path == "/api/health":
		u.handleHealth(w)
	case r.Method == http.MethodGet && r.URL.Path == "/api/restart":
		u.handleRestartView(w)
	case r.Method == http.MethodPost && r.URL.Path == "/api/restart":
		u.handleRestart(w, r)
	case r.Method == http.MethodPost && r.URL.Path == "/api/shutdown":
		u.handleShutdown(w)
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

	// 🔴 配置缺失不拦页面：界面里本来就有「配置」页（能编辑清单与 env）
	// 和「点清单路径用编辑器打开」的本机入口。以前这里回一页 503 说明，
	// 人反而进不去那个能补配置的地方，只能去手敲命令 —— 与「省事」正相反。
	//
	// 每次请求顺手重读一次配置：补完之后刷新即可，不用重启界面
	// （首次双击最需要这条，那时窗口是隐藏的，没人能去重启）。
	u.mu.Lock()
	pending := u.setupErr != nil
	u.mu.Unlock()
	if pending {
		_ = u.reload()
	}

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

const buildHint = "重新双击 启动运维.cmd 会自动补齐；也可手动：cd web && npm install && npm run build，然后 go build -o ops.exe ."

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
<p><b>最省事：关掉本界面，重新双击 启动运维.cmd</b> —— 启动器会自动构建前端并重新编译 exe。</p>
<p>也可以手动构建一次：</p>
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
	// 🔴 ops.env 缺失（或暂时写坏）不该让整个界面「什么都没有」：启动器首次
	// 会生成它，但人也可能手工删掉，那时 servers.json 仍在同一个默认路径上。
	// 用 shared.FallbackConfig 取同一套路径规则继续读清单。
	// 要连远端的动作仍走严格 LoadConfig（见 handleConfigSyncEnv / CLI）。
	cfg, err := shared.LoadConfig()
	if err != nil {
		cfg = shared.FallbackConfig()
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		return err
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	u.list = list
	u.states = shared.LoadServerState(list.Path)
	u.setupErr = nil
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

// serversView 是落地页的唯一数据契约。配置缺失时它也回 200（空清单 + 原因），
// 而不是 503 —— 前端要拿得到 servers_file 才能给「打开清单 / 去配置页」的入口。
type serversView struct {
	ServersFile string              `json:"servers_file"`
	Default     string              `json:"default,omitempty"`
	Servers     []shared.ServerInfo `json:"servers"`
	SetupError  string              `json:"setup_error,omitempty"`
}

func (u *uiState) handleServers(w http.ResponseWriter) {
	u.opMu.Lock()
	defer u.opMu.Unlock()
	if err := u.reload(); err != nil {
		// 🔴 配置缺失不再是「请求失败」：界面里本来就有能补配置的那一页。
		// 回空清单 + 原因 + 默认路径，让前端把它渲染成可操作的引导卡片；
		// 真正需要清单的写操作（check / apply-sudo / 备份部署）仍各自回 503。
		cfg, _ := configForEditing()
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: serversView{
			ServersFile: cfg.ServersFile,
			Servers:     []shared.ServerInfo{},
			SetupError:  err.Error(),
		}})
		return
	}
	u.mu.Lock()
	list, states := u.list, u.states
	u.mu.Unlock()
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: serversView{
		ServersFile: list.Path,
		Default:     list.Default,
		Servers:     servers.ServerInfos(list, states),
	}})
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
		// 503 而不是 500：这不是服务坏了，是「还差一份配置」，页面会据此
		// 显示那页能照做的说明（见 writeSetupHint）。
		writeAPI(w, http.StatusServiceUnavailable, apiResponse{Error: "配置还没准备好：" + err.Error()})
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
	// 两个会改远端的动作不许并发：部署正在写 crontab / 目录时改 sudoers，
	// 失败时根本分不清是哪一边把机器弄坏的。检查是只读，不受此限。
	if u.backupBusy() {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "备份部署任务正在运行，等它结束再配置免密 sudo"})
		return
	}
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
		// 503 而不是 500：这不是服务坏了，是「还差一份配置」，页面会据此
		// 显示那页能照做的说明（见 writeSetupHint）。
		writeAPI(w, http.StatusServiceUnavailable, apiResponse{Error: "配置还没准备好：" + err.Error()})
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

// handleShortcut 服务页面上的「创建桌面快捷方式」。
//
// 三点与别的接口不同：
//   - **不受配置缺失限制**：建快捷方式只碰本机桌面，跟 servers.json 填没填无关；
//     配置还没准备好时这个按钮照样该能用（那时别的接口都是 503）。
//   - 不进锁、不写任何远端：它不与检查 / 一键免密 sudo 互斥。
//   - 实现与 `ops shortcut` 是**同一份**（main.go 注入的 launcher 实现），
//     界面不自己拼路径——否则「命令行建出来能用、界面建出来指向别处」。
func (u *uiState) handleShortcut(w http.ResponseWriter) {
	if u.createShortcut == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有桌面快捷方式能力"})
		return
	}
	info, err := u.createShortcut()
	if err != nil {
		// 500 而不是 400：失败几乎都是环境问题（没 PowerShell、找不到启动器、
		// 不是 Windows），不是请求写错了。界面把 message 原样显示。
		writeAPI(w, http.StatusInternalServerError, apiResponse{Error: err.Error()})
		return
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: info})
}

// handleShutdown 关掉界面自己（退出码 0）。
//
// 后台模式下窗口是隐藏的，页面上的「关闭界面」就是唯一体面的停止方式：
// 不用翻日志、不用开任务管理器。它不改远端、不写配置，只结束本机这个进程。
// 与「重启」不同，这里不存在退出码 75：关掉之后没有东西留下是预期结果。
func (u *uiState) handleShutdown(w http.ResponseWriter) {
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]bool{"stopping": true}})
	// 响应先出去再退出：顺序反了浏览器拿到的是「连接被重置」，
	// 而它本来应该显示「界面已关闭」。
	go func() {
		time.Sleep(300 * time.Millisecond)
		fmt.Println("· 界面已关闭（重新双击 启动运维.cmd 再打开）")
		exitProcess(0)
	}()
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
