package deploy

// ops deploy：P3a 第一刀的 CLI 唯一入口。
//
// 🔴 只有 `--dry-run` 可用。不带它就**直接拒绝**，不生成计划、不碰远端 ——
//    正式发布（P3b）要单独授权，门禁钉在代码里而不是只写在文档里。
// 🔴 目标机只认 servers.json 的 name；不接受任意 host、私钥路径不打印。
// 🔴 只读失败也回完整快照并打印报告（rc=1），不是一句错误就退出。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const collectTimeout = 45 * time.Second
const releaseTimeout = 30 * time.Minute

type options struct {
	Scope          string
	Server         string
	DryRun         bool
	JSON           bool
	Release        bool // 显式发布动词 `ops deploy release`
	Confirm        string
	ConfigDir      string
	AIConfigDir    string
	ImagePrefix    string
	ImageTag       string
	ReleaseVersion string
	ReleaseNote    string
	NoBuild        bool
}

var errHelp = errors.New("help")

// parseDeployArgs 只认第一刀的白名单参数。P3b 的 --no-build / --no-sync /
// --release-version / --release-note 以及 rollback / ps / logs / releases 一律拒绝，
// 免得草案命令被人当成能跑的开关。
func parseDeployArgs(args []string) (options, error) {
	opt := options{Scope: ScopeAll}
	if len(args) == 0 {
		return opt, errHelp
	}
	i := 0
	if !strings.HasPrefix(args[0], "-") {
		switch args[0] {
		case "help", "-h", "--help":
			return opt, errHelp
		case "release":
			// 门 1：显式发布动词。没有它就是只读预演 / 直接拒绝。
			opt.Release = true
			i = 1
		default:
			opt.Scope = args[0]
			i = 1
		}
	}
	if opt.Release && i < len(args) && !strings.HasPrefix(args[i], "-") && validScopes[args[i]] {
		opt.Scope = args[i]
		i++
	}
	for ; i < len(args); i++ {
		a := args[i]
		need := func() (string, error) {
			if i+1 >= len(args) {
				return "", fmt.Errorf("%s 缺少参数", a)
			}
			i++
			return args[i], nil
		}
		needEq := func(prefix string) (string, error) {
			if strings.HasPrefix(a, prefix+"=") {
				return strings.TrimPrefix(a, prefix+"="), nil
			}
			return need()
		}
		releaseArg := func() error {
			if !opt.Release {
				return fmt.Errorf("未知参数：%s（正式发布参数只在 `ops deploy release` 后可用；只读预演只接受 --server / --dry-run / --json）", a)
			}
			return nil
		}
		switch {
		case a == "help", a == "-h", a == "--help":
			return opt, errHelp
		case a == "--server":
			v, err := need()
			if err != nil {
				return opt, err
			}
			opt.Server = v
		case strings.HasPrefix(a, "--server="):
			opt.Server = strings.TrimPrefix(a, "--server=")
		case a == "--dry-run":
			opt.DryRun = true
		case a == "--json":
			opt.JSON = true
		case a == "--confirm" || strings.HasPrefix(a, "--confirm="):
			if err := releaseArg(); err != nil {
				return opt, err
			}
			v, err := needEq("--confirm")
			if err != nil {
				return opt, err
			}
			opt.Confirm = v
		case a == "--config-dir" || strings.HasPrefix(a, "--config-dir="):
			if err := releaseArg(); err != nil {
				return opt, err
			}
			v, err := needEq("--config-dir")
			if err != nil {
				return opt, err
			}
			opt.ConfigDir = v
		case a == "--ai-config-dir" || strings.HasPrefix(a, "--ai-config-dir="):
			if err := releaseArg(); err != nil {
				return opt, err
			}
			v, err := needEq("--ai-config-dir")
			if err != nil {
				return opt, err
			}
			opt.AIConfigDir = v
		case a == "--image-prefix" || strings.HasPrefix(a, "--image-prefix="):
			if err := releaseArg(); err != nil {
				return opt, err
			}
			v, err := needEq("--image-prefix")
			if err != nil {
				return opt, err
			}
			opt.ImagePrefix = v
		case a == "--image-tag" || strings.HasPrefix(a, "--image-tag="):
			if err := releaseArg(); err != nil {
				return opt, err
			}
			v, err := needEq("--image-tag")
			if err != nil {
				return opt, err
			}
			opt.ImageTag = v
		case a == "--release-version" || strings.HasPrefix(a, "--release-version="):
			if err := releaseArg(); err != nil {
				return opt, err
			}
			v, err := needEq("--release-version")
			if err != nil {
				return opt, err
			}
			opt.ReleaseVersion = v
		case a == "--release-note" || strings.HasPrefix(a, "--release-note="):
			if err := releaseArg(); err != nil {
				return opt, err
			}
			v, err := needEq("--release-note")
			if err != nil {
				return opt, err
			}
			opt.ReleaseNote = v
		case a == "--no-build":
			if err := releaseArg(); err != nil {
				return opt, err
			}
			opt.NoBuild = true
		case strings.HasPrefix(a, "-"):
			return opt, fmt.Errorf("未知参数：%s（只读预演只接受 --server / --dry-run / --json；正式发布参数要跟在 `release` 动词后）", a)
		default:
			return opt, fmt.Errorf("多余的位置参数：%s", a)
		}
	}
	if !validScopes[opt.Scope] {
		return opt, fmt.Errorf("未知发布范围：%s（可选 %s）", opt.Scope, JoinScopeNames())
	}
	return opt, nil
}

