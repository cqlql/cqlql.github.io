package ui

import (
	"pass-up/ops/internal/shared"
)

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 配置页的测试只盯边界：凭证不回显、值转义、字段/键白名单、二次确认、
// 只认清单里的 name、备份任务在跑时 409。不真连 SSH。

func configState(t *testing.T) (*uiState, string) {
	t.Helper()
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	t.Setenv("PASS_UP_OPS_ENV", "")
	writeValidConfig(t, dir)
	u := newState(t, fakeDist(t))
	return u, dir
}

func serveConfigPost(u *uiState, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path+"?token=tok", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	return w
}

func TestQuoteEnvValue(t *testing.T) {
	cases := []struct{ in, want string }{
		{`plain`, `"plain"`},
		{`$(id)`, `"\$(id)"`},
		{"`id`", "\"\\`id\\`\""},
		{`a"b`, `"a\"b"`},
		{`C:\path\x`, `"C:\\path\\x"`},
	}
	for _, tc := range cases {
		if got := quoteEnvValue(tc.in); got != tc.want {
			t.Errorf("quoteEnvValue(%q) = %q，想要 %q", tc.in, got, tc.want)
		}
	}
}

func TestReadEnvFieldsMasksSecrets(t *testing.T) {
	p := filepath.Join(t.TempDir(), "postgres.env")
	content := strings.Join([]string{
		"# 注释要保留",
		`PG_SSH_HOST="10.0.0.9"`,
		`PG_SSH_KEY="/root/.ssh/id_passup_test"`,
		`SRC_SECRET="s3cret"`,
	}, "\n")
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	fields, existing, err := readEnvFields(p, shared.EnvDefs("pg"))
	if err != nil {
		t.Fatal(err)
	}
	if !existing["PG_SSH_HOST"] {
		t.Fatal("已有键没被识别")
	}
	byKey := map[string]envField{}
	for _, f := range fields {
		byKey[f.Key] = f
	}
	if got := byKey["PG_SSH_HOST"].Value; got != "10.0.0.9" {
		t.Errorf("非凭证值 = %q，想要 10.0.0.9", got)
	}
	for _, k := range []string{"PG_SSH_KEY", "SRC_SECRET"} {
		f := byKey[k]
		if !f.Secret || f.Value != "" || !f.Configured {
			t.Errorf("%s 没有正确脱敏：%+v", k, f)
		}
	}
	if !byKey["PG_CONTAINER_NAME"].Configured && byKey["PG_CONTAINER_NAME"].Value != "" {
		t.Error("模板里缺的键不该带值")
	}
}

// 换电脑后配置页一片「未配置」：真因不是缺默认值，而是 GET /api/config 没把
// env-schema.json 的 default 带出来。这里锁住「哪些能带、哪些必须空」。
func TestReadEnvFieldsExposesSchemaDefaults(t *testing.T) {
	p := filepath.Join(t.TempDir(), "postgres.env")
	// 只写一个已有键 + 一个文件里冒出来的未知键，其余按 schema 补齐。
	content := strings.Join([]string{
		`PG_SSH_HOST="10.0.0.9"`,
		`PG_SSH_KEY="/root/.ssh/id_passup_test"`,
		`UNKNOWN_FUTURE_KEY="keep"`,
	}, "\n")
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	fields, _, err := readEnvFields(p, shared.EnvDefs("pg"))
	if err != nil {
		t.Fatal(err)
	}
	byKey := map[string]envField{}
	for _, f := range fields {
		byKey[f.Key] = f
	}
	// 目录 / 数值 / 定时任务这类「完全可以给默认值」的键，页面要拿得到。
	for key, want := range map[string]string{
		"PG_BACKUP_ROOT":          "/data/backups/postgres",
		"PG_BACKUP_LOG_DIR":       "/var/log/pg-backup",
		"BACKUP_DISK_MOUNT":       "/data",
		"PG_LOCAL_RETENTION_DAYS": "7",
		"CRON_SCHEDULE_BACKUP":    "0 3 * * *",
		"PG_SSH_OPTS":             "-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new",
	} {
		f, ok := byKey[key]
		if !ok {
			t.Errorf("schema 里的 %s 没出现在字段列表", key)
			continue
		}
		if f.Default != want {
			t.Errorf("%s 的 default = %q，想要 %q", key, f.Default, want)
		}
		if f.Value != "" || f.Configured {
			t.Errorf("%s 只是提示默认值，不该顺手把值写进表单：%+v", key, f)
		}
	}
	// 凭证、必须人填、以及「留空即关闭」的开关一律不给默认值。
	for _, key := range []string{
		"PG_SSH_HOST", "PG_SSH_KEY", "ALERT_WEBHOOK",
	} {
		f := byKey[key]
		if f.Default != "" {
			t.Errorf("%s 不该带 default（值 %q）", key, f.Default)
		}
	}
	if byKey["UNKNOWN_FUTURE_KEY"].Default != "" {
		t.Error("文件里的未知键不该凭空得到默认值")
	}
	if got := byKey["PG_SSH_HOST"].Value; got != "10.0.0.9" {
		t.Errorf("已有键的值被改动：%q", got)
	}
	// 凭证即使被错标成有默认值，JSON 里也必须为空。
	b, err := json.Marshal(byKey["PG_SSH_KEY"])
	if err != nil {
		t.Fatal(err)
	}
	var wire map[string]any
	if err := json.Unmarshal(b, &wire); err != nil {
		t.Fatal(err)
	}
	if wire["default"] != "" || wire["value"] != "" {
		t.Errorf("凭证字段的 JSON 不该带值：%s", b)
	}
}

