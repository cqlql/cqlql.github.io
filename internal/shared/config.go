package shared

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// 配置目录覆盖变量：界面、快捷方式、菜单都从本机配置目录取同一份。
const ConfigDirEnv = "PASS_UP_OPS_CONFIG_DIR"

// Config 是 ops.env 解析后的结果；键定义（`ops init` 模板 / 默认值 / 赋值语义）
// 只在 opsenv.go 的 opsEnvKeys 里维护一次。
// 主机 / 端口 / SSH 用户 / 私钥 / sudo 凭据只在服务器清单（servers.json）里。
// 备份监控（P2a）的默认值：ops init 模板字面量与 defaultConfig() 运行时默认值
// 共用这一份常量，避免「模板写了 26、运行时却是 0」。
const (
	DefaultMonitorPGRoot          = "/data/backups/postgres"
	DefaultMonitorPGLog           = "/var/log/pg-backup"
	DefaultMonitorMinioLog        = "/var/log/minio-backup"
	DefaultMonitorDisk            = "/data"
	DefaultMonitorPGStaleHours    = 26.0
	DefaultMonitorMinioStaleHours = 26.0
	DefaultMonitorDiskWarnPct     = 90.0
)

// MonitorConfig 是 ops.env 里 P2 只读采集的路径与判定阈值。
// 路径都是**远端绝对路径**（配置加载时校验），MinioData 留空表示不采数据目录。
type MonitorConfig struct {
	PGRoot    string
	PGLog     string
	MinioLog  string
	MinioData string
	Disk      string

	PGStaleHours    float64
	MinioStaleHours float64
	DiskWarnPct     float64
}

type Config struct {
	Path string

	ServersFile   string
	DefaultServer string

	DeployDir    string
	SrcDir       string
	PGEnvFile    string
	MinioEnvFile string

	Monitor MonitorConfig

	// configErrors 收集「键合法但值非法」：Apply 不返回 error，统一在 validate() 报。
	configErrors []string
}

const serversTemplate = `{
  "default": "",
  "servers": []
}
`

// remotePathRe 与 docs/config.md 的远端路径校验保持一致。
var remotePathRe = regexp.MustCompile(`^/[A-Za-z0-9._/-]+$`)

func UserConfigDir() string {
	if dir := os.Getenv(ConfigDirEnv); dir != "" {
		return dir
	}
	if isWindows() {
		if dir, err := os.UserConfigDir(); err == nil {
			return filepath.Join(dir, "pass-up")
		}
	}
	if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
		return filepath.Join(xdg, "pass-up")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".config", "pass-up")
}

// ConfigPath 是 ops.env 的**唯一**路径规则：CLI、界面、启动器都问它。
// PASS_UP_OPS_ENV 直接给文件路径；否则按 UserConfigDir() 的优先级取目录
// （PASS_UP_OPS_CONFIG_DIR > os.UserConfigDir > XDG_CONFIG_HOME > ~/.config）。
// 🔴 不要在 .cmd 或其它文件里再拼一份 %APPDATA% 路径：覆盖变量一生效就会漂移。
func ConfigPath() string {
	if p := os.Getenv("PASS_UP_OPS_ENV"); p != "" {
		return p
	}
	if dir := UserConfigDir(); dir != "" {
		return filepath.Join(dir, "ops.env")
	}
	return "ops.env"
}

func defaultServersPath() string {
	if dir := UserConfigDir(); dir != "" {
		return filepath.Join(dir, "servers.json")
	}
	return "servers.json"
}

func isWindows() bool {
	return os.PathSeparator == '\\'
}

