package backup

import (
	"pass-up/ops/internal/shared"
)

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
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

// envName 是本机配置文件在配置目录 backup/ 下的名字（远端一律叫 <组件>/backup.env）。
func (c component) envName() string {
	if c == compPG {
		return "postgres.env"
	}
	return "minio.env"
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
	comps         []component
	Server        string
	dryRun        bool
	force         bool
	runNow        bool
	installDeps   bool
	passwordStdin bool
}

// readSudoPassword 从 stdin 读一行初始 sudo 密码。
//
// 🔴 只有 `--password-stdin`，**没有 `--password`**：密码不能出现在命令行 / ps / 日志里。
// 网页部署走的也是这条路（界面把密码喂给子进程的 stdin，见 docs/ui.md §9）。
// 清单里已经配了 sudo.password 时以清单为准，避免手输错覆盖掉能用的凭据。
func readSudoPassword() (string, error) {
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("读取密码失败：%w", err)
	}
	pw := strings.TrimRight(line, "\r\n")
	if pw == "" {
		return "", fmt.Errorf("stdin 没有读到 sudo 密码")
	}
	return pw, nil
}

func applySudoPassword(t *shared.SSHTarget, stdinPassword string) {
	if t.SudoPassword == "" {
		t.SudoPassword = stdinPassword
	}
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
		case a == "--password-stdin":
			opt.passwordStdin = true
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

func runBackupDeploy(args []string, embedded fs.FS) int {
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
	src, err := scriptFS(cfg, embedded)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	if err := checkScripts(src, opt.comps); err != nil {
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
	if opt.passwordStdin {
		pw, err := readSudoPassword()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
			return 1
		}
		applySudoPassword(t, pw)
	}
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
			fmt.Fprintf(os.Stderr, "ERROR: %s 既没有本机配置也没有有效的远端配置。\n先运行 ops backup env %s 生成模板，填好后重试：%s\n",
				p.comp.remoteDir(), p.comp, p.local)
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
	payload, err := buildPayload(src, envs)
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
	err = installLogrotate(t, ctx, cfg.DeployDir, srv.User, opt.comps)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 安装 logrotate 配置失败：%v\n", err)
		return 1
	}

	for _, c := range opt.comps {
		fmt.Printf("==> 安装 %s\n", c)
		ctx, cancel = context.WithTimeout(root, timeoutInstall)
		code, err := t.Stream(ctx, runUserEnv(t.User)+"bash "+shared.ShQuote(c.installPath(cfg.DeployDir))+" </dev/null", true, nil)
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
	// 自检必须以「备份任务的实际运行身份」跑，不能套 sudo：root 的
	// known_hosts / HOME / 私钥与 cron 里的 user 不是同一份，会出现
	// 「手工 ssh 能连、自检报连不上」以及「自检过了、备份却失败」两类假象。
	code, err := streamPreflight(root, t, cfg, opt.comps)
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
		// 与 ops backup once 共用同一段「按组件串行跑已部署脚本」；
		// 首跑保留旧语义：任一组件失败就停，不继续跑后面的组件。
		for _, r := range runBackupScripts(root, t, cfg.DeployDir, opt.comps, "首次运行", true) {
			if !r.ok() {
				return 1
			}
		}
	}

	fmt.Println()
	fmt.Println("完成。备份监控沿用清单里的同一账号，无需另配只读账号：")
	fmt.Println("  ops status --server " + srv.Name + "   看心跳 / dump / 磁盘")
	fmt.Println("  ops servers check " + srv.Name + "   复核 SSH 与免密 sudo")
	return 0
}

