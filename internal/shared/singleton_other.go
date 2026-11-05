//go:build !windows

package shared

// AcquireSingleton 在非 Windows 上不做跨进程拦截：那边没有 .lnk 双击入口，
// `ops ui &` 本来就不占终端。留着同一个签名是为了让调用方不分平台。
func AcquireSingleton(name string) (release func(), ok bool) {
	return func() {}, true
}
