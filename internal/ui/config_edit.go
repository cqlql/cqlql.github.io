package ui

import (
	"pass-up/ops/internal/shared"
)

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// 界面上的「配置」页要改两份本机文件：servers.json 与 backup/{postgres,minio}.env。
//
// 🔴 这一层只做纯文件编辑，不碰 HTTP、不碰远端。三条硬边界：
//   - 路径由调用方从 ops.env 解析，这里只接收已经确定的绝对路径；
//   - 字段白名单：清单只改白名单字段，env 只改「模板定义过 / 文件里已有」的键，
//     前端塞任意键不会变成一条新的 shell 变量；
//   - 写前先落 .tmp 并借 shared.LoadServers 做全量校验（env 则做值转义），
//     通过后才 .bak + 原子替换；失败时原文件一字未动。
//
// env 会被远端 install.sh / 备份脚本 `source`，所以值必须转义：否则一个
// `$(...)` 或反引号就会在部署时变成命令执行。见 docs/ui.md §12。

// ---------- 服务器清单 ----------

// name 是主键（state 缓存、default 都按它索引），不允许改；
// sudo.password 单独作为可写字段，但页面只留空/覆盖两态，不回显。
var serverEditableFields = map[string]bool{
	"role": true, "host": true, "port": true, "user": true,
	"key": true, "note": true, "sudo_mode": true, "sudo_password": true,
}

type serverEditResult struct {
	Changed          []string `json:"changed"`
	UserChanged      bool     `json:"user_changed"`
	SudoModeChanged  bool     `json:"sudo_mode_changed"`
	NeedsSudoReapply bool     `json:"needs_sudo_reapply"`
}

// editServersFile 用 map 解码而不是 Server 结构体：清单里未来新增的字段、
// monitor 等不参与编辑的字段都要原样留着，结构体 marshal 会把它们丢掉。
func editServersFile(path, name string, fields map[string]string) (serverEditResult, error) {
	var res serverEditResult
	for k := range fields {
		if !serverEditableFields[k] {
			return res, fmt.Errorf("不允许修改的字段：%s", k)
		}
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return res, fmt.Errorf("读取服务器清单失败：%w", err)
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var root map[string]any
	if err := dec.Decode(&root); err != nil {
		return res, fmt.Errorf("解析服务器清单失败：%w", err)
	}
	arr, ok := root["servers"].([]any)
	if !ok {
		return res, fmt.Errorf("服务器清单缺少 servers 数组")
	}
	var item map[string]any
	for _, v := range arr {
		m, ok := v.(map[string]any)
		if ok && m["name"] == name {
			item = m
			break
		}
	}
	if item == nil {
		return res, fmt.Errorf("清单里没有服务器：%s", name)
	}

	oldUser, _ := item["user"].(string)
	oldMode := sudoModeOf(item)
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys) // 稳定顺序，便于测试与日志
	for _, k := range keys {
		v := fields[k]
		if v == "" {
			continue // 空值 = 不修改；凭证字段靠这个语义保持原值
		}
		switch k {
		case "port":
			n, err := strconv.Atoi(v)
			if err != nil {
				return res, fmt.Errorf("port 必须是数字：%q", v)
			}
			item["port"] = n
		case "sudo_mode", "sudo_password":
			sudo, ok := item["sudo"].(map[string]any)
			if !ok {
				sudo = map[string]any{}
				item["sudo"] = sudo
			}
			if k == "sudo_mode" {
				sudo["mode"] = v
			} else {
				sudo["password"] = v
			}
		default:
			item[k] = v
		}
		res.Changed = append(res.Changed, k)
	}
	if v := fields["user"]; v != "" && v != oldUser {
		res.UserChanged = true
	}
	if v := fields["sudo_mode"]; v != "" && v != oldMode {
		res.SudoModeChanged = true
	}
	res.NeedsSudoReapply = res.UserChanged || res.SudoModeChanged

	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return res, err
	}
	out = append(out, '\n')

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, out, 0o600); err != nil {
		return res, fmt.Errorf("写临时清单失败：%w", err)
	}
	// 复用清单的全部校验规则（字段格式、sudo.mode 组合、default 指向、私钥存在性）。
	if _, err := shared.LoadServers(&shared.Config{ServersFile: tmp}); err != nil {
		_ = os.Remove(tmp)
		return res, fmt.Errorf("修改后的清单校验不通过，未写入：%w", err)
	}
	if err := writeWithBackup(path, tmp, out); err != nil {
		return res, err
	}
	if len(res.Changed) == 0 {
		return res, fmt.Errorf("没有需要保存的修改")
	}
	return res, nil
}

