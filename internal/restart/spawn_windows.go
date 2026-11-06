//go:build windows

package restart

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// detachProcess 是 Win32 的 DETACHED_PROCESS（Go 的 syscall 包没导出这个常量）。
//
// ⚠️ 必须有它：新进程不能待在父进程那个控制台里。共享控制台的话，关掉那个窗口
// 会向所有附着进程发 CTRL_CLOSE_EVENT —— 新起来的服务会被一起关掉，症状是
// 「重启成功了，活了两秒又没了」，而那时人已经离开现场了。
const detachProcess = 0x00000008

// createNoWindow 给构建命令一个**看不见**的控制台：有控制台、没窗口。
// npm / go 都要能写 stdout（我们接进构建输出），但重启那几十秒里不该弹黑框。
const createNoWindow = 0x08000000

// Spawn 拉起「接手进程」：exe 带 argv，且**不与本进程共享控制台**。
//
// ⚠️ log 是调用方用 ui.openRotatedLog 打开的 ops-ui.log（追加写、超上限先轮转）。
// 传 nil 就按 devnull 处理：不猜路径、不假装写到了某处。
// 之所以接一个 *os.File 而不是路径，是为了与后台守护共用**同一份**轮转实现，
// 不在这里再长出一个「日志到底怎么开」的答案。
func Spawn(exe string, argv []string, log *os.File) error {
	cmd := exec.Command(exe, argv...)
	cmd.Dir = filepath.Dir(exe)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP | detachProcess,
	}
	if log != nil {
		cmd.Stdout = log
		cmd.Stderr = log
	}
	cmd.Stdin = nil
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("拉起接手进程失败：%w", err)
	}
	// 不 Wait：本进程马上就要退出，等它结束等于自己等自己。
	return cmd.Process.Release()
}

// Hide 让构建命令不弹窗口。非 Windows 上是空实现。
func Hide(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: createNoWindow,
	}
}
