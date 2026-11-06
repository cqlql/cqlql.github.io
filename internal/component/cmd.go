package component

// ops component 的 CLI 分发。入口只做：解析参数 → 解析清单里的 name → 只读体检 →
// list 回状态 / install 走安装（含 dry-run 预检门）。
//
// 🔴 主机只来自 servers.json：命令只接受 --server <name>，不接受任意 host。
// 🔴 组件 id 只认注册表且必须 PhaseReady，planned 组件一律拒绝写操作。
// 🔴 只有 --password-stdin，没有 --password：sudo 密码不进命令行 / ps / 日志。

import (
	"pass-up/ops/internal/shared"
)

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"strings"
	"time"
)

var errHelp = errors.New("help")

const commandTimeout = 20 * time.Minute

type options struct {
	Verb          string
	ID            string
	Server        string
	DryRun        bool
	JSON          bool
	PasswordStdin bool
}

func parseArgs(args []string) (options, error) {
	var opt options
	if len(args) == 0 {
		return opt, errHelp
	}
	rest := args[1:]
	switch args[0] {
	case "list":
		opt.Verb = "list"
	case "install":
		opt.Verb = "install"
	case "help", "-h", "--help":
		return opt, errHelp
	default:
		return opt, fmt.Errorf("未知子命令：component %s", args[0])
	}
	for i := 0; i < len(rest); i++ {
		a := rest[i]
		switch {
		case a == "--server":
			if i+1 >= len(rest) {
				return opt, fmt.Errorf("--server 缺少参数")
			}
			i++
			opt.Server = rest[i]
		case strings.HasPrefix(a, "--server="):
			opt.Server = strings.TrimPrefix(a, "--server=")
		case a == "--dry-run":
			opt.DryRun = true
		case a == "--json":
			opt.JSON = true
		case a == "--password-stdin":
			opt.PasswordStdin = true
		case a == "-h" || a == "--help":
			return opt, errHelp
		case strings.HasPrefix(a, "-"):
			return opt, fmt.Errorf("未知参数：%s", a)
		default:
			if opt.Verb != "install" || opt.ID != "" {
				return opt, fmt.Errorf("多余的参数：%s", a)
			}
			opt.ID = a
		}
	}
	if opt.Verb == "install" {
		if opt.ID == "" {
			return opt, fmt.Errorf("install 必须显式指定组件 id（当前只有 docker）")
		}
		if !Runnable(opt.ID) {
			return opt, fmt.Errorf("组件 %q 不可安装（未注册或尚未接入）", opt.ID)
		}
	}
	if opt.Verb == "list" && opt.DryRun {
		return opt, fmt.Errorf("list 本身就是只读的，不需要 --dry-run")
	}
	return opt, nil
}

// readSudoPassword 与 backup 包同款：只读一行，不回显、不落盘。
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

// CmdComponent 由 main.go 注入嵌入的脚本树（与 backup.CmdBackup 同构）。
func CmdComponent(args []string, scripts fs.FS) int {
	opt, err := parseArgs(args)
	if errors.Is(err, errHelp) {
		usage()
		return 0
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
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
	if opt.PasswordStdin && opt.Verb == "install" {
		pw, err := readSudoPassword()
		if err != nil {
			fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
			return 1
		}
		if t.SudoPassword == "" {
			t.SudoPassword = pw
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()

	view := Collect(ctx, t, scripts, srv.Name)
	if opt.Verb == "list" {
		if opt.JSON {
			// stdout 只放 JSON，界面用它做状态源；别的提示都走 stderr。
			_ = json.NewEncoder(os.Stdout).Encode(view)
			if !view.Collected {
				fmt.Fprintln(os.Stderr, "WARN: "+view.Error)
				return 1
			}
			return 0
		}
		printStatus(view)
		if !view.Collected {
			return 1
		}
		return 0
	}
	return Install(ctx, t, scripts, view, opt.DryRun)
}

func printStatus(v StatusView) {
	fmt.Println("")
	fmt.Println("========== 环境组件状态（只读） ==========")
	fmt.Printf("目标机：%s · 采集：%s\n", v.Server, boolText(v.Collected))
	if v.Error != "" {
		fmt.Println("ERROR: " + v.Error)
		fmt.Println("（连不上时组件状态是「未知」，不是「未安装」）")
		return
	}
	fmt.Println("")
	for _, c := range v.Components {
		fmt.Printf("  %-6s %-12s %-10s %s\n", c.ID, c.Name, c.State, c.Version)
	}
	fmt.Println("")
	for _, it := range v.Checks {
		fmt.Printf("  %-22s %-8s %s\n", it.Label, it.State, it.Value)
	}
	fmt.Println("")
	fmt.Printf("预检：%s", boolText(v.Preflight.Ready))
	for _, b := range v.Preflight.Blockers {
		fmt.Printf("\n  BLOCK: %s", b)
	}
	for _, w := range v.Preflight.Warnings {
		fmt.Printf("\n  WARN : %s", w)
	}
	fmt.Println("")
}

func usage() {
	fmt.Print(`用法:
  ops component list --server <name> [--json]
                                       只读体检：组件状态 + Docker 环境检查项
  ops component install docker --server <name> [--dry-run] [--password-stdin]
                                       按 Docker 官方 apt 仓库安装引擎（写操作）

--dry-run 只做只读预检与计划打印，绝不上传脚本、绝不修改远端。
--server 只接受 servers.json 里的 name；不接受任意主机地址。
--password-stdin 从 stdin 读一次性 sudo 密码（密码不进命令行 / 日志）。

已接入组件：docker。minio 在目录里占位但尚未接入，install 会直接拒绝。
`)
}
