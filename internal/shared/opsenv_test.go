package shared

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func writeOpsEnv(t *testing.T, lines ...string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "ops.env")
	if err := os.WriteFile(p, []byte(strings.Join(lines, "\n")+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PASS_UP_OPS_ENV", p)
	return p
}

// 键定义自身要合法：漏了 Apply 的键会让解析静默丢值，重复键会让后一个盖掉前一个。
func TestOpsEnvKeyDefsWellFormed(t *testing.T) {
	defs := OpsEnvKeys()
	if len(defs) < 6 {
		t.Fatalf("opsEnvKeys 只剩 %d 个，事实源可能被改坏了", len(defs))
	}
	seen := map[string]bool{}
	for _, d := range defs {
		if !strings.HasPrefix(d.Key, OpsEnvPrefix) {
			t.Errorf("%s 缺少 %s 前缀", d.Key, OpsEnvPrefix)
		}
		if seen[d.Key] {
			t.Errorf("键 %s 重复定义", d.Key)
		}
		seen[d.Key] = true
		if d.Label == "" {
			t.Errorf("%s 缺少 Label", d.Key)
		}
		if d.Apply == nil {
			t.Errorf("%s 没有 Apply，解析时会静默丢值", d.Key)
		}
	}
	if OpsEnvKeys()[0].Notes == nil {
		t.Error("OpsEnvKeys() 应返回含 Notes 的副本")
	}
	// 改副本不许改到事实源。
	copyDefs := OpsEnvKeys()
	copyDefs[0].Key = "MUTATED"
	copyDefs[0].Notes[0] = "MUTATED"
	if OpsEnvKeys()[0].Key == "MUTATED" || strings.Contains(RenderOpsEnvTemplate(), "MUTATED") {
		t.Error("OpsEnvKeys() 泄漏了内部 slice，调用方能改到事实源")
	}
}

// `ops init` 模板是键定义的生成物：键顺序、字面量、注释都不许手抄第二份。
func TestRenderOpsEnvTemplateMatchesKeyDefs(t *testing.T) {
	tpl := RenderOpsEnvTemplate()
	var gotKeys []string
	for _, line := range strings.Split(strings.TrimRight(tpl, "\n"), "\n") {
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			t.Errorf("模板里出现非 KEY=VALUE 行：%q", line)
			continue
		}
		gotKeys = append(gotKeys, k)
		want := ""
		for _, d := range OpsEnvKeys() {
			if d.Key == k {
				want = d.TemplateValue
			}
		}
		if v != want {
			t.Errorf("模板 %s=%q，键定义是 %q", k, v, want)
		}
	}
	var wantKeys []string
	for _, d := range OpsEnvKeys() {
		wantKeys = append(wantKeys, d.Key)
		for _, n := range d.Notes {
			if !strings.Contains(tpl, "# "+n) {
				t.Errorf("模板缺少 %s 的注释 %q", d.Key, n)
			}
		}
	}
	if strings.Join(gotKeys, ",") != strings.Join(wantKeys, ",") {
		t.Errorf("模板键顺序/数量与键定义不一致：\n got  %v\n want %v", gotKeys, wantKeys)
	}
	if !strings.Contains(tpl, "PASS_UP_OPS_BACKUP_DEPLOY_DIR="+DefaultBackupDeployDir) {
		t.Errorf("模板的部署目录默认值没走 DefaultBackupDeployDir")
	}
	if fallback := FallbackConfig(); fallback.DeployDir != DefaultBackupDeployDir {
		t.Errorf("运行时默认值 %q 与模板字面量 %q 不一致", fallback.DeployDir, DefaultBackupDeployDir)
	}
}

func TestCmdInitWritesGeneratedTemplate(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "ops.env")
	t.Setenv("PASS_UP_OPS_ENV", p)
	t.Setenv(ConfigDirEnv, dir)
	if code := CmdInit(nil); code != 0 {
		t.Fatalf("ops init 返回 %d", code)
	}
	got, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != RenderOpsEnvTemplate() {
		t.Error("ops init 写出的模板与键定义渲染结果不一致")
	}
}

