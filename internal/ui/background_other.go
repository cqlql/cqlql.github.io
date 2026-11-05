//go:build !windows

package ui

import "errors"

// spawnBackgroundGuard 只在 Windows 上有意义：那边的「双击一个 .cmd 必然开
// 一个控制台窗口」是平台行为，才需要绕这么一圈。Linux/macOS 上 `ops ui &`
// 本来就不占终端——留着这个函数只为让 --background 给出一句人话，
// 而不是「未知参数」。
func spawnBackgroundGuard(launcher string, args []string, logPath string) error {
	return errors.New("--background 只给 Windows 的启动器（启动运维.cmd）用；" +
		"Linux/macOS 上直接 `ops ui &`，或交给 systemd-run")
}
