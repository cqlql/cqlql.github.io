package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"pass-up/ops/internal/shared"
)

// 生成器的唯一入口（内部命令，不进 usage / 菜单）。
//
// 事实源只有 internal/shared/env-schema.json。它生成三类产物：
// 1. deploy/backup/<组件>/backup.env.example（整文件重写）
// 2. deploy/backup/**/*.sh 与 Makefile 里的 ${KEY:-默认值} / := 默认值字面量
// 3. docs/config.md 的 <!-- gen:env-schema --> 键表区块
//
// 🔴 刻意**不改脚本的执行逻辑**：只把默认值字面量按 schema 写回。
// 这些脚本跑在生产备份机上，改 source 顺序 / 去掉兜底会引入无法在本机验证的行为变化；
// 「生成物 + go test 断言」已经能让「改一个默认值只动 schema 一处」成立。
const genBackupEnvCommand = "__gen-backup-env"

var (
	// ${KEY:-默认值}，捕获键与当前字面量。值里不含 }（脚本里的默认值都没有嵌套展开）。
	shellDefaultRe = regexp.MustCompile(`\$\{([A-Z][A-Z0-9_]*):-([^}]*)\}`)
	// Makefile 的 VAR := 默认值（只处理下面映射表里的变量）。
	makeDefaultRe = regexp.MustCompile(`^(\s*[A-Z][A-Z0-9_]*\s*:=\s*)(.+?)(\s*)$`)
	docBlockRe    = regexp.MustCompile(`(?s)<!-- gen:env-schema -->\n.*?<!-- /gen:env-schema -->`)
)

// 这两处不是「默认值」，是提示文案 / find 的哨兵路径，生成器与测试都不许碰。
var envSentinelValues = map[string]bool{
	"<未配置>":        true,
	"/nonexistent": true,
}

// Makefile 变量名 → schema 键名。它们不同名，是历史命名，别在 Makefile 里改名。
var makeVarToSchemaKey = map[string]string{
	"PG_CRON_SCHEDULE":        "CRON_SCHEDULE_BACKUP",
	"PG_HEALTH_CRON_SCHEDULE": "CRON_SCHEDULE_HEALTH",
	"PG_BACKUP_LOG_DIR":       "PG_BACKUP_LOG_DIR",
	"CRON_SCHEDULE":           "CRON_SCHEDULE_BACKUP",
	"HEALTH_CRON_SCHEDULE":    "CRON_SCHEDULE_HEALTH",
	"BACKUP_LOG_DIR":          "BACKUP_LOG_DIR",
}

func envComponentForPath(p string) string {
	p = filepath.ToSlash(p)
	switch {
	case strings.Contains(p, "/postgres/"), strings.HasSuffix(p, "preflight_pg.sh"):
		return "pg"
	case strings.Contains(p, "/minio/"), strings.HasSuffix(p, "preflight_minio.sh"):
		return "minio"
	default:
		return "" // lib/、preflight_check.sh、根 Makefile 不含组件专属默认值
	}
}

// rewriteShellDefaults 把脚本里属于 schema 的 ${KEY:-值} 字面量同步成 schema 默认值。
func rewriteShellDefaults(comp, src string) (string, int, []string) {
	if comp == "" {
		return src, 0, nil
	}
	var problems []string
	n := 0
	out := shellDefaultRe.ReplaceAllStringFunc(src, func(m string) string {
		sm := shellDefaultRe.FindStringSubmatch(m)
		key, cur := sm[1], sm[2]
		want, ok := shared.EnvDefault(comp, key)
		// 🔴 `${KEY:-}` 是**空兜底**，不是默认值：它给 set -u 防空，也承担
		//    install.sh 的「环境变量 / backup.env 有没有显式配」判定。填成默认值
		//    会让 [ -z ... ] 恒为假、[ -n ... ] 恒为真，静默改掉执行语义。
		//    生成器只同步「已经写了字面量」的默认值，绝不制造新的兜底值。
		if !ok || cur == "" || cur == want || envSentinelValues[cur] {
			return m
		}
		if want == "" {
			problems = append(problems, fmt.Sprintf("%s 的 schema 默认值为空，脚本却硬编码了 %q", key, cur))
			return m
		}
		n++
		return "${" + key + ":-" + want + "}"
	})
	return out, n, problems
}

