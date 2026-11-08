package backup

import (
	"pass-up/ops/internal/shared"
)

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

// 界面部署把 sudo 密码经 stdin 喂给 --password-stdin；
// 🔴 不存在 --password 这种会把密码写进命令行 / ps 的参数。
func TestParseDeployArgsPasswordStdin(t *testing.T) {
	opt, err := parseDeployArgs([]string{"pg", "--server", "bk", "--dry-run", "--password-stdin"})
	if err != nil {
		t.Fatal(err)
	}
	if !opt.passwordStdin || !opt.dryRun || opt.Server != "bk" {
		t.Errorf("选项解析不对：%+v", opt)
	}
	if _, err := parseDeployArgs([]string{"--password", "secret"}); err == nil {
		t.Error("不该存在 --password 参数")
	}
}

func TestReadSudoPasswordFromStdin(t *testing.T) {
	old := os.Stdin
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdin = r
	t.Cleanup(func() { os.Stdin = old })
	defer r.Close()
	if _, err := io.WriteString(w, "hunter2\n"); err != nil {
		t.Fatal(err)
	}
	_ = w.Close()

	pw, err := readSudoPassword()
	if err != nil || pw != "hunter2" {
		t.Errorf("readSudoPassword() = %q, %v，想要 hunter2", pw, err)
	}
}

// 默认（未配 SRC_DIR）必须用嵌入的脚本树，ops.exe 才能单独拷走使用。
func TestScriptFSDefaultsToEmbedded(t *testing.T) {
	emb := fstest.MapFS{
		"deploy/backup/preflight_check.sh": {Data: []byte("#!/bin/sh\n")},
	}
	src, err := scriptFS(&shared.Config{}, emb)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fs.Stat(src, "preflight_check.sh"); err != nil {
		t.Errorf("应取到嵌入脚本：%v", err)
	}
	// fs.Sub 之后不应还能看到 embed 的前缀。
	if _, err := fs.Stat(src, "deploy/backup/preflight_check.sh"); err == nil {
		t.Error("scriptFS 应已去掉 deploy/backup 前缀")
	}
}

func TestScriptFSOverrideMustExist(t *testing.T) {
	cfg := &shared.Config{SrcDir: filepath.Join(t.TempDir(), "nope")}
	if _, err := scriptFS(cfg, fstest.MapFS{}); err == nil {
		t.Error("SRC_DIR 指向不存在的目录应报错")
	}
}

// 缺文件要在这里拦下：上传会「成功」，问题要到远端 install.sh 才暴露。
func TestCheckScriptsMissing(t *testing.T) {
	complete := fstest.MapFS{
		"preflight_check.sh":           {Data: []byte("x")},
		"lib/common.sh":                {Data: []byte("x")},
		"postgres/install.sh":          {Data: []byte("x")},
		"postgres/pg_backup.sh":        {Data: []byte("x")},
		"postgres/pg_backup.logrotate": {Data: []byte("x")},
	}
	if err := checkScripts(complete, []component{compPG}); err != nil {
		t.Errorf("完整脚本包不应报错：%v", err)
	}
	// 只部署 pg 时不要求 minio 的文件。
	if err := checkScripts(complete, []component{compPG, compMinio}); err == nil {
		t.Error("缺 minio 脚本时应报错")
	}
}

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

	payload, err := buildPayload(os.DirFS(src), map[string]string{"postgres/backup.env": localEnv})
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

// 空的 then 分支在 sh 里是语法错误：`sh: Syntax error: "elif" unexpected`。
// 2026-11-05 踩过——只缺 mc 时 apt/dnf/yum 三个分支都没有包，脚本直接跑不起来。
// 这条测试把「生成器永远不产出空分支」钉成不变量。
func TestDepsInstallScriptNoEmptyBranch(t *testing.T) {
	cases := [][]string{
		{"mc"},
		{"pg_restore"},
		{"crontab"},
		{"logrotate"},
		{"pg_restore", "mc"},
		{"pg_restore", "crontab", "nc", "logrotate", "mc"},
	}
	for _, missing := range cases {
		s := depsInstallScript(missing)
		if strings.Contains(s, "then\nelif") || strings.Contains(s, "then\nelse") {
			t.Errorf("missing=%v 生成了空 then 分支：\n%s", missing, s)
		}
		// 只有 mc 时不该白跑一次 apt-get update。
		if len(missing) == 1 && missing[0] == "mc" && strings.Contains(s, "apt-get update") {
			t.Errorf("只装 mc 时不应触发包管理器：\n%s", s)
		}
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
	if got := shared.ShQuote("a'b"); got != `'a'\''b'` {
		t.Errorf("shQuote = %s", got)
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
	if !opt.dryRun || !opt.runNow || opt.Server != "backup-01" {
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

// 运行身份靠「Stream 的 bool 参数」这一行区分，重构时最容易被顺手改回 true。
// SSH 子进程不好在单测里 mock，这里从源码锁住关键调用点：
// preflight / 首跑 / 手动备份不套 sudo，install.sh 显式带运行用户，迁移期两份 crontab 都要看。
// 2026-11-08 起 preflight 与「按组件串行跑脚本」抽成了 deploy.go 的共用函数，
// `deploy --run-now` 与 `backup once` 各调一次，断言跟着改到共用函数那两行。
// 判据见 AGENTS.md 硬约束 24、docs/backup-deploy.md §4.4、docs/backup-once.md §3。
func TestDeployRunsBackupAsNonRoot(t *testing.T) {
	data, err := os.ReadFile("deploy.go")
	if err != nil {
		t.Fatalf("读取 deploy.go 失败：%v", err)
	}
	s := string(data)
	for _, want := range []string{
		`return t.Stream(ctx, cmd, false, nil)`,
		`c.backupPath(dir)), false, nil)`,
		`streamPreflight(root, t, cfg, opt.comps)`,
		`runBackupScripts(root, t, cfg.DeployDir, opt.comps, "首次运行", true)`,
		`runUserEnv(t.User)+"bash "`,
		`crontab -u root -l 2>/dev/null || true`,
		`BACKUP_RUN_USER=`,
		`revokeRunUserCrontab(t,`,
	} {
		if !strings.Contains(s, want) {
			t.Errorf("deploy.go 缺少运行身份迁移的关键片段 %q", want)
		}
	}
	if got := strings.Count(s, "runUserEnv(t.User)"); got != 2 {
		t.Errorf("install.sh 调用点应有 2 处（主安装 + 回滚重装）都带运行用户，实际 %d", got)
	}
	// 安装期的 root=true 调用（logrotate / 目录属主）是合法的，只禁共用执行段里的
	// 那两行被改成 true；`t.Stream(ctx, cmd, true, nil)` 在别处仍会出现，不能一刀切。
	if strings.Contains(s, `preflightArg(comps), true, nil)`) ||
		strings.Contains(s, `c.backupPath(dir)), true, nil)`) {
		t.Error("preflight / 备份脚本又被套回 sudo 了")
	}

	once, err := os.ReadFile("once.go")
	if err != nil {
		t.Fatalf("读取 once.go 失败：%v", err)
	}
	so := string(once)
	for _, want := range []string{
		`t.SudoPassword = ""`,
		`streamPreflight(root, t, cfg, opt.comps)`,
		`runBackupScripts(root, t, cfg.DeployDir, opt.comps, "手动备份", false)`,
	} {
		if !strings.Contains(so, want) {
			t.Errorf("once.go 缺少不提权 / 共用执行段的关键片段 %q", want)
		}
	}
}
