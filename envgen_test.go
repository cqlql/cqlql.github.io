package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"pass-up/ops/internal/shared"
)

// env-schema.json 是唯一事实源，但生成物是**文本文件**：改了 schema 不跑生成器，
// Go 照样编译通过、界面白名单也跟着变了，只有模板 / 脚本 / 文档还停在旧值。
// 这里把「生成物 == 当前 schema 重新渲染的结果」变成断言，让漏跑在 go test 就红。
//
// 与 backupdist_test.go 的分工：那边查「嵌入产物能不能跑」（文件齐、无凭证、无 CR、
// shebang）；这边查「生成物有没有跟上 schema」。两边都从磁盘 / embed 读，不信任人记得跑命令。
const genHint = "在仓库根跑 ops __gen-backup-env，然后 go build（脚本与模板都嵌进二进制）"

var (
	// `[ -z "${KEY:-}" ]` / `[ -n ... ]` / `[ -d ... ]` 这类**判断型**展开：
	// 空兜底承担「有没有显式配置」的判定，填成默认值会让判断恒真 / 恒假。
	shellTestEmptyRe = regexp.MustCompile(`\[\s*-([a-z]+)\s+"\$\{([A-Z][A-Z0-9_]*):-([^}]*)\}"`)
	// 原型 META 里的 `KEY:'标签'`（groups 的 name:'...' 是小写开头，不会命中）。
	prototypeLabelRe = regexp.MustCompile(`([A-Z][A-Z0-9_]*):'([^']*)'`)
	prototypeGroupRe = regexp.MustCompile(`\{name:'([^']*)',\s*keys:\[([^\]]*)\]\}`)
	prototypeKeyRe   = regexp.MustCompile(`'([A-Z][A-Z0-9_]*)'`)
)

func envExampleRel(comp string) string {
	return "deploy/backup/" + map[string]string{"pg": "postgres", "minio": "minio"}[comp] + "/backup.env.example"
}

// 两份模板：磁盘版本与 embed 版本都必须等于 RenderEnvExample。
// 前者挡「改了 schema 没跑生成器 / 有人手改模板」，后者顺带挡「改了模板没重新 build」。
func TestEnvSchemaTemplatesAreGenerated(t *testing.T) {
	for _, comp := range shared.EnvComponents() {
		rel := envExampleRel(comp)
		want, err := shared.RenderEnvExample(comp)
		if err != nil {
			t.Fatalf("渲染 %s 模板失败：%v", comp, err)
		}
		disk, err := os.ReadFile(filepath.FromSlash(rel))
		if err != nil {
			t.Fatal(err)
		}
		if string(disk) != string(want) {
			t.Errorf("%s 与 env-schema.json 不一致；%s", rel, genHint)
		}
		packed, err := fs.ReadFile(backupScripts, rel)
		if err != nil {
			t.Fatalf("读取嵌入产物 %s 失败：%v", rel, err)
		}
		if string(packed) != string(want) {
			t.Errorf("嵌入的 %s 与 env-schema.json 不一致；%s", rel, genHint)
		}
	}
}

// docs/config.md 的生成块必须与 RenderEnvDocTable 逐字一致。
func TestEnvSchemaDocTableIsGenerated(t *testing.T) {
	const rel = "docs/config.md"
	doc, err := os.ReadFile(rel)
	if err != nil {
		t.Fatal(err)
	}
	text := strings.ReplaceAll(string(doc), "\r\n", "\n")
	table, err := shared.RenderEnvDocTable()
	if err != nil {
		t.Fatal(err)
	}
	want := "<!-- gen:env-schema -->\n" + strings.TrimRight(string(table), "\n") + "\n<!-- /gen:env-schema -->"
	loc := docBlockRe.FindStringIndex(text)
	if loc == nil {
		t.Fatalf("%s 缺少 <!-- gen:env-schema --> 区块标记", rel)
	}
	if got := text[loc[0]:loc[1]]; got != want {
		t.Errorf("%s 的键表与 env-schema.json 不一致；%s", rel, genHint)
	}
}

