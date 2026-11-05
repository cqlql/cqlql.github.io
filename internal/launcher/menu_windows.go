//go:build windows

package launcher

import (
	"syscall"
	"unsafe"
)

const errorAlreadyExists = 183

// acquireMenuSingleton 用命名互斥体保证菜单只开一份：第二次双击只提示「已在运行」，
// 不启第二个交互窗口。互斥体是进程持有的，进程退出后由系统自动释放。
func acquireMenuSingleton() (func(), bool) {
	name, err := syscall.UTF16PtrFromString(`Local\pass-up-ops-menu`)
	if err != nil {
		return func() {}, true
	}
	createMutex := syscall.NewLazyDLL("kernel32.dll").NewProc("CreateMutexW")
	h, _, callErr := createMutex.Call(0, 0, uintptr(unsafe.Pointer(name)))
	if h == 0 {
		return func() {}, true // 拿不到 mutex 不拦用户，菜单照常可用
	}
	if callErr == syscall.Errno(errorAlreadyExists) {
		_ = syscall.CloseHandle(syscall.Handle(h))
		return func() {}, false
	}
	return func() { _ = syscall.CloseHandle(syscall.Handle(h)) }, true
}
