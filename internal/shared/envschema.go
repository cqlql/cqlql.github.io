package shared

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
)

// 备份 env 键的唯一事实源。
//
// 以前同一个键的默认值手抄在四处：backup.env.example、deploy/backup/**/*.sh
// 里的 ${KEY:-默认值}、internal/ui/config_edit.go 的界面白名单、docs/config.md。
// 2026-11-07 就抓到 PG_LOCAL_RETENTION_DAYS 模板写 7、脚本兜底写 3。
// 现在只认 env-schema.json：模板与脚本字面量由 `ops __gen-backup-env` 生成，
// 界面白名单在运行时直接读这里，go test 断言所有生成物与它一致。
//
// 🔴 这里只放「键定义」，不放任何真实凭证：整个 internal/shared 会被编进二进制。
//    填好的值在配置目录 backup/{postgres,minio}.env（见 docs/config.md）。

//go:embed env-schema.json
var envSchemaJSON []byte

// EnvKeyDef 是一个备份配置键。Default 是运行时默认值（空串 = 必须人填）；
// Placeholder 只是模板里给人看的占位文案，不参与运行时，也不进生成物之外的地方。
type EnvKeyDef struct {
	Key         string   `json:"key"`
	Default     string   `json:"default"`
	Label       string   `json:"label"`
	Group       string   `json:"group"`
	Secret      bool     `json:"secret,omitempty"`
	Placeholder string   `json:"placeholder,omitempty"`
	Notes       []string `json:"notes,omitempty"`
}

type envSchemaFile struct {
	Comment    string                 `json:"$comment"`
	Components map[string][]EnvKeyDef `json:"components"`
}

var envKeyRe = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)

var (
	envSchemaOnce sync.Once
	envSchemaVal  envSchemaFile
	envSchemaErr  error
)

func loadEnvSchema() (envSchemaFile, error) {
	envSchemaOnce.Do(func() {
		var s envSchemaFile
		if err := json.Unmarshal(envSchemaJSON, &s); err != nil {
			envSchemaErr = fmt.Errorf("解析 env-schema.json 失败：%w", err)
			return
		}
		for _, comp := range EnvComponents() {
			defs, ok := s.Components[comp]
			if !ok || len(defs) == 0 {
				envSchemaErr = fmt.Errorf("env-schema.json 缺少组件 %s 的键表", comp)
				return
			}
			seen := map[string]bool{}
			groupSeen := map[string]bool{}
			lastGroup := ""
			for _, d := range defs {
				if !envKeyRe.MatchString(d.Key) {
					envSchemaErr = fmt.Errorf("%s: 非法键名 %q", comp, d.Key)
					return
				}
				if seen[d.Key] {
					envSchemaErr = fmt.Errorf("%s: 键 %s 重复定义", comp, d.Key)
					return
				}
				seen[d.Key] = true
				if d.Label == "" || d.Group == "" {
					envSchemaErr = fmt.Errorf("%s: %s 缺少 label 或 group", comp, d.Key)
					return
				}
				if strings.ContainsAny(d.Default, "\r\n") {
					envSchemaErr = fmt.Errorf("%s: %s 的 default 不能含换行", comp, d.Key)
					return
				}
				// 渲染模板时按「分组变化」输出小标题，交错排列会重复输出同一标题。
				if d.Group != lastGroup {
					if groupSeen[d.Group] {
						envSchemaErr = fmt.Errorf("%s: 分组 %q 不连续（%s 处又出现一次），模板会重复分组标题", comp, d.Group, d.Key)
						return
					}
					groupSeen[d.Group] = true
					lastGroup = d.Group
				}
				// 字段名像凭证就必须标 secret，避免新键在界面上被明文回显。
				// 反向不限制：ALERT_WEBHOOK 这类可以主动加严。
				if !d.Secret && IsSecretEnvKey(d.Key) {
					envSchemaErr = fmt.Errorf("%s: %s 看起来是凭证，必须标 secret=true", comp, d.Key)
					return
				}
				// schema / 模板都编进二进制：凭证键带「方便测试」的默认值 = 凭证跟着 exe 跑。
				if d.Secret && d.Default != "" {
					envSchemaErr = fmt.Errorf("%s: %s 是凭证键，default 必须为空（模板用 placeholder）", comp, d.Key)
					return
				}
			}
		}
		envSchemaVal = s
	})
	return envSchemaVal, envSchemaErr
}

// mustEnvSchema 用于运行时读取：embed 内容是编译期固定的，解析失败等于构建坏了。
func mustEnvSchema() envSchemaFile {
	s, err := loadEnvSchema()
	if err != nil {
		panic("env-schema.json 不可用：" + err.Error())
	}
	return s
}

