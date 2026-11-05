package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "ops.env")
	servers := filepath.Join(dir, "servers.json")
	content := strings.Join([]string{
		"# 注释",
		"PASS_UP_OPS_SERVERS_FILE=" + servers,
		"PASS_UP_OPS_DEFAULT_SERVER=backup-01",
		"PASS_UP_OPS_BACKUP_DEPLOY_DIR=/opt/passup-backup",
		"UNKNOWN_KEY=ignored",
	}, "\n")
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PASS_UP_OPS_ENV", p)

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("loadConfig: %v", err)
	}
	if cfg.ServersFile != servers {
		t.Errorf("servers file = %q", cfg.ServersFile)
	}
	if cfg.DefaultServer != "backup-01" {
		t.Errorf("default server = %q", cfg.DefaultServer)
	}
	if cfg.DeployDir != "/opt/passup-backup" {
		t.Errorf("deploy dir = %q", cfg.DeployDir)
	}
}

func TestConfigValidate(t *testing.T) {
	cases := []struct {
		name string
		cfg  config
	}{
		{"empty servers file", config{ServersFile: "", DeployDir: "/opt/passup-backup"}},
		{"relative deploy dir", config{ServersFile: "servers.json", DeployDir: "backup"}},
		{"dotdot deploy dir", config{ServersFile: "servers.json", DeployDir: "/opt/../etc"}},
	}
	for _, tc := range cases {
		if err := tc.cfg.validate(); err == nil {
			t.Errorf("%s: 期望报错，实际通过", tc.name)
		}
	}
}

func TestInspectLocalEnv(t *testing.T) {
	dir := t.TempDir()
	missing := filepath.Join(dir, "missing.env")
	if _, ok := inspectLocalEnv(missing); ok {
		t.Error("missing 不应通过")
	}

	empty := filepath.Join(dir, "empty.env")
	os.WriteFile(empty, []byte("  \n"), 0o600)
	if issue, ok := inspectLocalEnv(empty); ok || issue != "empty" {
		t.Errorf("empty: ok=%v issue=%q", ok, issue)
	}

	ph := filepath.Join(dir, "ph.env")
	os.WriteFile(ph, []byte("PG_PASSWORD=CHANGE_ME\n"), 0o600)
	if issue, ok := inspectLocalEnv(ph); ok || issue != "placeholder" {
		t.Errorf("placeholder: ok=%v issue=%q", ok, issue)
	}

	good := filepath.Join(dir, "good.env")
	os.WriteFile(good, []byte("PG_PASSWORD=secret\n"), 0o600)
	if issue, ok := inspectLocalEnv(good); !ok || issue != "" {
		t.Errorf("good: ok=%v issue=%q", ok, issue)
	}
}

func TestParseDeployArgs(t *testing.T) {
	opt, err := parseDeployArgs([]string{"minio", "--dry-run", "--run-now", "--server", "backup-01"})
	if err != nil {
		t.Fatal(err)
	}
	if len(opt.comps) != 1 || opt.comps[0] != compMinio {
		t.Errorf("comps = %v", opt.comps)
	}
	if !opt.dryRun || !opt.runNow || opt.server != "backup-01" {
		t.Errorf("flags = %+v", opt)
	}

	if _, err := parseDeployArgs([]string{"pg", "--server=app-01"}); err != nil {
		t.Fatalf("--server=name: %v", err)
	}
	if _, err := parseDeployArgs([]string{"pg", "minio"}); err == nil {
		t.Error("多个组件应报错")
	}
	if _, err := parseDeployArgs([]string{"unknown"}); err == nil {
		t.Error("未知组件应报错")
	}
	if _, err := parseDeployArgs([]string{"--server"}); err == nil {
		t.Error("--server 缺值应报错")
	}
}