// addServersFile 在清单里追加一台服务器。
//
// 首次使用时 servers.json 常常只是 ops init 的空模板，甚至还不存在；而
// editServersFile 只能改**已有**的 name，空清单时配置页的保存按钮是灰的，
// 人还得去编辑器手敲一段 JSON —— 与「界面上就能配」正相反。
//
// 🔴 与 editServersFile 共用同一套约束，不另开一条写入路径：
//   - 字段白名单（多一个 name，且新增时必填）；
//   - 写前落 .tmp，借 shared.LoadServers 做**全量**校验（名称 / role / host /
//     user / sudo.mode / 私钥存在性 / default 指向），不通过则原文件一字未动；
//   - .bak + 原子替换，权限 0600；
//   - 写操作一律在调用方过 confirm=yes 与「备份任务在跑就 409」两道门。
func addServersFile(path string, fields map[string]string) (serverEditResult, error) {
	var res serverEditResult
	allowed := map[string]bool{"name": true}
	for k := range serverEditableFields {
		allowed[k] = true
	}
	for k := range fields {
		if !allowed[k] {
			return res, fmt.Errorf("不允许修改的字段：%s", k)
		}
	}
	name := strings.TrimSpace(fields["name"])
	if name == "" {
		return res, fmt.Errorf("请填写服务器名称（name）")
	}

	raw, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return res, fmt.Errorf("读取服务器清单失败：%w", err)
	}
	root := map[string]any{}
	if len(bytes.TrimSpace(raw)) > 0 {
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.UseNumber()
		if err := dec.Decode(&root); err != nil {
			return res, fmt.Errorf("解析服务器清单失败：%w", err)
		}
	}
	arr, ok := root["servers"].([]any)
	if !ok {
		if root["servers"] != nil {
			return res, fmt.Errorf("服务器清单的 servers 不是数组")
		}
		arr = []any{}
	}
	for _, v := range arr {
		if m, ok := v.(map[string]any); ok && m["name"] == name {
			return res, fmt.Errorf("清单里已有同名服务器：%s（要改它请回到编辑模式）", name)
		}
	}

	// 不给也能通过全量校验的默认值：一台最普通的备份端。
	item := map[string]any{
		"name": name,
		"role": "backup",
		"port": 22,
		"sudo": map[string]any{"mode": shared.SudoModeNopasswd},
	}
	for k, v := range fields {
		v = strings.TrimSpace(v)
		if v == "" || k == "name" {
			continue
		}
		switch k {
		case "port":
			n, err := strconv.Atoi(v)
			if err != nil {
				return res, fmt.Errorf("port 必须是数字：%q", v)
			}
			item["port"] = n
		case "sudo_mode", "sudo_password":
			sudo, ok := item["sudo"].(map[string]any)
			if !ok {
				sudo = map[string]any{}
				item["sudo"] = sudo
			}
			if k == "sudo_mode" {
				sudo["mode"] = v
			} else {
				sudo["password"] = v
			}
		default:
			item[k] = v
		}
		res.Changed = append(res.Changed, k)
	}
	sort.Strings(res.Changed)
	root["servers"] = append(arr, item)
	if _, ok := root["default"]; !ok {
		root["default"] = ""
	}

	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return res, err
	}
	out = append(out, '\n')
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return res, fmt.Errorf("创建配置目录失败：%w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, out, 0o600); err != nil {
		return res, fmt.Errorf("写临时清单失败：%w", err)
	}
	if _, err := shared.LoadServers(&shared.Config{ServersFile: tmp}); err != nil {
		_ = os.Remove(tmp)
		return res, fmt.Errorf("新增后的清单校验不通过，未写入：%w", err)
	}
	if err := writeWithBackup(path, tmp, out); err != nil {
		return res, err
	}
	return res, nil
}

