package backup

import (
	"strings"
	"testing"
)

// 卸载是破坏性动作，测试重点是「只删工具装的东西」与参数门，不连 SSH。

func TestParseUninstallArgs(t *testing.T) {
	opt, err := parseUninstallArgs([]string{
		"--server", "k4", "--target", "mc", "--target=pg_client",
		"--dry-run", "--password-stdin",
	})
	if err != nil {
		t.Fatal(err)
	}
	if opt.Server != "k4" || !opt.DryRun || !opt.PasswordStdin {
		t.Errorf("选项解析不对：%+v", opt)
	}
	if strings.Join(opt.Targets, ",") != "mc,pg_client" {
		t.Errorf("targets = %v", opt.Targets)
	}
	// 重复目标去重，顺序稳定。
	opt2, err := parseUninstallArgs([]string{"--server=k4", "--target", "mc", "--target", "mc"})
	if err != nil || strings.Join(opt2.Targets, ",") != "mc" {
		t.Errorf("重复目标应去重：%+v, %v", opt2, err)
	}
	for _, args := range [][]string{
		{"--server", "k4"},                          // 没选目标
		{"--server", "k4", "--target", "docker"},    // 白名单外
		{"--server", "k4", "--target", "cron"},      // 系统基础包不许卸
		{"--server", "k4", "--target", "mc", "all"}, // 位置参数
		{"--server", "k4", "--target", "mc", "--password", "secret"},
		{"--server", "k4", "--target", "mc", "--force"},
	} {
		if _, err := parseUninstallArgs(args); err == nil {
			t.Errorf("%v 应被拒绝", args)
		}
	}
}

func TestValidUninstallTargets(t *testing.T) {
	got, err := validUninstallTargets([]string{" MC ", "pg_client", "mc"})
	if err != nil || strings.Join(got, ",") != "mc,pg_client" {
		t.Errorf("归一化/去重 = %v, %v", got, err)
	}
	if _, err := validUninstallTargets(nil); err == nil {
		t.Error("至少要选一个目标")
	}
	if _, err := validUninstallTargets([]string{"pg_restore"}); err == nil {
		t.Error("只能按包组卸载，不接受命令名")
	}
}

func TestDepsUninstallScriptBoundaries(t *testing.T) {
	mcOnly := depsUninstallScript([]string{"mc"})
	if !strings.Contains(mcOnly, "rm -f /usr/local/bin/mc") {
		t.Errorf("mc 卸载没删工具安装的文件：\n%s", mcOnly)
	}
	for _, forbidden := range []string{"rm -rf", "autoremove", "purge", "crontab", "docker", "backup.env", ".mc/", "apt-get remove"} {
		if strings.Contains(mcOnly, forbidden) {
			t.Errorf("只卸 mc 时脚本不该出现 %q：\n%s", forbidden, mcOnly)
		}
	}

	pgOnly := depsUninstallScript([]string{"pg_client"})
	for _, want := range []string{
		"dpkg-query -W", "postgresql-client*", "apt-get remove -y",
		"NEEDRESTART_MODE=l", "timeout 300",
		"postgresql-client-common", "-common)?$", // 空壳包必须一起卸
	} {
		if !strings.Contains(pgOnly, want) {
			t.Errorf("PG 客户端卸载脚本缺少 %q：\n%s", want, pgOnly)
		}
	}
	for _, forbidden := range []string{"autoremove", "purge", "rm -rf", "/usr/local/bin/mc", "crontab"} {
		if strings.Contains(pgOnly, forbidden) {
			t.Errorf("PG 客户端卸载不该出现 %q：\n%s", forbidden, pgOnly)
		}
	}

	both := depsUninstallScript([]string{"mc", "pg_client"})
	if !strings.Contains(both, "/usr/local/bin/mc") || !strings.Contains(both, "apt-get remove -y") {
		t.Error("两个目标都选时两段都要生成")
	}
}

func TestDepsUninstallPlanIsServerSide(t *testing.T) {
	p := depsUninstallPlan()
	if len(p.Targets) != 2 || p.Targets[0].Key != "mc" || p.Targets[1].Key != "pg_client" {
		t.Errorf("可卸项不对：%+v", p.Targets)
	}
	if len(p.Impacts) < 3 || p.SubmitLabel == "" {
		t.Errorf("影响清单 / 提交文案缺失：%+v", p)
	}
	// 计划随只读状态一起下发，数组不能是 nil（JSON null 会让前端 .map 白屏）。
	v := emptyDepsView("k4", "all", 0)
	if v.Uninstall.Targets == nil || v.Uninstall.Impacts == nil {
		t.Error("DepsView.uninstall 的数组必须是 []")
	}
	if !strings.Contains(strings.Join(p.Impacts, "\n"), "cron") {
		t.Error("必须写明不提供卸载系统基础包")
	}
}

func TestDepsUninstallUsage(t *testing.T) {
	u := depsUninstallUsage()
	for _, want := range []string{"deps-uninstall", "--target", "mc", "pg_client", "--dry-run"} {
		if !strings.Contains(u, want) {
			t.Errorf("用法说明缺少 %s", want)
		}
	}
}