// dryRunGate 是纯函数：把「第一刀只有 --dry-run」钉成单测可锁的判据。
// 正式发布（P3b）尚未实现、需单独授权；拒绝时连清单都不读、远端都不连。
func dryRunGate(opt options) error {
	if opt.DryRun {
		return nil
	}
	return errors.New("只带 --dry-run 才是只读预演；不带它必须走显式发布动词 " +
		"`ops deploy release ... --confirm yes`（P3b 主链路）。本次没有生成计划，也没有连接远端")
}

// releaseGate 是 CLI / 服务端同一处逐字再验的门禁（门 1 / 2 / 5 + 参数完整性）。
// 🔴 授权不落盘、不缓存、不写进 ops.env；每次发布都要重新给 --confirm yes。
func releaseGate(opt options) error {
	if !opt.Release {
		return errors.New("缺少显式发布动词 `release`")
	}
	if opt.DryRun {
		return errors.New("release 与 --dry-run 不能同用（预演是只读的，不会发布）")
	}
	if opt.Server == "" {
		return errors.New("正式发布必须显式 --server <name>（目标机只认 servers.json 的 name）")
	}
	if opt.Confirm != "yes" {
		return errors.New("门 2 未过：必须 --confirm yes，服务端逐字再验（不读配置、不缓存、不当次之外有效）")
	}
	if opt.ConfigDir == "" {
		return errors.New("门 3 前置：必须显式 --config-dir（工具不擅自读生产 .env、不擅自同步凭证）")
	}
	return ValidateRelease(opt.ReleaseVersion, opt.ReleaseNote)
}

func gitShortCommit(dir string) (string, error) {
	c := exec.Command("git", "-C", dir, "rev-parse", "--short", "HEAD")
	b, err := c.Output()
	if err != nil {
		return "", fmt.Errorf("取不到 git 短 commit（不猜 tag，可用 --image-tag 显式指定）：%w", err)
	}
	return strings.TrimSpace(string(b)), nil
}

// runReleaseCLI 是 P3b-1 唯一的写路径：门禁没过连清单都不读、远端都不连。
func runReleaseCLI(opt options) int {
	if err := releaseGate(opt); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}
	release, ok := shared.AcquireSingleton(deployLockName)
	if !ok {
		fmt.Fprintln(os.Stderr, "ERROR: 已有发布任务在跑（本地单例锁）；拿不到立刻失败、不排队。")
		return 1
	}
	defer release()

	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", scrub(err.Error()))
		return 2
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", scrub(err.Error()))
		return 2
	}
	srv, err := list.Resolve(opt.Server, cfg.DefaultServer)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", scrub(err.Error()))
		return 2
	}
	t := shared.NewSSHTarget(srv)

	exe, err := os.Executable()
	if err != nil {
		exe = ""
	}
	opsDir := filepath.Dir(exe)
	parent := filepath.Dir(opsDir)
	prefix := opt.ImagePrefix
	if prefix == "" {
		v, e := ReadImagePrefix(filepath.Join(parent, "pass-up.backend", "docker"))
		if e != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 镜像前缀没采到（不猜默认值，可用 --image-prefix 显式指定）：%v\n", e)
			return 2
		}
		prefix = v
	}
	tag := opt.ImageTag
	if tag == "" {
		v, e := gitShortCommit(opsDir)
		if e != nil {
			fmt.Fprintf(os.Stderr, "ERROR: %v\n", e)
			return 2
		}
		tag = v
	}
	configDir, err := filepath.Abs(opt.ConfigDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: --config-dir 不是有效路径：%v\n", err)
		return 2
	}
	aiDir := ""
	if opt.AIConfigDir != "" {
		aiDir, err = filepath.Abs(opt.AIConfigDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: --ai-config-dir 不是有效路径：%v\n", err)
			return 2
		}
	}

	rcfg := ReleaseConfig{
		Server: srv.Name, Host: HostLabel(t), Scope: opt.Scope,
		RemoteDir: DefaultRemoteDir, ImagePrefix: prefix, ImageTag: tag,
		ConfigDir: configDir, AIConfigDir: aiDir,
		BackendRepo:    filepath.Join(parent, "pass-up.backend"),
		AIRepo:         filepath.Join(parent, "pass-up.ai"),
		WebRepo:        filepath.Join(parent, "pass-up.frontend"),
		ReleaseVersion: opt.ReleaseVersion, ReleaseNote: opt.ReleaseNote,
		NoBuild: opt.NoBuild, Timestamp: time.Now().Format("20060102-150405"),
		HealthWindow: DefaultHealthWindow, HealthPoll: DefaultHealthPoll,
	}
	ctx, cancel := context.WithTimeout(context.Background(), releaseTimeout)
	defer cancel()
	rep := RunRelease(ctx, rcfg, &SSHRunner{Target: t})
	if opt.JSON {
		return exitCodeForRelease(rep, writeReleaseJSON(rep))
	}
	printReleaseReport(rep)
	return exitCodeForRelease(rep, 0)
}