func sudoModeOf(item map[string]any) string {
	sudo, ok := item["sudo"].(map[string]any)
	if !ok {
		return ""
	}
	mode, _ := sudo["mode"].(string)
	return mode
}

// writeWithBackup 先留一份 .bak，再原子替换。tmp 已经写好并校验过。
func writeWithBackup(path, tmp string, data []byte) error {
	if raw, err := os.ReadFile(path); err == nil {
		_ = os.WriteFile(path+".bak", raw, 0o600)
	}
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("写临时文件失败：%w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("替换配置文件失败：%w", err)
	}
	return nil
}

// ---------- 备份 env ----------

var (
	envKeyRe  = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
	envLineRe = regexp.MustCompile(`^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$`)
)

const maxEnvValueLen = 2048

// 白名单不再手抄：运行时直接读 internal/shared/env-schema.json（唯一事实源）。
// 以前这里抄了两张表（20 + 17 键），改模板键必须记得同步，漏一次新键就在页面上不可见；
// 现在配置页、远端值对照、模板、脚本默认值全部问同一份 schema。见 docs/config.md §4。
type envKeyDef = shared.EnvKeyDef

func envDefsFor(component string) ([]envKeyDef, bool) {
	switch component {
	case "pg", "minio":
		return shared.EnvDefs(component), true
	default:
		return nil, false
	}
}

// secret 判定按字段名兜底：模板之外、文件里已有的键也不能把凭证回显出去。
// 与只读抓取 CLI 共用 shared 的实现，避免两端口径不一致。
func isSecretEnvKey(k string) bool {
	return shared.IsSecretEnvKey(k)
}

type envField struct {
	Key        string `json:"key"`
	Label      string `json:"label"`
	Group      string `json:"group"`
	Value      string `json:"value"`
	Secret     bool   `json:"secret"`
	Configured bool   `json:"configured"`
	// Default 是「留空时脚本会用到的运行时默认值」，只来自 env-schema.json。
	// 🔴 凭证键与 schema 里 default 为空的键必须是空串：前者带默认值等于凭证跟着 exe 跑，
	//    后者的空值是有语义的（跳过检查 / 不限速 / 不推送），填了会静默改掉脚本执行逻辑。
	Default string `json:"default"`
}

// envDefaultFor 只查 schema 的 default，不猜、不兜底。
// 文件里冒出来的未知键（不在白名单里）一律不给默认值。
func envDefaultFor(defs []envKeyDef, key string, secret bool) string {
	if secret {
		return ""
	}
	for _, d := range defs {
		if d.Key == key {
			return d.Default
		}
	}
	return ""
}

