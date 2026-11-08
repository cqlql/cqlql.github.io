package ui

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// 界面「手动备份」：mode=once 过六道门、不收 sudo 密码、报告只报脚本结果；
// 只读计划接口纯本机下发，前端只渲染（docs/backup-once.md §3 / §2.4）。

func TestBackupOnceModesAndArgs(t *testing.T) {
	for _, m := range []BackupMode{backupOnce, backupOnceDry} {
		if _, ok := parseBackupMode(string(m)); !ok {
			t.Errorf("parseBackupMode 不认 %q", m)
		}
	}
	if !isBackupWriteMode(backupOnce) {
		t.Error("once 必须是写模式（confirm 门 + 服务端预检门）")
	}
	if isBackupWriteMode(backupOnceDry) {
		t.Error("once-dry 是只读预演，不该进写模式")
	}
	cases := []struct {
		mode BackupMode
		want string
	}{
		{backupOnce, "once pg --server bk"},
		{backupOnceDry, "once pg --server bk --dry-run"},
	}
	for _, c := range cases {
		if got := strings.Join(backupCommandArgs(c.mode, "bk", "pg"), " "); got != c.want {
			t.Errorf("%s → %q，想要 %q", c.mode, got, c.want)
		}
	}
	for _, args := range [][]string{
		backupCommandArgs(backupOnce, "bk", "all"),
		backupCommandArgs(backupOnceDry, "bk", "minio"),
	} {
		joined := strings.Join(args, " ")
		for _, bad := range []string{"--force", "--run-now", "--install-deps", "--password", "sudo"} {
			if strings.Contains(joined, bad) {
				t.Errorf("手动备份命令带了危险参数 %q：%s", bad, joined)
			}
		}
	}
}

func TestBackupOnceNeedsYesAndRejectsPassword(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	for _, body := range []string{
		`{"mode":"once","name":"bk"}`,
		`{"mode":"once","name":"bk","confirm":"YES"}`,
		`{"mode":"once","name":"bk","confirm":"yes","password":"secret"}`,
		`{"mode":"once","name":"bk","confirm":"yes","targets":["mc"]}`,
		`{"mode":"once","name":"bk","confirm":"yes","pg_major":16}`,
	} {
		if w := serveBackupRun(u, body); w.Code != http.StatusBadRequest {
			t.Errorf("%s → %d，想要 400", body, w.Code)
		}
	}
	if got := len(f.snapshot()); got != 0 {
		t.Fatalf("门禁没过却执行了 %d 次命令", got)
	}
}

func TestBackupOnceRunsDryRunThenBackup(t *testing.T) {
	f := &fakeBackupRunner{codes: []int{0, 0}}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, `{"mode":"once","name":"bk","component":"minio","confirm":"yes"}`); w.Code != http.StatusOK {
		t.Fatalf("启动任务 = %d：%s", w.Code, w.Body.String())
	}
	v := waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 2 {
		t.Fatalf("想要预检 + 备份两次调用，实得 %d：%+v", len(calls), calls)
	}
	if got := strings.Join(calls[0].args, " "); got != "once minio --server bk --dry-run" {
		t.Errorf("第一次应是服务端预检：%s", got)
	}
	if got := strings.Join(calls[1].args, " "); got != "once minio --server bk" {
		t.Errorf("第二次应是正式备份：%s", got)
	}
	for _, c := range calls {
		if c.password != "" {
			t.Errorf("手动备份不该把密码交给子进程：%q", c.password)
		}
	}
	if v.ExitCode != 0 {
		t.Errorf("退出码 = %d", v.ExitCode)
	}
	for _, want := range []string{"手动备份", "不代表定时任务正常", "所选组件的备份脚本均退出 0"} {
		if !strings.Contains(v.Log, want) {
			t.Errorf("任务日志缺少 %q：\n%s", want, v.Log)
		}
	}
	for _, bad := range []string{"备份体系正常。", "定时任务正常。"} {
		if strings.Contains(v.Log, bad) {
			t.Errorf("报告不该出现 %q", bad)
		}
	}
}

func TestBackupOnceDryIsReadOnlyAndNotAToken(t *testing.T) {
	f := &fakeBackupRunner{}
	u := backupState(t, f.run)
	if w := serveBackupRun(u, `{"mode":"once-dry","name":"bk"}`); w.Code != http.StatusOK {
		t.Fatalf("只读预演 = %d：%s", w.Code, w.Body.String())
	}
	v := waitBackupTask(t, u)
	calls := f.snapshot()
	if len(calls) != 1 || !strings.Contains(strings.Join(calls[0].args, " "), "--dry-run") {
		t.Fatalf("预演应只跑一次 --dry-run：%+v", calls)
	}
	if !strings.Contains(v.Log, "不是执行凭证") {
		t.Errorf("预演报告必须说明不是执行凭证：\n%s", v.Log)
	}
}

