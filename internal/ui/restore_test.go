package ui

// 界面「备份恢复」的边界测试：门禁字段逐字校验、只读预演不是执行凭证、
// 服务端写动作自己跑 --dry-run、候选 / 计划接口只读且连不上也回完整快照。
// 不连真实 SSH：runner 与 restoreProbe 都注入假实现。

import (
	"pass-up/ops/internal/restore"
	"pass-up/ops/internal/shared"
)

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const restoreOKBody = `{"mode":"restore","name":"bk","component":"pg","confirm":"yes",` +
	`"restore_candidate":"daily/a.dump","restore_db":"restore_test","restore_db2":"restore_test",` +
	`"restore_checks":[true,true,true],"restore_cron_confirmed":true}`

func serveRestoreGet(u *uiState, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path+"&token=tok", nil)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	return w
}

func TestRestoreModesAndCommandArgs(t *testing.T) {
	for _, m := range []BackupMode{backupRestore, backupRestoreDry} {
		if _, ok := parseBackupMode(string(m)); !ok {
			t.Errorf("parseBackupMode 不认 %q", m)
		}
	}
	if !isBackupWriteMode(backupRestore) || isBackupWriteMode(backupRestoreDry) {
		t.Fatal("正式恢复是写模式，只读预演不是")
	}
	req := backupRunRequest{
		Mode: string(backupRestore), Name: "bk", Confirm: "yes",
		RestoreCandidate: "daily/a.dump", RestoreDB: "restore_test", RestoreDB2: "restore_test",
		RestoreCronConfirmed: true, RestoreChecks: []bool{true, true, true},
	}
	formal := strings.Join(restoreCommandArgs(backupRestore, req, "pg", "restore_test"), " ")
	for _, want := range []string{
		"restore run --server bk --component pg --candidate daily/a.dump",
		"--db restore_test --db-confirm restore_test", "--cron-confirmed",
		"--confirm yes --checks 1,1,1",
	} {
		if !strings.Contains(formal, want) {
			t.Errorf("正式恢复命令缺少 %q：%s", want, formal)
		}
	}
	for _, bad := range []string{"--force", "--password", "sudo", "..", "--dry-run"} {
		if strings.Contains(formal, bad) {
			t.Errorf("正式恢复命令带了不该有的 %q：%s", bad, formal)
		}
	}
	dry := strings.Join(restoreCommandArgs(backupRestoreDry, req, "pg", "restore_test"), " ")
	if !strings.Contains(dry, "--dry-run") || strings.Contains(dry, "--confirm") || strings.Contains(dry, "--checks") {
		t.Errorf("只读预演不该带门禁令牌：%s", dry)
	}
	minioReq := req
	minioReq.RestoreMinioConfirm = "YES"
	minio := strings.Join(restoreCommandArgs(backupRestore, minioReq, "minio", "restore_test"), " ")
	if !strings.Contains(minio, "--minio-confirm YES") {
		t.Errorf("MinIO 要把 YES 交给脚本：%s", minio)
	}
}

func TestRestoreRunGateRejectsEverythingShort(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	bodies := []string{
		`{"mode":"restore","name":"bk","component":"pg","restore_candidate":"daily/a.dump"}`, // 缺 confirm
		`{"mode":"restore","name":"bk","component":"all","confirm":"yes"}`,                   // all 不开放
		`{"mode":"restore","name":"bk","component":"pg","confirm":"yes","restore_candidate":"../../etc/passwd"}`,
		`{"mode":"restore","name":"bk","component":"pg","confirm":"yes","restore_candidate":"daily/a.dump","restore_db":"restore_test","restore_db2":"restore_tes"}`,
		`{"mode":"restore","name":"bk","component":"pg","confirm":"yes","restore_candidate":"daily/a.dump","restore_checks":[true,false,true]}`,
		`{"mode":"restore","name":"bk","component":"pg","confirm":"yes","restore_candidate":"daily/a.dump","restore_checks":[true,true,true]}`,
		`{"mode":"restore","name":"bk","component":"minio","confirm":"yes","restore_candidate":"passup-public"}`,
		`{"mode":"restore","name":"bk","component":"pg","confirm":"yes","restore_candidate":"daily/a.dump","restore_checks":[true,true,true],"restore_cron_confirmed":true,"password":"secret"}`,
		`{"mode":"restore","name":"nope","component":"pg","confirm":"yes","restore_candidate":"daily/a.dump","restore_checks":[true,true,true],"restore_cron_confirmed":true}`,
	}
	for _, body := range bodies {
		w := serveBackupRun(u, body)
		if w.Code != http.StatusBadRequest && w.Code != http.StatusNotFound {
			t.Errorf("%s → %d，想要 400/404：%s", body, w.Code, w.Body.String())
		}
	}
	if got := len(f.snapshot()); got != 0 {
		t.Fatalf("门禁没过却执行了 %d 次命令", got)
	}
}

func TestRestoreRunDoesServerSideDryRunFirst(t *testing.T) {
	f := &fakeBackupRunner{codes: []int{0, 0}}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, restoreOKBody); w.Code != http.StatusOK {
		t.Fatalf("启动任务 = %d：%s", w.Code, w.Body.String())
	}
	v := waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 2 {
		t.Fatalf("想要预检 + 恢复两次调用，实得 %d：%+v", len(calls), calls)
	}
	if first, second := strings.Join(calls[0].args, " "), strings.Join(calls[1].args, " "); !strings.HasSuffix(first, "--dry-run") || strings.Contains(second, "--dry-run") {
		t.Errorf("服务端要先自己跑 --dry-run：\n1: %s\n2: %s", first, second)
	}
	for _, c := range calls {
		if c.password != "" {
			t.Errorf("恢复不提权，密码不该交给子进程：%q", c.password)
		}
		if strings.Contains(strings.Join(c.args, " "), "--force") {
			t.Errorf("界面不开放 --force：%v", c.args)
		}
	}
	for _, want := range []string{"备份恢复", "只报脚本结果", "Flyway", "crontab"} {
		if !strings.Contains(v.Log, want) {
			t.Errorf("任务日志缺少 %q：\n%s", want, v.Log)
		}
	}
	for _, bad := range []string{"恢复成功，服务正常", "服务正常，恢复成功"} {
		if strings.Contains(v.Log, bad) {
			t.Errorf("报告不该出现 %q", bad)
		}
	}
}

