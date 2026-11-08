package restore

// 备份恢复的红线单测：只读采集脚本、离线完整快照、两级阻塞、门禁、
// 候选路径白名单、报告措辞与脱敏。全程不连真实 SSH。

import (
	"pass-up/ops/internal/shared"
)

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeRunner struct {
	out    string
	err    error
	script string
}

func (f *fakeRunner) RunScript(_ context.Context, s string) (string, error) {
	f.script = s
	return f.out, f.err
}

func testConfig() *shared.Config {
	return &shared.Config{DeployDir: "/opt/pass-up/backup"}
}

func okMeta() string {
	return strings.Join([]string{
		"@META\tnow_epoch\t1700003600",
		"@META\tpg_root\t/data/backups/postgres",
		"@META\tpg_host\t10.0.0.9",
		"@META\tpg_port\t22",
		"@META\tpg_db\tpass_up",
		"@META\tpg_container\tpostgres",
		"@META\tpg_jobs\t4",
		"@META\tsrc_url\t10.0.0.9:9000",
		"@META\tsrc_buckets\tpassup-public passup-private",
		"@META\tdest_url\t10.0.0.4:9000",
		"@META\tdest_prefix\tpassup-backup-",
		"@META\theartbeat\t2026-11-08 03:00:12",
		"@META\tdisk_free_kb\t20971520",
		"@META\tscripts_ok\t1",
		"@META\tpg_restore_bin\t1",
	}, "\n")
}

func pgRow(id, checksum, archive string) string {
	return strings.Join([]string{
		"@CAND", "pg", id, "a.dump", "", "134217728", "11-08 03:00", "daily",
		checksum, archive, "1700000000", "—", "—",
	}, "\t")
}

func TestCollectScriptIsReadOnlyAndWhitelisted(t *testing.T) {
	script := collectScript(testConfig(), CompPG)
	for _, forbidden := range []string{"sudo", "crontab", "mc alias set", "cat ", "rm ", "mv ", "tee ", ">>", "docker"} {
		if strings.Contains(script, forbidden) {
			t.Fatalf("只读采集脚本里不该出现 %q", forbidden)
		}
	}
	for _, required := range []string{"@META", "@CAND", "sha256sum -c", "pg_restore -l", "df -Pk", "backup.env"} {
		if !strings.Contains(script, required) {
			t.Fatalf("只读采集脚本缺少 %q", required)
		}
	}
	minio := collectScript(testConfig(), CompMinio)
	if strings.Contains(minio, "mc ") || strings.Contains(minio, "SRC_KEY") || strings.Contains(minio, "DEST_SECRET") {
		t.Fatal("MinIO 只读采集不许连 MinIO / 碰凭证")
	}
	if !strings.Contains(minio, "@CAND") {
		t.Fatal("MinIO 采集要输出桶对候选")
	}
}

func TestEndpointAndSafeErrorNeverLeakSecrets(t *testing.T) {
	if got := endpoint("https://user:secret@1.2.3.4:9000/bucket/path"); got != "https://1.2.3.4:9000" {
		t.Fatalf("URL 应只留 scheme+host:port，得到 %q", got)
	}
	if got := redactLine("SRC_KEY=abcd1234 DEST_SECRET=xyz"); strings.Contains(got, "abcd1234") || strings.Contains(got, "xyz") {
		t.Fatalf("凭证赋值没有脱敏：%q", got)
	}
	if got := safeError("Identity file /home/cql/.ssh/id_rsa not accessible"); strings.Contains(got, "id_rsa") {
		t.Fatalf("私钥路径没有隐去：%q", got)
	}
}

func TestParseCollectBuildsTwoLevelBlockers(t *testing.T) {
	out := okMeta() + "\n" + strings.Join([]string{
		pgRow("daily/a.dump", "缺失", "可解析"),
		pgRow("weekly/b.dump", "通过", "不可解析"),
		pgRow("monthly/c.dump", "通过", "可解析"),
	}, "\n") + "\n@END\n"
	s := parseCollect("k4", CompPG, out)
	if !s.Collected || len(s.Candidates) != 3 {
		t.Fatalf("候选解析失败：collected=%v rows=%d", s.Collected, len(s.Candidates))
	}
	if s.Candidates[0].Selectable || !strings.Contains(strings.Join(s.Candidates[0].RowBlockers, ""), ".sha256") {
		t.Fatal("缺校验和的行必须不可选，且理由写在行上")
	}
	archiveBlocker := strings.Join(s.Candidates[1].RowBlockers, "")
	if s.Candidates[1].Selectable || !strings.Contains(archiveBlocker, "无法解析") {
		t.Fatal("归档不可解析的行必须不可选")
	}
	// 真机演练发现：备份机客户端 ≠ 正式恢复用的容器内客户端，文案必须如实说明，
	// 不能把一份实际可恢复的 dump 说成坏了。
	if !strings.Contains(archiveBlocker, "容器内的 pg_restore") || !strings.Contains(archiveBlocker, "不提供绕过开关") {
		t.Fatalf("归档阻塞要说清判的是哪一侧、并给人工复核指引：%q", archiveBlocker)
	}
	if !s.Candidates[2].Selectable {
		t.Fatal("合格恢复点应该可选")
	}
	if s.PGHost != "10.0.0.9" || s.DiskFreeKB == nil || *s.DiskFreeKB != 20971520 || s.DiskFree == NotCollected {
		t.Fatalf("META 没解析全：host=%q free=%d %q", s.PGHost, s.DiskFreeKB, s.DiskFree)
	}
	if !s.ScriptsOK || len(s.Blockers) != 0 {
		t.Fatalf("脚本齐全时不应有全局阻塞：%v", s.Blockers)
	}
	if s.CronStatus != cronStatus || !strings.Contains(s.CronNote, "crontab") {
		t.Fatal("停定时备份必须是「不采集」的口径")
	}
}

