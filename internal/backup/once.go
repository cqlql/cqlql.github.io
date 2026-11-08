package backup

// 手动备份（立即跑一次）：ops backup once [pg|minio|all] --server <name> [--dry-run]
//
// 判据见 docs/backup-once.md。这里只接一根线到**备份机上已经部署好的**两个脚本，
// 不重写备份逻辑、不上传脚本、不写 crontab / logrotate / backup.env。
//
// 🔴 与 deploy --run-now 的区别：那是「装完首跑」，前面必然走上传 / install /
//    preflight；once 是日常触发，只跑 preflight + 已部署脚本。两者共用
//    streamPreflight 与 runBackupScripts（deploy.go），不抄第二遍。
// 🔴 不提权：root=false，且这里主动清掉 sudo 密码，清单里配了也不会走 sudo -S。
//    界面确认弹窗因此没有 sudo 密码框（docs/backup-once.md §3 门④）。
// 🔴 报告只报脚本结果：不写「备份体系正常 / 定时任务正常」，不把 status 的心跳
//    当成功凭证；手动成功同样写 last_success.txt，必须显式说明「不代表定时任务正常」。
// 🔴 工具不读 crontab：与定时窗口撞车由脚本内部的 flock -n 处理，工具侧不解析、
//    不算时间、不改定时任务。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"strings"
)

type onceOptions struct {
	comps  []component
	Server string
	dryRun bool
}