// 每个键都必须真的能改变 Config；新增键忘了在这里给值，测试会直接提醒补断言。
func TestLoadConfigAppliesEveryKey(t *testing.T) {
	dir := t.TempDir()
	values := map[string]string{
		"PASS_UP_OPS_SERVERS_FILE":          filepath.Join(dir, "servers.json"),
		"PASS_UP_OPS_DEFAULT_SERVER":        "backup-01",
		"PASS_UP_OPS_BACKUP_DEPLOY_DIR":     "/opt/passup-custom",
		"PASS_UP_OPS_BACKUP_SRC_DIR":        filepath.Join(dir, "scripts"),
		"PASS_UP_OPS_BACKUP_PG_ENV_FILE":    filepath.Join(dir, "postgres.env"),
		"PASS_UP_OPS_BACKUP_MINIO_ENV_FILE": filepath.Join(dir, "minio.env"),
	}
	var lines []string
	for _, d := range OpsEnvKeys() {
		v, ok := values[d.Key]
		if !ok {
			t.Fatalf("新增的 ops.env 键 %s 没有在本测试里给值，请补上断言", d.Key)
		}
		lines = append(lines, d.Key+"="+v)
	}
	writeOpsEnv(t, lines...)

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	checks := map[string]struct{ got, want string }{
		"ServersFile":   {cfg.ServersFile, values["PASS_UP_OPS_SERVERS_FILE"]},
		"DefaultServer": {cfg.DefaultServer, values["PASS_UP_OPS_DEFAULT_SERVER"]},
		"DeployDir":     {cfg.DeployDir, values["PASS_UP_OPS_BACKUP_DEPLOY_DIR"]},
		"SrcDir":        {cfg.SrcDir, values["PASS_UP_OPS_BACKUP_SRC_DIR"]},
		"PGEnvFile":     {cfg.PGEnvFile, values["PASS_UP_OPS_BACKUP_PG_ENV_FILE"]},
		"MinioEnvFile":  {cfg.MinioEnvFile, values["PASS_UP_OPS_BACKUP_MINIO_ENV_FILE"]},
	}
	for field, c := range checks {
		if c.got != c.want {
			t.Errorf("%s = %q，想要 %q", field, c.got, c.want)
		}
	}
}

// 未知 PASS_UP_OPS_* 必须报错并讲清原因，不能像以前那样静默忽略。
func TestLoadConfigRejectsUnknownOpsEnvKey(t *testing.T) {
	cases := []struct {
		name, line, want string
	}{
		{"拼错", "PASS_UP_OPS_DEFAULT_SERVR=bk", "可能是拼写错误"},
		{"P2 幽灵键", "PASS_UP_OPS_PG_ROOT=/data/backups/postgres", "备份监控（P2）方案尚未实现"},
		{"P3 幽灵键", "PASS_UP_OPS_DEPLOY_DIR=/opt/passup", "应用部署（P3–P4）方案尚未实现"},
		{"环境变量误写进文件", "PASS_UP_OPS_CONFIG_DIR=C:\\tmp", "这是进程环境变量"},
		{"已删除的旧主机键", "PASS_UP_OPS_BACKUP_HOST=10.0.0.1", "已迁移到服务器清单"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := writeOpsEnv(t, tc.line)
			_, err := LoadConfig()
			if err == nil {
				t.Fatalf("%q 应被拒绝，实际通过", tc.line)
			}
			if !strings.Contains(err.Error(), p) || !strings.Contains(err.Error(), "不支持的配置键") {
				t.Errorf("错误信息没给出文件与行号：%v", err)
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Errorf("错误信息缺少原因 %q：%v", tc.want, err)
			}
			for _, d := range OpsEnvKeys() {
				if !strings.Contains(err.Error(), d.Key) {
					t.Errorf("错误信息没列出合法键 %s", d.Key)
				}
			}
		})
	}
}

