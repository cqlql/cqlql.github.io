package backup

import (
	"pass-up/ops/internal/shared"
)

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	timeoutPrecheck  = 60 * time.Second
	timeoutUpload    = 10 * time.Minute
	timeoutDeps      = 15 * time.Minute
	timeoutInstall   = 10 * time.Minute
	timeoutPreflight = 5 * time.Minute
	timeoutRunNow    = 6 * time.Hour
)

type component string

const (
	compPG    component = "pg"
	compMinio component = "minio"
)

var errHelp = errors.New("help")

func parseComponents(s string) ([]component, error) {
	switch strings.ToLower(s) {
	case "", "all":
		return []component{compPG, compMinio}, nil
	case "pg", "postgres", "postgresql":
		return []component{compPG}, nil
	case "minio":
		return []component{compMinio}, nil
	default:
		return nil, fmt.Errorf("未知组件：%s（可选 pg / minio / all）", s)
	}
}

func (c component) remoteDir() string {
	if c == compPG {
		return "postgres"
	}
	return "minio"
}

func (c component) envRel() string {
	return c.remoteDir() + "/backup.env"
}

// envsToKeep：整目录切换时，只有本次「上传新配置」的组件不保留旧 env；
// 其余组件（含本次未部署的）必须从旧目录搬回，否则重部署单组件会弄丢别的组件配置。
func envsToKeep(plans []envPlan) []component {
	uploaded := map[component]bool{}
	for _, p := range plans {
		if p.upload {
			uploaded[p.comp] = true
		}
	}
	var keep []component
	for _, c := range []component{compPG, compMinio} {
		if !uploaded[c] {
			keep = append(keep, c)
		}
	}
	return keep
}

func (c component) installPath(dir string) string {
	return path.Join(dir, c.remoteDir(), "install.sh")
}

func (c component) backupPath(dir string) string {
	return path.Join(dir, c.remoteDir(), string(c)+"_backup.sh")
}

// logrotate：install.sh 只提示不安装，这里由工具负责落到 /etc/logrotate.d。
func (c component) logrotateSrc(dir string) string {
	return path.Join(dir, c.remoteDir(), string(c)+"_backup.logrotate")
}

func (c component) logrotateDst() string {
	if c == compPG {
		return "/etc/logrotate.d/pg-backup"
	}
	return "/etc/logrotate.d/minio-backup"
}

func (c component) envFile(cfg *shared.Config) string {
	if c == compPG {
		return cfg.PGEnvFile
	}
	return cfg.MinioEnvFile
}

type deployOptions struct {
	comps       []component
	Server      string
	dryRun      bool
	force       bool
	runNow      bool
	installDeps bool
}

func parseDeployArgs(args []string) (deployOptions, error) {
	opt := deployOptions{comps: []component{compPG, compMinio}}
	seen := false
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--dry-run":
			opt.dryRun = true
		case a == "--force":
			opt.force = true
		case a == "--run-now":
			opt.runNow = true
		case a == "--install-deps":
			opt.installDeps = true
		case a == "--server":
			if i+1 >= len(args) {
				return opt, fmt.Errorf("--server 缺少参数")
			}
			i++
			opt.Server = args[i]
		case strings.HasPrefix(a, "--server="):
			opt.Server = strings.TrimPrefix(a, "--server=")
		case a == "-h" || a == "--help":
			return opt, errHelp
		case strings.HasPrefix(a, "-"):
			return opt, fmt.Errorf("未知参数：%s", a)
		default:
			if seen {
				return opt, fmt.Errorf("只能指定一个组件")
			}
			comps, err := parseComponents(a)
			if err != nil {
				return opt, err
			}
			opt.comps = comps
			seen = true
		}
	}
	return opt, nil
}

type envPlan struct {
	comp        component
	local       string
	localOK     bool
	localIssue  string
	remoteState string // MISSING / PLACEHOLDER / OK
	upload      bool
	keep        bool
}