// rewriteMakeDefaults 同步 Makefile 的 := 兜底默认值。
func rewriteMakeDefaults(comp, src string) (string, int, []string) {
	if comp == "" {
		return src, 0, nil
	}
	var problems []string
	n := 0
	lines := strings.Split(src, "\n")
	for i, line := range lines {
		m := makeDefaultRe.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		varName := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(m[1]), ":="))
		key, ok := makeVarToSchemaKey[varName]
		if !ok {
			continue
		}
		cur := m[2]
		// 从 backup.env grep 的那几行含 $(shell ...)，不是兜底默认值。
		if strings.Contains(cur, "$(") {
			continue
		}
		want, ok := shared.EnvDefault(comp, key)
		if !ok || cur == want {
			continue
		}
		if want == "" {
			problems = append(problems, fmt.Sprintf("%s 的 schema 默认值为空，Makefile 却硬编码了 %q", key, cur))
			continue
		}
		lines[i] = m[1] + want + m[3]
		n++
	}
	return strings.Join(lines, "\n"), n, problems
}

func genWriteFile(rel, content string, changed *[]string) error {
	old, err := os.ReadFile(rel)
	if err != nil {
		return fmt.Errorf("读取 %s 失败：%w", rel, err)
	}
	// 生成物一律 LF：远端是 Linux，CRLF 会让 source 出来的值末尾带 \r。
	content = strings.ReplaceAll(content, "\r\n", "\n")
	if string(old) == content {
		return nil
	}
	if err := os.WriteFile(rel, []byte(content), 0o644); err != nil {
		return fmt.Errorf("写入 %s 失败：%w", rel, err)
	}
	*changed = append(*changed, rel)
	return nil
}

func cmdGenBackupEnv() int {
	if _, err := os.Stat("deploy/backup"); err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 请在仓库根目录运行（找不到 deploy/backup）")
		return 1
	}
	var changed []string
	var problems []string

	// 1) 两份模板整文件生成。
	for _, comp := range shared.EnvComponents() {
		dir := map[string]string{"pg": "postgres", "minio": "minio"}[comp]
		data, err := shared.RenderEnvExample(comp)
		if err != nil {
			fmt.Fprintln(os.Stderr, "ERROR:", err)
			return 1
		}
		if err := genWriteFile(filepath.Join("deploy", "backup", dir, "backup.env.example"), string(data), &changed); err != nil {
			fmt.Fprintln(os.Stderr, "ERROR:", err)
			return 1
		}
	}

	// 2) 脚本 / Makefile 里的默认值字面量。
	err := filepath.WalkDir("deploy/backup", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		name := d.Name()
		if !strings.HasSuffix(name, ".sh") && name != "Makefile" {
			return nil
		}
		comp := envComponentForPath(p)
		if comp == "" {
			return nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		src := strings.ReplaceAll(string(b), "\r\n", "\n")
		var out string
		var n int
		var prob []string
		if name == "Makefile" {
			out, n, prob = rewriteMakeDefaults(comp, src)
		} else {
			out, n, prob = rewriteShellDefaults(comp, src)
		}
		problems = append(problems, prob...)
		if n == 0 && out == src {
			return nil
		}
		return genWriteFile(p, out, &changed)
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		return 1
	}

	// 3) docs/config.md 的键表区块。
	docPath := filepath.Join("docs", "config.md")
	doc, err := os.ReadFile(docPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		return 1
	}
	table, err := shared.RenderEnvDocTable()
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		return 1
	}
	docText := strings.ReplaceAll(string(doc), "\r\n", "\n")
	if !docBlockRe.MatchString(docText) {
		fmt.Fprintln(os.Stderr, "ERROR: docs/config.md 缺少 <!-- gen:env-schema --> 区块标记")
		return 1
	}
	docText = docBlockRe.ReplaceAllStringFunc(docText, func(string) string {
		return "<!-- gen:env-schema -->\n" + strings.TrimRight(string(table), "\n") + "\n<!-- /gen:env-schema -->"
	})
	if err := genWriteFile(docPath, docText, &changed); err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		return 1
	}

	if len(problems) > 0 {
		for _, p := range problems {
			fmt.Fprintln(os.Stderr, "ERROR:", p)
		}
		return 1
	}
	if len(changed) == 0 {
		fmt.Println("所有生成物已与 env-schema.json 一致，无需改动。")
		return 0
	}
	fmt.Printf("已从 env-schema.json 重新生成 %d 个文件：\n", len(changed))
	for _, p := range changed {
		fmt.Println("  -", filepath.ToSlash(p))
	}
	fmt.Println("改完记得 go build（脚本与模板都嵌进二进制）。")
	return 0
}
