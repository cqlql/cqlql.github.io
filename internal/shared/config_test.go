package shared

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

	cfg, err := LoadConfig()
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
		cfg  Config
	}{
		{"empty servers file", Config{ServersFile: "", DeployDir: "/opt/passup-backup"}},
		{"relative deploy dir", Config{ServersFile: "servers.json", DeployDir: "backup"}},
		{"dotdot deploy dir", Config{ServersFile: "servers.json", DeployDir: "/opt/../etc"}},
	}
	for _, tc := range cases {
		if err := tc.cfg.validate(); err == nil {
			t.Errorf("%s: 期望报错，实际通过", tc.name)
		}
	}
}