func defaultConfig(path string) *Config {
	envDir := BackupEnvDir()
	return &Config{
		Path:        path,
		ServersFile: defaultServersPath(),
		DeployDir:   DefaultBackupDeployDir,
		// SrcDir 留空 = 用编进二进制的那份脚本（deploy/backup 已嵌入，见 backupdist.go）。
		// 备份脚本不再从兄弟仓读，因此与当前工作目录无关，ops.exe 可以单独拷走使用。
		SrcDir:       "",
		PGEnvFile:    filepath.Join(envDir, "postgres.env"),
		MinioEnvFile: filepath.Join(envDir, "minio.env"),
		Monitor: MonitorConfig{
			PGRoot:          DefaultMonitorPGRoot,
			PGLog:           DefaultMonitorPGLog,
			MinioLog:        DefaultMonitorMinioLog,
			Disk:            DefaultMonitorDisk,
			PGStaleHours:    DefaultMonitorPGStaleHours,
			MinioStaleHours: DefaultMonitorMinioStaleHours,
			DiskWarnPct:     DefaultMonitorDiskWarnPct,
		},
	}
}

// setMonitorPath 是 P2 路径键共用的赋值语义：留空用运行时默认值；
// MinioData 例外（默认就是空 = 不采），显式写空也保持不采。
func (c *Config) setMonitorPath(dst *string, v string) {
	if v != "" {
		*dst = v
	}
}

// setMonitorNumber 把「键合法但值非法」收进 configErrors，由 validate() 统一报，
// 不让非法阈值静默退化成 0（0 会把「超过阈值」判成恒真）。
func (c *Config) setMonitorNumber(key, v string, dst *float64, max float64) {
	if v == "" {
		return
	}
	x, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
	if err != nil || math.IsNaN(x) || math.IsInf(x, 0) || x <= 0 || (max > 0 && x > max) {
		hint := "正数"
		if max > 0 {
			hint = fmt.Sprintf("1–%g 之间的正数", max)
		}
		c.configErrors = append(c.configErrors, fmt.Sprintf("%s 必须是%s：%q", key, hint, v))
		return
	}
	*dst = x
}

// BackupEnvDir 是本机备份配置目录（backup/{postgres,minio}.env）。
// 这两个文件含数据库/MinIO 凭证，既不进仓库（见 .gitignore），也不进二进制 ——
// 打包时由 backup deploy 以 0600 单独注入到远端 <组件>/backup.env。
func BackupEnvDir() string {
	return filepath.Join(UserConfigDir(), "backup")
}

// FallbackConfig 给「配置还没准备好」时的本机编辑用：路径规则与 LoadConfig
// 完全一致，只是不要求 ops.env 存在、也不因它格式错而失败。
//
// 🔴 只用于**本机文件编辑**（配置页读写 servers.json / backup/*.env）。
// 任何要连远端的动作仍必须走 LoadConfig 的严格校验 —— 拿默认路径去 ssh，
// 等于把「配置没读到」伪装成「目标机不可达」。
func FallbackConfig() *Config {
	return defaultConfig(ConfigPath())
}

func LoadConfig() (*Config, error) {
	path := ConfigPath()
	c := defaultConfig(path)

	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("配置文件不存在：%s\n先运行 ops init 生成模板", path)
		}
		return nil, fmt.Errorf("读取配置失败：%w", err)
	}
	defer f.Close()

	defs := opsEnvKeyIndex()
	sc := bufio.NewScanner(f)
	lineNo := 0
	for sc.Scan() {
		lineNo++
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			return nil, fmt.Errorf("%s 第 %d 行格式错误，应为 KEY=VALUE", path, lineNo)
		}
		k = strings.TrimSpace(k)
		v = unquote(strings.TrimSpace(v))

		// 🔴 只管本项目前缀：人自己放的普通变量保持历史兼容，忽略。
		//    PASS_UP_OPS_* 拼错却静默忽略最危险 ——「以为配了」比「没配」难查得多；
		//    界面 configForEditing / reload 会用 FallbackConfig 兜住，页面仍能打开改文件。
		if !strings.HasPrefix(k, OpsEnvPrefix) {
			continue
		}
		d, ok := defs[k]
		if !ok {
			return nil, unknownOpsEnvKeyError(path, lineNo, k)
		}
		d.Apply(c, v)
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("读取配置失败：%w", err)
	}
	if err := c.validate(); err != nil {
		return nil, err
	}
	return c, nil
}

