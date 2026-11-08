package main

import (
	"pass-up/ops/internal/backup"
	"pass-up/ops/internal/component"
	"pass-up/ops/internal/launcher"
	"pass-up/ops/internal/monitor"
	"pass-up/ops/internal/restart"
	"pass-up/ops/internal/restore"
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
	case "status":
		// P2a 只读备份监控：脚本在 Go 常量里生成，经 ssh stdin 执行。
		return monitor.CmdStatus, true
	case "restore":
		// 备份恢复：只读候选 / 预演 + 显式执行；写动作仍要过界面二次确认或 CLI 门禁。
		return restore.CmdRestore, true
	case "ui":
		return runUI, true
	case "backup":
		// 备份脚本（deploy/backup）在根包（backupdist.go）嵌入，注入给 backup 包 ——
		// 与 ui 收 fs.FS 同理：embed 路径不能有 `..`，internal/backup 自己嵌不了。
		return func(a []string) int {
			return backup.CmdBackup(a, backupScripts)
		}, true
	case "component":
		// 环境组件脚本（deploy/component）同样在根包嵌入、由这里注入。
		// 组件注册表在 internal/component，新增组件只改注册表 + 脚本目录。
		return func(a []string) int {
			return component.CmdComponent(a, componentScripts)
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

// runUI 是 `ops ui` 与「重启接手进程」共用的**唯一**入口。
// 三样东西从根包注入，ui 自己一个都不 import（依赖方向见 AGENTS.md）：
//   - webDist：前端产物（embed 路径不能有 `..`，ui 收 fs.FS 便于测试塞 MapFS）；
//   - 快捷方式实现：真正代码在 launcher（它要用 ui.IconBytes），反向引用会成环；
//   - 备份部署执行器：ui 不能 import backup，函数值由这里递进去。
//     同一个执行器也跑 `component ...` 子命令（见 backuprun.go），
//     因此环境组件与备份部署共用界面里唯一一个后台任务锁。
func runUI(a []string) int {
	return ui.CmdUI(a, webDist,
		func() (shared.ShortcutInfo, error) {
			return launcher.CreateShortcutOnDesktop(launcher.DefaultShortcutName)
		},
		runBackupSubprocess,
	)
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
	// 接手进程：等旧进程把监听地址让出来 → 把新二进制换上去 → 同端口同 token 起服务。
	// ⚠️ 刻意**不进** commandHandler：它不该出现在 usage / 菜单的能力探测里，
	// 也不该被人手工敲。参数传错只能退出（它必须以服务身份起来，否则没人绑端口）。
	if args[0] == restart.Subcommand {
		return runRestartChild(args[1:])
	}
	// 启动器自检：这个二进制里到底有没有嵌进前端页面（换电脑 / 全新 clone 时为空）。
	// 同样是内部命令，只回退出码，不做任何写操作。
	if args[0] == distCheckCommand {
		return cmdDistCheck()
	}
	// 启动器用：问 Go 要 ops.env 的真实路径，别在 .cmd 里再拼一份 %APPDATA% 路径。
	// 同样是内部命令，只输出一行路径、不写文件。
	if args[0] == configPathCommand {
		return cmdConfigPath(os.Stdout)
	}
	// 开发期生成器：从 env-schema.json 重建模板 / 脚本默认值 / 文档键表。
	// 同样是内部命令，不进 usage / 菜单；只在仓库根由人显式执行。
	if args[0] == genBackupEnvCommand {
		return cmdGenBackupEnv()
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
  ops status --server <name> [--json]    只读查看备份状态（心跳 / dump / 磁盘 + 问题清单）
  ops restore list|plan|run --server <备份机> --component pg|minio [选项]
                                         备份恢复：只读候选 / 预演 / 显式执行（会覆盖生产端，必须有人值守）
  ops ui [--port 7788] [--no-open]       本机界面（只监听 127.0.0.1；端口被占自动递增）
                                         服务器清单 / 检查只读；写操作需显式二次确认
  ops shortcut [--name <名字>] [--remove]
                                         创建/删除桌面快捷方式（仅 Windows）
  ops menu                               交互菜单（启动器双击入口）
  ops backup deploy [组件] --server <name> [选项]
                                         安装/升级备份能力（脚本随二进制分发）
  ops backup verify [组件] --server <name>
                                         只跑远端 preflight 自检
  ops backup env [组件]                  生成本机备份配置模板（backup/*.env）
  ops component list --server <name> [--json]
                                         只读查看环境组件状态（--json 给界面）
  ops component install docker|minio --server <name> [--proxy <http://host:port>] [--dry-run]
                                         安装 Docker 引擎 / 拉起 MinIO 服务（代理仅 docker 生效）
  ops component image-load minio --server <name> --image-tar <本机 .tar> [--dry-run]
                                         导入 MinIO 离线镜像（写操作；不 docker pull）

组件: pg | minio | all（默认 all）
环境组件: docker | minio（minio 依赖 docker；镜像走离线 tar，凭证走 backup/minio.env）

运行 ops servers --help / ops status --help / ops restore help /
ops backup deploy --help / ops component help 查看选项。
ops status 的退出码：0 无 danger / 1 有 danger / 2 配置错。
`)
}