func exitCodeForRelease(rep ReleaseReport, writeCode int) int {
	if writeCode != 0 {
		return writeCode
	}
	if !rep.Completed {
		return 1
	}
	return 0
}

func writeReleaseJSON(rep ReleaseReport) int {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(rep); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 输出 JSON 失败：%v\n", err)
		return 1
	}
	return 0
}

func printReleaseReport(rep ReleaseReport) {
	fmt.Println("==> 应用部署正式发布（P3b-1 · CLI 主链路）")
	fmt.Printf("  目标机：%s（%s）  范围：%s  镜像：%s  tag：%s\n",
		rep.Server, rep.Host, rep.Scope, rep.ImagePrefix, rep.ImageTag)
	fmt.Printf("  发版号：%s（只作人读元信息，不是镜像 tag）  备注长度：%d\n",
		rep.ReleaseVersion, len([]rune(rep.ReleaseNote)))
	fmt.Printf("  远端 .env 换行：%s   :previous：%s\n", EnvEndingText(rep.EnvLineEnding), rep.PreviousTag)
	fmt.Println("\n==> 六道门禁")
	for _, g := range rep.Gates {
		mark := "✓"
		if !g.OK {
			mark = "✗"
		}
		fmt.Printf("  [%s] %-16s %s\n", mark, g.Name, g.Detail)
	}
	fmt.Println("\n==> 六阶段（失败停在当前阶段）")
	for _, s := range rep.Stages {
		mark := "✓"
		switch {
		case !s.OK:
			mark = "✗"
		case s.Skipped:
			mark = "–"
		}
		fmt.Printf("  [%s] %-10s %s\n", mark, s.Name, s.Detail)
	}
	fmt.Println("\n==> 流转镜像（逐字取自 compose 的 image:）")
	for _, i := range rep.Images {
		fmt.Printf("  - %s\n", i)
	}
	fmt.Println("\n==> 任务日志（尾部 30 行）")
	from := 0
	if len(rep.Log) > 30 {
		from = len(rep.Log) - 30
	}
	for _, l := range rep.Log[from:] {
		fmt.Printf("  %s\n", l)
	}
	fmt.Println("\n==> 警告")
	for _, w := range rep.Warnings {
		fmt.Printf("  - %s\n", w)
	}
	fmt.Println("\n==> 报告")
	fmt.Printf("  completed=%v  failed_stage=%q  duration_ms=%d\n", rep.Completed, rep.FailedStage, rep.DurationMS)
	if rep.Error != "" {
		fmt.Printf("  🔴 失败：%s\n", rep.Error)
	}
	fmt.Printf("  %s\n", rep.Note)
	fmt.Println("  🔴 健康门失败不自动回滚（`rollback` 属 P4）；预演 / 门禁阻塞不入账，本刀不落发版台账、不写 state.env。")
}

