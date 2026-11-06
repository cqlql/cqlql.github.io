package main

import (
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