func TestCollectFailureKeepsFullSnapshot(t *testing.T) {
	r := &fakeRunner{err: errors.New("ssh 连接失败：Identity file /home/cql/.ssh/id_rsa not accessible")}
	s := Collect(context.Background(), r, testConfig(), "k4", CompPG, "cql@10.0.0.4:22")
	if s.Collected || s.Error == "" || len(s.Blockers) == 0 {
		t.Fatal("连不上要回完整快照 + blockers，不是一行报错")
	}
	if s.Candidates == nil || s.Warnings == nil || s.Blockers == nil {
		t.Fatal("完整快照的 slice 不能是 nil（前端 .map 会白屏）")
	}
	for _, dash := range []string{s.Heartbeat, s.DiskFree, s.PGHost, s.PGContainer, s.PGJobs, s.SrcURL, s.Direction} {
		if dash != NotCollected {
			t.Fatalf("没采到的值必须显示 —，得到 %q", dash)
		}
	}
	if s.DiskFreeKB != nil {
		t.Fatal("没采到的数值必须是 null，不是 0")
	}
	if strings.Contains(s.Error, "id_rsa") || strings.Contains(s.Error, ".ssh/") {
		t.Fatalf("错误里带了私钥路径：%q", s.Error)
	}
	plan := BuildPlan(s, PlanRequest{Server: "k4", Component: CompPG, CandidateID: "a.dump", CronConfirmed: true})
	if plan.Available || !strings.Contains(strings.Join(plan.Impact, ""), "collected=false") {
		t.Fatalf("离线计划要禁用执行并说清先修连接：%+v", plan)
	}
	if strings.Contains(strings.Join(plan.Impact, ""), "校验和 、归档") {
		t.Fatal("离线计划不该把空字段拼成看不懂的影响项")
	}
}

func TestCandidatePathWhitelistAndRemoteFile(t *testing.T) {
	for _, bad := range []string{"/etc/passwd", "../daily/a.dump", "a b.dump", "a.dump;rm", "a|b", ""} {
		if ValidCandidateID(bad) {
			t.Fatalf("不该放行候选 ID：%q", bad)
		}
	}
	if !ValidCandidateID("daily/pass_up_20261108_030012.dump") {
		t.Fatal("正常的相对路径应该放行")
	}
	s := parseCollect("k4", CompPG, okMeta()+"\n"+pgRow("daily/a.dump", "通过", "可解析"))
	c, _ := s.CandidateByID("daily/a.dump")
	if got, err := s.RemoteFile(c); err != nil || got != "/data/backups/postgres/daily/a.dump" {
		t.Fatalf("远端路径必须由备份根目录拼：%q %v", got, err)
	}
	bad := s
	bad.PGRoot = "../../etc"
	if _, err := bad.RemoteFile(c); err == nil {
		t.Fatal("备份根目录不安全时必须拒绝拼路径")
	}
}

