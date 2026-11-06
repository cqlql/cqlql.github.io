package launcher

import (
	"pass-up/ops/internal/shared"
	"pass-up/ops/internal/ui"
)

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// 桌面快捷方式是纯本机动作：不改远端、不提权、不写注册表、不开机自启。
// .lnk 只指向仓库根的启动器，图标用与 /favicon.ico 同一份字节的 ops.ico。
const (
	// DefaultShortcutName 是桌面快捷方式的默认名字：多项目共存时必须不同，
	// 否则互相覆盖（见 docs/one-click-launch.md §6）。
	DefaultShortcutName = "PassUp · 运维"
	launcherName        = "启动运维.cmd"

	desktopDirEnv = "PASS_UP_OPS_DESKTOP_DIR"
)

// 结果模型在 shared.ShortcutInfo：界面也要回传同一份字段，而 ui 不能反向
// import launcher（launcher 已经 import ui，反过来就成环）。

var errShortcutWindowsOnly = errors.New("桌面快捷方式只对 Windows 有意义（.lnk）；" +
	"macOS / Linux 请自己建一个指向 " + launcherName + " 的启动器")

func CmdShortcut(args []string) int {
	name := DefaultShortcutName
	remove := false
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--remove":
			remove = true
		case a == "--name":
			if i+1 >= len(args) || strings.HasPrefix(args[i+1], "-") {
				fmt.Fprintln(os.Stderr, "ERROR: --name 缺少参数")
				return 2
			}
			i++
			name = args[i]
		case strings.HasPrefix(a, "--name="):
			name = strings.TrimPrefix(a, "--name=")
		case a == "-h" || a == "--help":
			shortcutUsage()
			return 0
		default:
			fmt.Fprintf(os.Stderr, "ERROR: 未知参数：%s\n", a)
			shortcutUsage()
			return 2
		}
	}

	if remove {
		path, removed, err := removeShortcutOnDesktop(name)
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
			return 1
		}
		if !removed {
			fmt.Printf("桌面上没有 %s，不用删\n", path)
			return 0
		}
		fmt.Printf("已删除 %s\n", path)
		return 0
	}

	Info, err := CreateShortcutOnDesktop(name)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	fmt.Printf("已创建桌面快捷方式：%s\n  指向：%s\n  图标：%s\n", Info.Path, Info.Launcher, Info.Icon)
	return 0
}

func shortcutUsage() {
	fmt.Print(`用法:
  ops shortcut [--name <名字>] [--remove]

在 Windows 桌面建一个指向仓库根 启动运维.cmd 的快捷方式。
--name   快捷方式名（默认 PassUp · 运维），不含 .lnk
--remove 删除；本来就不存在不算错误
非 Windows 平台明确报错，不假装创建了文件。
`)
}

// CreateShortcutOnDesktop 是唯一的创建实现：命令行（ops shortcut）与界面上的
// 「创建桌面快捷方式」都必须走这里，否则「命令行建出来能用、界面建出来指向别处」。
//
// 界面侧由 main.go 注入（ui 不能 import launcher），但实现只有这一份。
func CreateShortcutOnDesktop(name string) (shared.ShortcutInfo, error) {
	if runtime.GOOS != "windows" {
		return shared.ShortcutInfo{}, errShortcutWindowsOnly
	}
	if err := validateShortcutName(name); err != nil {
		return shared.ShortcutInfo{}, err
	}
	desktop, err := desktopDir()
	if err != nil {
		return shared.ShortcutInfo{}, err
	}
	launcher, err := launcherPath()
	if err != nil {
		return shared.ShortcutInfo{}, err
	}
	icon, err := ensureIcon()
	if err != nil {
		return shared.ShortcutInfo{}, err
	}
	lnk := filepath.Join(desktop, name+".lnk")
	if err := createShortcut(lnk, launcher, filepath.Dir(launcher), icon); err != nil {
		return shared.ShortcutInfo{}, err
	}
	return shared.ShortcutInfo{Path: lnk, Launcher: launcher, Icon: icon}, nil
}

// removeShortcutOnDesktop 返回 (路径, 是否真的删掉, 错误)：本来没有不算错。
func removeShortcutOnDesktop(name string) (string, bool, error) {
	if runtime.GOOS != "windows" {
		return "", false, errShortcutWindowsOnly
	}
	if err := validateShortcutName(name); err != nil {
		return "", false, err
	}
	desktop, err := desktopDir()
	if err != nil {
		return "", false, err
	}
	path := filepath.Join(desktop, name+".lnk")
	if err := os.Remove(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return path, false, nil
		}
		return path, false, fmt.Errorf("删除失败：%w", err)
	}
	return path, true, nil
}