func runBackupDeploy(args []string) int {
	opt, err := parseDeployArgs(args)
	if errors.Is(err, errHelp) {
		backupUsage()
		return 0
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}

	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	srv, err := list.Resolve(opt.Server, cfg.DefaultServer)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	plans, err := buildEnvPlans(cfg, opt.comps)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}

	t := shared.NewSSHTarget(srv)
	root := context.Background()

	ctx, cancel := context.WithTimeout(root, timeoutPrecheck)
	err = checkAccess(t, ctx)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}

	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	missing, optional, err := checkDeps(t, ctx, opt.comps)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 检查依赖失败：%v\n", err)
		return 1
	}
	// --dry-run 承诺不修改远端，因此即使带 --install-deps 也只报告。
	if opt.installDeps && len(missing) > 0 && !opt.dryRun {
		fmt.Printf("==> 安装缺失依赖：%s\n", strings.Join(missing, ", "))
		ctx, cancel = context.WithTimeout(root, timeoutDeps)
		err = installDeps(t, ctx, missing)
		cancel()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
			return 1
		}
		ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
		missing, optional, err = checkDeps(t, ctx, opt.comps)
		cancel()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 复查依赖失败：%v\n", err)
			return 1
		}
	}
	if len(missing) > 0 {
		if opt.dryRun {
			fmt.Printf("WARN: 缺少依赖：%s（--dry-run 不安装；实际部署需加 --install-deps 或手工安装）\n", strings.Join(missing, ", "))
		} else {
			fmt.Fprintf(os.Stderr, "ERROR: 缺少依赖：%s\n可加 --install-deps 让工具安装，或按上表手工安装。\n", strings.Join(missing, ", "))
			return 1
		}
	}
	for _, m := range optional {
		fmt.Printf("WARN: 可选依赖缺失：%s（install.sh 会给出提示）\n", m)
	}

	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	cronOut, err := cronOutput(t, ctx)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 读取远端 crontab 失败：%v\n", err)
		return 1
	}
	for _, c := range opt.comps {
		expected := path.Join(cfg.DeployDir, c.remoteDir())
		for _, d := range cronScriptDirs(cronOut, string(c)+"_backup.sh") {
			if normRemoteDir(d) != normRemoteDir(expected) {
				fmt.Fprintf(os.Stderr,
					"ERROR: 已有安装的 %s 脚本路径为 %s，与配置的 %s 不一致。\n"+
						"请把 PASS_UP_OPS_BACKUP_DEPLOY_DIR 改成现有路径后重试。\n",
					c, d, cfg.DeployDir)
				return 1
			}
		}
	}

	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	for i := range plans {
		plans[i].remoteState, err = envState(t, ctx, cfg.DeployDir, plans[i].comp)
		if err != nil {
			cancel()
			fmt.Fprintf(os.Stderr, "ERROR: 检查远端配置失败：%v\n", err)
			return 1
		}
	}
	cancel()

	for i := range plans {
		p := &plans[i]
		switch {
		case p.localOK && (opt.force || p.remoteState != "OK"):
			p.upload = true
		case p.localOK:
			p.keep = true
		case p.remoteState == "OK":
			p.keep = true
			fmt.Printf("WARN: 本机配置缺失，保留远端已有的 %s/backup.env\n", p.comp.remoteDir())
		default:
			fmt.Fprintf(os.Stderr, "ERROR: %s 既没有本机配置也没有有效的远端配置。\n先按 backup.env.example 准备：%s\n",
				p.comp.remoteDir(), p.local)
			return 1
		}
	}

	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	freeMB, _ := freeMB(t, ctx, cfg.DeployDir)
	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	hadOld, err := dirExists(t, ctx, cfg.DeployDir)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 检查远端目录失败：%v\n", err)
		return 1
	}

	printDeployPlan(cfg, srv, opt, plans, freeMB)
	if opt.dryRun {
		printDryRun(cfg, srv, opt)
		fmt.Println("\n--dry-run：未修改远端任何文件。")
		return 0
	}

	ctx, cancel = context.WithTimeout(root, timeoutUpload)
	err = prepareDir(t, ctx, cfg.DeployDir)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 准备远端目录失败：%v\n", err)
		return 1
	}

	envs := map[string]string{}
	for _, p := range plans {
		if p.upload {
			envs[p.comp.envRel()] = p.local
		}
	}
	payload, err := buildPayload(cfg.SrcDir, envs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 打包备份脚本失败：%v\n", err)
		return 1
	}
	fmt.Printf("==> 上传脚本（%.1f KB）\n", float64(len(payload))/1024)
	ctx, cancel = context.WithTimeout(root, timeoutUpload)
	err = upload(t, ctx, cfg.DeployDir, payload)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 上传失败：%v\n", err)
		return 1
	}

	ctx, cancel = context.WithTimeout(root, timeoutUpload)
	err = swap(t, ctx, cfg.DeployDir, envsToKeep(plans))
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 切换目录失败：%v\n", err)
		return 1
	}

	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	err = installLogrotate(t, ctx, cfg.DeployDir, opt.comps)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 安装 logrotate 配置失败：%v\n", err)
		return 1
	}

	for _, c := range opt.comps {
		fmt.Printf("==> 安装 %s\n", c)
		ctx, cancel = context.WithTimeout(root, timeoutInstall)
		code, err := t.Stream(ctx, "bash "+shared.ShQuote(c.installPath(cfg.DeployDir))+" </dev/null", true, nil)
		cancel()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 安装 %s 失败：%v\n", c, err)
			return failAfterInstall(root, t, cfg, opt.comps, hadOld)
		}
		if code != 0 {
			fmt.Fprintf(os.Stderr, "ERROR: %s/install.sh 退出码 %d\n", c, code)
			return failAfterInstall(root, t, cfg, opt.comps, hadOld)
		}
	}

	fmt.Println("==> 运行 preflight 自检")
	ctx, cancel = context.WithTimeout(root, timeoutPreflight)
	code, err := t.Stream(ctx, "bash "+shared.ShQuote(path.Join(cfg.DeployDir, "preflight_check.sh"))+" "+preflightArg(opt.comps)+" </dev/null", true, nil)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: preflight 执行失败：%v\n", err)
		return 1
	}
	if code == 1 {
		fmt.Fprintln(os.Stderr, "ERROR: preflight 有错误，部署未通过。")
		return failAfterInstall(root, t, cfg, opt.comps, hadOld)
	}
	if code == 2 {
		fmt.Println("WARN: preflight 有警告（常见于尚末首次备份），继续。")
	}

	if opt.runNow {
		for _, c := range opt.comps {
			fmt.Printf("==> 首次运行 %s 备份（可能需要较长时间）\n", c)
			ctx, cancel = context.WithTimeout(root, timeoutRunNow)
			code, err := t.Stream(ctx, "bash "+shared.ShQuote(c.backupPath(cfg.DeployDir)), true, nil)
			cancel()
			if err != nil {
				fmt.Fprintf(os.Stderr, "ERROR: %s 备份执行失败：%v\n", c, err)
				return 1
			}
			if code != 0 {
				fmt.Fprintf(os.Stderr, "ERROR: %s 备份退出码 %d\n", c, code)
				return 1
			}
		}
	}

	fmt.Println()
	fmt.Println("完成。只读监控账号写在服务器清单的 monitor 字段（P2 使用）：")
	fmt.Println(`  "monitor": {"user": "...", "key": "..."}`)
	fmt.Println("可运行 ops servers check " + srv.Name + " 复核 SSH 与免密 sudo。")
	return 0
}

