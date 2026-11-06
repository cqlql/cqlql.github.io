package restart

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// makeRoot 造一棵最小源码树：所有源码都「旧」，exe 最新，dist 介于两者之间。
// 于是默认结论是「不过期」，每个用例只动一处就能断言那一处是不是构建输入。
func makeRoot(t *testing.T) (root, exe string) {
	t.Helper()
	root = t.TempDir()
	exe = filepath.Join(root, "ops.exe")
	old := time.Now().Add(-2 * time.Hour)
	files := map[string]string{
		"go.mod":                               "module pass-up/ops\n",
		"main.go":                              "package main\n",
		"web/package.json":                     "{}\n",
		"web/src/App.tsx":                      "export default null\n",
		"web/dist/index.html":                  "<html></html>\n",
		"deploy/backup/pg/pg_backup.sh":        "#!/bin/sh\n",
		"deploy/backup/pg/backup.example":      "PG=1\n",
		"deploy/backup/minio/minio.env.sh":     "#!/bin/sh\n",
		"deploy/component/minio/check.sh":      "#!/bin/bash\n",
		"deploy/component/docker/update.sh":    "#!/bin/bash\n",
		"deploy/component/docker/uninstall.sh": "#!/bin/bash\n",
		"deploy/component/minio/update.sh":     "#!/bin/bash\n",
		"deploy/component/minio/uninstall.sh":  "#!/bin/bash\n",
		"ops.exe":                              "binary",
	}
	for rel, content := range files {
		p := filepath.Join(root, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(p, old, old); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.MkdirAll(filepath.Join(root, "web", "node_modules"), 0o700); err != nil {
		t.Fatal(err)
	}
	// dist 比源码新、比 exe 旧：既不该判前端过期，也不该判 Go 过期。
	mid := time.Now().Add(-time.Hour)
	if err := os.Chtimes(filepath.Join(root, "web", "dist", "index.html"), mid, mid); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	if err := os.Chtimes(exe, now, now); err != nil {
		t.Fatal(err)
	}
	return root, exe
}

func touch(t *testing.T, root, rel string) {
	t.Helper()
	p := filepath.Join(root, filepath.FromSlash(rel))
	now := time.Now().Add(time.Minute)
	if err := os.Chtimes(p, now, now); err != nil {
		t.Fatal(err)
	}
}

func TestCheckCleanTreeIsNotStale(t *testing.T) {
	root, exe := makeRoot(t)
	if got := Check(root, exe); got.Any() {
		t.Fatalf("干净的源码树不该判过期：%+v", got)
	}
}

func TestCheckWebSourceIsStale(t *testing.T) {
	root, exe := makeRoot(t)
	touch(t, root, "web/src/App.tsx")
	got := Check(root, exe)
	if !got.Web || !strings.Contains(got.Reason(), "web/src/App.tsx") {
		t.Fatalf("改了前端源码必须判 Web 过期：%+v", got)
	}
}

func TestCheckGoSourceIsStale(t *testing.T) {
	root, exe := makeRoot(t)
	touch(t, root, "main.go")
	got := Check(root, exe)
	if !got.Go || !strings.Contains(got.Reason(), "main.go") {
		t.Fatalf("改了 Go 源码必须判 Go 过期：%+v", got)
	}
}

func TestCheckEmbeddedBackupScriptIsStale(t *testing.T) {
	root, exe := makeRoot(t)
	touch(t, root, "deploy/backup/pg/pg_backup.sh")
	got := Check(root, exe)
	if !got.Go || !strings.Contains(got.Reason(), "pg_backup.sh") {
		t.Fatalf("deploy/backup 整目录 embed，改脚本同样要重编 Go：%+v", got)
	}
}

func TestCheckEmbeddedComponentScriptIsStale(t *testing.T) {
	root, exe := makeRoot(t)
	touch(t, root, "deploy/component/minio/check.sh")
	got := Check(root, exe)
	if !got.Go || !strings.Contains(got.Reason(), "check.sh") {
		t.Fatalf("deploy/component 整目录 embed，改组件脚本同样要重编 Go：%+v", got)
	}
}

// 2026-11-07：新增的四份写脚本同样 embed 进 exe，改了必须重编 Go。
func TestCheckComponentWriteScriptsAreGoInputs(t *testing.T) {
	for _, rel := range []string{
		"deploy/component/docker/update.sh",
		"deploy/component/docker/uninstall.sh",
		"deploy/component/minio/update.sh",
		"deploy/component/minio/uninstall.sh",
	} {
		root, exe := makeRoot(t)
		touch(t, root, rel)
		got := Check(root, exe)
		if !got.Go || !strings.Contains(got.GoReason, "deploy/component/") {
			t.Errorf("%s 改了必须重编 Go：%+v", rel, got)
		}
	}
}

func TestCheckDistNewerThanExeIsGoStale(t *testing.T) {
	root, exe := makeRoot(t)
	touch(t, root, "web/dist/index.html")
	got := Check(root, exe)
	// 前端重建过但没重编 Go：界面看着变了、其实跑的是旧 Go。
	if !got.Go || got.Reason() != "web/dist/index.html" {
		t.Fatalf("dist 比 exe 新必须判 Go 过期：%+v", got)
	}
}

func TestCheckRuntimeFilesDoNotTriggerRebuild(t *testing.T) {
	root, exe := makeRoot(t)
	now := time.Now().Add(time.Minute)
	for _, rel := range []string{"ops.exe~", "servers.json", "ops.env", "ops-ui.log"} {
		p := filepath.Join(root, rel)
		if err := os.WriteFile(p, []byte("runtime"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(p, now, now); err != nil {
			t.Fatal(err)
		}
	}
	// deploy/backup 里的运行态产物也不算输入。
	p := filepath.Join(root, "deploy", "backup", "pg", "last_success.txt")
	if err := os.WriteFile(p, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(p, now, now); err != nil {
		t.Fatal(err)
	}
	if got := Check(root, exe); got.Any() {
		t.Fatalf("运行态文件不该让「先重建」永远勾着：%+v", got)
	}
}

func TestCheckMissingDistIsStale(t *testing.T) {
	root, exe := makeRoot(t)
	if err := os.Remove(filepath.Join(root, "web", "dist", "index.html")); err != nil {
		t.Fatal(err)
	}
	got := Check(root, exe)
	if !got.Web || !strings.Contains(got.WebReason, "不存在") {
		t.Fatalf("没有 dist 就是过期，且要写清是哪个文件不存在：%+v", got)
	}
}

func TestBuildCommandsMatchRebuildOrder(t *testing.T) {
	root, _ := makeRoot(t)
	got := BuildCommands(root, Stale{Web: true})
	want := []string{"cd web && npm test", "npm run typecheck", "npm run build", "go build -o ops.next.exe ."}
	if strings.Join(got, " | ") != strings.Join(want, " | ") {
		t.Fatalf("构建命令与 Rebuild 顺序不一致：%v", got)
	}
	if got := BuildCommands(root, Stale{}); len(got) != 1 {
		t.Fatalf("前端不过期时只该跑 go build：%v", got)
	}
	if err := os.RemoveAll(filepath.Join(root, "web", "node_modules")); err != nil {
		t.Fatal(err)
	}
	got = BuildCommands(root, Stale{Web: true})
	if got[0] != "cd web && npm install" {
		t.Fatalf("node_modules 不在时要先装依赖：%v", got)
	}
}