// CmdDeploy 是 deploy 顶层动词的唯一入口（main.go 注册）。
func CmdDeploy(args []string) int {
	opt, err := parseDeployArgs(args)
	if errors.Is(err, errHelp) {
		deployUsage()
		return 0
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}
	// 🔴 P3b-1：只有显式 `release` 动词才进写路径；六道门在 releaseGate / RunRelease 里再验。
	if opt.Release {
		return runReleaseCLI(opt)
	}
	// 🔴 不带任何动词、也不带 --dry-run：就地拒绝，连清单都不读。
	if err := dryRunGate(opt); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}

	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", scrub(err.Error()))
		return 2
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", scrub(err.Error()))
		return 2
	}
	srv, err := list.Resolve(opt.Server, cfg.DefaultServer)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", scrub(err.Error()))
		return 2
	}
	t := shared.NewSSHTarget(srv)
	host := HostLabel(t)

	exe, err := os.Executable()
	if err != nil {
		exe = ""
	}
	opsDir := filepath.Dir(exe)
	repos := DetectRepos(opsDir)
	prefix := notCollected
	if repos.Backend {
		if v, e := ReadImagePrefix(filepath.Join(filepath.Dir(opsDir), "pass-up.backend", "docker")); e == nil {
			prefix = v
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), collectTimeout)
	defer cancel()
	pf := Collect(ctx, t, host)
	req := PlanRequest{
		Server:      srv.Name,
		Host:        host,
		Scope:       opt.Scope,
		ImagePrefix: prefix,
		ImageTag:    notCollected, // 第一刀不构建、不采集 git commit，不猜值
		RepoPaths:   repos,
	}
	p := BuildPlan(pf, req)
	p.Warnings = append(p.Warnings, "镜像 tag 未采集（第一刀不构建）；`<tag>` 是占位，P3b 才按 git 短 commit 取值")

	// 目标机身份由清单 role 决定（k1=backup 备份服务器、k2=app 应用部署目标）。
	// 在备份机上跑预演时给一条提示，免得把备份机快照误读成应用目标就绪结论。
	// 🔴 不硬编码任何 IP：部署目标只由 --server 选择（§9.1）。
	if w := roleWarning(srv.Name, srv.Role); w != "" {
		p.Warnings = append(p.Warnings, w)
	}

	// 🔴 --json 与 人读报告的退出码必须一致：连不上 / 有全局阻塞都是 rc=1，
	//    不能因为「JSON 打印成功」就回 0，否则界面 / 脚本会误判预演通过。
	if opt.JSON {
		return exitCodeFor(p, writeJSON(p))
	}
	printReport(p)
	if rc := exitCodeFor(p, 0); rc != 0 {
		fmt.Fprintln(os.Stderr, "ERROR: 只读预演没能生成可执行计划（见上面的完整快照）；远端没有被修改。")
		return rc
	}
	return 0
}

// roleWarning 是纯函数：只有备份机才提示「别把备份机快照读成应用目标结论」。
// 🔴 文案里不许出现任何硬编码 IP —— 早期版本写死了「真实应用主机 172.16.0.222
//    尚未登记」，拓扑确认后成了误导：那个地址只是 compose 的镜像仓库前缀 /
//    运维机本机 WSL2 转发，真正的部署目标由 --server 决定（docs/deploy.md §9.1）。
// 单测 TestRoleWarning 锁住这条。
func roleWarning(name, role string) string {
	if role != "backup" {
		return ""
	}
	return fmt.Sprintf(
		"目标机 %s 在清单里的 role 是 backup（备份服务器）；应用部署目标应是 role=app 的机器。本次只读预演验证的是链路与零写入，不是应用主机就绪结论",
		name)
}

// exitCodeFor 是纯函数：把「预演失败不能回 0」钉成单测可锁的判据。
// writeCode 是 --json 编码结果（人读路径传 0），非 0 优先。
func exitCodeFor(p Plan, writeCode int) int {
	if writeCode != 0 {
		return writeCode
	}
	if !p.Available {
		return 1
	}
	return 0
}

