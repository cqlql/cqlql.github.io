package main

import (
	"pass-up/ops/internal/backup"
	"pass-up/ops/internal/launcher"
	"pass-up/ops/internal/servers"
	"pass-up/ops/internal/shared"
	"pass-up/ops/internal/ui"
)

import (
	"fmt"
	"os"
)

func main() {
	os.Exit(run(os.Args[1:]))
}

// commandHandler 是动词的唯一注册表：run 用它分发，菜单用它做能力探测，
// 不再有第三份字符串表需要同步（usage 是给人看的说明文本）。
func commandHandler(name string) (func([]string) int, bool) {
	switch name {
	case "init":
		return shared.CmdInit, true
	case "servers":
		return servers.CmdServers, true
	case "ui":
		// 前端产物在根包（webdist.go）嵌入，注入给 ui 包 —— embed 路径不能有 `..`，
		// 而 ui 包拿到的是 fs.FS，测试因此可以塞 fstest.MapFS。
		return func(a []string) int { return ui.CmdUI(a, webDist) }, true
	case "backup":
		return backup.CmdBackup, true
	case "shortcut":
		return launcher.CmdShortcut, true
	case "menu":
		return func(a []string) int {
			probe := func(n string) bool {
				_, ok := commandHandler(n)
				return ok
			}
			return launcher.CmdMenu(a, run, probe)
		}, true
	default:
		return nil, false
	}
}

func run(args []string) int {
	if len(args) == 0 {
		usage()
		return 2
	}
	switch args[0] {
	case "help", "-h", "--help":
		usage()
		return 0
	}
	if h, ok := commandHandler(args[0]); ok {
		return h(args[1:])
	}
	fmt.Fprintf(os.Stderr, "未知命令：%s\n\n", args[0])
	usage()
	return 2
}

func usage() {
	fmt.Print(`Pass-up 本地运维工具

用法:
  ops init                               生成 ops.env / servers.json 模板
  ops servers list [--json]              服务器清单与最近检查结果
  ops servers check [name|all] [--json]  只读检查 SSH 与免密 sudo
  ops servers apply-sudo <name>          一键配置免密 sudo（写操作）
  ops ui [--port 7788]                   本机界面（只监听 127.0.0.1）
  ops shortcut [--name <名字>] [--remove]
                                         创建/删除桌面快捷方式（仅 Windows）
  ops menu                               交互菜单（启动器双击入口）
  ops backup deploy [组件] --server <name> [选项]
                                         安装/升级备份能力（P1）
  ops backup verify [组件] --server <name>
                                         只跑远端 preflight 自检

组件: pg | minio | all（默认 all）

运行 ops servers --help 或 ops backup deploy --help 查看选项。
`)
}