// EnvComponents 固定顺序：注册表式遍历，不用 map 的随机顺序。
func EnvComponents() []string { return []string{"pg", "minio"} }

// EnvDefs 是界面配置页白名单的唯一来源（配置页、远端值对照都调它）。
func EnvDefs(component string) []EnvKeyDef {
	s := mustEnvSchema()
	out := make([]EnvKeyDef, len(s.Components[component]))
	copy(out, s.Components[component])
	return out
}

// EnvDefault 返回某组件某键的运行时默认值。
func EnvDefault(component, key string) (string, bool) {
	for _, d := range EnvDefs(component) {
		if d.Key == key {
			return d.Default, true
		}
	}
	return "", false
}

// EnvKeySet 是两组键的并集，给「扫描脚本里有没有游离默认值」的测试用。
func EnvKeySet() map[string]bool {
	s := mustEnvSchema()
	out := map[string]bool{}
	for _, defs := range s.Components {
		for _, d := range defs {
			out[d.Key] = true
		}
	}
	return out
}

// EnvSchemaComment 供生成器写进产物头部。
func EnvSchemaComment() string { return mustEnvSchema().Comment }

func quoteEnvValue(v string) string {
	v = strings.ReplaceAll(v, `\`, `\\`)
	v = strings.ReplaceAll(v, `"`, `\"`)
	v = strings.ReplaceAll(v, `$`, `\$`)
	v = strings.ReplaceAll(v, "`", "\\`")
	return `"` + v + `"`
}

// RenderEnvExample 生成 backup.env.example 的完整内容。
// 它是 `ops backup env` 的模板，也是 install.sh 在远端生成 backup.env 的蓝本。
func RenderEnvExample(component string) ([]byte, error) {
	s, err := loadEnvSchema()
	if err != nil {
		return nil, err
	}
	defs, ok := s.Components[component]
	if !ok {
		return nil, fmt.Errorf("未知组件 %q", component)
	}
	title := map[string]string{"pg": "PostgreSQL", "minio": "MinIO"}[component]

	var b strings.Builder
	fmt.Fprintf(&b, "# ==========================================\n")
	fmt.Fprintf(&b, "# %s 备份环境变量配置模板\n", title)
	fmt.Fprintf(&b, "# 由 internal/shared/env-schema.json 生成，请勿手改。\n")
	fmt.Fprintf(&b, "# 改键 / 默认值：改 schema 后运行 ops __gen-backup-env；漏生成会被 go test 挡住。\n")
	fmt.Fprintf(&b, "# 复制为 backup.env 后填入真实值，勿提交 backup.env 到 Git\n")
	fmt.Fprintf(&b, "# ==========================================\n")

	group := ""
	for _, d := range defs {
		if d.Group != group {
			group = d.Group
			fmt.Fprintf(&b, "\n# ---------- %s ----------\n", group)
		} else {
			b.WriteString("\n")
		}
		for _, n := range d.Notes {
			fmt.Fprintf(&b, "# %s\n", n)
		}
		v := d.Default
		if d.Secret && d.Placeholder != "" {
			v = d.Placeholder
		}
		fmt.Fprintf(&b, "%s=%s\n", d.Key, quoteEnvValue(v))
	}
	return []byte(b.String()), nil
}

// RenderEnvDocTable 生成 docs/config.md 的键表区块（生成器写回文档时用）。
func RenderEnvDocTable() ([]byte, error) {
	s, err := loadEnvSchema()
	if err != nil {
		return nil, err
	}
	var b strings.Builder
	for _, comp := range EnvComponents() {
		fmt.Fprintf(&b, "### %s（`deploy/backup/%s/backup.env.example`）\n\n", comp, map[string]string{"pg": "postgres", "minio": "minio"}[comp])
		b.WriteString("| 键 | 默认值 | 分组 | 说明 | 凭证 |\n| :--- | :--- | :--- | :--- | :--- |\n")
		for _, d := range s.Components[comp] {
			def := d.Default
			if def == "" {
				def = "（空，必须人填）"
			} else {
				def = "`" + def + "`"
			}
			secret := ""
			if d.Secret {
				secret = "是"
			}
			fmt.Fprintf(&b, "| `%s` | %s | %s | %s | %s |\n", d.Key, def, d.Group, d.Label, secret)
		}
		b.WriteString("\n")
	}
	return []byte(b.String()), nil
}

// EnvSchemaKeysSorted 给测试与生成器做稳定输出。
func EnvSchemaKeysSorted() []string {
	keys := make([]string, 0, 40)
	for k := range EnvKeySet() {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