func TestBuildPlanTwoLevelBlockersAndTargetFirst(t *testing.T) {
	s := parseCollect("k4", CompPG, okMeta()+"\n"+strings.Join([]string{
		pgRow("daily/a.dump", "缺失", "可解析"),
		pgRow("monthly/c.dump", "通过", "可解析"),
	}, "\n"))
	base := PlanRequest{Server: "k4", Component: CompPG, DB: DefaultTestDB, CronConfirmed: true}

	// no-checksum：选中缺校验和的行 → 行阻塞升级成全局阻塞；改选合格行要重新取计划。
	bad := BuildPlan(s, PlanRequest{Server: "k4", Component: CompPG, DB: DefaultTestDB,
		CandidateID: "daily/a.dump", CronConfirmed: true})
	if bad.Available || len(bad.RowBlockers) == 0 || !strings.Contains(strings.Join(bad.Blockers, ""), ".sha256") {
		t.Fatalf("缺校验和场景应该阻塞：%v / %v", bad.Blockers, bad.RowBlockers)
	}
	good := BuildPlan(s, PlanRequest{Server: "k4", Component: CompPG, DB: DefaultTestDB,
		CandidateID: "monthly/c.dump", CronConfirmed: true})
	if !good.Available {
		t.Fatalf("改选合格恢复点后应放行：%v", good.Blockers)
	}
	if !strings.HasPrefix(good.Target, "恢复目标：") || !strings.Contains(good.Target, "10.0.0.9") {
		t.Fatalf("计划首行必须回显恢复目标（生产端）：%q", good.Target)
	}
	if !strings.HasPrefix(good.Impact[0], "恢复目标：") {
		t.Fatal("影响清单首行必须是恢复目标回显")
	}
	_ = base

	if p := BuildPlan(s, PlanRequest{Server: "k4", Component: CompPG, DB: DefaultTestDB, CandidateID: "monthly/c.dump"}); p.Available {
		t.Fatal("未确认停定时备份（R1）必须全局阻塞")
	} else if !strings.Contains(strings.Join(p.Blockers, ""), "crontab") {
		t.Fatal("阻塞文案要说清工具不读 crontab")
	}
	if p := BuildPlan(s, PlanRequest{Server: "k4", Component: CompPG, DB: DefaultTestDB,
		CandidateID: "monthly/c.dump", CronConfirmed: true, Busy: true}); p.Available {
		t.Fatal("任务锁占用必须全局阻塞")
	}
	// blocked：磁盘不足三份 dump。
	tight := s
	lowFree := int64(1024)
	tight.DiskFreeKB = &lowFree
	if p := BuildPlan(tight, PlanRequest{Server: "k4", Component: CompPG, DB: DefaultTestDB,
		CandidateID: "monthly/c.dump", CronConfirmed: true}); p.Available ||
		!strings.Contains(strings.Join(p.Blockers, ""), "磁盘不足") {
		t.Fatalf("磁盘不足要给出明确阻塞原因：%v", p.Blockers)
	}
	offline := FailureSnapshot("k4", CompPG, "连不上")
	if p := BuildPlan(offline, PlanRequest{Server: "k4", Component: CompPG, CandidateID: "a.dump", CronConfirmed: true}); p.Available {
		t.Fatal("离线快照必须阻塞执行")
	}
}

func TestValidateGateMatrix(t *testing.T) {
	s := parseCollect("k4", CompPG, okMeta()+"\n"+pgRow("daily/a.dump", "通过", "可解析"))
	p := BuildPlan(s, PlanRequest{Server: "k4", Component: CompPG, DB: DefaultTestDB,
		CandidateID: "daily/a.dump", CronConfirmed: true})
	good := Gate{
		Component: CompPG, CandidateID: "daily/a.dump", DB: DefaultTestDB, DB2: DefaultTestDB,
		Confirm: "yes", Checks: [3]bool{true, true, true}, CronConfirmed: true,
	}
	if err := ValidateGate(good, s, p); err != nil {
		t.Fatalf("完整门禁应该放行：%v", err)
	}
	cases := []struct {
		name string
		mut  func(*Gate)
	}{
		{"缺 confirm", func(g *Gate) { g.Confirm = "" }},
		{"库名两次不一致", func(g *Gate) { g.DB2 = "restore_tes" }},
		{"库名非法", func(g *Gate) { g.DB, g.DB2 = "a;drop", "a;drop" }},
		{"任意路径", func(g *Gate) { g.CandidateID = "/etc/passwd" }},
		{"缺前置勾选", func(g *Gate) { g.Checks[1] = false }},
		{"未确认停定时备份", func(g *Gate) { g.CronConfirmed = false }},
		{"收了 sudo 密码", func(g *Gate) { g.Password = "hunter2" }},
		{"生产库未勾覆盖", func(g *Gate) { g.DB, g.DB2 = "pass_up", "pass_up" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			g := good
			tc.mut(&g)
			if err := ValidateGate(g, s, p); err == nil {
				t.Fatal("门禁应该拒绝")
			}
		})
	}
	minio := s
	minio.Component = CompMinio
	minio.Candidates = []Candidate{{ID: "passup-public", Label: "passup-backup-passup-public",
		Target: "passup-public", Selectable: true, RowBlockers: []string{}}}
	minioPlan := BuildPlan(minio, PlanRequest{Server: "k4", Component: CompMinio,
		CandidateID: "passup-public", CronConfirmed: true})
	mg := Gate{Component: CompMinio, CandidateID: "passup-public", DB: DefaultTestDB,
		DB2: DefaultTestDB, Confirm: "yes", MinioConfirm: "YES",
		Checks: [3]bool{true, true, true}, CronConfirmed: true, CoverProduction: true}
	if err := ValidateGate(mg, minio, minioPlan); err != nil {
		t.Fatalf("MinIO 完整门禁应该放行：%v", err)
	}
	mg.MinioConfirm = "yes"
	if err := ValidateGate(mg, minio, minioPlan); err == nil {
		t.Fatal("MinIO 确认串必须是字面量 YES")
	}
	mg.MinioConfirm, mg.CoverProduction = "YES", false
	if err := ValidateGate(mg, minio, minioPlan); err == nil {
		t.Fatal("MinIO 覆盖生产必须额外勾选")
	}
}

