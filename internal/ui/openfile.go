package ui

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// openInEditor 是「拉起编辑器」的测试缝：单测不能真去开一个 VSCode 窗口。
// 返回实际用到的程序名，界面如实显示；找不到 VSCode 时不冒充成功。
var openInEditor = openFileInEditor

// systemFileOpener 也是测试缝：回退分支在单测里不该真去弹文件关联。
var systemFileOpener = defaultFileCommand

const (
	editorVSCode = "VSCode"
	editorSystem = "系统默认程序"
)

// handleOpenServersFile 让页面上的清单路径可直接点开编辑。
//
// 三条边界（对应 AGENTS.md 硬约束 14 / 15）：
//   - 纯本机动作：不写文件、不碰远端，只起一个编辑器进程；因此不需要
//     「输 yes」那类二次确认，但必须人点（POST + token + Origin，见 ServeHTTP）。
//   - 路径只由服务端从 ops.env 解析：**接口完全不读请求体**，前端塞 path
//     或任意字符串都没用，界面不会变成「打开任意本机文件」的代理。
//   - 目标必须存在且是普通文件，否则回一句能照做的中文原因。
//
// 不进 opMu：它与「检查 / 一键免密 sudo / 备份部署」不共享任何状态，
// 排队只会让人以为点一下路径要等 SSH 跑完。
func (u *uiState) handleOpenServersFile(w http.ResponseWriter) {
	// 配置还没准备好时这个按钮尤其有用（它就是补齐清单的入口之一）：
	// 路径按与 LoadConfig 相同的规则取默认值，不会因为 ops.env 缺失而 503。
	cfg, _ := configForEditing()
	path := cfg.ServersFile
	st, err := os.Stat(path)
	if err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{
			Error: fmt.Sprintf("找不到服务器清单：%s（%v）", path, err),
		})
		return
	}
	if st.IsDir() {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "服务器清单路径指向的是目录：" + path})
		return
	}

	editor, err := openInEditor(path)
	if err != nil {
		writeAPI(w, http.StatusInternalServerError, apiResponse{
			Error: fmt.Sprintf("打不开清单 %s：%v", path, err),
		})
		return
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: struct {
		Editor string `json:"editor"`
		Path   string `json:"path"`
	}{editor, path}})
}

// openFileInEditor 优先 VSCode，找不到（或起不来）就回退系统默认程序。
//
// 🔴 只拼 argv、不拼 shell 命令行：配置目录可能在含空格 / & / ^ 的路径下，
// 走 shell 就是把一个「打开清单」做成本机命令注入。
func openFileInEditor(path string) (string, error) {
	var vscodeErr error
	if cmd, ok := vscodeCommand(path); ok {
		// 故意不 Wait：VSCode 是长命 GUI 进程，请求不该等它退出（同 openBrowser）。
		if err := cmd.Start(); err == nil {
			return editorVSCode, nil
		} else {
			vscodeErr = err
		}
	}
	cmd := systemFileOpener(path)
	if err := cmd.Start(); err != nil {
		if vscodeErr != nil {
			return "", fmt.Errorf("VSCode 启动失败（%v）；系统默认程序也没起来（%v）。可手动打开 %s", vscodeErr, err, path)
		}
		return "", fmt.Errorf("找不到 VSCode，系统默认程序也没起来（%v）。可手动打开 %s", err, path)
	}
	return editorSystem, nil
}

// vscodeCommand 找本机 VSCode 并给出「在已有窗口里打开」的命令。
// 第二个返回值是 false 表示这台机器没找到，调用方应回退默认程序。
func vscodeCommand(path string) (*exec.Cmd, bool) {
	switch runtime.GOOS {
	case "windows":
		// 🔴 不能只跑 `Code.exe -r <file>`：那是 Electron 主程序，不是 CLI 入口，
		// 进程能起来但文件不会打开（真机验过：窗口标题纹丝不动）。
		// code.cmd 干的事是：ELECTRON_RUN_AS_NODE=1 + Code.exe <cli.js> -r <file>。
		// 这里照抄这条路径，省掉 cmd.exe（后台界面会闪黑窗口）和一层参数转义。
		for _, exe := range vscodeCandidates() {
			if st, err := os.Stat(exe); err != nil || st.IsDir() {
				continue
			}
			cli, ok := vscodeCLI(filepath.Dir(exe))
			if !ok {
				continue
			}
			cmd := exec.Command(exe, cli, "-r", path)
			cmd.Env = append(os.Environ(), "ELECTRON_RUN_AS_NODE=1")
			return cmd, true
		}
		return nil, false
	case "darwin":
		if p, err := exec.LookPath("code"); err == nil {
			return exec.Command(p, "-r", path), true
		}
		// open -a 即使应用不存在也会 Start 成功，所以先确认 .app 在。
		if _, err := os.Stat("/Applications/Visual Studio Code.app"); err == nil {
			return exec.Command("open", "-a", "Visual Studio Code", path), true
		}
		return nil, false
	default:
		if p, err := exec.LookPath("code"); err == nil {
			return exec.Command(p, "-r", path), true
		}
		return nil, false
	}
}

// vscodeCandidates 覆盖 Windows 上常见的用户级 / 系统级安装，以及 PATH 里
// code.cmd 所在 bin 目录的上一级（用户级安装会把 bin 加进 PATH）。
func vscodeCandidates() []string {
	var out []string
	if d := os.Getenv("LOCALAPPDATA"); d != "" {
		out = append(out,
			filepath.Join(d, "Programs", "Microsoft VS Code", "Code.exe"),
			filepath.Join(d, "Programs", "Microsoft VS Code Insiders", "Code - Insiders.exe"),
			filepath.Join(d, "Programs", "VSCodium", "VSCodium.exe"),
		)
	}
	for _, key := range []string{"ProgramFiles", "ProgramFiles(x86)"} {
		if d := os.Getenv(key); d != "" {
			out = append(out, filepath.Join(d, "Microsoft VS Code", "Code.exe"))
		}
	}
	if p, err := exec.LookPath("code.cmd"); err == nil && strings.HasSuffix(strings.ToLower(p), ".cmd") {
		out = append(out, filepath.Join(filepath.Dir(filepath.Dir(p)), "Code.exe"))
	}
	return out
}

// vscodeCLI 找 Code.exe 同目录树里的官方 CLI 入口。
// 安装目录下的版本哈希目录会随升级变（如 a717861c07），所以用通配符而不是写死；
// VSCodium 之类没有哈希层，直接是 resources/app/out/cli.js，两条都认。
func vscodeCLI(installDir string) (string, bool) {
	for _, pattern := range []string{
		filepath.Join(installDir, "*", "resources", "app", "out", "cli.js"),
		filepath.Join(installDir, "resources", "app", "out", "cli.js"),
	} {
		matches, err := filepath.Glob(pattern)
		if err != nil {
			continue
		}
		for _, p := range matches {
			if st, err := os.Stat(p); err == nil && !st.IsDir() {
				return p, true
			}
		}
	}
	return "", false
}

func defaultFileCommand(path string) *exec.Cmd {
	switch runtime.GOOS {
	case "windows":
		// 与 background.go 里开浏览器同一条路：交给文件关联，不猜编辑器。
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", path)
	case "darwin":
		return exec.Command("open", path)
	default:
		return exec.Command("xdg-open", path)
	}
}
