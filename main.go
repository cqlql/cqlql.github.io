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
		// 三样东西从根包注入，ui 自己一个都不 import（依赖方向见 AGENTS.md）：
		//   - webDist：前端产物（embed 路径不能有 `..`，ui 收 fs.FS 便于测试塞 MapFS）；
		//   - 快捷方式实现：真正代码在 launcher（它要用 ui.IconBytes），反向引用会成环；
		//   - 备份部署执行器：ui 不能 import backup，函数值由这里递进去。
		return func(a []string) int {
			return ui.CmdUI(a, webDist,
				func() (shared.ShortcutInfo, error) {
					return launcher.CreateShortcutOnDesktop(launcher.DefaultShortcutName)
				},
				runBackupSubprocess,
			)
		}, true
	case "backup":
		// 备份脚本（deploy/backup）在根包（backupdist.go）嵌入，注入给 backup 包 ——
		// 与 ui 收 fs.FS 同理：embed 路径不能有 `..`，internal/backup 自己嵌不了。
		return func(a []string) int {
			return backup.CmdBackup(a, backupScripts)
		}, true
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
	fmt.Print(`PassUp 本地运维工具

用法:
  ops init                               生成 ops.env / servers.json 模板
  ops servers list [--json]              服务器清单与最近检查结果
  ops servers check [name|all] [--json]  只读检查 SSH 与免密 sudo
  ops servers apply-sudo <name>          一键配置免密 sudo（写操作）
  ops ui [--port 7788] [--no-open]       本机界面（只监听 127.0.0.1；端口被占自动递增）
                                         服务器清单 / 检查只读；备份部署需显式二次确认
  ops shortcut [--name <名字>] [--remove]
                                         创建/删除桌面快捷方式（仅 Windows）
  ops menu                               交互菜单（启动器双击入口）
  ops backup deploy [组件] --server <name> [选项]
                                         安装/升级备份能力（脚本随二进制分发）
  ops backup verify [组件] --server <name>
                                         只跑远端 preflight 自检
  ops backup env [组件]                  生成本机备份配置模板（backup/*.env）

组件: pg | minio | all（默认 all）

运行 ops servers --help 或 ops backup deploy --help 查看选项。
`)
}