func TestParseRestoreArgsWhitelist(t *testing.T) {
	for _, bad := range []string{"--force", "--password-stdin", "--run-now", "--host", "--file", "--target"} {
		if _, err := parseRestoreArgs([]string{"run", "--server", "k4", bad, "x"}); err == nil {
			t.Fatalf("不该放行参数 %s", bad)
		}
	}
	if _, err := parseRestoreArgs([]string{"run", "--json"}); err == nil {
		t.Fatal("--json 只用于 list / plan")
	}
	if _, err := parseRestoreArgs([]string{"list", "--component", "oracle"}); err == nil {
		t.Fatal("组件白名单没生效")
	}
	o, err := parseRestoreArgs([]string{"run", "--server", "k4", "--component", "pg",
		"--candidate", "daily/a.dump", "--confirm", "yes", "--db-confirm", "restore_test",
		"--checks", "1,1,1", "--cron-confirmed"})
	if err != nil {
		t.Fatalf("合法参数被拒：%v", err)
	}
	g, err := o.gate()
	if err != nil || g.Checks != [3]bool{true, true, true} || !g.CronConfirmed {
		t.Fatalf("门禁字段没解析全：%+v %v", g, err)
	}
}

// 2026-11-08 真机演练：备份机 pg_restore 16.15 读不了归档 1.16，
// 但 `pg_restore -l ... | head` 会把失败吞成 0，预演误报「可解析」。
func TestPgRestoreDryRunScriptCatchesFailure(t *testing.T) {
	s := pgRestoreDryRunScript("/data/backups/postgres/daily/a.dump")
	if !strings.Contains(s, "|| {") || !strings.Contains(s, "exit 3") {
		t.Fatal("预演脚本必须显式捕获 pg_restore 的失败退出码")
	}
	if strings.Contains(s, "-l '/data/backups/postgres/daily/a.dump' | head") {
		t.Fatal("不许把 pg_restore -l 直接接管道（POSIX sh 无 pipefail）")
	}
	if !strings.Contains(s, "2>&1") || !strings.Contains(s, "printf '%s\\n'") {
		t.Fatal("失败时要打印 pg_restore 的真实错误输出（如 unsupported version）")
	}
}

// GNU find 的 %T@ 带小数秒：ParseInt 会失败，新鲜度会错误地显示 —。
func TestFreshnessParsesFractionalEpoch(t *testing.T) {
	row := pgRow("daily/a.dump", "通过", "可解析")
	row = strings.Replace(row, "\t1700000000\t", "\t1700000000.3018926360\t", 1)
	s := parseCollect("k4", CompPG, okMeta()+"\n"+row)
	if len(s.Candidates) != 1 || s.Candidates[0].Freshness == NotCollected {
		t.Fatalf("小数 epoch 也要算出新鲜度：%+v", s.Candidates)
	}
	if !strings.Contains(s.Candidates[0].Freshness, "小时前") {
		t.Fatalf("新鲜度算错：%q", s.Candidates[0].Freshness)
	}
}

func TestReportOnlyReportsScriptResult(t *testing.T) {
	var buf bytes.Buffer
	if code := printRestoreReport(&buf, restoreOptions{Component: CompPG, DB: DefaultTestDB}, 0); code != 0 {
		t.Fatal("脚本退出 0 时报告应返回 0")
	}
	text := buf.String()
	for _, forbidden := range []string{"恢复成功，服务正常", "服务正常，恢复成功", "备份体系正常"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("报告不许写 %q", forbidden)
		}
	}
	for _, required := range []string{"只报脚本结果", "Flyway", "crontab", "退出 0"} {
		if !strings.Contains(text, required) {
			t.Fatalf("报告缺少 %q", required)
		}
	}
	buf.Reset()
	if code := printRestoreReport(&buf, restoreOptions{Component: CompMinio}, 1); code != 1 {
		t.Fatal("失败报告应返回 1")
	}
	for _, required := range []string{"没有自动重试", "没有自动清场", "心跳", "失败桶"} {
		if !strings.Contains(buf.String(), required) {
			t.Fatalf("失败报告缺少 %q", required)
		}
	}
}
