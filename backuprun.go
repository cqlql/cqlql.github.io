package main

// 界面上的备份部署不重写一套逻辑，而是**再起一个自己**执行同一条 CLI 命令：
//
//	ops.exe backup deploy <组件> --server <name> [--dry-run] [--password-stdin]
//
// 这么做的三个理由（判据见 docs/ui.md §9）：
//  1. `backup.CmdBackup` 的输出全是 fmt.Print* 打到 os.Stdout，网页要拿到日志就得
//     改 30 多处输出、或临时替换全局 os.Stdout —— 前者侵入太大，后者并发不安全。
//     子进程把 stdout/stderr 直接接到任务日志，隔离得最干净。
//  2. `ui` 不能 import `backup`（依赖方向只允许 main → 能力包 → shared），
//     所以由根包实现执行器、main 注入函数值给 ui。
//  3. sudo 密码经 stdin 喂给子进程，天然满足「密码不进命令行 / 不落盘 / 不进日志」，
//     也和 CLI 的 --password-stdin 是同一条路。
//
// 部署进程独立于 HTTP 请求：刷新页面、关掉标签页都不会打断已经开始的远端安装。

import (
	"pass-up/ops/internal/restart"
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"
)

// 界面不开放 --run-now / --install-deps / --force，一次部署通常几分钟内结束。
// 上限只是防止子进程卡死占着内存；超时会杀掉本机进程，但**远端可能仍在跑**，
// 所以提示里必须让人去 verify 复核，不能说「已取消」。
const backupSubprocessTimeout = 30 * time.Minute

// runBackupSubprocess 执行一条 backup 子命令，输出写进 out，返回进程退出码。
// password 非空时经 stdin 传 --password-stdin，绝不拼进参数。
func runBackupSubprocess(args []string, password string, out io.Writer) int {
	exe, err := os.Executable()
	if err != nil {
		fmt.Fprintf(out, "ERROR: 找不到当前可执行文件：%v\n", err)
		return 1
	}
	exe = resolveBackupExe(exe)
	ctx, cancel := context.WithTimeout(context.Background(), backupSubprocessTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, exe, backupSubprocessArgs(args, password != "")...)
	// 界面进程（隐藏守护 / detached 接手进程）没有控制台，ops.exe 也是控制台程序：
	// 不隐藏的话，预检 / 同步 / 远端值对照每次都会弹一个黑窗口。
	shared.HideConsole(cmd)
	cmd.Stdout = out
	cmd.Stderr = out
	if password != "" {
		cmd.Stdin = strings.NewReader(password + "\n")
	}
	err = cmd.Run()
	if ctx.Err() != nil {
		fmt.Fprintln(out, "ERROR: 超过 30 分钟上限，本机子进程已结束；远端可能仍在执行，请跑一次「远端自检」复核。")
		return 1
	}
	if err == nil {
		return 0
	}
	var ee *exec.ExitError
	if errors.As(err, &ee) {
		return ee.ExitCode()
	}
	fmt.Fprintf(out, "ERROR: 启动 backup 子进程失败：%v\n", err)
	return 1
}

// resolveBackupExe 决定子进程到底跑哪个二进制。
//
// 🔴 Windows 上 os.Executable() 返回的是**进程映像加载时**的路径。带重建的重启会让
// 接手进程「从 ops.next.exe 起来、随后被 ReplaceBinary 改名成 ops.exe」，此后它仍
// 返回那个已经不存在的 next.exe。直接用它的后果是 compare-env / deploy / verify /
// sync-env 全部以 "fork/exec ...: The system cannot find the file specified" 失败
// （2026-11-06 真机：配置页的「远端值对照」就是这样挂的）。
// 判据与 restart.TargetExe 一致：按 .next.exe 后缀归一化，但**优先用仍在的原路径** ——
// next.exe 还在时它才是当前版本，别急着退回可能更旧的正式 exe。
// 两个都不存在就原样返回，交给 exec 报出真实错误，不猜一个位置。
func resolveBackupExe(exe string) string {
	if exe == "" {
		return exe
	}
	if _, err := os.Stat(exe); err == nil {
		return exe
	}
	if normalized := restart.NormalizeExePath(exe); normalized != exe {
		if _, err := os.Stat(normalized); err == nil {
			return normalized
		}
	}
	return exe
}

// backupSubprocessArgs 把界面选好的参数原样补成 CLI 参数。
// --password-stdin 追加在末尾：deploy / verify 的参数解析都遍历全部 argv，不挑位置。
func backupSubprocessArgs(args []string, withPassword bool) []string {
	full := make([]string, 0, len(args)+2)
	full = append(full, "backup")
	full = append(full, args...)
	if withPassword {
		full = append(full, "--password-stdin")
	}
	return full
}