func printReport(p Plan) {
	fmt.Println("==> 应用部署只读预演（P3a · 第一刀）")
	fmt.Printf("  目标机：%s（%s，来自 servers.json）\n", p.Server, p.Host)
	fmt.Printf("  发布范围：%s   远端目录：%s   镜像引用：%s   tag：%s\n",
		p.Scope, p.RemoteDir, p.ImagePrefix, p.ImageTag)
	fmt.Println("  执行身份：清单 user/key · 不提权 · 不喂 sudo 密码 · 私钥路径不打印")

	fmt.Printf("\n==> 远端只读预检（collected=%v，一条 sh -s，全程不写文件）\n", p.Preflight.Collected)
	if p.Preflight.Error != "" {
		fmt.Printf("  🔴 采集错误：%s\n", p.Preflight.Error)
	}
	if len(p.Preflight.Checks) == 0 {
		fmt.Println("  （没采到：collected=false，数值一律 —，不用 0 兜底）")
	}
	for _, c := range p.Preflight.Checks {
		mark := "✓"
		if !c.OK {
			mark = "·"
		}
		fmt.Printf("  [%s] %-22s %-24s %s\n", mark, c.Name, c.Value, c.Detail)
	}

	fmt.Println("\n==> 与 deploy.sh 人工步骤逐条对齐（2026-11-11 实读真实脚本）")
	for _, a := range p.Alignments {
		fmt.Printf("  新工具「%s」 ↔ deploy.sh「%s」\n", a.Ours, a.Theirs)
		fmt.Printf("      差异：%s\n", a.Diff)
	}

	fmt.Println("\n==> 将执行的命令（草案 · 只打印不执行）")
	for _, c := range p.Commands {
		fmt.Printf("  [%s] %s\n", c.Phase, c.Cmd)
		if c.Note != "" {
			fmt.Printf("      注：%s\n", c.Note)
		}
	}

	fmt.Println("\n==> 影响清单")
	for _, l := range p.Impact {
		fmt.Printf("  - %s\n", l)
	}
	fmt.Println("\n==> 警告")
	for _, w := range p.Warnings {
		fmt.Printf("  - %s\n", w)
	}
	fmt.Println("\n==> 全局阻塞")
	if len(p.Blockers) == 0 {
		fmt.Println("  - 无")
	}
	for _, b := range p.Blockers {
		fmt.Printf("  - 🔴 %s\n", b)
	}

	fmt.Println("\n==> 报告")
	fmt.Printf("  available=%v · %s\n", p.Available, p.Note)
	fmt.Println("  🔴 第一刀没有正式发布按钮；预演不落台账、不写 state.env，P3b 真实发布要单独授权。")
	fmt.Println("  🔴 撞锁 / 构建失败 / 健康门失败是运行期结果，不是预演阻塞；本刀不制造也不判断这些结果。")
}

func writeJSON(p Plan) int {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(p); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 输出 JSON 失败：%v\n", err)
		return 1
	}
	return 0
}

func deployUsage() {
	fmt.Print(`用法:
  ops deploy [all|infra|ai|backend|web] --server <name> --dry-run [--json]
                       只读预演（P3a）：真实 ssh 只读预检 + 打印将执行的每条远端命令，
                       与 deploy.sh 人工步骤逐条对齐；不改远端任何文件。
  ops deploy release [--server <name>] --confirm yes --config-dir <本机配置目录>
                       --release-version <三段式> [--release-note <单行>]
                       [--ai-config-dir <ai 配置目录>] [--image-prefix <前缀>]
                       [--image-tag <tag>] [--no-build] [--json]
                       正式发布（P3b-1 CLI 主链路）：六道门禁 + 六阶段状态机 +
                       落盘流转断点续传 + 两个 compose 单元 + 150 s 健康门。

🔴 只读预演不带 --dry-run 直接拒绝；release 与 --dry-run 不能同用。
   rollback / ps / logs / releases 仍未注册；界面视图与发版台账属后续批次。
🔴 门 2：--confirm yes 由服务端逐字再验，授权只对当次任务有效、不落盘、不缓存。
🔴 门 3：必须显式 --config-dir —— 工具不擅自读生产 .env、不擅自同步 52 键凭证；
   缺 /data / .env / secrets/ / compose 会点名哪一项，不开始构建、不同步。
🔴 门 4：本地单例 + 远端 flock -n，拿不到立刻失败、不排队。
🔴 门 5：发版号三段式白名单；备注单行、不写远端、不拼进任何命令。
🔴 门 6：配置先备份到 .deploy/backup/<时间戳>/，备份没成功就不往下走。
🔴 失败停在当前阶段、保留现场；健康门失败**不自动回滚**（rollback 属 P4）。
   --no-build 是显式快路径（复用现成镜像），默认每轮构建。
🔴 --server 只认 servers.json 的 name（不接受任意 host）；统一用清单 user/key，
   不提权、不收 sudo 密码，私钥路径不打印；目标机只由 --server 决定。
🔴 第一刀的只读预演不拿远端锁、不 mkdir、不 rsync、不构建镜像、不 compose up；
   只读失败也回完整快照（collected=false、数值一律 —、不猜 0）。
`)
}
