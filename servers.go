package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// 服务器清单：schema、字段语义与校验规则见 docs/servers.md §3。
// 🔴 主机只来自这里，命令只接受清单里的 name，不接受任意 host。

const (
	sudoModeNopasswd = "nopasswd"
	sudoModeNone     = "none"
	sudoModeRoot     = "root"
)

type sudoConfig struct {
	Mode     string `json:"mode"`
	Password string `json:"password"`
}

type monitorAccount struct {
	User string `json:"user"`
	Key  string `json:"key"`
}

type server struct {
	Name    string          `json:"name"`
	Role    string          `json:"role"`
	Host    string          `json:"host"`
	Port    int             `json:"port"`
	User    string          `json:"user"`
	Key     string          `json:"key"`
	Sudo    sudoConfig      `json:"sudo"`
	Monitor *monitorAccount `json:"monitor"`
	Note    string          `json:"note"`
}

type serverList struct {
	Path    string   `json:"-"`
	Default string   `json:"default"`
	Servers []server `json:"servers"`
}

var (
	serverNameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)
	userNameRe   = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_-]*$`)
	validRoles   = map[string]bool{"backup": true, "app": true, "db": true, "other": true}
)

func loadServers(cfg *config) (*serverList, error) {
	path := cfg.ServersFile
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("服务器清单不存在：%s\n参考 docs/servers.md §3 创建（或运行 ops init 生成空模板）", path)
		}
		return nil, fmt.Errorf("读取服务器清单失败：%w", err)
	}
	if !isWindows() && info.Mode().Perm()&0o077 != 0 {
		return nil, fmt.Errorf("服务器清单权限过宽（%o）：%s，请执行 chmod 600", info.Mode().Perm(), path)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取服务器清单失败：%w", err)
	}
	var l serverList
	if err := json.Unmarshal(b, &l); err != nil {
		return nil, fmt.Errorf("解析服务器清单失败：%w", err)
	}
	l.Path = path
	if err := l.normalize(); err != nil {
		return nil, err
	}
	return &l, nil
}

func (l *serverList) normalize() error {
	if len(l.Servers) == 0 {
		return fmt.Errorf("服务器清单为空：%s\n参考 docs/servers.md §3 添加服务器", l.Path)
	}
	seen := map[string]bool{}
	hasPassword := false
	for i := range l.Servers {
		s := &l.Servers[i]
		if s.Name == "" {
			return fmt.Errorf("%s: servers[%d].name 不能为空", l.Path, i)
		}
		if !serverNameRe.MatchString(s.Name) {
			return fmt.Errorf("%s: name %q 非法（只允许字母数字与 . _ -）", l.Path, s.Name)
		}
		if seen[s.Name] {
			return fmt.Errorf("%s: name 重复：%s", l.Path, s.Name)
		}
		seen[s.Name] = true

		if s.Role == "" {
			return fmt.Errorf("%s: %s 缺少 role（backup/app/db/other）", l.Path, s.Name)
		}
		if !validRoles[s.Role] {
			return fmt.Errorf("%s: %s 的 role 非法：%s（可选 backup/app/db/other）", l.Path, s.Name, s.Role)
		}
		if s.Host != "" && (strings.HasPrefix(s.Host, "-") || strings.ContainsAny(s.Host, " \t\r\n")) {
			return fmt.Errorf("%s: %s 的 host 非法：%q", l.Path, s.Name, s.Host)
		}
		if s.Host == "" {
			return fmt.Errorf("%s: %s 缺少 host", l.Path, s.Name)
		}
		if s.User == "" {
			return fmt.Errorf("%s: %s 缺少 user", l.Path, s.Name)
		}
		if !userNameRe.MatchString(s.User) {
			return fmt.Errorf("%s: %s 的 user 非法：%q（只允许字母数字与 _ -）", l.Path, s.Name, s.User)
		}
		if s.Port == 0 {
			s.Port = 22
		}
		if s.Port < 1 || s.Port > 65535 {
			return fmt.Errorf("%s: %s 的 port 超出 1-65535：%d", l.Path, s.Name, s.Port)
		}

		switch s.Sudo.Mode {
		case "":
			s.Sudo.Mode = sudoModeNopasswd
		case sudoModeNopasswd, sudoModeNone, sudoModeRoot:
		default:
			return fmt.Errorf("%s: %s 的 sudo.mode 非法：%q（可选 nopasswd/none/root）", l.Path, s.Name, s.Sudo.Mode)
		}
		if s.Sudo.Mode == sudoModeRoot && s.User != "root" {
			return fmt.Errorf("%s: %s 的 sudo.mode=root 要求 user=root", l.Path, s.Name)
		}
		if s.Sudo.Password != "" {
			if strings.ContainsAny(s.Sudo.Password, "\r\n") {
				return fmt.Errorf("%s: %s 的 sudo.password 不能包含换行", l.Path, s.Name)
			}
			hasPassword = true
		}

		if s.Key != "" {
			s.Key = expandAndCheckKey(s.Key)
			if s.Key == "" {
				return fmt.Errorf("%s: %s 的 key 不存在或不可用（私钥路径不打印）", l.Path, s.Name)
			}
		}
		if s.Monitor != nil {
			if s.Monitor.User != "" && !userNameRe.MatchString(s.Monitor.User) {
				return fmt.Errorf("%s: %s 的 monitor.user 非法：%q", l.Path, s.Name, s.Monitor.User)
			}
			if s.Monitor.Key != "" {
				s.Monitor.Key = expandAndCheckKey(s.Monitor.Key)
				if s.Monitor.Key == "" {
					return fmt.Errorf("%s: %s 的 monitor.key 不存在或不可用（私钥路径不打印）", l.Path, s.Name)
				}
			}
		}
	}
	if l.Default != "" && !seen[l.Default] {
		return fmt.Errorf("%s: default 指向不存在的服务器：%s", l.Path, l.Default)
	}
	if hasPassword && !isWindows() {
		if info, err := os.Stat(l.Path); err == nil && info.Mode().Perm()&0o077 != 0 {
			return fmt.Errorf("清单含 sudo.password，文件权限必须是 600：%s", l.Path)
		}
	}
	return nil
}

// expandAndCheckKey 展开 ~ 并确认文件存在；失败返回空串（不打印路径）。
func expandAndCheckKey(p string) string {
	p = resolveLocalPath(p)
	if p == "" {
		return ""
	}
	info, err := os.Stat(p)
	if err != nil || info.IsDir() {
		return ""
	}
	if !isWindows() && info.Mode().Perm()&0o077 != 0 {
		return ""
	}
	return p
}

func (l *serverList) get(name string) (*server, error) {
	if name == "" {
		return nil, fmt.Errorf("必须指定服务器 name")
	}
	for i := range l.Servers {
		if l.Servers[i].Name == name {
			return &l.Servers[i], nil
		}
	}
	return nil, fmt.Errorf("清单里没有服务器：%s（可用 ops servers list 查看）", name)
}

// resolve 选定目标机：显式 name > ops.env 的 PASS_UP_OPS_DEFAULT_SERVER >
// 清单的 default > 唯一的 role=backup。
func (l *serverList) resolve(explicit, cfgDefault string) (*server, error) {
	if explicit != "" {
		return l.get(explicit)
	}
	if cfgDefault != "" {
		return l.get(cfgDefault)
	}
	if l.Default != "" {
		return l.get(l.Default)
	}
	var backups []*server
	for i := range l.Servers {
		if l.Servers[i].Role == "backup" {
			backups = append(backups, &l.Servers[i])
		}
	}
	if len(backups) == 1 {
		return backups[0], nil
	}
	return nil, fmt.Errorf("未指定 --server，且无法自动选择（role=backup 有 %d 台）；请显式给 --server <name>", len(backups))
}

// monitorTarget 返回只读监控使用的账号；未配置 monitor 时复用登录账号。
func (s *server) monitorTarget() (user, key string) {
	user, key = s.User, s.Key
	if s.Monitor != nil {
		if s.Monitor.User != "" {
			user = s.Monitor.User
		}
		if s.Monitor.Key != "" {
			key = s.Monitor.Key
		}
	}
	return user, key
}

// ---- 最近一次检查结果（仅缓存，不是配置；未检查过显示 —） ----

type serverStatus struct {
	SSH       string `json:"ssh,omitempty"`  // ok / fail / unknown
	Sudo      string `json:"sudo,omitempty"` // ok / need / root / disabled / error
	Detail    string `json:"detail,omitempty"`
	CheckedAt string `json:"checked_at,omitempty"`
}

type statusFile struct {
	Servers map[string]serverStatus `json:"servers"`
}

func statePath(serversFile string) string {
	return filepath.Join(filepath.Dir(serversFile), "servers.state.json")
}

func loadServerState(serversFile string) map[string]serverStatus {
	b, err := os.ReadFile(statePath(serversFile))
	if err != nil {
		return map[string]serverStatus{}
	}
	var st statusFile
	if err := json.Unmarshal(b, &st); err != nil || st.Servers == nil {
		return map[string]serverStatus{}
	}
	return st.Servers
}

func saveServerState(serversFile string, states map[string]serverStatus) error {
	b, err := json.MarshalIndent(statusFile{Servers: states}, "", "  ")
	if err != nil {
		return err
	}
	p := statePath(serversFile)
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return err
	}
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

func sudoLabel(st serverStatus) string {
	switch st.Sudo {
	case "ok":
		return "已免密"
	case "need":
		return "需要配置"
	case "root":
		return "root 登录"
	case "disabled":
		return "已跳过"
	case "error":
		return "连接失败"
	default:
		return "—"
	}
}

func sshLabel(st serverStatus) string {
	switch st.SSH {
	case "ok":
		return "可达"
	case "fail":
		return "失败"
	default:
		return "—"
	}
}

// serverInfo 对外展示用：绝不包含私钥路径。
type serverInfo struct {
	Name               string       `json:"name"`
	Role               string       `json:"role"`
	User               string       `json:"user"`
	Host               string       `json:"host"`
	Port               int          `json:"port"`
	SudoMode           string       `json:"sudo_mode"`
	HasKey             bool         `json:"has_key"`
	PasswordConfigured bool         `json:"password_configured"`
	Note               string       `json:"note,omitempty"`
	Status             serverStatus `json:"status"`
}

func (s *server) info(st serverStatus) serverInfo {
	return serverInfo{
		Name:               s.Name,
		Role:               s.Role,
		User:               s.User,
		Host:               s.Host,
		Port:               s.Port,
		SudoMode:           s.Sudo.Mode,
		HasKey:             s.Key != "",
		PasswordConfigured: s.Sudo.Password != "",
		Note:               s.Note,
		Status:             st,
	}
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = strings.TrimSpace(s[:i])
	}
	if len(s) > 200 {
		s = s[:200] + "…"
	}
	return s
}
