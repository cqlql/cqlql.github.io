//go:build windows

package shared

import (
	"syscall"
	"unsafe"
)

const errorAlreadyExists = 183

// AcquireSingleton 用 Windows 命名互斥体做**跨进程**单实例判定。
//
// 互斥体由进程持有，进程退出（哪怕被强杀）后由内核自动释放，所以不存在
// 「残留锁文件把工具锁死」这种常见毛病。ok=false 表示已有实例在跑。
//
// 拿不到句柄时不拦调用方：宁可偶尔多开一个，也不能让双击变成「点了没反应」。
func AcquireSingleton(name string) (release func(), ok bool) {
	p, err := syscall.UTF16PtrFromString(name)
	if err != nil {
		return func() {}, true
	}
	createMutex := syscall.NewLazyDLL("kernel32.dll").NewProc("CreateMutexW")
	h, _, callErr := createMutex.Call(0, 0, uintptr(unsafe.Pointer(p)))
	if h == 0 {
		return func() {}, true
	}
	if callErr == syscall.Errno(errorAlreadyExists) {
		_ = syscall.CloseHandle(syscall.Handle(h))
		return func() {}, false
	}
	return func() { _ = syscall.CloseHandle(syscall.Handle(h)) }, true
}