func (c *Config) validate() error {
	if len(c.configErrors) > 0 {
		return fmt.Errorf("ops.env 配置错误：%s", strings.Join(c.configErrors, "；"))
	}
	if c.ServersFile == "" {
		return fmt.Errorf("服务器清单路径为空")
	}
	if !remotePathRe.MatchString(c.DeployDir) || strings.Contains(c.DeployDir, "..") {
		return fmt.Errorf("PASS_UP_OPS_BACKUP_DEPLOY_DIR 必须是以 / 开头且不含 .. 的安全远端路径：%q", c.DeployDir)
	}
	// P2 采集路径会拼进远端 sh 脚本：先在这里卡死绝对路径与 ..，
	// probeScript() 再对每段做 ShQuote（两道防线，见 docs/backup-monitor.md §3.1）。
	paths := []struct{ key, value string }{
		{"PASS_UP_OPS_PG_ROOT", c.Monitor.PGRoot},
		{"PASS_UP_OPS_PG_LOG", c.Monitor.PGLog},
		{"PASS_UP_OPS_MINIO_LOG", c.Monitor.MinioLog},
		{"PASS_UP_OPS_DISK", c.Monitor.Disk},
	}
	if c.Monitor.MinioData != "" {
		paths = append(paths, struct{ key, value string }{"PASS_UP_OPS_MINIO_DATA", c.Monitor.MinioData})
	}
	for _, p := range paths {
		if !remotePathRe.MatchString(p.value) || strings.Contains(p.value, "..") {
			return fmt.Errorf("%s 必须是以 / 开头且不含 .. 的安全远端路径：%q", p.key, p.value)
		}
	}
	for _, t := range []struct {
		key   string
		value float64
		max   float64
	}{
		{"PASS_UP_OPS_PG_STALE_HOURS", c.Monitor.PGStaleHours, 0},
		{"PASS_UP_OPS_MINIO_STALE_HOURS", c.Monitor.MinioStaleHours, 0},
		{"PASS_UP_OPS_DISK_WARN_PCT", c.Monitor.DiskWarnPct, 100},
	} {
		if t.value <= 0 || (t.max > 0 && t.value > t.max) {
			hint := "正数"
			if t.max > 0 {
				hint = fmt.Sprintf("1–%g 之间的正数", t.max)
			}
			return fmt.Errorf("%s 必须是%s：%g", t.key, hint, t.value)
		}
	}
	return nil
}

func unquote(s string) string {
	if len(s) >= 2 {
		if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
			return s[1 : len(s)-1]
		}
	}
	return s
}

func resolveLocalPath(p string) string {
	if p == "" {
		return ""
	}
	if strings.HasPrefix(p, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			p = filepath.Join(home, p[2:])
		}
	}
	if filepath.IsAbs(p) {
		return p
	}
	abs, err := filepath.Abs(p)
	if err != nil {
		return p
	}
	return abs
}

func CmdInit(args []string) int {
	if len(args) > 0 {
		fmt.Fprintln(os.Stderr, "用法: ops init")
		return 2
	}
	path := ConfigPath()
	if _, err := os.Stat(path); err == nil {
		fmt.Printf("配置已存在：%s\n未覆盖。\n", path)
	} else {
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 创建配置目录失败：%v\n", err)
			return 1
		}
		if err := os.WriteFile(path, []byte(RenderOpsEnvTemplate()), 0o600); err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 写入配置失败：%v\n", err)
			return 1
		}
		fmt.Printf("已生成配置：%s\nops.env 的路径键留空由程序推导默认值；backup.env 不适用（留空不会落盘、预检会判未配置），说明见 docs/config.md。\n", path)
	}

	servers := defaultServersPath()
	if _, err := os.Stat(servers); err == nil {
		fmt.Printf("服务器清单已存在：%s\n", servers)
		return 0
	}
	if err := os.MkdirAll(filepath.Dir(servers), 0o700); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 创建服务器清单目录失败：%v\n", err)
		return 1
	}
	if err := os.WriteFile(servers, []byte(serversTemplate), 0o600); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 写入服务器清单失败：%v\n", err)
		return 1
	}
	fmt.Printf("已生成服务器清单：%s\n请按 docs/servers.md §3 添加服务器。\n", servers)
	return 0
}
