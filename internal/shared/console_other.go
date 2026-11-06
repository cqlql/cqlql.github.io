//go:build !windows

package shared

import "os/exec"

// HideConsole 在非 Windows 上不需要做任何事（没有「控制台窗口」这回事）。
// 保留同名函数是为了让 shared/backuprun/launcher 的调用点不必写 build tag。
func HideConsole(_ *exec.Cmd) {}