func oncePlanResponse(t *testing.T, u *uiState, query string) (*httptest.ResponseRecorder, oncePlanView) {
	t.Helper()
	w := serve(u, http.MethodGet, "/api/backup/once/plan?token=tok&"+query, nil)
	var body struct {
		OK   bool         `json:"ok"`
		Data oncePlanView `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("解析计划响应失败：%v / %s", err, w.Body.String())
	}
	return w, body.Data
}

func TestBackupOncePlanIsReadOnlyAndServerSide(t *testing.T) {
	u := backupState(t, func([]string, string, io.Writer) int { return 0 })
	if w := serve(u, http.MethodGet, "/api/backup/once/plan?name=bk", nil); w.Code != http.StatusUnauthorized {
		t.Errorf("不带 token 读计划 = %d，想要 401", w.Code)
	}
	if w := serve(u, http.MethodGet, "/api/backup/once/plan?token=tok&name=bk&component=../etc", nil); w.Code != http.StatusBadRequest {
		t.Errorf("越权组件 = %d，想要 400", w.Code)
	}
	w, p := oncePlanResponse(t, u, "name=bk&component=all")
	if w.Code != http.StatusOK || !p.Available || len(p.Blockers) != 0 {
		t.Fatalf("正常计划应 available=true：%+v", p)
	}
	if p.Context.CronStatus != "不采集（工具不读 crontab）" {
		t.Errorf("定时任务状态口径被改了：%q", p.Context.CronStatus)
	}
	if p.Order != "pg → minio" {
		t.Errorf("组件顺序不对：%q", p.Order)
	}
	joined := strings.Join(p.Impact, "\n") + strings.Join(p.Warnings, "\n")
	for _, want := range []string{"sha256", "find -mtime -delete", "mc mb", "--overwrite", "flock", "不代表定时任务正常", "30 分钟"} {
		if !strings.Contains(joined, want) {
			t.Errorf("计划缺少 %q", want)
		}
	}
	if len(p.Commands) != 3 || !strings.Contains(strings.Join(p.Commands, " "), "ops backup once") {
		t.Errorf("命令清单不对：%+v", p.Commands)
	}
	if _, pg := oncePlanResponse(t, u, "name=bk&component=pg"); strings.Contains(strings.Join(pg.Impact, "\n"), "mc mb") {
		t.Error("只选 pg 时影响清单不该有 MinIO 的 mc mb")
	}
}

func TestBackupOncePlanReportsBusyAndUnknownName(t *testing.T) {
	u := backupState(t, func([]string, string, io.Writer) int { return 0 })
	if !u.ensureTask().start(backupDeploy, "bk", "all", "") {
		t.Fatal("任务没抢到锁")
	}
	_, p := oncePlanResponse(t, u, "name=bk&component=all")
	if p.Available || len(p.Blockers) == 0 || !strings.Contains(strings.Join(p.Blockers, " "), "409") {
		t.Errorf("任务锁占用时应给全局阻塞：%+v", p)
	}
	_, p2 := oncePlanResponse(t, u, "name=not-in-list&component=all")
	if p2.Available || len(p2.Blockers) == 0 {
		t.Errorf("未知 name 应给全局阻塞：%+v", p2)
	}
}

func TestBuildOnceSourceOnlyWhitelistedFields(t *testing.T) {
	snap := cliEnvSnapshot{Components: []cliEnvComponent{
		{Component: "pg", Fields: []cliEnvField{
			{Key: "PG_SSH_HOST", Value: "10.0.0.5", Configured: true},
			{Key: "PG_DB_NAME", Value: "pass_up", Configured: true},
			{Key: "PG_SSH_KEY", Value: "/root/.ssh/id", Configured: true, Secret: true},
			{Key: "PG_KEY", Value: "hunter2", Configured: true}, // 不在白名单，也不许回
		}},
		{Component: "minio", Fields: []cliEnvField{
			{Key: "SRC_URL", Value: "http://user:pwd@10.0.0.6:9000/path?q=1", Configured: true},
			{Key: "SRC_BUCKETS", Value: "bucket-a bucket-b", Configured: true},
			{Key: "SRC_SECRET", Value: "top-secret", Configured: true, Secret: true},
			{Key: "DEST_URL", Value: "http://127.0.0.1:9000", Configured: true},
		}},
	}}
	v := buildOnceSource("bk", "all", snap, "12:00:00")
	if !v.Collected {
		t.Fatal("应标记为已采集")
	}
	var pgHost, pgPort, srcURL string
	for _, it := range v.PG {
		if it.Key == "PG_SSH_HOST" {
			pgHost = it.Value
		}
		if it.Key == "PG_SSH_PORT" {
			pgPort = it.Value
		}
	}
	for _, it := range v.MinIO {
		if it.Key == "SRC_URL" {
			srcURL = it.Value
		}
	}
	if pgHost != "10.0.0.5" || pgPort != "—" {
		t.Errorf("生产端主机 / 未配置字段不对：host=%q port=%q", pgHost, pgPort)
	}
	if srcURL != "http://10.0.0.6:9000" {
		t.Errorf("SRC_URL 没有去掉 userinfo / path：%q", srcURL)
	}
	body, _ := json.Marshal(v)
	for _, bad := range []string{"hunter2", "top-secret", ".ssh/id", "user:pwd", "PG_KEY", "SRC_SECRET"} {
		if strings.Contains(string(body), bad) {
			t.Errorf("来源响应泄漏了 %q：%s", bad, body)
		}
	}
	if onceEndpoint("10.0.0.6:9000") != "http://10.0.0.6:9000" {
		t.Error("不带 scheme 的地址没补成可显示形式")
	}
	if oncePlain("/root/.ssh/id") != "（已隐藏）" {
		t.Error("私钥路径没被隐藏")
	}
}

func onceSourceResponse(t *testing.T, u *uiState, query string) (*httptest.ResponseRecorder, onceSourceView) {
	t.Helper()
	w := serve(u, http.MethodGet, "/api/backup/once/source?token=tok&"+query, nil)
	var body struct {
		OK   bool           `json:"ok"`
		Data onceSourceView `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("解析来源响应失败：%v / %s", err, w.Body.String())
	}
	return w, body.Data
}

