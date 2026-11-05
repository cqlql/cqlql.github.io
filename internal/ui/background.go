package ui

import (
	"pass-up/ops/internal/shared"
)

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// 双击 启动运维.cmd 的两条路，对应 .cmd 里的两个分支：
//
//   - 日常：ops ui --background --launcher <启动器> [透传参数]
//     由一条**隐藏的** cmd 重新执行启动器（--bg），桌面不留黑窗口。
//   - --bg：隐藏 cmd 里跑的就是普通的 ops ui，只是窗口看不见。
//
// 后台不是另起一套实现：它复用同一份 CmdUI / ServeHTTP，所以页面里的
// 「关闭界面」、token、只读边界一个字都不变。
const (
	// uiInfoName 落配置目录（0600，里面有 token）；第二次双击要读它才能把
	// 浏览器指回已经跑着的那个实例。
	uiInfoName = "ui.json"

	// 后台 stdout/stderr 的落点与上限。界面日志在页面里看，这里只有启动横幅、
	// 退出码和 panic；没人看着的日志无上限增长只会把磁盘占满。
	uiLogName  = "ops-ui.log"
	uiLogLimit = 512 << 10

	// uiReadyTimeout 是「守护到底起没起来」的等待上限。正常 <1 秒；给足余量
	// 是因为第一次双击可能还要现编 ops.exe。
	uiReadyTimeout = 6 * time.Second
)

// acquireSingleton 是 shared 的跨进程单实例判定；做成变量让单测能模拟
// 「已有一个界面在跑」，而不必真的去起第二个进程。
var acquireSingleton = shared.AcquireSingleton

// uiSingletonKey 把「按配置目录单实例」编成互斥体名。
//
// 🔴 必须带目录指纹。互斥体是**机器级**的，而配置目录可以被
// PASS_UP_OPS_CONFIG_DIR 覆盖（验收 / 多环境）。用固定名字时，A 目录的界面
// 会把 B 目录的启动挡掉，然后指着 B 目录里根本不存在的 ui.json 让你「删掉再试」——
// 排查起来完全反直觉。参考项目的 ui.lock 落在配置目录里，天然就是按目录隔离的，
// 这里用名字模拟同一个语义。菜单另用 Local\pass-up-ops-menu，两者不干扰。
func uiSingletonKey(dir string) string {
	sum := sha1.Sum([]byte(strings.ToLower(filepath.Clean(dir))))
	return fmt.Sprintf(`Local\pass-up-ops-ui-%s`, hex.EncodeToString(sum[:6]))
}

// waitReady 同样是测试缝：单测里的 spawnGuard 是假的，不会真的写 ui.json。
var waitReady = waitUIReady

// uiInfo 是「怎么进来」的凭据，0600 落盘。
type uiInfo struct {
	Port  int    `json:"port"`
	Token string `json:"token"`
}

// backgroundUI 是双击启动器走的那条路：**要么把界面放到后台，
// 要么把浏览器指到已经在跑的那个界面**，两条路都不该留一个黑窗口。
//
// 参数由 启动运维.cmd 拼好，不给人手敲：
//
//	ops ui --background --launcher <启动器路径> [透传给 ops ui 的参数...]
func backgroundUI(rest []string) int {
	if len(rest) < 2 || rest[0] != "--launcher" {
		fmt.Fprintln(os.Stderr, "ERROR: --background 只能由 启动运维.cmd 调用（形如 --background --launcher <启动器路径>）")
		return 2
	}
	launcher, pass := rest[1], rest[2:]

	dir := shared.UserConfigDir()
	if dir == "" {
		fmt.Fprintln(os.Stderr, "ERROR: 找不到配置目录（可用 "+shared.ConfigDirEnv+" 指定）")
		return 1
	}

	// 单实例用互斥体判定，不用 tasklist：后者会把 `ops servers check` 这类
	// 短命进程也算成「界面在跑」，于是双击后只打开一个连不上的标签页。
	release, ok := acquireSingleton(uiSingletonKey(dir))
	if !ok {
		info, err := readUIInfo(dir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 这个配置目录下已有界面进程，但读不到它的端口/token：%v\n", err)
			fmt.Fprintf(os.Stderr, "       先点那个界面的「关闭界面」；或删掉 %s 再双击一次\n", uiInfoPath(dir))
			return 1
		}
		fmt.Printf("· 界面已经在跑：%s\n", uiURL(info.Port, ""))
		openBrowser(uiURL(info.Port, info.Token))
		return 0
	}
	// 立刻放掉：真正该握这把互斥体的是守护里那个 `ops ui`。父进程拿着不放，
	// 守护启动后会以为自己来晚了，转头又去开一次浏览器。
	release()

	before := uiInfoStamp(dir)
	if err := spawnGuard(launcher, pass, filepath.Join(dir, uiLogName)); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 后台启动失败：%v\n", err)
		return 1 // .cmd 见到非 0 会回退到前台，错误不会变成「无声失败」
	}
	// spawn 成功只代表 cmd 起来了，不代表 ops ui 监听成功（端口被占时它会在
	// 隐藏窗口里退掉）。等它把**新的** ui.json 写出来才算真的就绪；否则回退前台，
	// 让 bind 失败之类的错误出现在可见窗口里，而不是只躺在日志里。
	if err := waitReady(dir, before, uiReadyTimeout); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 后台界面没能起来：%v\n", err)
		fmt.Fprintf(os.Stderr, "       详情：%s\n", filepath.Join(dir, uiLogName))
		fmt.Fprintln(os.Stderr, "       下面回退到前台运行，错误会直接显示在这个窗口里。")
		return 1
	}
	fmt.Println("· 界面在后台启动，浏览器马上打开；要关就点页面右上角的「关闭界面」")
	return 0
}