// parseOnceArgs 只认白名单参数。刻意不接 --force / --run-now / --install-deps /
// --password-stdin：手动备份不该顺带重部署，也不需要提权。
func parseOnceArgs(args []string) (onceOptions, error) {
	opt := onceOptions{comps: []component{compPG, compMinio}}
	seen := false
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--dry-run":
			opt.dryRun = true
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
			return opt, fmt.Errorf("未知参数：%s（手动备份不接受 --force / --run-now / --install-deps / --password-stdin）", a)
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

// onceImpact / onceWarnings 是 CLI 预演打印的影响清单与警告。
// 界面那份在 internal/ui/once.go：ui 不能 import backup（依赖方向硬约束 21），
// 与 pg_major / 卸载目标白名单一样各留一份纯数据，改文案要两处同步。
var onceImpact = map[component][]string{
	compPG: {
		"新建一份 .dump + globals_*.sql + 各自 .sha256；按日期进 daily / weekly / monthly（每月 1 号 monthly、周一 weekly）",
		"find -mtime -delete 清理三个分级目录里的旧备份",
		"全部成功后才写 last_success.txt 心跳；失败不写",
	},
	compMinio: {
		"mc alias set 写 ~/.mc；备份端桶不存在时 mc mb 创建",
		"逐桶 mc mirror --overwrite：备份端同名对象会被覆盖",
		"全部桶成功后才写心跳；失败桶逐项汇总，不写心跳",
	},
}

var onceWarnings = []string{
	"本次为手动触发，不代表定时任务正常；工具不读 crontab，定时任务是否正常由人判断",
	"撞锁 / 组件失败 / 超时是运行期结果，预演挡不住；脚本自带 flock -n，拿不到锁会如实退出 1、本次不执行",
	"界面子进程上限 30 分钟：超时只结束本机等待，远端可能仍在执行；不自动重试、不写「已取消」",
	"日志里可能出现 src_url / 桶名；绝不读取或回显 backup.env，凭证不进任务日志",
}

func onceComponentOrder(comps []component) string {
	parts := make([]string, 0, len(comps))
	for _, c := range comps {
		parts = append(parts, string(c))
	}
	return strings.Join(parts, " → ")
}

func printOncePlan(cfg *shared.Config, srv *shared.Server, opt onceOptions) {
	fmt.Println("手动备份计划")
	fmt.Printf("  目标机：%s（role=%s，%s@%s:%d）\n", srv.Name, srv.Role, srv.User, srv.Host, srv.Port)
	fmt.Printf("  运行身份：%s（清单 user；root=false 不提权，与 cron / preflight 同 HOME）\n", srv.User)
	fmt.Printf("  组件顺序：%s（串行，逐项汇总）\n", onceComponentOrder(opt.comps))
	fmt.Printf("  部署目录：%s\n", cfg.DeployDir)
	fmt.Println("  将执行的远端命令：")
	fmt.Printf("    bash %s %s   # preflight（只读）\n",
		path.Join(cfg.DeployDir, "preflight_check.sh"), preflightArg(opt.comps))
	for _, c := range opt.comps {
		fmt.Printf("    bash %s\n", c.backupPath(cfg.DeployDir))
	}
	fmt.Println("  影响清单（一次备份不只是多一个 dump）：")
	for _, c := range opt.comps {
		for _, line := range onceImpact[c] {
			fmt.Printf("    [%s] %s\n", c, line)
		}
	}
	fmt.Println("  警告：")
	for _, w := range onceWarnings {
		fmt.Printf("    - %s\n", w)
	}
}

// deployedScriptCheck 生成只读检查脚本：只 test -f，不写文件、不提权、不碰 crontab。
// 抽成纯函数是为了让 go test 能直接挡住「有人顺手把 sudo / 重定向加回来」。
func deployedScriptCheck(cfg *shared.Config, comps []component) string {
	files := []string{path.Join(cfg.DeployDir, "preflight_check.sh")}
	for _, c := range comps {
		files = append(files, c.backupPath(cfg.DeployDir))
	}
	var b strings.Builder
	b.WriteString("set -eu\n")
	for _, f := range files {
		fmt.Fprintf(&b, "[ -f %s ] || { echo '缺少脚本 %s'; exit 1; }\n", shared.ShQuote(f), f)
	}
	b.WriteString("echo OK\n")
	return b.String()
}

// checkDeployedScripts 只读确认备份机上确实躺着要跑的脚本。
// 用 RunScript（stdin `sh -s`）而不是 Capture：它的错误只说 user@host:port，
// 不会把 ssh 的「Identity file ... not accessible」带进输出（硬约束 8）。
func checkDeployedScripts(root context.Context, t *shared.SSHTarget, cfg *shared.Config, comps []component) error {
	ctx, cancel := context.WithTimeout(root, timeoutPrecheck)
	defer cancel()
	out, err := t.RunScript(ctx, deployedScriptCheck(cfg, comps))
	if err != nil {
		return fmt.Errorf("检查备份机上的脚本失败：%w\n%s\n先运行 ops backup deploy 把脚本装到备份机", err, strings.TrimSpace(out))
	}
	if strings.TrimSpace(out) != "OK" {
		return fmt.Errorf("检查备份机上的脚本失败：%s", strings.TrimSpace(out))
	}
	return nil
}

// runBackupOnce 的退出码：0 全部组件成功（或预演放行）；1 任一组件失败 / preflight 阻塞；
// 2 参数 / 配置 / 前置（脚本未部署）错。不自动重试、不自动清场。
func runBackupOnce(args []string) int {
	opt, err := parseOnceArgs(args)
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
		return 2
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}
	srv, err := list.Resolve(opt.Server, cfg.DefaultServer)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}
	// 🔴 --server 只认清单里的备份机：真正的判据是「这台机上有没有已部署脚本」，
	// 下面 checkDeployedScripts 会只读确认；role 不是 backup 时给一句警告，
	// 不硬拦（清单历史数据里角色可能写得随意，与 deploy 的选机口径保持一致）。
	if srv.Role != "" && srv.Role != "backup" {
		fmt.Printf("WARN: %s 在清单里的 role 是 %s，不是 backup；确认它就是备份脚本所在的机器。\n", srv.Name, srv.Role)
	}

	t := shared.NewSSHTarget(srv)
	// 🔴 手动备份不提权：清掉 sudo 密码，root=false 时不会走 sudo -S / sudo -n。
	t.SudoPassword = ""
	root := context.Background()

	if err := checkDeployedScripts(root, t, cfg, opt.comps); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}

	printOncePlan(cfg, srv, opt)
	if opt.dryRun {
		fmt.Println("==> 只读预演：跑一次 preflight 自检（不执行备份脚本、不改远端）")
	} else {
		fmt.Println("==> 正式执行：先跑 preflight 自检（退出码 1 阻塞 / 2 警告放行）")
	}
	code, err := streamPreflight(root, t, cfg, opt.comps)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: preflight 执行失败：%v\n", err)
		return 1
	}
	if code == 1 {
		fmt.Fprintln(os.Stderr, "ERROR: preflight 有错误，本次不执行备份；远端没有被修改。")
		return 1
	}
	if code == 2 {
		// 「尚未首次备份」是 2，不能反过来把第一次手动备份挡在门外。
		fmt.Println("WARN: preflight 有警告（常见于尚未首次备份），继续放行。")
	}

	if opt.dryRun {
		fmt.Println()
		fmt.Println("预演完成：没有执行备份脚本、没有产生 dump、没有写心跳，远端没有被修改。")
		fmt.Println("🔴 预演不是执行凭证：正式执行前服务端会自己再跑一遍 --dry-run 预检。")
		fmt.Println("🔴 本次为手动触发，不代表定时任务正常；工具不读 crontab。")
		return 0
	}

	// 串行跑完所有组件再汇总：不许被后一个组件的成功盖掉前一个的失败。
	results := runBackupScripts(root, t, cfg.DeployDir, opt.comps, "手动备份", false)
	return printOnceReport(results)
}

func printOnceReport(results []backupScriptResult) int {
	fmt.Println()
	fmt.Println("==> 手动备份结果（只报脚本结果）")
	failed := false
	for _, r := range results {
		switch {
		case r.err != nil:
			fmt.Printf("  %-5s 执行失败：%v\n", r.comp, r.err)
			failed = true
		case r.code != 0:
			fmt.Printf("  %-5s 退出码 %d\n", r.comp, r.code)
			failed = true
		default:
			fmt.Printf("  %-5s 退出码 0（脚本执行完成）\n", r.comp)
		}
	}
	if failed {
		fmt.Println("  结论：有组件未成功。没有自动重试、没有自动清场；失败组件不写心跳。")
		fmt.Println("  若上面的脚本日志出现「上一次备份任务仍在运行中」，则是被 flock 挡下、本次未执行。")
	} else {
		fmt.Println("  结论：所选组件的备份脚本均退出 0；这不等于「备份体系正常」，要看结果请去只读的监控页。")
	}
	fmt.Println("  ⚠️ 本次为手动触发，不代表定时任务正常；工具不读 crontab，定时任务是否正常由人判断。")
	fmt.Println("  查看心跳：ops status --server <name> 或界面「备份监控」页（都是只读）。")
	if failed {
		return 1
	}
	return 0
}