// revokeRunUserCrontab 撤销本次部署写进运行用户 crontab 的备份任务。
// 只在回滚路径调用：旧版 install.sh 重跑时会把任务装回 root，不撤销运行用户
// 这份就会两套并存、每天双跑。以 root 执行才能改别人的 crontab；
// 失败只告警，不打断已经开始的回滚（现场留给 .failed / .old 人工核对）。
func revokeRunUserCrontab(t *shared.SSHTarget, ctx context.Context, user string) {
	if user == "" || user == "root" {
		return
	}
	cmd := fmt.Sprintf("crontab -u %s -l 2>/dev/null | grep -vE '#(PG_BACKUP|MINIO_BACKUP)' | crontab -u %s - || true",
		shared.ShQuote(user), shared.ShQuote(user))
	out, _, err := t.Capture(ctx, cmd, true)
	if err != nil {
		fmt.Fprintf(os.Stderr, "WARN: 撤销 %s 的备份定时任务失败，请人工检查两份 crontab 是否双跑：%v %s\n",
			user, err, strings.TrimSpace(out))
	}
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
	// 🔴 身份迁移回滚：install.sh 在失败前可能已把任务装进运行用户 crontab，
	// 而回滚重跑的旧 install.sh 会把任务装回 root。不清掉前者就会每天双跑
	// （2026-11-06 211 真机踩过）。只删带我们标签的行，其它用户任务原样保留。
	cleanCtx, cleanCancel := context.WithTimeout(root, timeoutPrecheck)
	revokeRunUserCrontab(t, cleanCtx, t.User)
	cleanCancel()
	for _, c := range comps {
		ctx, cancel = context.WithTimeout(root, timeoutInstall)
		t.Stream(ctx, runUserEnv(t.User)+"bash "+shared.ShQuote(c.installPath(cfg.DeployDir))+" </dev/null", true, nil)
		cancel()
	}
	fmt.Fprintln(os.Stderr, "已回滚脚本并重装旧版本；配置未回滚。")
	return 1
}

func printDeployPlan(cfg *shared.Config, srv *shared.Server, opt deployOptions, plans []envPlan, freeMB string) {
	fmt.Printf("部署计划\n  服务器：%s（%s）\n  主机：%s@%s:%d\n  组件：%s\n  目录：%s\n  运行身份：%s（cron / 自检 / 首跑）；root 只用于安装期写系统目录\n",
		srv.Name, srv.Role, srv.User, srv.Host, srv.Port, joinComponents(opt.comps), cfg.DeployDir, srv.User)
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
		fmt.Printf("  sed 's|__BACKUP_USER__|%s|g; s|__BACKUP_GROUP__|<主组>|g' %s > %s\n",
			srv.User, c.logrotateSrc(cfg.DeployDir), c.logrotateDst())
	}
	for _, c := range opt.comps {
		fmt.Printf("  BACKUP_RUN_USER=%s bash %s </dev/null   # sudo 包装层由工具添加\n", srv.User, c.installPath(cfg.DeployDir))
	}
	fmt.Printf("  # install.sh 内：crontab -u %s、目录 chown %s、清理旧 root crontab\n", srv.User, srv.User)
	fmt.Printf("  bash %s %s   # 以 %s 执行，不套 sudo\n",
		path.Join(cfg.DeployDir, "preflight_check.sh"), preflightArg(opt.comps), srv.User)
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

// streamPreflight 以清单 user 跑远端 preflight_check.sh：
// `verify` / `deploy` 收尾 / `once` 预演与正式执行共用这一个入口（不套 sudo）。
// 退出码沿用 docs/backup-deploy.md §4.5：0 放行 / 1 阻塞 / 2 警告放行。
func streamPreflight(root context.Context, t *shared.SSHTarget, cfg *shared.Config, comps []component) (int, error) {
	ctx, cancel := context.WithTimeout(root, timeoutPreflight)
	defer cancel()
	cmd := "bash " + shared.ShQuote(path.Join(cfg.DeployDir, "preflight_check.sh")) +
		" " + preflightArg(comps) + " </dev/null"
	return t.Stream(ctx, cmd, false, nil)
}

// backupScriptResult 是一个组件的执行结论。`once` 要分组件汇总，
// 不能被后一个组件的成功盖掉，所以结果逐个留着，循环里不定总退出码。
type backupScriptResult struct {
	comp component
	code int
	err  error
}

func (r backupScriptResult) ok() bool { return r.err == nil && r.code == 0 }

