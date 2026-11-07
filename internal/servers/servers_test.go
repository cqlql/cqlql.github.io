package servers

import (
	"pass-up/ops/internal/shared"
)

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeServersFile(t *testing.T, body string) *shared.Config {
	t.Helper()
	dir := t.TempDir()
	p := filepath.Join(dir, "servers.json")
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	return &shared.Config{ServersFile: p, DeployDir: "/opt/passup-backup"}
}

func TestLoadServersValid(t *testing.T) {
	key := filepath.Join(t.TempDir(), "id_ed25519")
	if err := os.WriteFile(key, []byte("key"), 0o600); err != nil {
		t.Fatal(err)
	}
	keyJSON, _ := filepath.Abs(key)
	body := `{
	  "default": "backup-01",
	  "servers": [
	    {"name":"backup-01","role":"backup","host":"172.16.0.222","port":2223,
	     "user":"cql","key":"` + filepath.ToSlash(keyJSON) + `",
	     "sudo":{"mode":"nopasswd","password":"123123"},
	     "monitor":{"user":"passup-ro"},"note":"测试机"},
	    {"name":"app-01","role":"app","host":"10.0.0.21","user":"deploy"}
	  ]
	}`
	cfg := writeServersFile(t, body)
	list, err := shared.LoadServers(cfg)
	if err != nil {
		t.Fatalf("loadServers: %v", err)
	}
	if list.Default != "backup-01" {
		t.Errorf("default = %q", list.Default)
	}
	app := list.Servers[1]
	if app.Port != 22 {
		t.Errorf("缺省 port 应为 22，得到 %d", app.Port)
	}
	if app.Sudo.Mode != shared.SudoModeNopasswd {
		t.Errorf("缺省 sudo.mode 应为 nopasswd，得到 %q", app.Sudo.Mode)
	}
	if !filepath.IsAbs(list.Servers[0].Key) {
		t.Errorf("key 应展开为绝对路径")
	}
	// 2026-11-08 起单账号：采集就用 user/key，不带 sudo 密码（脚本只读、不提权）。
	// 上面 JSON 里特意留着历史 "monitor" 字段：反序列化忽略，不影响加载。
	st := list.Servers[0].StatusSSHTarget()
	if st.User != "cql" || !filepath.IsAbs(st.Key) || st.SudoPassword != "" {
		t.Errorf("status target 不对：%+v", st)
	}
}

// 单账号：status 与安装共用清单的 user/key；采集不提权、不带 sudo 密码。
// 旧清单里残留的 monitor 对象只是历史数据，不生效也不影响加载。
func TestStatusSSHTargetUsesSingleAccount(t *testing.T) {
	key := filepath.Join(t.TempDir(), "id_ed25519")
	if err := os.WriteFile(key, []byte("key"), 0o600); err != nil {
		t.Fatal(err)
	}
	keyJSON := filepath.ToSlash(key)
	body := `{"servers":[{"name":"b","role":"backup","host":"h","port":2223,
	  "user":"cql","key":"` + keyJSON + `",
	  "sudo":{"mode":"nopasswd","password":"admin-pw"},
	  "monitor":{"user":"passup-ro","key":"` + keyJSON + `"}}]}`
	list, err := shared.LoadServers(writeServersFile(t, body))
	if err != nil {
		t.Fatalf("历史 monitor 字段不该影响加载：%v", err)
	}
	target := list.Servers[0].StatusSSHTarget()
	if target.User != "cql" || target.Host != "h" || target.Port != 2223 {
		t.Errorf("target 没用清单里的账号 / 主机：%+v", target)
	}
	if !filepath.IsAbs(target.Key) || target.SudoPassword != "" {
		t.Errorf("采集要复用私钥，但不许带 sudo 密码：%+v", target)
	}

	// root 登录同样能采集：只读由远端脚本保证，不再按账号身份拒绝。
	rootList, err := shared.LoadServers(writeServersFile(t,
		`{"servers":[{"name":"r","role":"backup","host":"h","user":"root","sudo":{"mode":"root"}}]}`))
	if err != nil {
		t.Fatalf("root 清单应能加载：%v", err)
	}
	rootTarget := rootList.Servers[0].StatusSSHTarget()
	if rootTarget.User != "root" || rootTarget.SudoPassword != "" {
		t.Errorf("root 登录的采集 target 不对：%+v", rootTarget)
	}
}

func TestLoadServersValidation(t *testing.T) {
	key := filepath.Join(t.TempDir(), "id_ed25519")
	os.WriteFile(key, []byte("key"), 0o600)

	cases := []struct{ name, body string }{
		{"empty", `{"servers":[]}`},
		{"no name", `{"servers":[{"role":"backup","host":"h","user":"u"}]}`},
		{"bad name", `{"servers":[{"name":"a b","role":"backup","host":"h","user":"u"}]}`},
		{"duplicate", `{"servers":[
			{"name":"a","role":"backup","host":"h","user":"u"},
			{"name":"a","role":"app","host":"h2","user":"u"}]}`},
		{"no role", `{"servers":[{"name":"a","host":"h","user":"u"}]}`},
		{"bad role", `{"servers":[{"name":"a","role":"web","host":"h","user":"u"}]}`},
		{"no host", `{"servers":[{"name":"a","role":"backup","user":"u"}]}`},
		{"host dash", `{"servers":[{"name":"a","role":"backup","host":"-h","user":"u"}]}`},
		{"no user", `{"servers":[{"name":"a","role":"backup","host":"h"}]}`},
		{"bad user", `{"servers":[{"name":"a","role":"backup","host":"h","user":"root;rm"}]}`},
		{"bad port", `{"servers":[{"name":"a","role":"backup","host":"h","port":70000,"user":"u"}]}`},
		{"bad sudo mode", `{"servers":[{"name":"a","role":"backup","host":"h","user":"u","sudo":{"mode":"x"}}]}`},
		{"root mode non-root user", `{"servers":[{"name":"a","role":"backup","host":"h","user":"u","sudo":{"mode":"root"}}]}`},
		{"missing key", `{"servers":[{"name":"a","role":"backup","host":"h","user":"u","key":"/nope/id"}]}`},
		{"password newline", `{"servers":[{"name":"a","role":"backup","host":"h","user":"u","sudo":{"password":"x\ny"}}]}`},
		{"default missing", `{"default":"b","servers":[{"name":"a","role":"backup","host":"h","user":"u"}]}`},
	}
	for _, tc := range cases {
		cfg := writeServersFile(t, tc.body)
		if _, err := shared.LoadServers(cfg); err == nil {
			t.Errorf("%s: 期望报错，实际通过", tc.name)
		}
	}
}