func TestBackupOnceSourceEndpoint(t *testing.T) {
	const snap = `{"components":[{"component":"pg","fields":[{"key":"PG_SSH_HOST","value":"10.0.0.5","configured":true}]}]}`
	u := backupState(t, func(_ []string, _ string, out io.Writer) int {
		_, _ = io.WriteString(out, snap)
		return 0
	})
	if w := serve(u, http.MethodGet, "/api/backup/once/source?name=bk", nil); w.Code != http.StatusUnauthorized {
		t.Errorf("不带 token = %d，想要 401", w.Code)
	}
	if w := serve(u, http.MethodGet, "/api/backup/once/source?token=tok&name=bk&component=../etc", nil); w.Code != http.StatusBadRequest {
		t.Errorf("越权组件 = %d，想要 400", w.Code)
	}
	w, v := onceSourceResponse(t, u, "name=bk&component=all")
	if w.Code != http.StatusOK || !v.Collected || len(v.PG) == 0 || len(v.MinIO) == 0 {
		t.Fatalf("正常来源应回完整快照：%+v", v)
	}
	if v.PG[0].Value != "10.0.0.5" {
		t.Errorf("生产端主机没回显：%+v", v.PG)
	}
	_, unknown := onceSourceResponse(t, u, "name=not-in-list&component=pg")
	if unknown.Collected || unknown.Error == "" {
		t.Errorf("未知 name 应回完整快照 + 原因：%+v", unknown)
	}
}

func TestBackupOnceSourceFailureIsCompleteAndRedacted(t *testing.T) {
	u := backupState(t, func(_ []string, _ string, out io.Writer) int {
		_, _ = io.WriteString(out, "ERROR: ssh 失败\nWarning: Identity file /root/.ssh/id not accessible\n")
		return 1
	})
	_, v := onceSourceResponse(t, u, "name=bk&component=all")
	if v.Collected || v.Error == "" || len(v.PG) != 0 || len(v.MinIO) != 0 {
		t.Errorf("失败应回 collected=false + 完整空数组：%+v", v)
	}
	if strings.Contains(v.Error, ".ssh/") || strings.Contains(v.Error, "Identity file") {
		t.Errorf("错误里出现私钥路径：%q", v.Error)
	}
}

func TestAppendOnceReportWording(t *testing.T) {
	cases := []struct {
		name string
		log  string
		code int
		want string
	}{
		{"locked", "level=warn 上一次备份任务仍在运行中，本次执行取消。\n", 1, "被锁挡下，本次未执行"},
		{"timeout", "ERROR: 超过 30 分钟上限，本机已停止等待\n", 1, "远端可能仍在执行"},
		{"failed", "level=error 部分桶备份失败\n", 1, "有组件未成功"},
		{"ready", "level=info 备份任务顺利完成\n", 0, "均退出 0"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			task := &backupTask{}
			task.start(backupOnce, "bk", "all", "")
			task.append(c.log)
			var buf bytes.Buffer
			appendOnceReport(&buf, task, c.code)
			got := buf.String()
			if !strings.Contains(got, c.want) {
				t.Errorf("报告缺少 %q：\n%s", c.want, got)
			}
			if !strings.Contains(got, "不代表定时任务正常") {
				t.Errorf("报告少了手动触发口径：\n%s", got)
			}
			if strings.Contains(got, "已取消") {
				t.Errorf("报告不许写「已取消」：\n%s", got)
			}
		})
	}
}
