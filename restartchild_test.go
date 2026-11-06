package main

import (
	"path/filepath"
	"testing"

	"pass-up/ops/internal/restart"
)

func TestParseRestartChildArgs(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "ops.exe")
	next := filepath.Join(dir, "ops.next.exe")
	got, err := parseRestartChildArgs([]string{"127.0.0.1:7789", target, next})
	if err != nil {
		t.Fatal(err)
	}
	if got.Addr != "127.0.0.1:7789" || got.Port != "7789" || got.NewExe != next || got.TargetExe != target {
		t.Fatalf("解析结果不对：%+v", got)
	}
}

func TestParseRestartChildArgsDashMeansNoRebuild(t *testing.T) {
	got, err := parseRestartChildArgs([]string{"127.0.0.1:7788", "ops.exe", "-"})
	if err != nil || got.NewExe != "" {
		t.Fatalf(`"-" 必须表示「不换二进制」：%+v %v`, got, err)
	}
}

func TestParseRestartChildArgsRejectsBadInput(t *testing.T) {
	cases := [][]string{
		{},
		{"127.0.0.1:7788", "ops.exe"},
		{"not-an-addr", "ops.exe", "-"},
		{"127.0.0.1:abc", "ops.exe", "-"},
		{"127.0.0.1:70000", "ops.exe", "-"},
		{"127.0.0.1:7788", "", "-"},
	}
	for i, args := range cases {
		if _, err := parseRestartChildArgs(args); err == nil {
			t.Fatalf("第 %d 组参数不该被接受：%v", i, args)
		}
	}
}

func TestRunRestartChildRejectsBadArgsWithoutStartingService(t *testing.T) {
	// 参数不齐只能退出，绝不能「猜一组参数」把服务起到别处。
	if code := runRestartChild([]string{"127.0.0.1:7788"}); code == 0 {
		t.Fatal("参数不齐时不能假装成功")
	}
}

func TestInternalRestartCommandsAreNotRegistered(t *testing.T) {
	// 内部子命令不进 usage / 菜单的能力探测，也不该被人手工敲。
	for _, name := range []string{restart.Subcommand, restart.TakeoverFlag} {
		if _, ok := commandHandler(name); ok {
			t.Fatalf("%s 不该出现在命令注册表里", name)
		}
	}
}