func failAfterInstall(root context.Context, t *shared.SSHTarget, cfg *shared.Config, comps []component, hadOld bool) int {
	if !hadOld {
		fmt.Fprintln(os.Stderr, "全新安装未回滚（没有可回滚的旧版本）；修复配置后重跑 ops backup deploy。")
		return 1
	}
	fmt.Fprintln(os.Stderr, "==> 回滚到上一版脚本")
	ctx, cancel := context.WithTimeout(root, timeoutUpload)
	err := rollback(t, ctx, cfg.DeployDir)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 回滚失败，请人工检查 %s.old 与 %s.failed：%v\n", cfg.DeployDir, cfg.DeployDir, err)
		return 1
	}
	for _, c := range comps {
		ctx, cancel = context.WithTimeout(root, timeoutInstall)
		t.Stream(ctx, "bash "+shared.ShQuote(c.installPath(cfg.DeployDir))+" </dev/null", true, nil)
		cancel()
	}
	fmt.Fprintln(os.Stderr, "已回滚脚本并重装旧版本；配置未回滚。")
	return 1
}

func printDeployPlan(cfg *shared.Config, srv *shared.Server, opt deployOptions, plans []envPlan, freeMB string) {
	fmt.Printf("部署计划\n  服务器：%s（%s）\n  主机：%s@%s:%d\n  组件：%s\n  目录：%s\n",
		srv.Name, srv.Role, srv.User, srv.Host, srv.Port, joinComponents(opt.comps), cfg.DeployDir)
	for _, p := range plans {
		action := "保留远端配置"
		if p.upload {
			action = "上传本机配置"
		}
		fmt.Printf("  %-5s 本机=%-9s 远端=%-11s %s\n",
			p.comp, localState(p), p.remoteState, action)
	}
	if freeMB != "" {
		fmt.Printf("  远端可用空间：%s MB\n", freeMB)
	}
}

