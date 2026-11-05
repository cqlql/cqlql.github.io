package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// config 与 docs/config.md 一一对应；新增键先改文档，再改这里。
// 主机 / 端口 / SSH 用户 / 私钥 / sudo 凭据只在服务器清单（servers.json）里。
type config struct {
	Path string

	ServersFile   string
	DefaultServer string

	DeployDir    string
	SrcDir       string
	PGEnvFile    string
	MinioEnvFile string
}

const configTemplate = `# Pass-up 本地运维工具配置
# 服务器清单（主机 / 用户 / 私钥 / sudo 凭据只写在这里指向的 JSON）
# 留空使用默认路径：Windows %AppData%\pass-up\servers.json，其它 ~/.config/pass-up/servers.json
PASS_UP_OPS_SERVERS_FILE=
# 省略 --server 时的默认服务器名；留空则取清单里的 default，再退化为唯一的 backup
PASS_UP_OPS_DEFAULT_SERVER=

# 备份能力安装（P1；目标机由 --server 选择）
PASS_UP_OPS_BACKUP_DEPLOY_DIR=/opt/passup-backup
# 本机备份脚本源目录（相对当前目录）
PASS_UP_OPS_BACKUP_SRC_DIR=../pass-up.backend/deploy/backup

# 已填好的备份配置（含凭证，不入 Git）
PASS_UP_OPS_BACKUP_PG_ENV_FILE=../pass-up.backend/deploy/backup/postgres/backup.env
PASS_UP_OPS_BACKUP_MINIO_ENV_FILE=../pass-up.backend/deploy/backup/minio/backup.env
`

const serversTemplate = `{
  "default": "",
  "servers": []
}
`

// remotePathRe 与 docs/config.md 的远端路径校验保持一致。
var remotePathRe = regexp.MustCompile(`^/[A-Za-z0-9._/-]+$`)

func userConfigDir() string {
	if dir := os.Getenv(configDirEnv); dir != "" {
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

func configPath() string {
	if p := os.Getenv("PASS_UP_OPS_ENV"); p != "" {
		return p
	}
	if dir := userConfigDir(); dir != "" {
		return filepath.Join(dir, "ops.env")
	}
	return "ops.env"
}

func defaultServersPath() string {
	if dir := userConfigDir(); dir != "" {
		return filepath.Join(dir, "servers.json")
	}
	return "servers.json"
}

func isWindows() bool {
	return os.PathSeparator == '\\'
}

func defaultConfig(path string) *config {
	cwd, err := os.Getwd()
	if err != nil {
		cwd = "."
	}
	base := filepath.Join(cwd, "..", "pass-up.backend", "deploy", "backup")
	return &config{
		Path:         path,
		ServersFile:  defaultServersPath(),
		DeployDir:    "/opt/passup-backup",
		SrcDir:       base,
		PGEnvFile:    filepath.Join(base, "postgres", "backup.env"),
		MinioEnvFile: filepath.Join(base, "minio", "backup.env"),
	}
}

func loadConfig() (*config, error) {
	path := configPath()
	c := defaultConfig(path)

	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("配置文件不存在：%s\n先运行 ops init 生成模板", path)
		}
		return nil, fmt.Errorf("读取配置失败：%w", err)
	}
	defer f.Close()

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

		switch k {
		case "PASS_UP_OPS_SERVERS_FILE":
			if v != "" {
				c.ServersFile = resolveLocalPath(v)
			}
		case "PASS_UP_OPS_DEFAULT_SERVER":
			c.DefaultServer = v
		case "PASS_UP_OPS_BACKUP_DEPLOY_DIR":
			c.DeployDir = v
		case "PASS_UP_OPS_BACKUP_SRC_DIR":
			c.SrcDir = resolveLocalPath(v)
		case "PASS_UP_OPS_BACKUP_PG_ENV_FILE":
			c.PGEnvFile = resolveLocalPath(v)
		case "PASS_UP_OPS_BACKUP_MINIO_ENV_FILE":
			c.MinioEnvFile = resolveLocalPath(v)
		default:
			// 未知键忽略：ops.env 由人维护，允许保留历史键。
		}
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("读取配置失败：%w", err)
	}
	if err := c.validate(); err != nil {
		return nil, err
	}
	return c, nil
}

func (c *config) validate() error {
	if c.ServersFile == "" {
		return fmt.Errorf("服务器清单路径为空")
	}
	if !remotePathRe.MatchString(c.DeployDir) || strings.Contains(c.DeployDir, "..") {
		return fmt.Errorf("PASS_UP_OPS_BACKUP_DEPLOY_DIR 必须是以 / 开头且不含 .. 的安全远端路径：%q", c.DeployDir)
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

func cmdInit(args []string) int {
	if len(args) > 0 {
		fmt.Fprintln(os.Stderr, "用法: ops init")
		return 2
	}
	path := configPath()
	if _, err := os.Stat(path); err == nil {
		fmt.Printf("配置已存在：%s\n未覆盖。\n", path)
	} else {
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 创建配置目录失败：%v\n", err)
			return 1
		}
		if err := os.WriteFile(path, []byte(configTemplate), 0o600); err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 写入配置失败：%v\n", err)
			return 1
		}
		fmt.Printf("已生成配置：%s\n请填写 PASS_UP_OPS_SERVERS_FILE 等键后再运行。\n", path)
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