// 非本项目前缀的键保持历史兼容：人可能在 ops.env 里放自己的变量。
func TestLoadConfigIgnoresNonPrefixedKey(t *testing.T) {
	writeOpsEnv(t, "UNKNOWN_KEY=ignored", "EDITOR=vi")
	if _, err := LoadConfig(); err != nil {
		t.Errorf("非 PASS_UP_OPS_ 前缀的键应忽略：%v", err)
	}
}

// docs/ 全部分册里出现的每个 PASS_UP_OPS_* 键名，都必须在「真实键」或「已知但不可用」
// 里有归属。这是 2026-11-07 诊断里 P2/P3 幽灵键的护栏：第 3 步把键表移到对应分册后，
// 断言也跟着扩到全部文档 —— 换地方藏不起来，新冒出来的幽灵键一样会红。
func TestOpsEnvDocKeysAreClassified(t *testing.T) {
	files, err := filepath.Glob("../../docs/*.md")
	if err != nil {
		t.Fatal(err)
	}
	if len(files) < 10 {
		t.Fatalf("docs/*.md 只找到 %d 个文件，相对路径可能变了", len(files))
	}
	re := regexp.MustCompile("`(PASS_UP_OPS_[A-Z_]+)`")
	index, retired := opsEnvKeyIndex(), retiredOpsEnvKeys()
	seen := map[string]string{} // 键 → 首次出现的文档
	for _, rel := range files {
		data, err := os.ReadFile(rel)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range re.FindAllStringSubmatch(string(data), -1) {
			k := m[1]
			if _, ok := seen[k]; ok {
				continue
			}
			seen[k] = filepath.Base(rel)
			if _, ok := index[k]; ok {
				continue
			}
			if _, ok := retired[k]; ok {
				continue
			}
			t.Errorf("%s 里的 %s 既不是 opsEnvKeys 的键，也没在 retiredOpsEnvKeys 里说明原因", rel, k)
		}
	}
	if len(seen) < 20 {
		t.Errorf("只解析到 %d 个键名，正则或文档结构可能变了，断言等于空转", len(seen))
	}
	t.Logf("核对了 %d 份文档里 %d 个去重后的 PASS_UP_OPS_* 键名", len(files), len(seen))
}

// config.md 只讲现行配置：未实现方案的键表与运行态文件清单都已移到对应分册。
// 这条断言把第 3 步的意图钉住，防止「整理完没多久又抄回来」。
func TestConfigDocOnlyDefinesCurrentConfig(t *testing.T) {
	const rel = "../../docs/config.md"
	data, err := os.ReadFile(rel)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)

	ghosts := 0
	for k, reason := range retiredOpsEnvKeys() {
		if !strings.Contains(reason, "尚未实现") {
			continue
		}
		ghosts++
		if strings.Contains(text, "`"+k+"`") {
			t.Errorf("%s 仍复述了未实现方案的键 %s；键表应留在对应分册", rel, k)
		}
	}
	if ghosts < 20 {
		t.Errorf("原因表里只有 %d 个「尚未实现」的键，分类可能失效，断言等于空转", ghosts)
	}
	if regexp.MustCompile("(?m)^\\|\\s*`ui\\.json`\\s*\\|").MatchString(text) {
		t.Errorf("%s 仍带运行态文件清单表；判据应在 one-click-launch.md §4.4", rel)
	}
	for _, doc := range []string{"backup-monitor.md", "deploy.md", "one-click-launch.md"} {
		if !strings.Contains(text, doc) {
			t.Errorf("%s 缺少指向 %s 的指针", rel, doc)
		}
	}
	t.Logf("config.md 已不含 %d 个方案键与运行态文件表", ghosts)
}
