package main

import (
	"io/fs"
	"strings"
	"testing"
)

// 嵌入产物必须够 `ops backup deploy` 跑完整流程：
// 上传 → install.sh → logrotate → preflight → 首跑。
// 少一个文件的后果不是编译失败，而是远端跑到一半才 command not found。
func TestEmbeddedBackupScriptsComplete(t *testing.T) {
	need := []string{
		"deploy/backup/preflight_check.sh",
		"deploy/backup/preflight_pg.sh",
		"deploy/backup/preflight_minio.sh",
		"deploy/backup/lib/common.sh",
		"deploy/backup/postgres/install.sh",
		"deploy/backup/postgres/pg_backup.sh",
		"deploy/backup/postgres/pg_backup.logrotate",
		"deploy/backup/postgres/backup.env.example",
		"deploy/backup/minio/install.sh",
		"deploy/backup/minio/minio_backup.sh",
		"deploy/backup/minio/minio_backup.logrotate",
		"deploy/backup/minio/backup.env.example",
	}
	for _, n := range need {
		if _, err := fs.Stat(backupScripts, n); err != nil {
			t.Errorf("嵌入产物缺少 %s：%v", n, err)
		}
	}
}

// 二进制会被拷来拷去，绝不能带着真实凭证。
// 真实配置在配置目录 backup/{postgres,minio}.env（见 docs/config.md），
// 由 backup deploy 打包时以 0600 单独注入。
func TestEmbeddedBackupScriptsHaveNoCredentials(t *testing.T) {
	err := fs.WalkDir(backupScripts, "deploy/backup", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		base := d.Name()
		switch {
		case base == "backup.env", base == "sync.env", base == "last_success.txt",
			strings.HasSuffix(base, ".log"):
			t.Errorf("嵌入产物里出现了凭证/运行时文件：%s", p)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

// 脚本被截断或写空时，远端会以「莫名奇妙的语法错误」失败。
// 这里只做最便宜的三条：非空 + 以 shebang 开头（.sh 才要求）+ 不含 CR。
//
// 🔴 CR 那条不是洁癖：这些文件跑在 Linux 上，CRLF 会让 bash 报
// `$'\r': command not found`，而本机（Windows）跑得好好的，极难定位。
// .gitattributes 管的是 checkout，管不住「有人用会存 CRLF 的编辑器改脚本」。
func TestEmbeddedShellScriptsLookSane(t *testing.T) {
	err := fs.WalkDir(backupScripts, "deploy/backup", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		if !strings.HasSuffix(p, ".sh") && !strings.HasSuffix(p, ".logrotate") {
			return nil
		}
		data, err := fs.ReadFile(backupScripts, p)
		if err != nil {
			return err
		}
		if len(data) == 0 {
			t.Errorf("%s 是空文件", p)
		}
		if strings.ContainsRune(string(data), '\r') {
			t.Errorf("%s 含 CR：CRLF 脚本在 Linux 上会报 $'\\r': command not found", p)
		}
		if strings.HasSuffix(p, ".sh") && !strings.HasPrefix(string(data), "#!") {
			t.Errorf("%s 缺少 shebang", p)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

// 脚本同步已被 ops backup deploy 取代：rsync 那套在 Windows 上跑不了，
// 也不注入本机 backup.env、不装 logrotate、不跑 preflight。
func TestEmbeddedBackupScriptsDroppedRsyncSync(t *testing.T) {
	for _, n := range []string{"deploy/backup/backup_sync.sh", "deploy/backup/sync.env.example"} {
		if _, err := fs.Stat(backupScripts, n); err == nil {
			t.Errorf("%s 应已删除（同步由 ops backup deploy 负责）", n)
		}
	}
}