// 脚本兜底值对齐 + 空兜底语义保护。
//
// 🔴 2026-11-07 初版生成器把 `${KEY:-}` 也填成默认值，install.sh 的
// `[ -z "${CRON_SCHEDULE_BACKUP:-}" ]` 会恒假、preflight 的 `[ -n "${SRC_URL:-}" ]`
// 会恒真，静默改掉执行语义。这条断言专门把它钉死：判断型展开必须是空兜底。
func TestEnvSchemaShellDefaultsAligned(t *testing.T) {
	checked := 0
	err := filepath.WalkDir("deploy/backup", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		if !strings.HasSuffix(d.Name(), ".sh") {
			return nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		src, rel := string(b), filepath.ToSlash(p)

		for _, m := range shellTestEmptyRe.FindAllStringSubmatch(src, -1) {
			if m[3] != "" {
				t.Errorf("%s：`[ -%s \"${%s:-%s}\" ]` 的空兜底被填成了默认值，判断会恒真/恒假；%s",
					rel, m[1], m[2], m[3], genHint)
			}
		}

		comp := envComponentForPath(rel)
		if comp == "" { // lib/、preflight_check.sh 不含组件专属默认值
			return nil
		}
		for _, m := range shellDefaultRe.FindAllStringSubmatch(src, -1) {
			key, cur := m[1], m[2]
			want, ok := shared.EnvDefault(comp, key)
			if !ok || cur == "" || envSentinelValues[cur] {
				// 非配置键（HOME / EDITOR / LOG_SIZE …）、空兜底、提示文案 / find 哨兵。
				continue
			}
			if want == "" {
				t.Errorf("%s：%s 在 schema 里是「必须人填」，脚本却硬编码了 %q", rel, key, cur)
				continue
			}
			if cur != want {
				t.Errorf("%s：${%s:-%s} 与 schema 默认值 %q 不一致；%s", rel, key, cur, want, genHint)
			}
			checked++
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	// 活性检测：正则或目录结构一变就可能一处都匹配不到，那样断言是「假绿」。
	if checked < 20 {
		t.Errorf("只核对了 %d 处脚本默认字面量；目录结构或正则可能失效，断言等于空转", checked)
	}
	t.Logf("核对了 %d 处脚本默认字面量", checked)
}

// Makefile 的手工入口也有一份 cron / 日志目录兜底，变量名与 schema 键名不同，
// 走 makeVarToSchemaKey 映射后逐个比对。
func TestEnvSchemaMakeDefaultsAligned(t *testing.T) {
	checked := 0
	for _, comp := range shared.EnvComponents() {
		rel := "deploy/backup/" + map[string]string{"pg": "postgres", "minio": "minio"}[comp] + "/Makefile"
		b, err := os.ReadFile(filepath.FromSlash(rel))
		if err != nil {
			t.Fatal(err)
		}
		for _, line := range strings.Split(strings.ReplaceAll(string(b), "\r\n", "\n"), "\n") {
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
			if strings.Contains(cur, "$(") { // 从 backup.env grep 的那几行不是兜底值
				continue
			}
			want, ok := shared.EnvDefault(comp, key)
			if !ok {
				t.Errorf("%s：映射表把 %s 指向了 schema 里不存在的 %s", rel, varName, key)
				continue
			}
			if cur != want {
				t.Errorf("%s：%s 兜底值 %q 与 schema 默认值 %q 不一致；%s", rel, varName, cur, want, genHint)
			}
			checked++
		}
	}
	if checked < 6 { // 两个 Makefile 各 3 条兜底（日志目录、备份 cron、巡检 cron）
		t.Errorf("只核对了 %d 条 Makefile 兜底；映射表或正则可能失效，断言等于空转", checked)
	}
	t.Logf("核对了 %d 条 Makefile 兜底", checked)
}

// 凭证键在 schema 里 default 必须为空（loadEnvSchema 会拦），模板里只能出现 placeholder
// 或空串。schema、模板、脚本都编进二进制：渲染逻辑一旦被改坏，
// 一个「方便测试」的默认凭证就会跟着 exe 到处跑。
func TestEnvSchemaTemplatesCarryNoSecretDefaults(t *testing.T) {
	for _, comp := range shared.EnvComponents() {
		data, err := shared.RenderEnvExample(comp)
		if err != nil {
			t.Fatal(err)
		}
		for _, d := range shared.EnvDefs(comp) {
			if !d.Secret {
				continue
			}
			lineRe := regexp.MustCompile(`(?m)^` + regexp.QuoteMeta(d.Key) + `="([^"]*)"$`)
			m := lineRe.FindStringSubmatch(string(data))
			if m == nil {
				t.Errorf("%s 模板里找不到凭证键 %s 的赋值行", comp, d.Key)
				continue
			}
			want := d.Placeholder // 没配 placeholder 时就该是空串
			if m[1] != want {
				t.Errorf("%s 模板里 %s=%q，应为 placeholder %q（凭证不许有默认明文）", comp, d.Key, m[1], want)
			}
		}
	}
}

// 交互原型不是实现，但按 docs/ui.md §12 的约定要「同步维护」。
// 它是**子集速览**：只演示部分键，所以这里断言「原型里写的都必须与 schema 一致」，
// 不要求原型列出全部键；假数据（远端 IP、库名、凭证）不参与比对。
func TestEnvSchemaPrototypeAligned(t *testing.T) {
	labelChecked, groupChecked, defaultChecked := 0, 0, 0
	const rel = "docs/config-compare.html"
	b, err := os.ReadFile(rel)
	if err != nil {
		t.Fatal(err)
	}
	text := strings.ReplaceAll(string(b), "\r\n", "\n")

	metaStart := strings.Index(text, "const META = {")
	if metaStart < 0 {
		t.Fatalf("%s 里找不到 const META", rel)
	}
	metaEnd := strings.Index(text[metaStart:], "\n};")
	if metaEnd < 0 {
		t.Fatalf("%s 里 META 没有结束标记", rel)
	}
	meta := text[metaStart : metaStart+metaEnd]

	for i, comp := range []string{"pg", "minio"} {
		defs := map[string]shared.EnvKeyDef{}
		groups := map[string]bool{}
		for _, d := range shared.EnvDefs(comp) {
			defs[d.Key] = d
			groups[d.Group] = true
		}
		begin := strings.Index(meta, "\n  "+comp+":{")
		if begin < 0 {
			t.Fatalf("%s 的 META 缺少 %s 段", rel, comp)
		}
		end := len(meta)
		if i == 0 {
			if n := strings.Index(meta, "\n  minio:{"); n > begin {
				end = n
			}
		}
		seg := meta[begin:end]

		for _, m := range prototypeLabelRe.FindAllStringSubmatch(seg, -1) {
			labelChecked++
			d, ok := defs[m[1]]
			if !ok {
				t.Errorf("%s %s：原型标签 %s 不在 env-schema.json 里", rel, comp, m[1])
				continue
			}
			if d.Label != m[2] {
				t.Errorf("%s %s：%s 的标签 %q 与 schema 的 %q 不一致", rel, comp, m[1], m[2], d.Label)
			}
		}
		for _, g := range prototypeGroupRe.FindAllStringSubmatch(seg, -1) {
			groupChecked++
			if !groups[g[1]] {
				t.Errorf("%s %s：原型分组 %q 不在 schema 里", rel, comp, g[1])
			}
			for _, k := range prototypeKeyRe.FindAllStringSubmatch(g[2], -1) {
				d, ok := defs[k[1]]
				if !ok {
					t.Errorf("%s %s：原型分组 %q 里的 %s 不在 schema 里", rel, comp, g[1], k[1])
					continue
				}
				if d.Group != g[1] {
					t.Errorf("%s %s：%s 在原型里归 %q，schema 里归 %q", rel, comp, k[1], g[1], d.Group)
				}
			}
		}
	}

	// 演示用的**默认值**里，这几处是判据性内容（尤其 7/3 漂移过的那个键），
	// 必须与 schema 一致；其余是刻意造的「远端与本机不同」假数据，不参与比对。
	for _, c := range []struct{ comp, obj, key string }{
		{"pg", "PG_REMOTE", "PG_LOCAL_RETENTION_DAYS"},
		{"pg", "PG_REMOTE", "CRON_SCHEDULE_BACKUP"},
		{"pg", "PG_REMOTE", "CRON_SCHEDULE_HEALTH"},
		{"minio", "MINIO_REMOTE", "CRON_SCHEDULE_BACKUP"},
		{"minio", "MINIO_REMOTE", "CRON_SCHEDULE_HEALTH"},
	} {
		defaultChecked++
		start := strings.Index(text, "const "+c.obj+" = {")
		if start < 0 {
			t.Fatalf("%s 里找不到 const %s", rel, c.obj)
		}
		end := strings.Index(text[start:], "\n};")
		if end < 0 {
			t.Fatalf("%s 里 %s 没有结束标记", rel, c.obj)
		}
		re := regexp.MustCompile(`\b` + c.key + `:'([^']*)'`)
		m := re.FindStringSubmatch(text[start : start+end])
		want, ok := shared.EnvDefault(c.comp, c.key)
		if !ok {
			t.Fatalf("schema 里没有 %s/%s", c.comp, c.key)
		}
		if m == nil {
			t.Errorf("%s 的 %s 里找不到 %s 的演示默认值", rel, c.obj, c.key)
			continue
		}
		if m[1] != want {
			t.Errorf("%s：%s.%s 演示默认值 %q 与 schema 的 %q 不一致；%s", rel, c.obj, c.key, m[1], want, genHint)
		}
	}
	if labelChecked < 20 || groupChecked < 7 || defaultChecked != 5 {
		t.Errorf("原型解析数量异常（标签 %d / 分组 %d / 默认值 %d）；META 结构或正则可能变了，断言等于空转",
			labelChecked, groupChecked, defaultChecked)
	}
	t.Logf("核对了原型 %d 个标签 / %d 个分组 / %d 个演示默认值", labelChecked, groupChecked, defaultChecked)
}
