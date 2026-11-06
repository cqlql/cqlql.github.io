package ui

import (
	"pass-up/ops/internal/shared"
)

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
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

type envKeyDef struct {
	Key    string
	Label  string
	Group  string
	Secret bool
}

// 白名单 = 模板定义过的键；文件里已有的键也允许改（见 editEnvFile）。
// 与 deploy/backup/<组件>/backup.env.example 逐字对齐，新增键先改模板再改这里。
var pgEnvDefs = []envKeyDef{
	{"PG_CONTAINER_NAME", "主服务器 PG 容器名", "主服务器", false},
	{"PG_DB_USER", "数据库用户", "主服务器", false},
	{"PG_DB_NAME", "业务库名", "主服务器", false},
	{"PG_SSH_HOST", "主服务器地址", "SSH 连接（备份端 → 主服务器）", false},
	{"PG_SSH_PORT", "SSH 端口", "SSH 连接（备份端 → 主服务器）", false},
	{"PG_SSH_USER", "SSH 登录用户", "SSH 连接（备份端 → 主服务器）", false},
	{"PG_SSH_KEY", "备份端私钥路径", "SSH 连接（备份端 → 主服务器）", true},
	{"PG_SSH_OPTS", "SSH 额外选项", "SSH 连接（备份端 → 主服务器）", false},
	{"PG_BACKUP_ROOT", "备份根目录", "备份端", false},
	{"PG_BACKUP_LOG_DIR", "日志目录", "备份端", false},
	{"PG_LOCAL_RETENTION_DAYS", "本地保留天数", "备份端", false},
	{"PG_WEEKLY_RETENTION_DAYS", "周备保留天数", "备份端", false},
	{"PG_MONTHLY_RETENTION_DAYS", "月备保留天数", "备份端", false},
	{"PG_RESTORE_JOBS", "恢复并发数", "备份端", false},
	{"CRON_SCHEDULE_BACKUP", "备份定时（cron）", "定时任务", false},
	{"CRON_SCHEDULE_HEALTH", "巡检定时（cron）", "定时任务", false},
	{"BACKUP_HEALTH_THRESHOLD_HOURS", "健康阈值（小时）", "巡检", false},
	{"BACKUP_DISK_MOUNT", "数据盘挂载点", "巡检", false},
	{"BACKUP_DISK_CRIT_PCT", "磁盘告警百分比", "巡检", false},
	{"ALERT_WEBHOOK", "告警 Webhook", "巡检", true},
}

var minioEnvDefs = []envKeyDef{
	{"SRC_URL", "源 MinIO 地址", "源端", false},
	{"SRC_KEY", "源端 Access Key", "源端", true},
	{"SRC_SECRET", "源端 Secret Key", "源端", true},
	{"SRC_BUCKETS", "源桶列表", "源端", false},
	{"DEST_URL", "目标 MinIO 地址", "备份端", false},
	{"DEST_KEY", "目标 Access Key", "备份端", true},
	{"DEST_SECRET", "目标 Secret Key", "备份端", true},
	{"DEST_BUCKET_PREFIX", "备份桶前缀", "备份端", false},
	{"MINIO_CONTAINER_NAME", "MinIO 容器名", "备份端", false},
	{"UPLOAD_LIMIT", "上传限速", "备份端", false},
	{"BACKUP_LOG_DIR", "日志目录", "备份端", false},
	{"CRON_SCHEDULE_BACKUP", "备份定时（cron）", "定时任务", false},
	{"CRON_SCHEDULE_HEALTH", "巡检定时（cron）", "定时任务", false},
	{"BACKUP_DISK_MOUNT", "数据盘挂载点", "巡检", false},
	{"BACKUP_HEALTH_THRESHOLD_HOURS", "健康阈值（小时）", "巡检", false},
	{"BACKUP_DISK_CRIT_PCT", "磁盘告警百分比", "巡检", false},
	{"ALERT_WEBHOOK", "告警 Webhook", "巡检", true},
}

func envDefsFor(component string) ([]envKeyDef, bool) {
	switch component {
	case "pg":
		return pgEnvDefs, true
	case "minio":
		return minioEnvDefs, true
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
}

// readEnvFields 返回可编辑字段。凭证字段 value 恒为空，只给 configured 标记。
// 文件不存在时按模板返回一组空字段，让人可以直接在页面填出一份新配置。
func readEnvFields(path string, defs []envKeyDef) ([]envField, map[string]bool, error) {
	existing := map[string]bool{}
	var fields []envField
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
			fields = append(fields, envField{k, label, group, value, secret, v != ""})
		}
	}
	for _, d := range defs {
		if existing[d.Key] {
			continue
		}
		secret := d.Secret || isSecretEnvKey(d.Key)
		fields = append(fields, envField{d.Key, d.Label, d.Group, "", secret, false})
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
