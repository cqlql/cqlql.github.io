package launcher

import (
	"pass-up/ops/internal/shared"
	"pass-up/ops/internal/ui"
)

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestValidateShortcutName(t *testing.T) {
	valid := []string{"PassUp · 运维", "中文 空格·中点", "O'Neil", "ops.ico.lnk"}
	for _, name := range valid {
		if err := validateShortcutName(name); err != nil {
			t.Errorf("合法名字 %q 被拒绝：%v", name, err)
		}
	}
	invalid := []string{"", "   ", ".", "..", `a\b`, "a/b", "a:b", "a*b", "a?b", `a"b`, "a<b", "a>b", "a|b"}
	for _, name := range invalid {
		if err := validateShortcutName(name); err == nil {
			t.Errorf("非法名字 %q 竟然通过", name)
		}
	}
}

func TestPsQuote(t *testing.T) {
	if got := psQuote("O'Neil"); got != "'O''Neil'" {
		t.Fatalf("psQuote = %q", got)
	}
}

func TestFindUp(t *testing.T) {
	root := t.TempDir()
	deep := filepath.Join(root, "a", "b", "c")
	if err := os.MkdirAll(deep, 0o755); err != nil {
		t.Fatal(err)
	}
	launcher := filepath.Join(root, launcherName)
	if err := os.WriteFile(launcher, []byte("@echo off\r\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if p, ok := findUp(deep, launcherName, 4); !ok || p != launcher {
		t.Fatalf("向上 4 层没找到启动器：p=%q ok=%v", p, ok)
	}
	if _, ok := findUp(deep, launcherName, 1); ok {
		t.Fatal("层级不够却找到了启动器")
	}
	if _, ok := findUp(root, launcherName, 0); !ok {
		t.Fatal("起点就有启动器却没找到")
	}
}

func TestShortcutScriptEscaping(t *testing.T) {
	lnk := `C:\Users\O'Neil\Desktop\PassUp · 运维.lnk`
	launcher := `D:\_work\pass-up\ops\` + launcherName
	workdir := `D:\_work\pass-up\ops`
	icon := `C:\Users\O'Neil\AppData\Roaming\pass-up\ops.ico`
	s := shortcutScript(lnk, launcher, workdir, icon)

	for _, want := range []string{
		"$ErrorActionPreference = 'Stop'",
		"O''Neil",
		"Test-Path -LiteralPath",
		"TargetPath = '" + launcher + "'",
		"Arguments = ''",
		"WorkingDirectory = '" + workdir + "'",
		"IconLocation = " + psQuote(icon+",0"),
		"WindowStyle = 7",
		"$sc.Save()",
	} {
		if !strings.Contains(s, want) {
			t.Errorf("脚本里缺少 %q", want)
		}
	}
	if strings.Contains(s, "TargetPath = 'ops.exe") {
		t.Error("快捷方式直接指向了 exe")
	}
}

func TestDesktopDirOverride(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "desktop")
	t.Setenv(desktopDirEnv, dir)
	got, err := desktopDir()
	if err != nil {
		t.Fatalf("desktopDir: %v", err)
	}
	if got != dir {
		t.Fatalf("desktopDir = %q，想要 %q", got, dir)
	}
	if st, err := os.Stat(dir); err != nil || !st.IsDir() {
		t.Fatalf("覆盖目录没被建出来：%v", err)
	}
}

func TestIconSameBytes(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	path, err := ensureIcon()
	if err != nil {
		t.Fatalf("ensureIcon: %v", err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(ui.IconBytes) {
		t.Fatal("落盘的 ops.ico 与嵌入的 ui.IconBytes 不是同一份字节")
	}
	// 第二次调用不应重写或报错（只在缺失/内容不同时写）。
	if _, err := ensureIcon(); err != nil {
		t.Fatalf("第二次 ensureIcon: %v", err)
	}
}

func TestRemoveShortcutIdempotent(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("仅在 Windows 校验 .lnk 删除")
	}
	dir := t.TempDir()
	t.Setenv(desktopDirEnv, dir)
	path, removed, err := removeShortcutOnDesktop("不存在")
	if err != nil || removed {
		t.Fatalf("本来没有却报错/删了东西：path=%q removed=%v err=%v", path, removed, err)
	}
	lnk := filepath.Join(dir, "demo.lnk")
	if err := os.WriteFile(lnk, []byte("fake"), 0o644); err != nil {
		t.Fatal(err)
	}
	path, removed, err = removeShortcutOnDesktop("demo")
	if err != nil || !removed || path != lnk {
		t.Fatalf("删除失败：path=%q removed=%v err=%v", path, removed, err)
	}
}

func TestLauncherPath(t *testing.T) {
	p, err := launcherPath()
	if err != nil {
		t.Fatalf("launcherPath: %v", err)
	}
	if filepath.Base(p) != launcherName {
		t.Fatalf("找到的不是启动器：%q", p)
	}
	if st, err := os.Stat(p); err != nil || st.IsDir() {
		t.Fatalf("启动器不存在：%v", err)
	}
}

func TestShortcutUsageAndBadArgs(t *testing.T) {
	if rc := CmdShortcut([]string{"--help"}); rc != 0 {
		t.Errorf("--help 退出码 = %d", rc)
	}
	if rc := CmdShortcut([]string{"--wat"}); rc != 2 {
		t.Errorf("未知参数退出码 = %d", rc)
	}
}