func localState(p envPlan) string {
	if p.localOK {
		return "OK"
	}
	return p.localIssue
}

func printDryRun(cfg *shared.Config, srv *shared.Server, opt deployOptions) {
	newDir := cfg.DeployDir + ".new"
	fmt.Println("将要执行的远端命令：")
	fmt.Printf("  rm -rf %s && mkdir -p %s && chown %s %s\n", newDir, newDir, srv.User, newDir)
	fmt.Printf("  tar -xzf - -C %s   # stdin 为本机脚本包\n", newDir)
	for _, c := range opt.comps {
		fmt.Printf("  cp %s %s\n", c.logrotateSrc(cfg.DeployDir), c.logrotateDst())
	}
	for _, c := range opt.comps {
		fmt.Printf("  bash %s </dev/null\n", c.installPath(cfg.DeployDir))
	}
	fmt.Printf("  bash %s %s\n", path.Join(cfg.DeployDir, "preflight_check.sh"), preflightArg(opt.comps))
	if opt.runNow {
		for _, c := range opt.comps {
			fmt.Printf("  bash %s\n", c.backupPath(cfg.DeployDir))
		}
	}
}

func joinComponents(comps []component) string {
	parts := make([]string, 0, len(comps))
	for _, c := range comps {
		parts = append(parts, string(c))
	}
	return strings.Join(parts, ", ")
}

func preflightArg(comps []component) string {
	if len(comps) == 2 {
		return "all"
	}
	return string(comps[0])
}

func buildEnvPlans(cfg *shared.Config, comps []component) ([]envPlan, error) {
	var plans []envPlan
	for _, c := range comps {
		p := envPlan{comp: c, local: c.envFile(cfg)}
		issue, ok := inspectLocalEnv(p.local)
		p.localOK = ok
		p.localIssue = issue
		if ok || issue == "missing" {
			plans = append(plans, p)
			continue
		}
		return nil, fmt.Errorf("%s 无效（%s），先按 backup.env.example 填好", p.local, issue)
	}
	return plans, nil
}

func inspectLocalEnv(p string) (string, bool) {
	b, err := os.ReadFile(p)
	if err != nil {
		return "missing", false
	}
	if strings.TrimSpace(string(b)) == "" {
		return "empty", false
	}
	if regexp.MustCompile(`CHANGE_ME|YOUR_`).Match(b) {
		return "placeholder", false
	}
	return "", true
}

func checkAccess(t *shared.SSHTarget, ctx context.Context) error {
	out, _, err := t.Capture(ctx, "id -u", false)
	if err != nil {
		return fmt.Errorf("SSH 连接失败：%w", err)
	}
	if strings.TrimSpace(out) == "0" {
		t.IsRoot = true
		return nil
	}
	_, code, err := t.Capture(ctx, "true", true)
	if err != nil {
		return fmt.Errorf("检查 sudo 失败：%w", err)
	}
	if code != 0 {
		return fmt.Errorf("sudo 不可用：先运行 ops servers apply-sudo <name> 配置免密 sudo，或在清单里填 sudo.password")
	}
	return nil
}