// runBackupScripts 按 pg → minio 串行执行备份机上**已部署**的备份脚本。
//
// 🔴 一律以清单 user 运行（root=false）：与 cron / preflight 同 HOME、同
// known_hosts、同 ~/.mc。工具不重写备份逻辑，也不接收任意脚本路径。
// stopOnFailure=true 保留 deploy --run-now 的旧语义（首跑遇错即停）；
// once 传 false，跑完所有组件再分组件如实汇总。
func runBackupScripts(root context.Context, t *shared.SSHTarget, dir string, comps []component, label string, stopOnFailure bool) []backupScriptResult {
	results := make([]backupScriptResult, 0, len(comps))
	for _, c := range comps {
		fmt.Printf("==> %s %s 备份（可能需要较长时间）\n", label, c)
		ctx, cancel := context.WithTimeout(root, timeoutRunNow)
		code, err := t.Stream(ctx, "bash "+shared.ShQuote(c.backupPath(dir)), false, nil)
		cancel()
		r := backupScriptResult{comp: c, code: code, err: err}
		results = append(results, r)
		switch {
		case err != nil:
			fmt.Fprintf(os.Stderr, "ERROR: %s %s 备份执行失败：%v\n", label, c, err)
		case code != 0:
			fmt.Fprintf(os.Stderr, "ERROR: %s %s 备份退出码 %d\n", label, c, code)
		}
		if !r.ok() && stopOnFailure {
			break
		}
	}
	return results
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
		return nil, fmt.Errorf("%s 无效（%s），先运行 ops backup env %s 生成模板并填好", p.local, issue, p.comp)
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
	out, code, err := t.Capture(ctx, "id -u", false)
	if err != nil {
		return fmt.Errorf("SSH 连接失败：%w", err)
	}
	if code != 0 {
		return fmt.Errorf("SSH 命令失败（exit %d）：%s", code, strings.TrimSpace(out))
	}
	if strings.TrimSpace(out) == "0" {
		t.IsRoot = true
		return nil
	}
	// 远端输出必须带上：连接被重置时这里以前只报「sudo 不可用」，
	// 与真的没有免密 sudo 长得一模一样，排查方向会直接跑偏。
	sudoOut, code, err := t.Capture(ctx, "true", true)
	if err != nil {
		return fmt.Errorf("SSH 连接失败（sudo 探测）：%w", err)
	}
	if code != 0 {
		return fmt.Errorf("sudo 不可用（exit %d）：%s\n"+
			"先运行 ops servers apply-sudo <name> 配置免密 sudo，"+
			"或在清单里填 sudo.password，或加 --password-stdin",
			code, strings.TrimSpace(sudoOut))
	}
	return nil
}

// checkDeps 与界面「备份依赖」状态共用同一张清单和同一次只读采集：
// deploy 只需要「缺什么」，probeDeps 还提供版本 / 安装来源 / 安装计划给页面。
// 🔴 采不到状态必须如实报错，不能用空输出冒充「依赖齐全」。
func checkDeps(t *shared.SSHTarget, ctx context.Context, comps []component) (missing, optional []string, err error) {
	view, err := probeDeps(t, ctx, comps, "", joinComponents(comps), 0)
	if err != nil {
		return nil, nil, err
	}
	if !view.Collected {
		return nil, nil, fmt.Errorf("依赖检查未正常完成：%s", view.Error)
	}
	return view.Missing, view.Optional, nil
}

func installDeps(t *shared.SSHTarget, ctx context.Context, missing []string) error {
	return installDepsWithMajor(t, ctx, missing, 0)
}

func installDepsWithMajor(t *shared.SSHTarget, ctx context.Context, missing []string, pgMajor int) error {
	code, err := t.Stream(ctx, depsInstallScriptWithMajor(missing, pgMajor), true, nil)
	if err != nil {
		return fmt.Errorf("安装依赖失败：%w", err)
	}
	if code != 0 {
		return fmt.Errorf("安装依赖失败（exit %d）", code)
	}
	return nil
}

