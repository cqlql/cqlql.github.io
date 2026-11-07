package backup

// 「卸载备份依赖」：给装机复测用的反向动作。
//
// 🔴 只删**本工具装的东西**：mc = /usr/local/bin/mc 这一个文件；
//    PG 客户端 = postgresql-client / postgresql-client-<n> 这几个包。
//    cron / nc / ssh / tar / logrotate 是系统基础包，一律不提供卸载。
// 🔴 不动 ~/.mc 配置、MinIO 容器 / 镜像、PGDG 仓库配置、PostgreSQL 服务端、
//    crontab / logrotate / backup.env；不 autoremove（会连带删别的包）。
// 🔴 与安装同一套门：--dry-run 只报告、正式才提权、装/卸完都复查一遍。
// 🔴 卸载计划（可卸项 / 影响清单 / 文案）由 Go 侧算好随 DepsView 下发，前端只渲染。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
)

const (
	uninstallTargetMC       = "mc"
	uninstallTargetPGClient = "pg_client"
)

type DepsUninstallTarget struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Help  string `json:"help"`
}

type DepsUninstallPlan struct {
	Title       string                `json:"title"`
	Description string                `json:"description"`
	Targets     []DepsUninstallTarget `json:"targets"`
	Impacts     []string              `json:"impacts"`
	SubmitLabel string                `json:"submit_label"`
}

// depsUninstallPlan 是界面确认弹窗的唯一数据源。两个勾选项都不默认勾选
// （与组件卸载「删数据默认不勾」同一条规矩），必须由人显式选中至少一个。
func depsUninstallPlan() DepsUninstallPlan {
	return DepsUninstallPlan{
		Title: "确认卸载备份依赖",
		Description: "只删除本次勾选的命令，供「安装缺少依赖」复测用；服务端会先跑一遍 --dry-run，预检不过不会卸载。",
		Targets: []DepsUninstallTarget{
			{
				Key: uninstallTargetMC, Label: "卸载 MinIO 客户端 mc",
				Help: "只删工具安装的 /usr/local/bin/mc；不动 ~/.mc 配置、MinIO 容器与镜像",
			},
			{
				Key: uninstallTargetPGClient, Label: "卸载 PostgreSQL 客户端（pg_restore / pg_dump）",
				Help: "apt remove postgresql-client / postgresql-client-<n> / postgresql-client-common；不 autoremove、不删 PGDG 仓库配置、不动服务端",
			},
		},
		Impacts: []string{
			"卸载后备份定时任务下一次执行会失败（预期结果），不要为消掉报错去删 crontab / 改配置。",
			"postgresql-client-common 会一并移除：它提供 /usr/bin/pg_restore 这个 pg_wrapper 壳链接，只卸客户端包会留下「命令在、--version 却失败」的假阳性。若该包被其它程序依赖，apt 会拒绝卸载并如实报错。",
			"不提供卸载 cron / nc / ssh / scp / tar / logrotate：这些是系统基础包，卸了会破坏目标机。",
			"不删除 ~/.mc、MinIO 容器 / 镜像、PGDG apt 源、PostgreSQL 服务端、backup.env；libpq5 等只被自动安装的包不 autoremove。",
			"服务端先跑 --dry-run；正式卸载后自动复查命令是否真的消失（pg_restore / mc 必须 --version 能跑通才算已装）。",
		},
		SubmitLabel: "确认卸载",
	}
}