// MinIO 侧的凭证同样不许带默认值（schema 已强制，这里再挡一道）。
func TestReadEnvFieldsNoMinioSecretDefaults(t *testing.T) {
	fields, _, err := readEnvFields(filepath.Join(t.TempDir(), "missing.env"), shared.EnvDefs("minio"))
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range fields {
		if f.Secret && (f.Default != "" || f.Value != "") {
			t.Errorf("凭证 %s 带值：%+v", f.Key, f)
		}
	}
	if got := findEnvField(fields, "BACKUP_LOG_DIR").Default; got != "/var/log/minio-backup" {
		t.Errorf("MinIO 日志目录默认值 = %q", got)
	}
	// 空值有语义的两个开关：schema default 为空，页面不能一键填。
	for _, key := range []string{"MINIO_CONTAINER_NAME", "UPLOAD_LIMIT"} {
		if got := findEnvField(fields, key).Default; got != "" {
			t.Errorf("%s 的空值代表跳过/关闭，不该给默认值 %q", key, got)
		}
	}
}

func findEnvField(fields []envField, key string) envField {
	for _, f := range fields {
		if f.Key == key {
			return f
		}
	}
	return envField{}
}

func TestEditEnvFile(t *testing.T) {
	p := filepath.Join(t.TempDir(), "postgres.env")
	original := strings.Join([]string{
		"# 头部注释",
		`PG_SSH_HOST="127.0.0.1"`,
		`PG_SSH_USER="root"`,
		`UNKNOWN_FUTURE_KEY="keep"`,
	}, "\n")
	if err := os.WriteFile(p, []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}

	changed, err := editEnvFile(p, shared.EnvDefs("pg"), map[string]string{
		"PG_SSH_HOST":        "10.0.0.9",
		"PG_SSH_KEY":         "/root/.ssh/$(id)",
		"PG_SSH_USER":        "", // 空值 = 保持不变
		"PG_BACKUP_ROOT":     "/data/backups/postgres",
		"UNKNOWN_FUTURE_KEY": "keep",
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(changed) != 4 {
		t.Errorf("changed = %v", changed)
	}
	got, _ := os.ReadFile(p)
	s := string(got)
	for _, want := range []string{
		"# 头部注释", `PG_SSH_USER="root"`, `PG_SSH_HOST="10.0.0.9"`,
		`PG_SSH_KEY="/root/.ssh/\$(id)"`, `PG_BACKUP_ROOT="/data/backups/postgres"`,
	} {
		if !strings.Contains(s, want) {
			t.Errorf("保存后的文件缺少 %q：\n%s", want, s)
		}
	}
	if !strings.Contains(s, `\$(id)`) {
		t.Error("值里的 $() 没转义，source 时会变成命令执行")
	}
	if _, err := os.Stat(p + ".bak"); err != nil {
		t.Errorf("没有留 .bak：%v", err)
	}
}

func TestEditEnvFileRejectsBadInput(t *testing.T) {
	p := filepath.Join(t.TempDir(), "postgres.env")
	original := "PG_SSH_HOST=\"1.2.3.4\"\n"
	if err := os.WriteFile(p, []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := editEnvFile(p, shared.EnvDefs("pg"), map[string]string{"PATH": "/bin"}, nil); err == nil {
		t.Error("未知键竟然通过了")
	}
	if _, err := editEnvFile(p, shared.EnvDefs("pg"), map[string]string{"PG_SSH_HOST": "a\nb"}, nil); err == nil {
		t.Error("带换行的值竟然通过了")
	}
	// 私钥路径曾被人填成口令 12345678，页面不回显，直到远端 preflight 才发现。
	if _, err := editEnvFile(p, shared.EnvDefs("pg"), map[string]string{"PG_SSH_KEY": "12345678"}, nil); err == nil {
		t.Error("PG_SSH_KEY 填成非路径的口令竟然通过了")
	}
	got, _ := os.ReadFile(p)
	if string(got) != original {
		t.Errorf("校验失败后原文件被改了：%q", got)
	}
}

// 显式清空：凭证不回显，页面只能靠 clear 把错值清掉；空值仍表示「保持不变」。
func TestEditEnvFileClear(t *testing.T) {
	defs := shared.EnvDefs("pg")
	const original = "# 头部注释\n" +
		"PG_SSH_HOST=\"192.168.1.221\"\n" +
		"PG_SSH_KEY=\"12345678\"\n" +
		"PG_DB_NAME=\"pass_up_dev\"\n"
	newFile := func(t *testing.T) string {
		t.Helper()
		p := filepath.Join(t.TempDir(), "postgres.env")
		if err := os.WriteFile(p, []byte(original), 0o600); err != nil {
			t.Fatal(err)
		}
		return p
	}

	t.Run("清空凭证并保留其它行", func(t *testing.T) {
		p := newFile(t)
		changed, err := editEnvFile(p, defs, map[string]string{"PG_SSH_KEY": ""}, []string{"PG_SSH_KEY"})
		if err != nil {
			t.Fatal(err)
		}
		if strings.Join(changed, ",") != "PG_SSH_KEY" {
			t.Errorf("changed = %v", changed)
		}
		got, _ := os.ReadFile(p)
		want := "# 头部注释\nPG_SSH_HOST=\"192.168.1.221\"\nPG_SSH_KEY=\"\"\nPG_DB_NAME=\"pass_up_dev\"\n"
		if string(got) != want {
			t.Errorf("清空后的文件：\n%s\n想要：\n%s", got, want)
		}
		if _, err := os.Stat(p + ".bak"); err != nil {
			t.Errorf("清空没留 .bak：%v", err)
		}
	})

	t.Run("不发 clear 时空值仍保持不变", func(t *testing.T) {
		p := newFile(t)
		if _, err := editEnvFile(p, defs, map[string]string{"PG_SSH_KEY": ""}, nil); err == nil {
			t.Error("没有实际修改竟然保存成功")
		}
		if got, _ := os.ReadFile(p); string(got) != original {
			t.Errorf("原文件被改了：\n%s", got)
		}
	})

	t.Run("新值优先于清空", func(t *testing.T) {
		p := newFile(t)
		_, err := editEnvFile(p, defs,
			map[string]string{"PG_SSH_KEY": "/home/cql/.ssh/id_ed25519"},
			[]string{"PG_SSH_KEY"})
		if err != nil {
			t.Fatal(err)
		}
		if got, _ := os.ReadFile(p); !strings.Contains(string(got), `PG_SSH_KEY="/home/cql/.ssh/id_ed25519"`) {
			t.Errorf("新值没写进去：\n%s", got)
		}
	})

	t.Run("未知键与文件里不存在的键", func(t *testing.T) {
		p := newFile(t)
		if _, err := editEnvFile(p, defs, nil, []string{"PATH"}); err == nil {
			t.Error("clear 里的未知键竟然通过了")
		}
		if _, err := editEnvFile(p, defs, nil, []string{"CRON_SCHEDULE_BACKUP"}); err == nil {
			t.Error("清空文件里没有的键不应该产生一次写入")
		}
		if got, _ := os.ReadFile(p); string(got) != original {
			t.Errorf("校验失败后原文件被改了：\n%s", got)
		}
	})
}

func TestEditServersFileKeepsUnknownFieldsAndValidates(t *testing.T) {
	p := filepath.Join(t.TempDir(), "servers.json")
	original := `{"default":"bk","servers":[{"name":"bk","role":"backup","host":"10.0.0.1","user":"ubuntu","future_field":"keep"}]}`
	if err := os.WriteFile(p, []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}
	res, err := editServersFile(p, "bk", map[string]string{"user": "cql", "sudo_mode": "nopasswd"})
	if err != nil {
		t.Fatal(err)
	}
	if !res.UserChanged || !res.NeedsSudoReapply {
		t.Errorf("改了 user 没提示重配 sudo：%+v", res)
	}
	got, _ := os.ReadFile(p)
	if !strings.Contains(string(got), `"future_field": "keep"`) {
		t.Errorf("未知字段被丢了：%s", got)
	}
	if !strings.Contains(string(got), `"user": "cql"`) {
		t.Errorf("user 没改：%s", got)
	}
	if _, err := os.Stat(p + ".bak"); err != nil {
		t.Errorf("没有留 .bak：%v", err)
	}

	before, _ := os.ReadFile(p)
	if _, err := editServersFile(p, "bk", map[string]string{"sudo_mode": "bogus"}); err == nil {
		t.Error("非法 sudo.mode 竟然通过了")
	}
	after, _ := os.ReadFile(p)
	if string(before) != string(after) {
		t.Error("校验失败后清单被改了")
	}
}

func TestConfigAPIViewAndConfirmGate(t *testing.T) {
	u, dir := configState(t)
	envDir := filepath.Join(dir, "backup")
	if err := os.MkdirAll(envDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(envDir, "postgres.env"),
		[]byte("PG_SSH_HOST=\"1.2.3.4\"\nPG_SSH_KEY=\"/root/.ssh/secret\"\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	w := serve(u, http.MethodGet, "/api/config?token=tok", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/config = %d：%s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "/root/.ssh/secret") {
		t.Fatal("配置视图把私钥路径回显出来了")
	}
	if !strings.Contains(w.Body.String(), "exec_chain") {
		t.Error("没返回执行身份链")
	}
	var envelope struct {
		Data configView `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if len(envelope.Data.Servers) != 1 || len(envelope.Data.Envs) != 2 {
		t.Errorf("视图内容不对：%+v", envelope.Data)
	}

	if got := serveConfigPost(u, "/api/config/servers",
		`{"name":"bk","fields":{"note":"x"}}`).Code; got != http.StatusBadRequest {
		t.Errorf("没输 yes 竟然放行：%d", got)
	}
	if got := serveConfigPost(u, "/api/config/servers",
		`{"name":"nope","confirm":"yes","fields":{"note":"x"}}`).Code; got != http.StatusNotFound {
		t.Errorf("未知 name 竟然放行：%d", got)
	}
	if got := serveConfigPost(u, "/api/config/servers",
		`{"name":"bk","confirm":"yes","fields":{"note":"hello"}}`).Code; got != http.StatusOK {
		t.Errorf("正常保存失败：%d", got)
	}
}

// 🔴 配置不全时「配置」页必须能打开：那一页正是用来把配置补齐的。
// 503 会把人拦在门外，只能回头去手敲命令，与「省事」正相反。
func TestConfigViewWorksWithoutConfig(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	t.Setenv("PASS_UP_OPS_ENV", "")
	u := newState(t, fakeDist(t))

	w := serve(u, http.MethodGet, "/api/config?token=tok", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("配置缺失时 GET /api/config = %d：%s", w.Code, w.Body.String())
	}
	var envelope struct {
		Data configView `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	v := envelope.Data
	if v.SetupError == "" {
		t.Error("没把「还差什么配置」带回页面")
	}
	if len(v.Servers) != 0 {
		t.Errorf("清单读不出来时应回空数组，实得 %+v", v.Servers)
	}
	if len(v.Envs) != 2 {
		t.Errorf("两份备份配置仍应可编辑，实得 %d 份", len(v.Envs))
	}
	if !strings.Contains(v.ServersFile, "servers.json") {
		t.Errorf("没给出清单路径：%q", v.ServersFile)
	}
}

// 配置不全时也能把备份配置写进默认路径（不必先手工建 ops.env）。
func TestConfigEnvSaveWorksWithoutConfig(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	t.Setenv("PASS_UP_OPS_ENV", "")
	u := newState(t, fakeDist(t))

	w := serveConfigPost(u, "/api/config/backup-env",
		`{"component":"pg","confirm":"yes","fields":{"PG_SSH_HOST":"10.0.0.9"}}`)
	if w.Code != http.StatusOK {
		t.Fatalf("配置缺失时保存 env = %d：%s", w.Code, w.Body.String())
	}
	raw, err := os.ReadFile(filepath.Join(dir, "backup", "postgres.env"))
	if err != nil {
		t.Fatalf("没写出默认路径下的 postgres.env：%v", err)
	}
	if !strings.Contains(string(raw), `PG_SSH_HOST="10.0.0.9"`) {
		t.Errorf("写出的内容不对：%s", raw)
	}
}

// 界面清空凭证：clear 走 HTTP 契约，仍要 confirm=yes，且只写本机文件。
func TestConfigEnvClearViaAPI(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	t.Setenv("PASS_UP_OPS_ENV", "")
	u := newState(t, fakeDist(t))
	p := filepath.Join(dir, "backup", "postgres.env")
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		t.Fatal(err)
	}
	const original = "PG_SSH_KEY=\"12345678\"\n"
	if err := os.WriteFile(p, []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}

	if got := serveConfigPost(u, "/api/config/backup-env",
		`{"component":"pg","confirm":"no","clear":["PG_SSH_KEY"]}`).Code; got != http.StatusBadRequest {
		t.Errorf("没确认就清空 = %d，想要 400", got)
	}
	if w := serveConfigPost(u, "/api/config/backup-env",
		`{"component":"pg","confirm":"yes","clear":["PG_SSH_KEY"]}`); w.Code != http.StatusOK {
		t.Fatalf("清空 = %d：%s", w.Code, w.Body.String())
	}
	raw, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != "PG_SSH_KEY=\"\"\n" {
		t.Errorf("清空结果不对：%q", raw)
	}
}

// ---- 新增服务器：空清单 / 文件不存在时也能在界面里把第一台写进去 ----

func TestAddServerIntoEmptyList(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	t.Setenv("PASS_UP_OPS_ENV", "")
	p := filepath.Join(dir, "servers.json")
	if err := os.WriteFile(p, []byte("{\"default\":\"\",\"servers\":[]}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	u := newState(t, fakeDist(t))

	// mode=add 也要过 confirm=yes 这道门。
	if got := serveConfigPost(u, "/api/config/servers",
		`{"mode":"add","fields":{"name":"bk","host":"10.0.0.1","user":"ubuntu"}}`).Code; got != http.StatusBadRequest {
		t.Fatalf("没输 yes 竟然放行：%d", got)
	}
	w := serveConfigPost(u, "/api/config/servers",
		`{"mode":"add","confirm":"yes","fields":{"name":"bk","host":"10.0.0.1","user":"ubuntu","role":"backup"}}`)
	if w.Code != http.StatusOK {
		t.Fatalf("新增失败：%d %s", w.Code, w.Body.String())
	}
	// 保存完落地页立刻就能读到，不用重启界面。
	got := serve(u, http.MethodGet, "/api/servers?token=tok", nil)
	if got.Code != http.StatusOK || !strings.Contains(got.Body.String(), `"name":"bk"`) {
		t.Fatalf("保存后 /api/servers 没拿到新服务器：%d %s", got.Code, got.Body.String())
	}
	// 同名不许再加一次，且原文件没被改坏。
	if got := serveConfigPost(u, "/api/config/servers",
		`{"mode":"add","confirm":"yes","fields":{"name":"bk","host":"10.0.0.2","user":"ubuntu"}}`).Code; got != http.StatusBadRequest {
		t.Fatalf("重名竟然放行：%d", got)
	}
	raw, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(string(raw), `"name": "bk"`) != 1 {
		t.Errorf("清单被写坏了：%s", raw)
	}
	if _, err := os.Stat(p + ".bak"); err != nil {
		t.Errorf("没有留 .bak：%v", err)
	}
}

func TestAddServerCreatesMissingList(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	t.Setenv("PASS_UP_OPS_ENV", "")
	u := newState(t, fakeDist(t))

	w := serveConfigPost(u, "/api/config/servers",
		`{"mode":"add","confirm":"yes","fields":{"name":"bk","host":"10.0.0.1","user":"ubuntu"}}`)
	if w.Code != http.StatusOK {
		t.Fatalf("清单不存在时新增失败：%d %s", w.Code, w.Body.String())
	}
	raw, err := os.ReadFile(filepath.Join(dir, "servers.json"))
	if err != nil {
		t.Fatalf("没写出 servers.json：%v", err)
	}
	for _, want := range []string{`"name": "bk"`, `"port": 22`, `"mode": "nopasswd"`} {
		if !strings.Contains(string(raw), want) {
			t.Errorf("新清单缺少 %q：%s", want, raw)
		}
	}
}

func TestAddServerRejectsBadFields(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	t.Setenv("PASS_UP_OPS_ENV", "")
	p := filepath.Join(dir, "servers.json")
	original := "{\"default\":\"\",\"servers\":[]}\n"
	if err := os.WriteFile(p, []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}
	u := newState(t, fakeDist(t))

	for _, body := range []string{
		`{"mode":"add","confirm":"yes","fields":{"host":"10.0.0.1"}}`,                             // 没填 name
		`{"mode":"add","confirm":"yes","fields":{"name":"bk","evil":"x"}}`,                        // 不在白名单
		`{"mode":"add","confirm":"yes","fields":{"name":"bk","host":"bad host","user":"ubuntu"}}`, // 全量校验不过
		`{"mode":"bogus","confirm":"yes","fields":{"name":"bk"}}`,                                 // 未知模式
	} {
		if got := serveConfigPost(u, "/api/config/servers", body).Code; got != http.StatusBadRequest {
			t.Errorf("非法请求竟然放行（%s）：%d", body, got)
		}
	}
	got, _ := os.ReadFile(p)
	if string(got) != original {
		t.Errorf("校验失败后清单被改了：%s", got)
	}
}

func TestConfigAPIBusyAndSync(t *testing.T) {
	u, dir := configState(t)
	envDir := filepath.Join(dir, "backup")
	if err := os.MkdirAll(envDir, 0o700); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{"postgres.env", "minio.env"} {
		if err := os.WriteFile(filepath.Join(envDir, f), []byte("PG_SSH_HOST=\"1.2.3.4\"\n"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	var args []string
	u.runner = func(a []string, _ string, _ io.Writer) int {
		args = append([]string{}, a...)
		return 0
	}

	w := serveConfigPost(u, "/api/config/sync-env",
		`{"name":"bk","component":"pg","confirm":"yes"}`)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"synced":true`) {
		t.Fatalf("同步失败：%d %s", w.Code, w.Body.String())
	}
	if strings.Join(args, " ") != "sync-env pg --server bk" {
		t.Errorf("runner 参数不对：%v", args)
	}

	// 备份任务在跑时，改配置与同步都必须 409。
	task := u.ensureTask()
	task.mu.Lock()
	task.running = true
	task.mu.Unlock()
	if got := serveConfigPost(u, "/api/config/backup-env",
		`{"component":"pg","confirm":"yes","fields":{"PG_SSH_HOST":"9.9.9.9"}}`).Code; got != http.StatusConflict {
		t.Errorf("任务在跑时改配置 = %d，想要 409", got)
	}
	if got := serveConfigPost(u, "/api/config/sync-env",
		`{"name":"bk","component":"pg","confirm":"yes"}`).Code; got != http.StatusConflict {
		t.Errorf("任务在跑时同步 = %d，想要 409", got)
	}
	task.mu.Lock()
	task.running = false
	task.mu.Unlock()

	// 同步命令失败是业务结果：信封必须仍是 ok=true，否则前端会把带日志的
	// 响应丢成 ApiError，页面只剩一句 "HTTP 200 OK"。
	u.runner = func(_ []string, _ string, out io.Writer) int {
		_, _ = io.WriteString(out, "ssh: connect to host 127.0.0.1 port 1: Connection refused\n")
		return 1
	}
	failed := serveConfigPost(u, "/api/config/sync-env",
		`{"name":"bk","component":"pg","confirm":"yes"}`)
	if failed.Code != http.StatusOK ||
		!strings.Contains(failed.Body.String(), `"ok":true`) ||
		!strings.Contains(failed.Body.String(), `"synced":false`) ||
		!strings.Contains(failed.Body.String(), "Connection refused") {
		t.Fatalf("同步失败的响应没带日志：%d %s", failed.Code, failed.Body.String())
	}

	// 占位符配置不许推到远端。
	if err := os.WriteFile(filepath.Join(envDir, "postgres.env"),
		[]byte("PG_SSH_HOST=\"CHANGE_ME\"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := serveConfigPost(u, "/api/config/sync-env",
		`{"name":"bk","component":"pg","confirm":"yes"}`).Code; got != http.StatusBadRequest {
		t.Errorf("占位符配置竟然被放行：%d", got)
	}
}
