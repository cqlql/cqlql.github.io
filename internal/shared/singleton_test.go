package shared

import (
	"runtime"
	"testing"
)

// 同一把命名互斥体不能拿两次，否则「第二次双击只指过去」会失效。
func TestAcquireSingletonOnlyOnce(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("非 Windows 不做跨进程单实例拦截（没有 .lnk 双击入口）")
	}
	const name = `Local\pass-up-ops-singleton-test`
	release, ok := AcquireSingleton(name)
	if !ok {
		t.Fatal("第一次拿互斥体应该成功")
	}
	defer release()
	if _, ok := AcquireSingleton(name); ok {
		t.Error("同一把互斥体被拿了两次：单实例会失效")
	}
}

// 不同名字互不干扰：菜单与界面是两个独立的单实例域。
func TestAcquireSingletonDifferentNames(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("非 Windows 不做跨进程单实例拦截")
	}
	r1, ok1 := AcquireSingleton(`Local\pass-up-ops-singleton-test-a`)
	if !ok1 {
		t.Fatal("第一次拿互斥体应该成功")
	}
	defer r1()
	r2, ok2 := AcquireSingleton(`Local\pass-up-ops-singleton-test-b`)
	if !ok2 {
		t.Fatal("不同名字不该互相挡住")
	}
	defer r2()
}