func TestRestoreDryIsReadOnlyAndNotAToken(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	body := `{"mode":"restore-dry","name":"bk","component":"pg",` +
		`"restore_candidate":"daily/a.dump","restore_db":"restore_test","restore_cron_confirmed":true}`
	if w := serveBackupRun(u, body); w.Code != http.StatusOK {
		t.Fatalf("只读预演应放行：%d %s", w.Code, w.Body.String())
	}
	waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 1 {
		t.Fatalf("只读预演只跑一次，不该再跑服务端预检：%d", len(calls))
	}
	joined := strings.Join(calls[0].args, " ")
	if !strings.Contains(joined, "--dry-run") || strings.Contains(joined, "--confirm") {
		t.Errorf("预演不能带门禁令牌：%s", joined)
	}
}

func healthyRestoreSnapshot() restore.Snapshot {
	freeKB := int64(20 << 20)
	return restore.Snapshot{
		Server: "bk", Component: restore.CompPG, Collected: true, ScriptsOK: true,
		Identity: "cql@10.0.0.4:22", Host: "cql@10.0.0.4:22",
		CronStatus: "不采集（工具不读 crontab）", Heartbeat: "2026-11-08 03:00:12",
		DiskFree: "20 GB", DiskFreeKB: &freeKB,
		PGRoot: "/data/backups/postgres", PGHost: "10.0.0.9", PGPort: "22",
		PGDB: "pass_up", PGContainer: "postgres", PGJobs: "4",
		SrcURL: "10.0.0.9:9000", SrcBuckets: "passup-public",
		DestURL: "10.0.0.4:9000", DestPrefix: "passup-backup-",
		Candidates: []restore.Candidate{{
			ID: "daily/a.dump", Label: "a.dump", Size: "128 MB", SizeBytes: 128 << 20,
			Checksum: "通过", Archive: "可解析", Selectable: true, RowBlockers: []string{},
		}},
		Blockers: []string{}, Warnings: []string{},
	}
}

func TestRestoreCandidatesAndPlanAreReadOnly(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	probes := 0
	u.restoreProbe = func(_ *shared.Config, _ *shared.ServerList, name, component string) (restore.Snapshot, error) {
		probes++
		return healthyRestoreSnapshot(), nil
	}
	w := serveRestoreGet(u, "/api/restore/candidates?name=bk&component=pg")
	if w.Code != http.StatusOK {
		t.Fatalf("候选接口 = %d：%s", w.Code, w.Body.String())
	}
	var snapResp struct {
		OK   bool             `json:"ok"`
		Data restore.Snapshot `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &snapResp); err != nil {
		t.Fatal(err)
	}
	if !snapResp.Data.Collected || len(snapResp.Data.Candidates) != 1 {
		t.Fatalf("候选快照不对：%+v", snapResp.Data)
	}
	if got := len(f.snapshot()); got != 0 {
		t.Fatalf("只读接口不该触发任何任务：%d", got)
	}

	// 换选中行 / 声明状态都要重新取一次计划，服务端自己算 available。
	ready := serveRestoreGet(u, "/api/restore/plan?name=bk&component=pg&candidate=daily/a.dump&db=restore_test&cron_confirmed=1")
	var readyPlan struct {
		Data restore.Plan `json:"data"`
	}
	if err := json.Unmarshal(ready.Body.Bytes(), &readyPlan); err != nil {
		t.Fatal(err)
	}
	if !readyPlan.Data.Available || !strings.HasPrefix(readyPlan.Data.Target, "恢复目标：") {
		t.Fatalf("计划该可用且首行回显恢复目标：%+v", readyPlan.Data)
	}
	unconfirmed := serveRestoreGet(u, "/api/restore/plan?name=bk&component=pg&candidate=daily/a.dump&db=restore_test&cron_confirmed=0")
	var blockedPlan struct {
		Data restore.Plan `json:"data"`
	}
	if err := json.Unmarshal(unconfirmed.Body.Bytes(), &blockedPlan); err != nil {
		t.Fatal(err)
	}
	if blockedPlan.Data.Available {
		t.Fatal("未确认停定时备份必须全局阻塞")
	}
	if probes < 3 {
		t.Fatalf("计划要重新采集，不能拿前端缓存算：probes=%d", probes)
	}
}

func TestRestoreOfflineReturnsFullSnapshot(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	u.restoreProbe = func(_ *shared.Config, _ *shared.ServerList, name, component string) (restore.Snapshot, error) {
		return restore.FailureSnapshot(name, component, "备份机连不上"), nil
	}
	w := serveRestoreGet(u, "/api/restore/candidates?name=bk&component=pg")
	var resp struct {
		Data restore.Snapshot `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Data.Collected || resp.Data.Heartbeat != "—" || len(resp.Data.Blockers) == 0 ||
		resp.Data.Candidates == nil {
		t.Fatalf("离线要回完整快照：%+v", resp.Data)
	}
}