func TestResolveServer(t *testing.T) {
	cfg := writeServersFile(t, `{
	  "default": "backup-01",
	  "servers": [
	    {"name":"backup-01","role":"backup","host":"h","user":"u"},
	    {"name":"app-01","role":"app","host":"h2","user":"u"}
	  ]
	}`)
	list, err := shared.LoadServers(cfg)
	if err != nil {
		t.Fatal(err)
	}

	s, err := list.Resolve("app-01", "")
	if err != nil || s.Name != "app-01" {
		t.Errorf("显式 name 选择失败：%v", err)
	}
	s, err = list.Resolve("", "app-01")
	if err != nil || s.Name != "app-01" {
		t.Errorf("ops.env 默认选择失败：%v", err)
	}
	s, err = list.Resolve("", "")
	if err != nil || s.Name != "backup-01" {
		t.Errorf("清单 default 选择失败：%v", err)
	}
	if _, err := list.Resolve("nope", ""); err == nil {
		t.Error("未知 name 应报错")
	}
}

func TestResolveOnlyBackupFallback(t *testing.T) {
	cfg := writeServersFile(t, `{"servers":[
	  {"name":"b1","role":"backup","host":"h","user":"u"},
	  {"name":"a1","role":"app","host":"h","user":"u"}]}`)
	list, err := shared.LoadServers(cfg)
	if err != nil {
		t.Fatal(err)
	}
	s, err := list.Resolve("", "")
	if err != nil || s.Name != "b1" {
		t.Errorf("唯一 backup 应自动选中：%v", err)
	}

	cfg = writeServersFile(t, `{"servers":[
	  {"name":"b1","role":"backup","host":"h","user":"u"},
	  {"name":"b2","role":"backup","host":"h","user":"u"}]}`)
	list, err = shared.LoadServers(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := list.Resolve("", ""); err == nil {
		t.Error("多台 backup 且无默认值应报错")
	}
}

func TestSudoersHelpers(t *testing.T) {
	if got := sudoersDropInPath("cql"); got != "/etc/sudoers.d/90-cql-nopasswd" {
		t.Errorf("drop-in 路径 = %q", got)
	}
	if got := sudoersContent("cql"); got != "cql ALL=(ALL) NOPASSWD:ALL\n" {
		t.Errorf("内容 = %q", got)
	}

	script := sudoApplyScript("/etc/sudoers.d/90-cql-nopasswd", sudoersContent("cql"))
	for _, want := range []string{"visudo -cf", "install -m 0440 -o root -g root", "chmod 0440"} {
		if !strings.Contains(script, want) {
			t.Errorf("脚本缺少 %q", want)
		}
	}
	enc := base64.StdEncoding.EncodeToString([]byte(script))
	cmd := scriptCommand(script)
	if !strings.Contains(cmd, enc) || !strings.Contains(cmd, "base64 -d | sh") {
		t.Errorf("scriptCommand = %q", cmd)
	}
}

func TestChoosePassword(t *testing.T) {
	s := &shared.Server{Sudo: shared.SudoConfig{Password: "from-list"}}
	if got := choosePassword(s, "from-input"); got != "from-list" {
		t.Errorf("清单密码应优先，得到 %q", got)
	}
	s.Sudo.Password = ""
	if got := choosePassword(s, "from-input"); got != "from-input" {
		t.Errorf("应使用本次输入，得到 %q", got)
	}
}

func TestServerInfoNoKeyPath(t *testing.T) {
	s := &shared.Server{Name: "a", Role: "backup", Host: "h", Port: 22, User: "u", Key: "/secret/key"}
	Info := s.Info(shared.ServerStatus{})
	if !Info.HasKey {
		t.Error("HasKey 应为 true")
	}
	if strings.Contains(strings.Join([]string{Info.Name, Info.Role, Info.Host, Info.Note}, " "), "/secret") {
		t.Error("展示信息不应包含私钥路径")
	}
}

func TestServerStateRoundTrip(t *testing.T) {
	cfg := writeServersFile(t, `{"servers":[{"name":"a","role":"backup","host":"h","user":"u"}]}`)
	states := map[string]shared.ServerStatus{
		"a": {SSH: "ok", Sudo: "need", Detail: "需要密码", CheckedAt: "2026-11-05T10:00:00+08:00"},
	}
	if err := shared.SaveServerState(cfg.ServersFile, states); err != nil {
		t.Fatal(err)
	}
	got := shared.LoadServerState(cfg.ServersFile)
	if got["a"].Sudo != "need" {
		t.Errorf("状态未持久化：%+v", got)
	}
}