func checkDeps(t *shared.SSHTarget, ctx context.Context, comps []component) (missing, optional []string, err error) {
	required := map[string]bool{
		"tar": true, "crontab": true, "ssh": true, "scp": true, "nc": true,
	}
	for _, c := range comps {
		switch c {
		case compPG:
			required["pg_restore"] = true
		case compMinio:
			required["mc"] = true
		}
	}
	names := make([]string, 0, len(required)+1)
	for n := range required {
		names = append(names, n)
	}
	names = append(names, "logrotate")

	cmd := `for c in ` + strings.Join(names, " ") + `; do command -v "$c" >/dev/null 2>&1 || echo "$c"; done`
	out, _, err := t.Capture(ctx, cmd, false)
	if err != nil {
		return nil, nil, err
	}
	for _, n := range strings.Fields(out) {
		if n == "logrotate" {
			optional = append(optional, n)
		} else {
			missing = append(missing, n)
		}
	}
	return missing, optional, nil
}

func installDeps(t *shared.SSHTarget, ctx context.Context, missing []string) error {
	code, err := t.Stream(ctx, depsInstallScript(missing), true, nil)
	if err != nil {
		return fmt.Errorf("安装依赖失败：%w", err)
	}
	if code != 0 {
		return fmt.Errorf("安装依赖失败（exit %d）", code)
	}
	return nil
}

func depsInstallScript(missing []string) string {
	set := map[string]bool{}
	for _, m := range missing {
		set[m] = true
	}
	var b strings.Builder
	b.WriteString("set -e\n")
	if len(missing) > 0 {
		b.WriteString("if command -v apt-get >/dev/null 2>&1; then\n")
		b.WriteString("  apt-get update\n")
		args := aptPackages(set)
		if len(args) > 0 {
			b.WriteString("  DEBIAN_FRONTEND=noninteractive apt-get install -y " + strings.Join(args, " ") + "\n")
		}
		b.WriteString("elif command -v dnf >/dev/null 2>&1; then\n")
		if args := rpmPackages(set); len(args) > 0 {
			b.WriteString("  dnf install -y " + strings.Join(args, " ") + "\n")
		}
		b.WriteString("elif command -v yum >/dev/null 2>&1; then\n")
		if args := rpmPackages(set); len(args) > 0 {
			b.WriteString("  yum install -y " + strings.Join(args, " ") + "\n")
		}
		b.WriteString("else\n  echo '没有支持的包管理器（apt/dnf/yum）' >&2; exit 1\nfi\n")
	}
	if set["mc"] {
		b.WriteString(`if ! command -v mc >/dev/null 2>&1; then
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) arch=amd64 ;;
    aarch64|arm64) arch=arm64 ;;
    *) echo "不支持的 CPU 架构: $arch" >&2; exit 1 ;;
  esac
  url="https://dl.min.io/client/mc/release/linux-$arch/mc"
  ok=0
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o /usr/local/bin/mc && ok=1 || rm -f /usr/local/bin/mc
  elif command -v wget >/dev/null 2>&1; then
    wget -qO /usr/local/bin/mc "$url" && ok=1 || rm -f /usr/local/bin/mc
  fi
  # dl.min.io 已停止分发社区版 mc（实测返回 410）：退回从本机 minio 镜像里提取
  if [ "$ok" -ne 1 ] && command -v docker >/dev/null 2>&1; then
    img=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -m1 -E '^(minio/minio|quay.io/minio/minio):' || true)
    if [ -n "$img" ]; then
      cid=$(docker create "$img") || cid=""
      if [ -n "$cid" ] && docker cp "$cid:/usr/bin/mc" /usr/local/bin/mc >/dev/null 2>&1; then
        ok=1
      fi
      if [ -n "$cid" ]; then docker rm -f "$cid" >/dev/null 2>&1 || true; fi
    fi
  fi
  if [ "$ok" -ne 1 ]; then
    echo "无法获取 mc（官方下载地址已失效），请手动安装 mc 到 /usr/local/bin/mc" >&2
    exit 1
  fi
  chmod +x /usr/local/bin/mc
fi
`)
	}
	return b.String()
}

