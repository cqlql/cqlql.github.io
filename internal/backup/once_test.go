package backup

import (
	"pass-up/ops/internal/shared"
)

import (
	"errors"
	"io"
	"os"
	"strings"
	"testing"
)

// 手动备份是远端写动作，测试只钉死**边界与报告口径**，不连 SSH：
// 参数门、只读检查脚本、计划文案、分组件汇总、usage。

func TestParseOnceArgs(t *testing.T) {
	opt, err := parseOnceArgs([]string{"minio", "--server", "bk", "--dry-run"})
	if err != nil {
		t.Fatal(err)
	}
	if !opt.dryRun || opt.Server != "bk" || len(opt.comps) != 1 || opt.comps[0] != compMinio {
		t.Errorf("选项解析不对：%+v", opt)
	}
	all, err := parseOnceArgs([]string{"--server=bk"})
	if err != nil || all.Server != "bk" || len(all.comps) != 2 || all.dryRun {
		t.Errorf("默认 all + --key=value：%+v, %v", all, err)
	}
	if _, err := parseOnceArgs([]string{"--help"}); !errors.Is(err, errHelp) {
		t.Errorf("--help 应返回 errHelp，实得 %v", err)
	}
	if _, err := parseOnceArgs([]string{"pg", "minio"}); err == nil {
		t.Error("只能指定一个组件")
	}
	if _, err := parseOnceArgs([]string{"../etc"}); err == nil {
		t.Error("不接受任意组件 / 路径")
	}
	for _, bad := range []string{
		"--force", "--run-now", "--install-deps", "--password-stdin", "--password",
		"--target", "--pg-major", "/etc/passwd", "-x",
	} {
		if _, err := parseOnceArgs([]string{bad}); err == nil {
			t.Errorf("手动备份不该接受 %q", bad)
		}
	}
	if _, err := parseOnceArgs([]string{"--server"}); err == nil {
		t.Error("--server 缺参数应报错")
	}
}

// 影响清单不能只剩「跑一次备份」四个字，四条红线文案也不许被删掉。
func TestOncePlanWording(t *testing.T) {
	joined := strings.Join(append(onceImpact[compPG], onceImpact[compMinio]...), "\n")
	for _, want := range []string{"sha256", "find -mtime -delete", "mc mb", "--overwrite", "last_success.txt"} {
		if !strings.Contains(joined, want) {
			t.Errorf("影响清单缺少 %q", want)
		}
	}
	warn := strings.Join(onceWarnings, "\n")
	for _, want := range []string{"不代表定时任务正常", "不读 crontab", "flock", "30 分钟", "backup.env"} {
		if !strings.Contains(warn, want) {
			t.Errorf("警告缺少 %q", want)
		}
	}
}

func TestDeployedScriptCheckIsReadOnly(t *testing.T) {
	cfg := &shared.Config{DeployDir: "/opt/passup-backup"}
	s := deployedScriptCheck(cfg, []component{compPG, compMinio})
	for _, want := range []string{
		"[ -f ", "/opt/passup-backup/preflight_check.sh",
		"/opt/passup-backup/postgres/pg_backup.sh", "/opt/passup-backup/minio/minio_backup.sh",
	} {
		if !strings.Contains(s, want) {
			t.Errorf("检查脚本缺少 %q：\n%s", want, s)
		}
	}
	for _, bad := range []string{"sudo", "rm ", "mv ", "crontab", ">>", "docker", "source "} {
		if strings.Contains(s, bad) {
			t.Errorf("只读检查脚本出现了 %q：\n%s", bad, s)
		}
	}
	if strings.Contains(deployedScriptCheck(cfg, []component{compPG}), "minio_backup.sh") {
		t.Error("只选 pg 时不应检查 minio 脚本")
	}
}

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = w
	done := make(chan string, 1)
	go func() {
		b, _ := io.ReadAll(r)
		done <- string(b)
	}()
	fn()
	_ = w.Close()
	os.Stdout = old
	return <-done
}

// 分组件汇总：pg 成功不能把 minio 的失败盖掉；报告只报脚本结果。
func TestPrintOnceReportAggregatesFailures(t *testing.T) {
	results := []backupScriptResult{
		{comp: compPG, code: 0},
		{comp: compMinio, code: 1},
	}
	var code int
	out := captureStdout(t, func() { code = printOnceReport(results) })
	if code != 1 {
		t.Errorf("任一组件失败应为 1，实得 %d", code)
	}
	for _, want := range []string{"pg", "minio", "退出码 0", "退出码 1", "不代表定时任务正常", "flock"} {
		if !strings.Contains(out, want) {
			t.Errorf("报告缺少 %q：\n%s", want, out)
		}
	}
	for _, bad := range []string{"备份体系正常", "定时任务正常。", "已取消"} {
		if strings.Contains(out, bad) {
			t.Errorf("报告不该出现 %q：\n%s", bad, out)
		}
	}
}

func TestPrintOnceReportAllSucceeded(t *testing.T) {
	var code int
	out := captureStdout(t, func() {
		code = printOnceReport([]backupScriptResult{{comp: compPG, code: 0}})
	})
	if code != 0 {
		t.Errorf("全部成功应为 0，实得 %d", code)
	}
	if !strings.Contains(out, "不代表定时任务正常") || !strings.Contains(out, "只报脚本结果") {
		t.Errorf("成功报告也要带手动触发口径：\n%s", out)
	}
}

func TestBackupUsageListsOnce(t *testing.T) {
	out := captureStdout(t, backupUsage)
	for _, want := range []string{"ops backup once", "--dry-run", "--server <name>"} {
		if !strings.Contains(out, want) {
			t.Errorf("usage 缺少 %q", want)
		}
	}
}