func depsInstallScript(missing []string) string {
	return depsInstallScriptWithMajor(missing, 0)
}

// depsInstallScriptWithMajor 是安装脚本的**唯一**生成器。
// pgMajor>0 时按 PostgreSQL 官方文档配置 PGDG apt 仓库并装对应主版本客户端；
// dnf / yum 没有等价的版本化包名保证，仍是原来的系统包（文档里如实说明）。
func depsInstallScriptWithMajor(missing []string, pgMajor int) string {
	set := map[string]bool{}
	for _, m := range missing {
		set[m] = true
	}
	var b strings.Builder
	b.WriteString("set -e\n")
	// 只有 mc 缺失时，三个包管理器都没有包要装：以前仍会生成 if/elif/elif 骨架，
	// 空 then 分支在 sh 里是语法错误（实测 `sh: Syntax error: "elif" unexpected`），
	// 而且白跑一次 apt-get update。所以整段只在真有包时才生成，空分支回 `:`。
	aptArgs, rpmArgs := aptPackagesWithMajor(set, pgMajor), rpmPackages(set)
	if len(aptArgs) > 0 || len(rpmArgs) > 0 {
		b.WriteString("if command -v apt-get >/dev/null 2>&1; then\n")
		if pgMajor > 0 && set["pg_restore"] {
			b.WriteString(pgdgRepoScript())
		}
		b.WriteString("  echo '==> 更新包索引（最多 5 分钟）'\n")
		// 🔴 每一步都有上限：2026-11-07 k4 上 mc 下载无超时挂了 7 分钟，
		//    界面看起来就是「卡住不动」。再给 apt 加 NEEDRESTART_MODE=l，
		//    装个客户端不该顺手重启 docker / systemd-logind（旧日志里出现过 deferred 列表）。
		b.WriteString("  timeout 300 apt-get update\n")
		b.WriteString(installLine("DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l timeout 900 apt-get install -y ", aptArgs))
		b.WriteString("elif command -v dnf >/dev/null 2>&1; then\n")
		b.WriteString(installLine("timeout 900 dnf install -y ", rpmArgs))
		b.WriteString("elif command -v yum >/dev/null 2>&1; then\n")
		b.WriteString(installLine("timeout 900 yum install -y ", rpmArgs))
		b.WriteString("else\n  echo '没有支持的包管理器（apt/dnf/yum）' >&2; exit 1\nfi\n")
	}
	if set["mc"] {
		// 🔴 顺序改了：先离线、后外网。2026-11-07 k4 实测中国镜像 HEAD 200 但 GET
		//    传了 110 KB 就不再动（curl 默认无超时，任务挂了 7 分钟）；而目标机
		//    明明已导入 minio 镜像，旧脚本却因私有仓库前缀匹配不到而没走离线路径。
		b.WriteString(`mc_ok=0
mc_path=$(command -v mc 2>/dev/null || true)
if [ -n "$mc_path" ] && [ -x "$mc_path" ] && timeout 15 "$mc_path" --version >/dev/null 2>&1; then mc_ok=1; fi
# 🔴 与只读探测同一判据：半截下载 / 0644 无执行位 / --version 跑不动，都算「没装」，
#    下面的 curl -o 或 docker cp 会直接覆盖那个坏文件，不会留下假阳性。
if [ "$mc_ok" -ne 1 ]; then
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) arch=amd64 ;;
    aarch64|arm64) arch=arm64 ;;
    *) echo "不支持的 CPU 架构: $arch" >&2; exit 1 ;;
  esac
  ok=0
  # ① 离线优先：MinIO 容器镜像里自带 mc，不访问外网、不会卡在半截下载。
  #    镜像名可能带私有仓库前缀（192.168.1.221:5000/minio/minio:...），
  #    所以匹配 (^|/)minio/minio:，不能只认 minio/minio: 开头。
  if command -v docker >/dev/null 2>&1; then
    echo '==> 安装 mc：先查目标机已导入的 MinIO 镜像（离线，不访问外网）'
    img=$(timeout 20 docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -m1 -E '(^|/)minio/minio:' || true)
    if [ -n "$img" ]; then
      echo "==> 从镜像提取 mc：$img"
      cid=$(timeout 30 docker create "$img") || cid=""
      if [ -n "$cid" ]; then
        for p in /usr/bin/mc /usr/local/bin/mc; do
          if timeout 30 docker cp "$cid:$p" /usr/local/bin/mc >/dev/null 2>&1; then ok=1; break; fi
        done
        timeout 20 docker rm -f "$cid" >/dev/null 2>&1 || true
      fi
      if [ "$ok" -eq 1 ]; then echo '==> 已从离线镜像提取 mc'; else echo 'WARN: 镜像里没取到 mc，改试官方下载地址'; fi
    else
      echo '==> 目标机没有已导入的 MinIO 镜像，改试官方下载地址'
    fi
  fi
  # ② 官方文档 https://min.io/docs/minio/linux/reference/minio-mc.html#install-mc
  #    给的地址是 dl.min.io/aistor/...；社区版 dl.min.io/client/... 实测 410，
  #    中国镜像 dl.minio.org.cn 可连通但大文件传输会挂，所以每个地址都必须有硬超时，
  #    并且逐个打印进度，界面上再也不会出现「长时间没有输出」的假死。
  if [ "$ok" -ne 1 ]; then
    for url in \
      "https://dl.minio.org.cn/client/mc/release/linux-$arch/mc" \
      "https://dl.min.io/aistor/mc/release/linux-$arch/mc" \
      "https://dl.min.io/client/mc/release/linux-$arch/mc"
    do
      echo "==> 下载 mc（最多 90 秒）：$url"
      if command -v curl >/dev/null 2>&1; then
        curl -fsSL --connect-timeout 8 --max-time 90 "$url" -o /usr/local/bin/mc && { ok=1; break; } \
          || { echo "WARN: $url 下载失败或超时"; rm -f /usr/local/bin/mc; }
      elif command -v wget >/dev/null 2>&1; then
        timeout 90 wget -q --timeout=8 --tries=1 -O /usr/local/bin/mc "$url" && { ok=1; break; } \
          || { echo "WARN: $url 下载失败或超时"; rm -f /usr/local/bin/mc; }
      fi
    done
  fi
  if [ "$ok" -ne 1 ]; then
    echo "无法获取 mc：离线镜像与三个官方地址都不可用，请手动安装到 /usr/local/bin/mc" >&2
    exit 1
  fi
  chmod +x /usr/local/bin/mc
  echo '==> mc 安装完成，版本：'
  /usr/local/bin/mc --version || true
fi
`)
	}
	return b.String()
}

