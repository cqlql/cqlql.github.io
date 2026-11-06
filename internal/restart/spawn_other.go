//go:build !windows

package restart

import (
	"fmt"
	"os"
	"os/exec"
)

// Spawn 在非 Windows 上明确失败。
//
// 本仓的双击入口（启动运维.cmd / 隐藏 cmd 守护 / .lnk）只在 Windows 上有意义，
// 而重启的交接机制（DETACHED_PROCESS、正在运行的 exe 可改名）也是 Windows 特有的。
// 与其用一套没验证过的 POSIX detach 假装能用，不如如实说清：那会是另一种
// 「看起来正常」。`ops ui` 在其它平台上仍然可以前台跑、手动 Ctrl+C 重启。
func Spawn(_ string, _ []string, _ *os.File) error {
	return fmt.Errorf("界面上的「重启」只在 Windows 上可用；其它平台请 Ctrl+C 后手动 go build 再启动")
}

// Hide 在非 Windows 上不需要做任何事。
func Hide(_ *exec.Cmd) {}