// readEnvFields 返回可编辑字段。凭证字段 value 恒为空，只给 configured 标记。
// 文件不存在时按模板返回一组空字段，让人可以直接在页面填出一份新配置。
func readEnvFields(path string, defs []envKeyDef) ([]envField, map[string]bool, error) {
	existing := map[string]bool{}
	// 恒非 nil：JSON 里的 null 会被前端当数组用（env.fields.map），契约见 config_compare.go。
	fields := make([]envField, 0, len(defs))
	raw, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return nil, nil, fmt.Errorf("读取备份配置失败：%w", err)
	}
	if err == nil {
		for _, line := range strings.Split(string(raw), "\n") {
			m := envLineRe.FindStringSubmatch(line)
			if m == nil {
				continue
			}
			k, v := m[1], unquoteEnv(strings.TrimSpace(m[2]))
			if !envKeyRe.MatchString(k) || existing[k] {
				continue
			}
			existing[k] = true
			label, group := k, "其它"
			for _, d := range defs {
				if d.Key == k {
					label, group = d.Label, d.Group
					break
				}
			}
			secret := isSecretEnvKey(k)
			value := ""
			if !secret {
				value = v
			}
			fields = append(fields, envField{
				Key: k, Label: label, Group: group, Value: value,
				Secret: secret, Configured: v != "",
				Default: envDefaultFor(defs, k, secret),
			})
		}
	}
	for _, d := range defs {
		if existing[d.Key] {
			continue
		}
		secret := d.Secret || isSecretEnvKey(d.Key)
		fields = append(fields, envField{
			Key: d.Key, Label: d.Label, Group: d.Group, Value: "",
			Secret: secret, Configured: false,
			Default: envDefaultFor(defs, d.Key, secret),
		})
	}
	return fields, existing, nil
}

// editEnvFile 只替换「模板定义过或文件里已有」的键，其余行（注释、空行、
// 未来新增的键）原样保留。值统一用双引号包裹并转义 shell 元字符。
func editEnvFile(path string, defs []envKeyDef, fields map[string]string) ([]string, error) {
	allowed := map[string]bool{}
	for _, d := range defs {
		allowed[d.Key] = true
	}
	_, existing, err := readEnvFields(path, defs)
	if err != nil {
		return nil, err
	}
	for k := range existing {
		allowed[k] = true
	}
	keys := make([]string, 0, len(fields))
	for k := range fields {
		if !envKeyRe.MatchString(k) || !allowed[k] {
			return nil, fmt.Errorf("不允许修改的配置键：%s", k)
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	raw, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("读取备份配置失败：%w", err)
	}
	lines := []string{}
	if len(raw) > 0 {
		lines = strings.Split(strings.TrimRight(string(raw), "\n"), "\n")
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(lines)+len(keys))
	for _, line := range lines {
		m := envLineRe.FindStringSubmatch(line)
		if m == nil {
			out = append(out, line)
			continue
		}
		k := m[1]
		v, ok := fields[k]
		if !ok || v == "" || seen[k] {
			out = append(out, line)
			continue
		}
		if err := validateEnvValue(v); err != nil {
			return nil, fmt.Errorf("%s：%w", k, err)
		}
		out = append(out, k+"="+quoteEnvValue(v))
		seen[k] = true
	}
	var changed []string
	for _, k := range keys {
		v := fields[k]
		if v == "" {
			continue // 空值 = 保持不变，凭证字段靠它避免被误清
		}
		if err := validateEnvValue(v); err != nil {
			return nil, fmt.Errorf("%s：%w", k, err)
		}
		if !seen[k] {
			out = append(out, k+"="+quoteEnvValue(v))
			seen[k] = true
		}
		changed = append(changed, k)
	}
	if len(changed) == 0 {
		return nil, fmt.Errorf("没有需要保存的修改")
	}
	data := []byte(strings.Join(out, "\n") + "\n")
	tmp := path + ".tmp"
	if err := writeWithBackup(path, tmp, data); err != nil {
		return nil, err
	}
	return changed, nil
}

func validateEnvValue(v string) error {
	if strings.ContainsAny(v, "\r\n") {
		return fmt.Errorf("值不能包含换行")
	}
	if len(v) > maxEnvValueLen {
		return fmt.Errorf("值过长（上限 %d 字节）", maxEnvValueLen)
	}
	return nil
}

// quoteEnvValue 让值在被 shell source 时只是字面量：
// 反斜杠、双引号、$、反引号全部转义，$(...) 与 `...` 都不会被求值。
func quoteEnvValue(v string) string {
	r := strings.NewReplacer(
		`\`, `\\`,
		`"`, `\"`,
		`$`, `\$`,
		"`", "\\`",
	)
	return `"` + r.Replace(v) + `"`
}

func unquoteEnv(s string) string {
	return shared.UnquoteEnvValue(s)
}