// installLine 生成一行安装命令。没有包时必须回 `:`：
// 空的 then 分支在 sh 里是语法错误，而 dnf/yum 分支在没有 rpm 包时正好是空的。
func installLine(prefix string, args []string) string {
	if len(args) == 0 {
		return "  :\n"
	}
	return "  " + prefix + strings.Join(args, " ") + "\n"
}

// pgdgRepoScript 按 PostgreSQL 官方文档「Manual Repository Configuration」写
// /etc/apt/sources.list.d/pgdg.sources。只在用户显式给了 --pg-major 时才生成：
// 发版仓库的 postgresql-client 在多数机器上够用，PGDG 需要访问公网 apt 仓库，
// 内网机器上默认启用只会把本来能装好的依赖搞失败。
func pgdgRepoScript() string {
	return `  # PGDG 官方 apt 仓库：https://www.postgresql.org/download/linux/debian/
  if ! command -v pg_restore >/dev/null 2>&1; then
    . /etc/os-release
    if [ -z "${VERSION_CODENAME:-}" ]; then echo '取不到发行版 codename，无法配置 PGDG 仓库' >&2; exit 1; fi
    install -d /usr/share/postgresql-common/pgdg
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL --connect-timeout 8 --max-time 60 https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
    else
      timeout 60 wget -q --timeout=8 --tries=1 -O /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
    fi
    printf '%s\n' 'Types: deb' 'URIs: https://apt.postgresql.org/pub/repos/apt' "Suites: ${VERSION_CODENAME}-pgdg" "Architectures: $(dpkg --print-architecture)" 'Components: main' 'Signed-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc' > /etc/apt/sources.list.d/pgdg.sources
  fi
`
}