func aptPackages(set map[string]bool) []string {
	var out []string
	if set["pg_restore"] {
		out = append(out, "postgresql-client")
	}
	if set["crontab"] {
		out = append(out, "cron")
	}
	if set["logrotate"] {
		out = append(out, "logrotate")
	}
	if set["nc"] {
		out = append(out, "netcat-openbsd")
	}
	if set["ssh"] || set["scp"] {
		out = append(out, "openssh-client")
	}
	if set["tar"] {
		out = append(out, "tar")
	}
	return dedup(out)
}

func rpmPackages(set map[string]bool) []string {
	var out []string
	if set["pg_restore"] {
		out = append(out, "postgresql")
	}
	if set["crontab"] {
		out = append(out, "cronie")
	}
	if set["logrotate"] {
		out = append(out, "logrotate")
	}
	if set["nc"] {
		out = append(out, "nmap-ncat")
	}
	if set["ssh"] || set["scp"] {
		out = append(out, "openssh-clients")
	}
	if set["tar"] {
		out = append(out, "tar")
	}
	return dedup(out)
}

func dedup(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

func cronOutput(t *shared.SSHTarget, ctx context.Context) (string, error) {
	out, _, err := t.Capture(ctx, "crontab -l 2>/dev/null || true", true)
	return out, err
}

func cronScriptDirs(crontab, script string) []string {
	re := regexp.MustCompile(`([^\s'"]+)/` + regexp.QuoteMeta(script))
	seen := map[string]bool{}
	var dirs []string
	for _, line := range strings.Split(crontab, "\n") {
		if !strings.Contains(line, "#PG_BACKUP") && !strings.Contains(line, "#MINIO_BACKUP") {
			continue
		}
		for _, m := range re.FindAllStringSubmatch(line, -1) {
			if !seen[m[1]] {
				seen[m[1]] = true
				dirs = append(dirs, m[1])
			}
		}
	}
	return dirs
}

func normRemoteDir(d string) string {
	return strings.TrimRight(filepath.ToSlash(d), "/")
}

func envState(t *shared.SSHTarget, ctx context.Context, dir string, c component) (string, error) {
	p := path.Join(dir, c.envRel())
	cmd := fmt.Sprintf(
		`if [ -f %s ]; then if grep -Eq 'CHANGE_ME|YOUR_' %s; then echo PLACEHOLDER; else echo OK; fi; else echo MISSING; fi`,
		shared.ShQuote(p), shared.ShQuote(p))
	out, _, err := t.Capture(ctx, cmd, true)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

func freeMB(t *shared.SSHTarget, ctx context.Context, dir string) (string, error) {
	parent := path.Dir(dir)
	out, _, err := t.Capture(ctx, "df -P -m "+shared.ShQuote(parent)+" 2>/dev/null | tail -1", false)
	if err != nil {
		return "", err
	}
	f := strings.Fields(out)
	if len(f) < 4 {
		return "", nil
	}
	return f[3], nil
}

func dirExists(t *shared.SSHTarget, ctx context.Context, dir string) (bool, error) {
	out, code, err := t.Capture(ctx, "test -d "+shared.ShQuote(dir)+" && echo YES || echo NO", true)
	if err != nil {
		return false, err
	}
	if code != 0 {
		return false, fmt.Errorf("检查目录失败（exit %d）：%s", code, strings.TrimSpace(out))
	}
	return strings.TrimSpace(out) == "YES", nil
}

func prepareDir(t *shared.SSHTarget, ctx context.Context, dir string) error {
	newDir := dir + ".new"
	user := t.User
	if user == "" {
		user = "root"
	}
	cmd := fmt.Sprintf("set -e; rm -rf %s; mkdir -p %s; chown %s %s",
		shared.ShQuote(newDir), shared.ShQuote(newDir), shared.ShQuote(user), shared.ShQuote(newDir))
	code, err := t.Stream(ctx, cmd, true, nil)
	if err != nil {
		return err
	}
	if code != 0 {
		return fmt.Errorf("exit %d", code)
	}
	return nil
}

func upload(t *shared.SSHTarget, ctx context.Context, dir string, payload []byte) error {
	cmd := "tar -xzf - -C " + shared.ShQuote(dir+".new")
	code, err := t.Stream(ctx, cmd, false, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	if code != 0 {
		return fmt.Errorf("tar 解包失败（exit %d）", code)
	}
	return nil
}

func swap(t *shared.SSHTarget, ctx context.Context, dir string, keep []component) error {
	var b strings.Builder
	b.WriteString("set -e\n")
	for _, c := range keep {
		rel := c.envRel()
		oldEnv := path.Join(dir, rel)
		newEnv := path.Join(dir+".new", rel)
		fmt.Fprintf(&b, "if [ -f %s ] && [ ! -f %s ]; then cp -p %s %s; fi\n",
			shared.ShQuote(oldEnv), shared.ShQuote(newEnv), shared.ShQuote(oldEnv), shared.ShQuote(newEnv))
	}
	fmt.Fprintf(&b, "rm -rf %s\n", shared.ShQuote(dir+".old"))
	fmt.Fprintf(&b, "if [ -d %s ]; then mv %s %s; fi\n", shared.ShQuote(dir), shared.ShQuote(dir), shared.ShQuote(dir+".old"))
	fmt.Fprintf(&b, "mv %s %s\n", shared.ShQuote(dir+".new"), shared.ShQuote(dir))

	code, err := t.Stream(ctx, b.String(), true, nil)
	if err != nil {
		return err
	}
	if code != 0 {
		return fmt.Errorf("切换目录失败（exit %d）", code)
	}
	return nil
}

func installLogrotate(t *shared.SSHTarget, ctx context.Context, dir string, comps []component) error {
	var b strings.Builder
	b.WriteString("set -e\n")
	for _, c := range comps {
		src := c.logrotateSrc(dir)
		dst := c.logrotateDst()
		fmt.Fprintf(&b, "if [ -f %s ]; then cp -f %s %s && chmod 644 %s; else echo '缺少 %s' >&2; exit 1; fi\n",
			shared.ShQuote(src), shared.ShQuote(src), shared.ShQuote(dst), shared.ShQuote(dst), src)
	}
	if len(comps) == 0 {
		return nil
	}
	code, err := t.Stream(ctx, b.String(), true, nil)
	if err != nil {
		return err
	}
	if code != 0 {
		return fmt.Errorf("logrotate 安装失败（exit %d）", code)
	}
	return nil
}

func rollback(t *shared.SSHTarget, ctx context.Context, dir string) error {
	failed := dir + ".failed"
	cmd := fmt.Sprintf("set -e; rm -rf %s; if [ -d %s ]; then mv %s %s; fi; if [ -d %s ]; then mv %s %s; fi",
		shared.ShQuote(failed), shared.ShQuote(dir), shared.ShQuote(dir), shared.ShQuote(failed),
		shared.ShQuote(dir+".old"), shared.ShQuote(dir+".old"), shared.ShQuote(dir))
	code, err := t.Stream(ctx, cmd, true, nil)
	if err != nil {
		return err
	}
	if code != 0 {
		return fmt.Errorf("回滚失败（exit %d）", code)
	}
	return nil
}

func buildPayload(srcDir string, envs map[string]string) ([]byte, error) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	// 打包时间戳回退 5 秒：远端时钟通常略慢于本机，用 now 会被 tar 报
	// "time stamp ... is X s in the future"（仅噪音，但会淹没真正的错误）。
	modTime := time.Now().Add(-5 * time.Second)

	err := filepath.WalkDir(srcDir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcDir, p)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		rel = filepath.ToSlash(rel)
		base := d.Name()

		if d.IsDir() {
			if base == ".git" || base == ".deploy" {
				return filepath.SkipDir
			}
			hdr := &tar.Header{Name: rel + "/", Mode: 0o755, Typeflag: tar.TypeDir, ModTime: modTime}
			return tw.WriteHeader(hdr)
		}
		if d.Type()&fs.ModeSymlink != 0 {
			return nil
		}
		if excludedBackupFile(base) {
			return nil
		}
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		mode := int64(0o644)
		if strings.HasSuffix(rel, ".sh") {
			mode = 0o755
		}
		hdr := &tar.Header{Name: rel, Mode: mode, Size: int64(len(data)), Typeflag: tar.TypeReg, ModTime: modTime}
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		_, err = tw.Write(data)
		return err
	})
	if err != nil {
		return nil, err
	}

	// 本机配置单独以 0600 写入，不上传示例文件。
	for rel, local := range envs {
		data, err := os.ReadFile(local)
		if err != nil {
			return nil, fmt.Errorf("读取 %s 失败：%w", local, err)
		}
		hdr := &tar.Header{Name: rel, Mode: 0o600, Size: int64(len(data)), Typeflag: tar.TypeReg, ModTime: modTime}
		if err := tw.WriteHeader(hdr); err != nil {
			return nil, err
		}
		if _, err := tw.Write(data); err != nil {
			return nil, err
		}
	}

	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func excludedBackupFile(base string) bool {
	switch base {
	case "backup.env", "sync.env", "last_success.txt":
		return true
	}
	return strings.HasSuffix(base, ".log")
}

func runBackupVerify(args []string) int {
	comps := []component{compPG, compMinio}
	serverName := ""
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "-h" || a == "--help":
			backupUsage()
			return 0
		case a == "--server":
			if i+1 >= len(args) {
				fmt.Fprintln(os.Stderr, "ERROR: --server 缺少参数")
				return 2
			}
			i++
			serverName = args[i]
		case strings.HasPrefix(a, "--server="):
			serverName = strings.TrimPrefix(a, "--server=")
		case strings.HasPrefix(a, "-"):
			fmt.Fprintf(os.Stderr, "ERROR: 未知参数：%s\n", a)
			return 2
		default:
			c, err := parseComponents(a)
			if err != nil {
				fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
				return 2
			}
			comps = c
		}
	}
	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	srv, err := list.Resolve(serverName, cfg.DefaultServer)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	t := shared.NewSSHTarget(srv)
	root := context.Background()

	ctx, cancel := context.WithTimeout(root, timeoutPrecheck)
	err = checkAccess(t, ctx)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}

	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	exists, err := dirExists(t, ctx, cfg.DeployDir)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	if !exists {
		fmt.Fprintf(os.Stderr, "ERROR: 远端目录不存在：%s\n先运行 ops backup deploy\n", cfg.DeployDir)
		return 1
	}

	ctx, cancel = context.WithTimeout(root, timeoutPreflight)
	code, err := t.Stream(ctx, "bash "+shared.ShQuote(path.Join(cfg.DeployDir, "preflight_check.sh"))+" "+preflightArg(comps), true, nil)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: preflight 执行失败：%v\n", err)
		return 1
	}
	if code == 1 {
		return 1
	}
	if code == 2 {
		fmt.Println("WARN: preflight 有警告。")
	}
	return 0
}

