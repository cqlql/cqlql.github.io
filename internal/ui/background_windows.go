//go:build windows

package ui

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// createNoWindow 给子进程一个**看不见的**控制台。
//
// 关键在「看不见」而不是「没有」：cmd.exe 与它随后拉起的 ops ui 都要能写
// stdout（我们把它接到日志上），CREATE_NO_WINDOW 正好是这个形状——
// 有控制台、没窗口。
const createNoWindow = 0x08000000

// spawnBackgroundGuard 用一条隐藏的 cmd 重新执行启动器（带 --bg），随即返回。
//
// 为什么绕回 .cmd 而不是让 Go 自己当守护：守护要能重建 / 替换 ops.exe，
// 而 Windows 不允许覆盖一个正在运行的 exe——Go 自己当守护等于把自己锁死。
// cmd 不持有那个句柄。父进程退得越快，双击后那个黑窗口闪得越短。
func spawnBackgroundGuard(launcher string, args []string, logPath string) error {
	if _, err := os.Stat(launcher); err != nil {
		return fmt.Errorf("找不到启动器：%w", err)
	}
	logFile, err := openRotatedLog(logPath, uiLogLimit)
	if err != nil {
		return err
	}
	// 子进程拿到的是复制过的句柄，父进程这份可以立刻关。
	defer logFile.Close()

	// cmd.exe 的 /c 有一处老坑：整行以引号开头时它会自己剥掉首尾引号，
	// 路径带空格就散架。官方写法是 /s /c 再整体包一层引号——而这条整行
	// **必须走 CmdLine**：os/exec 默认那套 \" 转义是给普通程序用的，cmd 不认。
	line := `/s /c ""` + launcher + `" --bg`
	for _, a := range args {
		line += " " + quoteArg(a)
	}
	line += `"`

	c := exec.Command("cmd.exe")
	c.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: createNoWindow,
		CmdLine:       line,
	}
	c.Stdout = logFile
	c.Stderr = logFile
	c.Dir = filepath.Dir(launcher)
	return c.Start()
}