// aptPackagesWithMajor：指定主版本时把通用包名换成 PGDG 的版本化包名。
func aptPackagesWithMajor(set map[string]bool, pgMajor int) []string {
	pkgs := aptPackages(set)
	if pgMajor <= 0 {
		return pkgs
	}
	for i, p := range pkgs {
		if p == "postgresql-client" {
			pkgs[i] = fmt.Sprintf("postgresql-client-%d", pgMajor)
		}
	}
	return pkgs
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

// runUserEnv 把「备份运行身份」显式传给远端 install.sh。
// ssh 本来就以上面清单里的 user 登录，但 install.sh 由 sudo 包着跑，
// SUDO_USER 未必可靠，所以显式给一个环境变量。它同时决定：
// crontab -u 装给谁、日志/备份目录 chown 给谁、preflight 与 SSH 连通探测降权到谁。
// 🔴 四处必须是同一个人，否则又会出现「自检能连、cron 连不上」。
func runUserEnv(user string) string {
	if user == "" {
		user = "root"
	}
	return "BACKUP_RUN_USER=" + shared.ShQuote(user) + " "
}

// cronOutput 同时看「运行用户」与「root」两份 crontab：
// 迁移期旧安装的任务还留在 root 名下（install.sh 会清掉），只看用户级会漏掉
// 目录漂移检查，导致同一套备份被装到两个目录、每天双跑。
func cronOutput(t *shared.SSHTarget, ctx context.Context) (string, error) {
	userOut, _, err := t.Capture(ctx, "crontab -l 2>/dev/null || true", false)
	if err != nil {
		return "", err
	}
	rootOut, _, err := t.Capture(ctx, "crontab -u root -l 2>/dev/null || true", true)
	if err != nil {
		return "", err
	}
	return userOut + "\n" + rootOut, nil
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

// safeRunUser 挡住用户名里可能破坏 sed 表达式 / shell 命令的字符。
var safeRunUser = regexp.MustCompile(`^[A-Za-z0-9_.-]+$`)

// installLogrotate 把模板里的 su 占位符替换成运行用户再落盘。
// 日志目录属主改成运行用户后，logrotate 不带 su 会因「目录属主非 root」
// 判定不安全而直接跳过轮转，所以这一步是身份迁移的一部分，不能省。
func installLogrotate(t *shared.SSHTarget, ctx context.Context, dir, user string, comps []component) error {
	if len(comps) == 0 {
		return nil
	}
	if user == "" {
		user = "root"
	}
	if !safeRunUser.MatchString(user) {
		return fmt.Errorf("备份运行用户名含非法字符：%q", user)
	}
	var b strings.Builder
	b.WriteString("set -e\n")
	fmt.Fprintf(&b, "grp=$(id -gn %s) || exit 1\n", shared.ShQuote(user))
	for _, c := range comps {
		src := c.logrotateSrc(dir)
		dst := c.logrotateDst()
		fmt.Fprintf(&b,
			"if [ -f %s ]; then sed -e 's|__BACKUP_USER__|%s|g' -e \"s|__BACKUP_GROUP__|$grp|g\" %s > %s && chmod 644 %s; else echo '缺少 %s' >&2; exit 1; fi\n",
			shared.ShQuote(src), user, shared.ShQuote(src), shared.ShQuote(dst), shared.ShQuote(dst), src)
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

// embeddedRoot 是嵌入的脚本树在 embed.FS 里的前缀（见仓库根 backupdist.go）。
const embeddedRoot = "deploy/backup"

// scriptFS 选出本次打包用的脚本来源。
//
// 默认（cfg.SrcDir 为空）用**编进二进制**的那份：ops.exe 因此可以单独拷到任何机器上
// 部署，不再依赖「从仓根跑」或兄弟仓是否存在。显式配置 PASS_UP_OPS_BACKUP_SRC_DIR
// 时才用磁盘目录 —— 留给调试与临时热修，代价是那台机器上的脚本可能与二进制不一致。
func scriptFS(cfg *shared.Config, embedded fs.FS) (fs.FS, error) {
	if cfg.SrcDir == "" {
		sub, err := fs.Sub(embedded, embeddedRoot)
		if err != nil {
			return nil, fmt.Errorf("嵌入的备份脚本不可用：%w", err)
		}
		return sub, nil
	}
	info, err := os.Stat(cfg.SrcDir)
	if err != nil || !info.IsDir() {
		return nil, fmt.Errorf("PASS_UP_OPS_BACKUP_SRC_DIR 指向的目录不可用：%s", cfg.SrcDir)
	}
	return os.DirFS(cfg.SrcDir), nil
}

// checkScripts 在动远端之前先确认脚本包是完整的：
// 缺文件时上传会「成功」，直到远端 install.sh 报 command not found 才发现。
func checkScripts(src fs.FS, comps []component) error {
	need := []string{"preflight_check.sh", "lib/common.sh"}
	for _, c := range comps {
		need = append(need,
			path.Join(c.remoteDir(), "install.sh"),
			c.backupPath(""),
			c.logrotateSrc(""),
		)
	}
	for _, n := range need {
		if _, err := fs.Stat(src, n); err != nil {
			return fmt.Errorf("脚本包缺少 %s（嵌入产物不完整，或 PASS_UP_OPS_BACKUP_SRC_DIR 指错了目录）", n)
		}
	}
	return nil
}

// buildPayload 把脚本树打成 tar.gz。src 可能是嵌入的 deploy/backup（embed.FS），
// 也可能是覆盖出来的磁盘目录（os.DirFS）—— 两者都是 fs.FS，路径一律斜杠分隔，
// 所以不再需要 filepath.Rel / ToSlash 那套 Windows 专用处理。
func buildPayload(src fs.FS, envs map[string]string) ([]byte, error) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	// 打包时间戳回退 5 秒：远端时钟通常略慢于本机，用 now 会被 tar 报
	// "time stamp ... is X s in the future"（仅噪音，但会淹没真正的错误）。
	modTime := time.Now().Add(-5 * time.Second)

	err := fs.WalkDir(src, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if p == "." {
			return nil
		}
		rel := p
		base := d.Name()

		if d.IsDir() {
			if base == ".git" || base == ".deploy" {
				return fs.SkipDir
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
		data, err := fs.ReadFile(src, p)
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
	passwordStdin := false
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
		case a == "--password-stdin":
			passwordStdin = true
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
	if passwordStdin {
		pw, err := readSudoPassword()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
			return 1
		}
		applySudoPassword(t, pw)
	}
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

	// 与 cron 里的备份脚本保持同一身份（清单 user），不要 sudo 提权：
	// 见 runBackupDeploy 里同处的说明。
	code, err := streamPreflight(root, t, cfg, comps)
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
//
// embedded 是编进二进制的脚本树（根包 backupdist.go 注入）：embed 路径不能有 `..`，
// 所以 internal/backup 自己嵌不了 deploy/backup，只能由 main 传进来（与 ui 收 fs.FS 同理）。
func CmdBackup(args []string, embedded fs.FS) int {
	if len(args) == 0 {
		backupUsage()
		return 2
	}
	switch args[0] {
	case "deploy":
		return runBackupDeploy(args[1:], embedded)
	case "deps":
		return runBackupDeps(args[1:])
	case "deps-uninstall":
		return runBackupDepsUninstall(args[1:])
	case "verify":
		return runBackupVerify(args[1:])
	case "once":
		return runBackupOnce(args[1:])
	case "env":
		return runBackupEnv(args[1:], embedded)
	case "sync-env":
		return runBackupSyncEnv(args[1:])
	case "compare-env":
		return runBackupCompareEnv(args[1:])
	case "help", "-h", "--help":
		backupUsage()
		return 0
	default:
		fmt.Fprintf(os.Stderr, "未知子命令：backup %s\n\n", args[0])
		backupUsage()
		return 2
	}
}

// runBackupEnv 把嵌入的 backup.env.example 落到本机配置目录，供人填真实值。
// 脚本树里不放任何真实凭证，所以「新机器上从哪拿模板」必须由这条命令回答。
// 已存在的文件一律不覆盖：那是填好的凭证。
func runBackupEnv(args []string, embedded fs.FS) int {
	comps := []component{compPG, compMinio}
	if len(args) > 0 {
		var err error
		comps, err = parseComponents(args[0])
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
			return 2
		}
		if len(args) > 1 {
			fmt.Fprintln(os.Stderr, "用法: ops backup env [pg|minio|all]")
			return 2
		}
	}

	dir := shared.BackupEnvDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 创建配置目录失败：%v\n", err)
		return 1
	}
	for _, c := range comps {
		src := path.Join(embeddedRoot, c.remoteDir(), "backup.env.example")
		data, err := fs.ReadFile(embedded, src)
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 嵌入产物缺少 %s：%v\n", src, err)
			return 1
		}
		dst := filepath.Join(dir, c.envName())
		if _, err := os.Stat(dst); err == nil {
			fmt.Printf("%s 已存在，未覆盖：%s\n", c, dst)
			continue
		}
		if err := os.WriteFile(dst, data, 0o600); err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 写入 %s 失败：%v\n", dst, err)
			return 1
		}
		fmt.Printf("已生成 %s 模板：%s\n", c, dst)
	}
	fmt.Println("请按模板填好必填项（勿留 CHANGE_ME / YOUR_），再运行 ops backup deploy。")
	return 0
}

func backupUsage() {
	fmt.Print(`用法:
  ops backup deploy [pg|minio|all] --server <name> [--dry-run] [--force] [--run-now] [--install-deps]
  ops backup deps   [pg|minio|all] --server <name> [--json] [--dry-run] [--pg-major <n>]
                                       只安装缺失依赖（mc / pg_restore 等），不部署脚本；界面用这个入口
  ops backup deps-uninstall --server <name> --target <mc|pg_client> [--dry-run]
                                       只卸载工具装的 mc / PG 客户端，供「装了再卸、卸了再装」复测
  ops backup once      [pg|minio|all] --server <name> [--dry-run]
                                       立即跑一次备份（复用已部署脚本，不重装、不进 crontab）
                                       --dry-run 只跑 preflight + 打印计划，不改远端
  ops backup env       [pg|minio|all]  生成本机配置模板（已存在不覆盖）
  ops backup sync-env  [pg|minio|all] --server <name>
                                       只把本机填好的配置推到远端 backup.env（不重装脚本）
  ops backup compare-env [pg|minio|all] --server <name>
                                       只读抓取远端 backup.env，输出脱敏后的键值（供界面对照）

目标机只从服务器清单（servers.json）里按 name 选择。
脚本随二进制分发（deploy/backup 已嵌入）；只有调试时才用
PASS_UP_OPS_BACKUP_SRC_DIR 覆盖成本机目录。

选项:
  --server <name> 目标服务器（省略则用清单的 default / 唯一的 backup）
  --dry-run       只预检并打印将执行的远端命令，不修改远端
                  （backup once 的 --dry-run 只跑 preflight + 打印计划，不跑备份脚本）
  --force         用本机 backup.env 覆盖远端已有配置（旧配置随 .old 目录保留）
  --run-now       安装成功后立即跑一次备份（写操作，可能较长时间）
  --install-deps  自动安装缺失依赖（apt/dnf/yum；mc 从官方地址下载）
  --pg-major      仅 backup deps：按 PGDG 官方仓库装 postgresql-client-<n>
  --target        仅 backup deps-uninstall：mc / pg_client（可重复；至少一个）
  --password-stdin
                  从 stdin 读初始 sudo 密码（没有 --password 参数）；
                  清单里已配 sudo.password 时以清单为准，界面部署走这条
`)
}
