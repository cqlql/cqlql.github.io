//go:build !windows

package launcher

import "pass-up/ops/internal/shared"

// 非 Windows 没有 .lnk 入口，菜单也不会被双击启动；shared 那边明确不做拦截。
func acquireMenuSingleton() (func(), bool) {
	return shared.AcquireSingleton("pass-up-ops-menu")
}
