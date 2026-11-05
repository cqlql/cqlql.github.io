//go:build windows

package launcher

import "pass-up/ops/internal/shared"

// acquireMenuSingleton 保证菜单只开一份：第二次双击只提示「已在运行」，
// 不启第二个交互窗口。跨进程判定下沉到 shared，与界面共用同一份实现
// （互斥体名不同，是两个独立的单实例域）。
func acquireMenuSingleton() (func(), bool) {
	return shared.AcquireSingleton(`Local\pass-up-ops-menu`)
}
