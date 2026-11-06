package restart

import (
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestWaitPortFreeWhenFree(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	_ = ln.Close()
	if err := WaitPortFree(addr, 2*time.Second); err != nil {
		t.Fatalf("端口已经空了却报失败：%v", err)
	}
}

func TestWaitPortFreeTimesOutWhenBusy(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	err = WaitPortFree(ln.Addr().String(), 450*time.Millisecond)
	if err == nil || !strings.Contains(err.Error(), "仍占着") {
		t.Fatalf("端口被占时应超时并说清，实际：%v", err)
	}
}

func TestWaitPortFreeRefusesEmptyAddr(t *testing.T) {
	if err := WaitPortFree("", time.Second); err == nil {
		t.Fatal("没给地址却报「可以接手了」")
	}
}

func TestReplaceBinaryRefusesSamePath(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "ops.exe")
	if err := os.WriteFile(p, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	got := ReplaceBinary(p, p)
	if got.Applied || got.Error == nil || !strings.Contains(got.Error.Error(), "同一个文件") {
		t.Fatalf("同路径必须拒绝，实际：%+v", got)
	}
	if b, _ := os.ReadFile(p); string(b) != "old" {
		t.Fatal("同路径时竟然动了这个文件")
	}
}

func TestReplaceBinaryOverwritesTarget(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "ops.exe")
	next := filepath.Join(dir, "ops.next.exe")
	if err := os.WriteFile(target, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(next, []byte("new"), 0o600); err != nil {
		t.Fatal(err)
	}
	got := ReplaceBinary(next, target)
	if !got.Applied || got.Error != nil {
		t.Fatalf("换身失败：%+v", got)
	}
	if b, _ := os.ReadFile(target); string(b) != "new" {
		t.Fatal("正式 exe 没有被换成新二进制")
	}
	if _, err := os.Stat(next); err == nil {
		t.Fatal("ops.next.exe 应该已经被改名移走")
	}
}

func TestReplaceBinaryMissingSourceIsNotFatal(t *testing.T) {
	dir := t.TempDir()
	got := ReplaceBinary(filepath.Join(dir, "ops.next.exe"), filepath.Join(dir, "ops.exe"))
	// 换不上不是致命错误：调用方要继续用旧二进制起服务，但必须拿到原因。
	if got.Applied || got.Error == nil {
		t.Fatalf("缺产物时应给出可记进日志的原因，实际：%+v", got)
	}
}

func TestNormalizeExePathTurnsNextIntoFormal(t *testing.T) {
	dir := t.TempDir()
	next := filepath.Join(dir, "ops.next.exe")
	want := filepath.Join(dir, "ops.exe")
	if got := NormalizeExePath(next); got != want {
		t.Fatalf("接手进程必须记住正式 exe，实际：%s", got)
	}
	if got := NormalizeExePath(want); got != want {
		t.Fatalf("正式 exe 不该被改动，实际：%s", got)
	}
	if got := NormalizeExePath(""); got != "" {
		t.Fatal("空路径应原样返回空")
	}
}

func TestTargetExeNormalizesRunningImage(t *testing.T) {
	p, err := TargetExe()
	if err != nil {
		t.Fatal(err)
	}
	if strings.HasSuffix(strings.ToLower(p), NextExeSuffix) {
		t.Fatalf("TargetExe 不该返回 next.exe：%s", p)
	}
	if !filepath.IsAbs(p) {
		t.Fatalf("正式 exe 必须是绝对路径：%s", p)
	}
}

func TestNextExeForSitsBesideTarget(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "ops.exe")
	want := filepath.Join(dir, "ops.next.exe")
	if got := NextExeFor(target); got != want {
		t.Fatalf("重建产物路径不对：%s", got)
	}
	if got := NormalizeExePath(NextExeFor(target)); got != target {
		t.Fatalf("next → 正式 的规范化没闭环：%s", got)
	}
}

func TestTailLinesKeepsTheFailureAtTheEnd(t *testing.T) {
	in := "1\n2\n3\n4\n5\n"
	got := TailLines(in, 2)
	if !strings.Contains(got, "4\n5") || !strings.Contains(got, "省略前 3 行") {
		t.Fatalf("失败原因总在最后，必须保留末尾：%q", got)
	}
}
