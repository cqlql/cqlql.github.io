package ui

import (
	"pass-up/ops/internal/shared"
)

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMergeCompareStates(t *testing.T) {
	local := map[string]string{
		"PG_SSH_HOST":     "10.0.0.9",
		"PG_SSH_KEY":      "/home/cql/.ssh/new",
		"PG_RESTORE_JOBS": "4",
	}
	cs := cliEnvComponent{
		Component: "pg",
		Path:      "/opt/passup-backup/postgres/backup.env",
		Fields: []cliEnvField{
			{Key: "PG_SSH_HOST", Value: "127.0.0.1", Configured: true, Fingerprint: shared.EnvFingerprint("127.0.0.1")},
			{Key: "PG_SSH_KEY", Value: shared.MaskEnvValue("/root/.ssh/old"), Secret: true, Configured: true, Fingerprint: shared.EnvFingerprint("/root/.ssh/old")},
			{Key: "PG_LOCAL_RETENTION_DAYS", Value: "7", Configured: true, Fingerprint: shared.EnvFingerprint("7")},
		},
	}
	got := mergeCompare(cs, "/local/postgres.env", local)
	byKey := map[string]compareFieldView{}
	for _, f := range got.Fields {
		byKey[f.Key] = f
	}
	if byKey["PG_SSH_HOST"].State != "changed" {
		t.Errorf("非凭证不同应 changed：%+v", byKey["PG_SSH_HOST"])
	}
	if byKey["PG_SSH_KEY"].State != "changed" || !byKey["PG_SSH_KEY"].Secret {
		t.Errorf("凭证指纹不同应 changed：%+v", byKey["PG_SSH_KEY"])
	}
	if strings.Contains(byKey["PG_SSH_KEY"].Local, "/home/cql") ||
		strings.Contains(byKey["PG_SSH_KEY"].Remote, "/root/") {
		t.Error("凭证明文漏进了对比结果")
	}
	if byKey["PG_LOCAL_RETENTION_DAYS"].State != "remote-only" {
		t.Errorf("远端独有应 remote-only：%+v", byKey["PG_LOCAL_RETENTION_DAYS"])
	}
	if byKey["PG_RESTORE_JOBS"].State != "local-only" {
		t.Errorf("本机独有应 local-only：%+v", byKey["PG_RESTORE_JOBS"])
	}
}

func TestMergeCompareSecretFingerprint(t *testing.T) {
	local := map[string]string{"PG_SSH_KEY": "/x"}
	cs := cliEnvComponent{
		Component: "pg",
		Fields: []cliEnvField{
			{Key: "PG_SSH_KEY", Value: shared.MaskEnvValue("/x"), Secret: true, Configured: true, Fingerprint: shared.EnvFingerprint("/x")},
		},
	}
	got := mergeCompare(cs, "/local/postgres.env", local)
	if got.Fields[0].State != "consistent" {
		t.Fatalf("指纹相同应 consistent：%+v", got.Fields[0])
	}
}

func TestConfigCompareAPI(t *testing.T) {
	u, dir := configState(t)
	envDir := filepath.Join(dir, "backup")
	if err := os.MkdirAll(envDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(envDir, "postgres.env"),
		[]byte("PG_SSH_HOST=\"10.0.0.9\"\nPG_SSH_KEY=\"/home/cql/.ssh/new\"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	var args []string
	u.runner = func(a []string, _ string, out io.Writer) int {
		args = append([]string{}, a...)
		_, _ = io.WriteString(out, `{"components":[{"component":"pg","path":"/opt/passup-backup/postgres/backup.env","fields":[`+
			`{"key":"PG_SSH_HOST","value":"127.0.0.1","secret":false,"configured":true,"fingerprint":"`+shared.EnvFingerprint("127.0.0.1")+`"},`+
			`{"key":"PG_SSH_KEY","value":"/ro…old","secret":true,"configured":true,"fingerprint":"`+shared.EnvFingerprint("/root/.ssh/old")+`"}]}]}`)
		return 0
	}
	w := serve(u, http.MethodGet, "/api/config/compare?component=pg&name=bk&token=tok", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("compare = %d：%s", w.Code, w.Body.String())
	}
	if strings.Join(args, " ") != "compare-env pg --server bk" {
		t.Errorf("runner 参数不对：%v", args)
	}
	body := w.Body.String()
	// 非凭证值（10.0.0.9）本来就该回显给页面；只有凭证明文不能出现。
	for _, leak := range []string{"/home/cql", "/root/.ssh/old"} {
		if strings.Contains(body, leak) {
			t.Errorf("响应里漏了凭证明文 %q：%s", leak, body)
		}
	}
	var envelope struct {
		Data configCompareView `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if len(envelope.Data.Components) != 1 || len(envelope.Data.Components[0].Fields) != 2 {
		t.Fatalf("对比结果不完整：%+v", envelope.Data)
	}
	if f := envelope.Data.Components[0].Fields[0]; f.Local != "10.0.0.9" || f.State != "changed" {
		t.Errorf("非凭证字段应回显本机值并标 changed：%+v", f)
	}
	if envelope.Data.FetchedAt == "" {
		t.Error("缺 fetched_at")
	}
}

func TestConfigCompareFailures(t *testing.T) {
	u, _ := configState(t)
	u.runner = func(_ []string, _ string, out io.Writer) int {
		_, _ = io.WriteString(out, "ERROR: 远端配置不存在：/opt/passup-backup/postgres/backup.env\n")
		return 1
	}
	if got := serve(u, http.MethodGet, "/api/config/compare?component=pg&name=bk&token=tok", nil).Code; got != http.StatusOK {
		t.Errorf("抓取失败应回 200 + error：%d", got)
	}
	w := serve(u, http.MethodGet, "/api/config/compare?component=pg&name=bk&token=tok", nil)
	if !strings.Contains(w.Body.String(), `"error"`) || !strings.Contains(w.Body.String(), "远端配置不存在") {
		t.Errorf("失败原因没回给页面：%s", w.Body.String())
	}
	if got := serve(u, http.MethodGet, "/api/config/compare?component=bogus&name=bk&token=tok", nil).Code; got != http.StatusBadRequest {
		t.Errorf("未知组件应 400：%d", got)
	}
	if got := serve(u, http.MethodGet, "/api/config/compare?component=pg&name=nope&token=tok", nil).Code; got != http.StatusNotFound {
		t.Errorf("未知 name 应 404：%d", got)
	}
}