// CmdBackup 是 backup 动词的分发入口：与 runBackupDeploy / runBackupVerify 同文件，
// main.go 只保留全局注册表、run 与 usage。
func CmdBackup(args []string) int {
	if len(args) == 0 {
		backupUsage()
		return 2
	}
	switch args[0] {
	case "deploy":
		return runBackupDeploy(args[1:])
	case "verify":
		return runBackupVerify(args[1:])
	case "help", "-h", "--help":
		backupUsage()
		return 0
	default:
		fmt.Fprintf(os.Stderr, "未知子命令：backup %s\n\n", args[0])
		backupUsage()
		return 2
	}
}

func backupUsage() {
	fmt.Print(`用法:
  ops backup deploy [pg|minio|all] --server <name> [--dry-run] [--force] [--run-now] [--install-deps]
  ops backup verify [pg|minio|all] --server <name>

目标机只从服务器清单（servers.json）里按 name 选择。

选项:
  --server <name> 目标服务器（省略则用清单的 default / 唯一的 backup）
  --dry-run       只预检并打印将执行的远端命令，不修改远端
  --force         用本机 backup.env 覆盖远端已有配置（旧配置随 .old 目录保留）
  --run-now       安装成功后立即跑一次备份（写操作，可能较长时间）
  --install-deps  自动安装缺失依赖（apt/dnf/yum；mc 从官方地址下载）
`)
}
