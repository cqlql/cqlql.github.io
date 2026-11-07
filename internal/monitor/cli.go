package monitor

// ops status 的 CLI 分发：解析参数 → 清单选目标 → 只读账号 → Collect → 渲染 / --json。
//
// 🔴 主机只来自 servers.json；只读账号只来自该条目的 monitor（硬约束 9 / 12）。
// 🔴 退出码：0 无 danger / 1 有 danger（含连不上）/ 2 用法·配置错；
//    --json 三种情况都输出完整快照，stdout 只有 JSON，别的提示走 stderr。
// 🔴 任何输出都不打印私钥路径（AGENTS.md 硬约束 8）。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
)

var errStatusHelp = errors.New("help")

type statusOptions struct {
	Server string
	JSON   bool
}

func parseStatusArgs(args []string) (statusOptions, error) {
	var opt statusOptions
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "help" || a == "-h" || a == "--help":
			return opt, errStatusHelp
		case a == "--server":
			if i+1 >= len(args) {
				return opt, fmt.Errorf("--server 缺少参数")
			}
			i++
			opt.Server = args[i]
		case strings.HasPrefix(a, "--server="):
			opt.Server = strings.TrimPrefix(a, "--server=")
		case a == "--json":
			opt.JSON = true
		case strings.HasPrefix(a, "-"):
			return opt, fmt.Errorf("未知参数：%s", a)
		default:
			return opt, fmt.Errorf("多余的参数：%s（目标机只认 --server <清单里的 name>）", a)
		}
	}
	return opt, nil
}

func CmdStatus(args []string) int {
	opt, err := parseStatusArgs(args)
	if errors.Is(err, errStatusHelp) {
		statusUsage()
		return 0
	}
	if err != nil {
		return emitFailure(opt.JSON, FailureStatus("", err.Error()), 2)
	}

	cfg, err := shared.LoadConfig()
	if err != nil {
		return emitFailure(opt.JSON, FailureStatus("", "读取配置失败："+err.Error()), 2)
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		return emitFailure(opt.JSON, FailureStatus("", "读取服务器清单失败："+err.Error()), 2)
	}
	// 选机与只读账号强制在 CollectForServer 里，与 P2+ 网页共用同一条链路。
	st, err := CollectForServer(context.Background(), cfg, list, opt.Server)
	if err != nil {
		return emitFailure(opt.JSON, st, 2)
	}
	code := 0
	if hasDanger(st) {
		code = 1
	}
	if opt.JSON {
		if err := json.NewEncoder(os.Stdout).Encode(st); err != nil {
			fmt.Fprintln(os.Stderr, "ERROR: 输出 JSON 失败："+err.Error())
			return 2
		}
		if code != 0 {
			fmt.Fprintln(os.Stderr, "WARN: 检测到 danger 级问题（退出码 1），详情见快照 problems")
		}
		return code
	}
	printStatus(st, cfg.Path)
	if code != 0 {
		fmt.Fprintln(os.Stderr, "WARN: 检测到 danger 级问题（退出码 1）")
	}
	return code
}

// emitFailure 让配置 / 用法错也回一份字段齐全的快照，而不是一行报错。
// 传入的是 CollectForServer / FailureStatus 已经造好的那份，CLI 与网页口径一致。
func emitFailure(jsonOut bool, s Status, code int) int {
	if jsonOut {
		_ = json.NewEncoder(os.Stdout).Encode(s)
		return code
	}
	fmt.Fprintln(os.Stderr, "ERROR: "+s.Connection.Error)
	fmt.Fprintln(os.Stderr, "（用法 / 配置错误；加 --json 会输出完整快照）")
	statusUsage()
	return code
}

func num(v *float64, unit string) string {
	if v == nil {
		return "—"
	}
	return fmt.Sprintf("%.1f %s", *v, unit)
}

func flag(v bool) string {
	if v {
		return "是"
	}
	return "否"
}

func printStatus(s Status, configPath string) {
	fmt.Println("")
	fmt.Println("========== 备份状态（只读） ==========")
	fmt.Printf("目标机：%s · 远端主机：%s\n", valueOr(s.Host, "—"), valueOr(s.RemoteHost, "—"))
	fmt.Println("")
	fmt.Println("问题清单：")
	if len(s.Problems) == 0 {
		fmt.Println("  无（未发现 danger / warn）")
	}
	for _, p := range s.Problems {
		fmt.Printf("  [%-6s] %s\n", p.Level, p.Text)
	}
	fmt.Println("")
	fmt.Printf("连接    可达：%s · 耗时：%s · 错误：%s\n",
		flag(s.Connection.OK), num(s.Connection.LatencyMS, "ms"), valueOr(s.Connection.Error, "—"))
	fmt.Println("")
	fmt.Printf("PG      已采集：%s · 有成功记录：%s · 上次成功：%s（%s 前）\n",
		flag(s.PG.Collected), flag(s.PG.HasSuccess), valueOr(s.PG.LastSuccessRaw, "—"),
		num(s.PG.LastSuccessAgeHours, "h"))
	fmt.Printf("        最新 dump：%s · 大小 %s · %s 前 · 备份占用 %s\n",
		valueOr(s.PG.LatestPath, "—"), num(s.PG.LatestSizeMB, "MB"),
		num(s.PG.LatestAgeHours, "h"), num(s.PG.TotalMB, "MB"))
	fmt.Println("")
	fmt.Printf("MinIO   已采集：%s · 有成功记录：%s · 上次成功：%s（%s 前）\n",
		flag(s.MinIO.Collected), flag(s.MinIO.HasSuccess), valueOr(s.MinIO.LastSuccessRaw, "—"),
		num(s.MinIO.LastSuccessAgeHours, "h"))
	fmt.Printf("        日志占用 %s · 数据目录占用 %s（未配置恒 —）\n",
		num(s.MinIO.LogSizeMB, "MB"), num(s.MinIO.DataSizeMB, "MB"))
	fmt.Println("")
	fmt.Printf("磁盘    已采集：%s · 总量 %s · 剩余 %s · 已用 %s\n",
		flag(s.Disk.Collected), num(s.Disk.TotalMB, "MB"),
		num(s.Disk.FreeMB, "MB"), num(s.Disk.UsedPct, "%"))
	fmt.Println("")
	fmt.Printf("采集时间：%s · 本机配置：%s\n", s.CheckedAt, configPath)
	fmt.Println("退出码：0 无 danger / 1 有 danger（含连不上）/ 2 用法·配置错")
}

func statusUsage() {
	fmt.Print(`用法:
  ops status --server <name> [--json]
                        只读采集备份状态（PG 心跳 / 最新 dump / MinIO 心跳 / 磁盘）
  ops status --help     查看本说明

--server 只接受 servers.json 里的 name；省略时按 ops.env 的
         PASS_UP_OPS_DEFAULT_SERVER、清单 default、唯一 role=backup 依次退化。
🔴 只读账号强制来自该条目的 monitor：monitor.user / monitor.key 必须齐全、
   monitor.user 不能等于安装账号 user，也不许是 root；
   target 不带 sudo 密码、绝不提权。未配 monitor 会明确报错，不静默复用 user/key。
--json  输出完整快照（数值未采到是 null，problems 恒为数组）；连接失败 /
         配置错也一样返回字段齐全的快照。stdout 只有 JSON，提示走 stderr。

采集只读：远端脚本从 stdin 执行，不写文件、不查 crontab、不调用会写日志 /
推告警的 *_status.sh。时间新鲜度用远端两个 epoch 相减，与本机时钟无关。
退出码：0 无 danger / 1 有 danger（含连不上）/ 2 用法·配置错。
`)
}
