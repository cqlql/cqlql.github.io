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
	"path/filepath"
	"strings"
	"time"
)

const collectTimeout = 45 * time.Second

type options struct {
	Scope  string
	Server string
	DryRun bool
	JSON   bool
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
		default:
			opt.Scope = args[0]
			i = 1
		}
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
		case strings.HasPrefix(a, "-"):
			return opt, fmt.Errorf("未知参数：%s（第一刀只接受 --server / --dry-run / --json；--no-build / --no-sync / 发版参数属于 P3b 草案，未实现）", a)
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
	return errors.New("第一刀只开放只读预演：`ops deploy ... --dry-run`；" +
		"正式发布（P3b）尚未实现、需单独授权。本次没有生成计划，也没有连接远端")
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
	// 🔴 第一刀唯一的硬门禁：不带 --dry-run 就地拒绝，连清单都不读。
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
                       只读预演：真实 ssh 只读预检 + 打印将执行的每条远端命令，
                       与 deploy.sh 人工步骤逐条对齐；不改远端任何文件。

🔴 第一刀只有 --dry-run，不带它直接拒绝。正式发布（P3b）/ rollback / ps / logs /
   releases 都未注册、未授权；没有正式发布按钮，也不接受 --no-build / --no-sync /
   发版参数。预演不是执行凭证，不落发版台账、不写远端 state.env。
🔴 --server 只认 servers.json 的 name（不接受任意 host）；统一用清单 user/key，
   不提权、不收 sudo 密码，私钥路径不打印。
🔴 第一刀不拿远端锁（拿锁会写文件）、不 mkdir、不 rsync、不构建镜像、不 compose up。
   只读失败也回完整快照（collected=false、数值一律 —、不猜 0）。
🔴 部署目标只由 --server 选择：清单里 k1 是备份服务器（role=backup）、
   k2 是应用部署目标（role=app）；别把备份机的预检结果当成应用目标就绪结论。
   172.16.0.222:5000/passup 只是 compose 的镜像仓库前缀，不是部署目标。
`)
}
