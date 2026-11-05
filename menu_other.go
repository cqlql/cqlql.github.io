//go:build !windows

package main

// 非 Windows 没有 .lnk 入口，菜单也不会被双击启动，不做单实例拦截。
func acquireMenuSingleton() (func(), bool) {
	return func() {}, true
}
