package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 界面拼出来的参数必须原样落到 CLI 上，且密码只以 --password-stdin 的形式出现。
func TestBackupSubprocessArgs(t *testing.T) {
	args := []string{"deploy", "pg", "--server", "bk", "--dry-run"}
	withPw := backupSubprocessArgs(args, true)
	if got, want := strings.Join(withPw, " "), "backup deploy pg --server bk --dry-run --password-stdin"; got != want {
		t.Errorf("带密码的参数 = %q，想要 %q", got, want)
	}
	noPw := backupSubprocessArgs(args, false)
	if strings.Contains(strings.Join(noPw, " "), "password") {
		t.Errorf("没给密码时不该出现任何密码参数：%v", noPw)
	}
	if len(noPw) != len(args)+1 || noPw[0] != "backup" {
		t.Errorf("动词前缀不对：%v", noPw)
	}
	// 不能把调用方的切片改坏：下次还要拿同一份 args 跑安装。
	if strings.Join(args, " ") != "deploy pg --server bk --dry-run" {
		t.Errorf("调用方参数被改写了：%v", args)
	}
}

// 重启换身之后，当前进程的 os.Executable() 指向的 next.exe 已被改名成正式 exe。
// 不归一化的话，所有 backup 子命令都会以「找不到文件」失败。
func TestResolveBackupExe(t *testing.T) {
	dir := t.TempDir()
	formal := filepath.Join(dir, "ops.exe")
	next := filepath.Join(dir, "ops.next.exe")
	touch := func(p string) {
		t.Helper()
		if err := os.WriteFile(p, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	// 常规：正式 exe 在跑，原样用。
	touch(formal)
	if got := resolveBackupExe(formal); got != formal {
		t.Errorf("正式 exe = %q，想要 %q", got, formal)
	}
	// 换身后：next.exe 不存在了，必须落到同目录的正式 exe。
	if got := resolveBackupExe(next); got != formal {
		t.Errorf("换身后 = %q，想要 %q", got, formal)
	}
	// 换身失败 / 尚未换身：next.exe 仍在，它就是当前版本，别退回旧的。
	touch(next)
	if got := resolveBackupExe(next); got != next {
		t.Errorf("next.exe 仍在时应优先用它，得到 %q", got)
	}
	// 两个都不存在：不猜位置，原样交回 exec 去报真实错误。
	missing := filepath.Join(t.TempDir(), "ops.next.exe")
	if got := resolveBackupExe(missing); got != missing {
		t.Errorf("都不存在时应原样返回，得到 %q", got)
	}
	if got := resolveBackupExe(""); got != "" {
		t.Errorf("空路径应原样返回，得到 %q", got)
	}
}