// ensureIcon 写图标后补一次 Stat：ui.WriteIcon 自己吞错误（图标不该让界面起不来），
// 但快捷方式不能假装成功，否则 .lnk 会悄悄变成空白图标。
func ensureIcon() (string, error) {
	dir := shared.UserConfigDir()
	if dir == "" {
		return "", errors.New("找不到配置目录（可用 " + shared.ConfigDirEnv + " 指定）")
	}
	ui.WriteIcon(dir)
	path := filepath.Join(dir, "ops.ico")
	if _, err := os.Stat(path); err != nil {
		return "", fmt.Errorf("图标没能写到 %s：%w", path, err)
	}
	return path, nil
}

// launcherPath 从 cwd 与 exe 所在目录分别向上找启动器，两个起点都要试：
// 在仓根直接 ops.exe，或从子目录敲绝对路径，都要能找到同一个入口。
func launcherPath() (string, error) {
	var bases []string
	if wd, err := os.Getwd(); err == nil {
		bases = append(bases, wd)
	}
	if exe, err := os.Executable(); err == nil {
		bases = append(bases, filepath.Dir(exe))
	}
	for _, base := range bases {
		if p, ok := findUp(base, launcherName, 4); ok {
			return p, nil
		}
	}
	return "", fmt.Errorf("没找到 %s：请在仓库根目录下运行（快捷方式必须指向启动器，不能指向 ops.exe）", launcherName)
}

func findUp(dir, name string, levels int) (string, bool) {
	for i := 0; i <= levels; i++ {
		p := filepath.Join(dir, name)
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			if abs, aerr := filepath.Abs(p); aerr == nil {
				return abs, true
			}
			return p, true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", false
}

// desktopDir 先问系统要「真正的桌面」（OneDrive 重定向很常见），再回退。
// 覆盖变量只给验收/单测用：测试绝不写真桌面。
func desktopDir() (string, error) {
	if d := os.Getenv(desktopDirEnv); d != "" {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return "", fmt.Errorf("建不了 %s 指向的目录：%w", desktopDirEnv, err)
		}
		return d, nil
	}
	if d, err := desktopDirFromPowerShell(); err == nil && d != "" {
		return d, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("找不到桌面目录：%w", err)
	}
	cands := []string{filepath.Join(home, "Desktop")}
	if od := os.Getenv("OneDrive"); od != "" {
		cands = append(cands, filepath.Join(od, "Desktop"))
	}
	for _, cand := range cands {
		if st, serr := os.Stat(cand); serr == nil && st.IsDir() {
			return cand, nil
		}
	}
	return "", errors.New("找不到桌面目录（可用 " + desktopDirEnv + " 指定）")
}

func desktopDirFromPowerShell() (string, error) {
	// OutputEncoding 必须是 UTF-8：中文用户名下桌面路径是中文，默认 GBK 读回来是乱码。
	out, err := runPowerShell(`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Environment]::GetFolderPath('Desktop')`)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// createShortcut 用 WScript.Shell 建 .lnk：.lnk 是没公开文档的复合结构，
// 手写等于把「微软哪天改一格」变成自己的 bug，引 COM 库又会破坏零依赖。
func createShortcut(lnk, target, workdir, icon string) error {
	_, err := runPowerShell(shortcutScript(lnk, target, workdir, icon))
	return err
}

// shortcutScript 是纯函数：引号化、WindowStyle、IconLocation 都在这里定死，
// 测试直接断言文本，不用真的去点桌面。
func shortcutScript(lnk, target, workdir, icon string) string {
	return fmt.Sprintf(`$ErrorActionPreference = 'Stop'
$lnk = %s
$parent = Split-Path -Parent $lnk
if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnk)
$sc.TargetPath = %s
$sc.Arguments = ''
$sc.WorkingDirectory = %s
$sc.IconLocation = %s
$sc.Description = %s
$sc.WindowStyle = 7
$sc.Save()
`, psQuote(lnk), psQuote(target), psQuote(workdir), psQuote(icon+",0"),
		psQuote(DefaultShortcutName+"：双击打开本地运维界面"))
}

// psQuote：PowerShell 单引号字面量里只有 ' 需要转义，写成两个连续单引号。
// 少了它，用户名 O'Neil 会把脚本拼断，语法错看不出跟名字有关。
func psQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}

func runPowerShell(script string) (string, error) {
	exe := "powershell"
	if _, err := exec.LookPath(exe); err != nil {
		exe = "pwsh"
	}
	cmd := exec.Command(exe, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	var out, errOut strings.Builder
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(errOut.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("PowerShell 执行失败：%s", msg)
	}
	return out.String(), nil
}

// validateShortcutName 挡住路径穿越：name 直接拼进 lnk 路径，
// --name ..\..\evil 能把文件写到桌面外面。
func validateShortcutName(name string) error {
	if strings.TrimSpace(name) == "" {
		return errors.New("--name 不能为空")
	}
	if strings.ContainsAny(name, `\/:*?"<>|`) {
		return fmt.Errorf("--name 里有 Windows 文件名不允许的字符（\\ / : * ? \" < > |）：%q", name)
	}
	if name == "." || name == ".." {
		return fmt.Errorf("--name 不能是 %q", name)
	}
	return nil
}