// validUninstallTargets 是 CLI 侧的目标白名单；界面后端另有一份同判据的校验。
func validUninstallTargets(in []string) ([]string, error) {
	seen := map[string]bool{}
	out := []string{}
	for _, raw := range in {
		t := strings.ToLower(strings.TrimSpace(raw))
		if t != uninstallTargetMC && t != uninstallTargetPGClient {
			return nil, fmt.Errorf("未知卸载目标 %q（可选 mc / pg_client）", raw)
		}
		if !seen[t] {
			seen[t] = true
			out = append(out, t)
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("至少要选一个卸载目标（--target mc / --target pg_client）")
	}
	return out, nil
}

type uninstallOptions struct {
	Server        string
	Targets       []string
	DryRun        bool
	PasswordStdin bool
}

func parseUninstallArgs(args []string) (uninstallOptions, error) {
	opt := uninstallOptions{}
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--dry-run":
			opt.DryRun = true
		case a == "--password-stdin":
			opt.PasswordStdin = true
		case a == "--server":
			if i+1 >= len(args) {
				return opt, fmt.Errorf("--server 缺少参数")
			}
			i++
			opt.Server = args[i]
		case strings.HasPrefix(a, "--server="):
			opt.Server = strings.TrimPrefix(a, "--server=")
		case a == "--target" || strings.HasPrefix(a, "--target="):
			v := ""
			if a == "--target" {
				if i+1 >= len(args) {
					return opt, fmt.Errorf("--target 缺少参数")
				}
				i++
				v = args[i]
			} else {
				v = strings.TrimPrefix(a, "--target=")
			}
			opt.Targets = append(opt.Targets, v)
		case a == "-h" || a == "--help":
			return opt, errHelp
		case strings.HasPrefix(a, "-"):
			return opt, fmt.Errorf("未知参数：%s", a)
		default:
			return opt, fmt.Errorf("deps-uninstall 不接受位置参数（组件固定 all）：%s", a)
		}
	}
	targets, err := validUninstallTargets(opt.Targets)
	if err != nil {
		return opt, err
	}
	opt.Targets = targets
	return opt, nil
}

// depsUninstallScript 是远端执行的唯一脚本生成器。
// 路径全部是常量，不接受任意路径 / 任意包名（包名来自远端 dpkg-query 的只读输出）。
func depsUninstallScript(targets []string) string {
	set := map[string]bool{}
	for _, t := range targets {
		set[t] = true
	}
	var b strings.Builder
	b.WriteString("set -e\n")
	if set[uninstallTargetMC] {
		b.WriteString(`echo '==> 卸载 mc：只删 /usr/local/bin/mc'
if [ -e /usr/local/bin/mc ]; then
  rm -f /usr/local/bin/mc
  echo '==> 已删除 /usr/local/bin/mc'
else
  echo '==> /usr/local/bin/mc 不存在，跳过'
fi
left=$(command -v mc 2>/dev/null || true)
if [ -n "$left" ]; then echo "WARN: mc 仍可从 $left 找到（不是工具安装的路径，本工具不删系统文件）" >&2; fi
`)
	}
	if set[uninstallTargetPGClient] {
		b.WriteString(`echo '==> 卸载 PostgreSQL 客户端包（保留服务端 / 仓库配置 / 其它依赖）'
if ! command -v apt-get >/dev/null 2>&1; then
  echo '目标机没有 apt-get：请用系统包管理器手工卸载 postgresql-client' >&2
  exit 1
fi
# postgresql-client-common 也要卸：它提供 /usr/bin/pg_restore 这个 pg_wrapper
# 壳链接，只卸 postgresql-client[-<n>] 会留下一个「命令在、--version 却失败」的空壳。
pkgs=$(dpkg-query -W -f='${binary:Package}\n' 'postgresql-client*' 2>/dev/null | grep -E '^postgresql-client(-[0-9]+|-common)?$' || true)
if [ -n "$pkgs" ]; then
  echo "==> 将移除：$pkgs"
  DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l timeout 300 apt-get remove -y $pkgs
else
  echo '==> 没有找到 postgresql-client 包，跳过'
fi
`)
	}
	b.WriteString("echo '==> 卸载动作结束'\n")
	return b.String()
}

