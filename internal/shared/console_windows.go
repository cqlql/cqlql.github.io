//go:build windows

package shared

import (
	"os/exec"
	"syscall"
)

// CREATE_NO_WINDOW：给控制台子程序一个「存在但看不见」的控制台。
// Go 的 syscall 包没导出这个常量，值来自 winbase.h。
const createNoWindow = 0x08000000

// HideConsole 让后台进程拉起的控制台子程序不弹黑窗口。
//
// 🔴 双击落地页走隐藏 cmd 守护；点过「重启」之后跑的是 DETACHED_PROCESS 接手进程，
// **没有控制台**。这种进程里用 exec.Command 拉起控制台子程序（ssh.exe / ops.exe /
// powershell.exe）时，Windows 会替它新建一个**可见**控制台 —— 症状就是点「检查」
// 时黑窗口一闪一闪（每台机器两次 ssh：id -u、sudo -n true），预检 / 同步 / 远端值
// 对照（ops.exe 子进程）同理。
//
// 口径与隐藏守护、restart.Hide 一致：CREATE_NO_WINDOW + SW_HIDE。只改窗口可见性，
// 不动命令行参数、stdin/stdout 管道与退出码；非 Windows 上是空实现。
func HideConsole(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: createNoWindow,
	}
}
