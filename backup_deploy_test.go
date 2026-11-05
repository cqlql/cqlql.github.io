package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildPayload(t *testing.T) {
	src := t.TempDir()
	pgDir := filepath.Join(src, "postgres")
	if err := os.MkdirAll(pgDir, 0o755); err != nil {
		t.Fatal(err)
	}
	files := map[string]string{
		"postgres/install.sh":         "#!/bin/sh\n",
		"postgres/pg_backup.sh":       "#!/bin/sh\n",
		"postgres/backup.env":         "PG_PASSWORD=remote-secret\n",
		"postgres/backup.env.example": "PG_PASSWORD=CHANGE_ME\n",
		"postgres/backup.log":         "log\n",
	}
	for rel, body := range files {
		if err := os.WriteFile(filepath.Join(src, rel), []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	localEnv := filepath.Join(t.TempDir(), "backup.env")
	if err := os.WriteFile(localEnv, []byte("PG_PASSWORD=local-secret\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	payload, err := buildPayload(src, map[string]string{"postgres/backup.env": localEnv})
	if err != nil {
		t.Fatal(err)
	}

	entries := readTar(t, payload)
	if mode := entries["postgres/install.sh"]; mode != 0o755 {
		t.Errorf("install.sh mode = %o", mode)
	}
	if mode := entries["postgres/backup.env"]; mode != 0o600 {
		t.Errorf("backup.env mode = %o", mode)
	}
	if _, ok := entries["postgres/backup.log"]; ok {
		t.Error("backup.log 不应被打包")
	}
	if _, ok := entries["postgres/backup.env.example"]; !ok {
		t.Error("backup.env.example 应被打包")
	}
}

func readTar(t *testing.T, payload []byte) map[string]int64 {
	t.Helper()
	gz, err := gzip.NewReader(bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	entries := map[string]int64{}
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		if hdr.Typeflag == tar.TypeReg {
			entries[hdr.Name] = hdr.Mode
		}
	}
	return entries
}

func TestCronScriptDirs(t *testing.T) {
	crontab := strings.Join([]string{
		"0 3 * * * bash /opt/passup-backup/postgres/pg_backup.sh >> /var/log/pg-backup/backup.log 2>&1 #PG_BACKUP",
		"30 4 * * * bash /opt/passup-backup/postgres/pg_backup_status.sh >> /dev/null 2>&1 #PG_BACKUP_HEALTH",
		"0 2 * * * bash /opt/passup-backup/minio/minio_backup.sh >> /var/log/minio-backup/backup.log 2>&1 #MINIO_BACKUP",
		"15 5 * * * bash /opt/passup-backup/minio/minio_backup_status.sh >> /dev/null 2>&1 #MINIO_BACKUP_HEALTH",
	}, "\n")

	if got := cronScriptDirs(crontab, "pg_backup.sh"); len(got) != 1 || got[0] != "/opt/passup-backup/postgres" {
		t.Errorf("pg dirs = %v", got)
	}
	if got := cronScriptDirs(crontab, "minio_backup.sh"); len(got) != 1 || got[0] != "/opt/passup-backup/minio" {
		t.Errorf("minio dirs = %v", got)
	}
}

func TestDepsInstallScript(t *testing.T) {
	s := depsInstallScript([]string{"pg_restore", "mc"})
	if !strings.Contains(s, "postgresql-client") {
		t.Error("缺少 postgresql-client")
	}
	if !strings.Contains(s, "dl.min.io") {
		t.Error("缺少 mc 下载地址")
	}
	if strings.Contains(s, "apt-get install -y \n") {
		t.Error("空包列表不应执行 apt install")
	}
}

func TestEnvsToKeep(t *testing.T) {
	// 只部署 pg（上传新配置）时，minio 的旧 env 必须保留。
	got := envsToKeep([]envPlan{{comp: compPG, upload: true}, {comp: compMinio, keep: true}})
	if len(got) != 1 || got[0] != compMinio {
		t.Errorf("envsToKeep = %v，期望仅保留 minio", got)
	}
	// 两个组件都上传新配置时不保留旧文件。
	if got := envsToKeep([]envPlan{{comp: compPG, upload: true}, {comp: compMinio, upload: true}}); len(got) != 0 {
		t.Errorf("全部上传时不应保留旧配置，得到 %v", got)
	}
}

func TestShQuote(t *testing.T) {
	if got := shQuote("a'b"); got != `'a'\''b'` {
		t.Errorf("shQuote = %s", got)
	}
}