func runBackupDepsUninstall(args []string) int {
	opt, err := parseUninstallArgs(args)
	if errors.Is(err, errHelp) {
		fmt.Print(depsUninstallUsage())
		return 0
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}
	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	srv, err := list.Resolve(opt.Server, cfg.DefaultServer)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	t := shared.NewSSHTarget(srv)
	if opt.PasswordStdin {
		pw, err := readSudoPassword()
		if err != nil {
			fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
			return 1
		}
		applySudoPassword(t, pw)
	}

	root := context.Background()
	ctx, cancel := context.WithTimeout(root, timeoutPrecheck)
	before, err := probeDeps(t, ctx, []component{compPG, compMinio}, srv.Name, "all", 0)
	cancel()
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 只读依赖检查失败（不推断状态）："+err.Error())
		return 1
	}
	fmt.Printf("卸载计划 · %s\n  目标：%s\n  当前：mc=%v / pg_restore=%v\n",
		srv.Name, strings.Join(opt.Targets, ", "),
		depInstalled(before, "mc"), depInstalled(before, "pg_restore"))
	for _, line := range depsUninstallPlan().Impacts {
		fmt.Println("  - " + line)
	}
	fmt.Println("\n将要执行的远端命令：")
	fmt.Print(depsUninstallScript(opt.Targets))
	if opt.DryRun {
		fmt.Println("\n--dry-run：只报告，未修改远端任何文件。")
		return 0
	}

	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	err = checkAccess(t, ctx)
	cancel()
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	ctx, cancel = context.WithTimeout(root, timeoutDeps)
	code, err := t.Stream(ctx, depsUninstallScript(opt.Targets), true, nil)
	cancel()
	if err != nil || code != 0 {
		fmt.Fprintf(os.Stderr, "ERROR: 卸载脚本执行失败（exit %d）：%v\n", code, err)
		return 1
	}

	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	after, err := probeDeps(t, ctx, []component{compPG, compMinio}, srv.Name, "all", 0)
	cancel()
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 复查依赖失败："+err.Error())
		return 1
	}
	installed := map[string]bool{}
	for _, it := range after.Items {
		installed[it.Name] = it.Installed
	}
	var still []string
	if containsString(opt.Targets, uninstallTargetMC) && installed["mc"] {
		still = append(still, "mc（可能装在别的路径，日志里有 WARN）")
	}
	if containsString(opt.Targets, uninstallTargetPGClient) && installed["pg_restore"] {
		still = append(still, "pg_restore（可能有其它版本的客户端仍在 PATH）")
	}
	if len(still) > 0 {
		fmt.Fprintln(os.Stderr, "ERROR: 卸载后仍可用："+strings.Join(still, "、")+"；请按上面的 WARN 人工复核")
		return 1
	}
	fmt.Println("==> 卸载完成并复查通过；现在可以在界面点「安装缺少依赖」重新跑一遍。")
	return 0
}

func depInstalled(view DepsView, name string) bool {
	for _, it := range view.Items {
		if it.Name == name {
			return it.Installed
		}
	}
	return false
}

func containsString(in []string, want string) bool {
	for _, s := range in {
		if s == want {
			return true
		}
	}
	return false
}

func depsUninstallUsage() string {
	return `用法:
  ops backup deps-uninstall --server <name> --target <mc|pg_client> [--target ...] [--dry-run] [--password-stdin]
    --target mc         只删工具安装的 /usr/local/bin/mc
    --target pg_client  apt remove postgresql-client / postgresql-client-<n>
                        / postgresql-client-common（提供 pg_restore 壳链接）
    --dry-run           只打印将执行的远端命令，不改远端任何文件
    --password-stdin    从 stdin 读初始 sudo 密码（没有 --password 参数）

只用于「卸载了再装一次」的复测；不提供卸载 cron / nc / ssh / tar / logrotate，
不 autoremove、不删 ~/.mc / 容器 / 镜像 / PGDG 源 / 服务端 / crontab / backup.env。
界面同样要输 yes 确认，并由服务端先跑 --dry-run。
`
}