// uiInfoStamp 是 ui.json 的修改时间；不存在返回零值。
func uiInfoStamp(dir string) time.Time {
	st, err := os.Stat(uiInfoPath(dir))
	if err != nil {
		return time.Time{}
	}
	return st.ModTime()
}

// waitUIReady 等守护写出**新的、完整的** ui.json。
//
// 为什么不能只看「cmd 还在不在」：bind 失败时 ops ui 立刻退出，cmd 守护也跟着
// 结束，而父进程早已返回 0——双击的人只看到黑窗口一闪，什么也没有。这个等待
// 把那种静默失败变成非 0 退出，交给 .cmd 回退前台。
func waitUIReady(dir string, before time.Time, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		if st, err := os.Stat(uiInfoPath(dir)); err == nil && st.ModTime().After(before) {
			if _, err := readUIInfo(dir); err == nil {
				return nil
			}
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("等不到界面就绪（%s 没有更新）", uiInfoPath(dir))
		}
		time.Sleep(150 * time.Millisecond)
	}
}

// uiConfigDir 是运行态文件的唯一落点；配置目录由 shared 决定（可覆盖，便于验收）。
func uiConfigDir() (string, error) {
	dir := shared.UserConfigDir()
	if dir == "" {
		return "", errors.New("找不到配置目录（可用 " + shared.ConfigDirEnv + " 指定）")
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

func uiInfoPath(dir string) string { return filepath.Join(dir, uiInfoName) }

func readUIInfo(dir string) (uiInfo, error) {
	b, err := os.ReadFile(uiInfoPath(dir))
	if err != nil {
		return uiInfo{}, err
	}
	var info uiInfo
	if err := json.Unmarshal(b, &info); err != nil {
		return uiInfo{}, err
	}
	if info.Port <= 0 || info.Token == "" {
		return uiInfo{}, errors.New("ui.json 内容不完整")
	}
	return info, nil
}

func writeUIInfo(dir string, info uiInfo) error {
	b, err := json.Marshal(info)
	if err != nil {
		return err
	}
	// 0600：里面是 token，等同于一把临时钥匙。
	return os.WriteFile(uiInfoPath(dir), b, 0o600)
}

// uiURL 拼带 token 的地址。token 只出现在启动横幅、ui.json（0600）和这里，
// 不进日志、不进 Referer（本仓用 ?token=，见 docs/ui.md §4）。
func uiURL(port int, token string) string {
	u := fmt.Sprintf("http://127.0.0.1:%d/", port)
	if token != "" {
		u += "?token=" + token
	}
	return u
}

// 两个测试缝：单测不能真的弹出浏览器，也不能真的 spawn 一条隐藏 cmd。
// 生产环境它们就是平台实现本身。
var spawnGuard = spawnBackgroundGuard

var openBrowser = func(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	// 失败不算错误：地址已经打印过了，手动点一下即可。
	_ = cmd.Start()
}

// openRotatedLog 追加打开日志；已经超过 limit 就先清掉再开。
func openRotatedLog(path string, limit int64) (*os.File, error) {
	if st, err := os.Stat(path); err == nil && st.Size() > limit {
		_ = os.Remove(path)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	return os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
}

// quoteArg 只在需要时加引号：透传的是 --port 7790 这种，不为复杂转义设计。
func quoteArg(s string) string {
	if s == "" {
		return `""`
	}
	if strings.ContainsAny(s, " \t") {
		return `"` + s + `"`
	}
	return s
}
