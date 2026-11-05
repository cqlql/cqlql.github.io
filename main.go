package main

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
		return cmdInit, true
	case "servers":
		return cmdServers, true
	case "ui":
		return cmdUI, true
	case "backup":
		return cmdBackup, true
	case "shortcut":
		return cmdShortcut, true
	case "menu":
		return cmdMenu, true
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

func cmdBackup(args []string) int {
	if len(args) == 0 {
		backupUsage()
		return 2
	}
	switch args[0] {
	case "deploy":
		return runBackupDeploy(args[1:])
	case "verify":
		return runBackupVerify(args[1:])
	case "help", "-h", "--help":
		backupUsage()
		return 0
	default:
		fmt.Fprintf(os.Stderr, "未知子命令：backup %s\n\n", args[0])
		backupUsage()
		return 2
	}
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

func backupUsage() {
	fmt.Print(`用法:
  ops backup deploy [pg|minio|all] --server <name> [--dry-run] [--force] [--run-now] [--install-deps]
  ops backup verify [pg|minio|all] --server <name>

目标机只从服务器清单（servers.json）里按 name 选择。

选项:
  --server <name> 目标服务器（省略则用清单的 default / 唯一的 backup）
  --dry-run       只预检并打印将执行的远端命令，不修改远端
  --force         用本机 backup.env 覆盖远端已有配置（旧配置随 .old 目录保留）
  --run-now       安装成功后立即跑一次备份（写操作，可能较长时间）
  --install-deps  自动安装缺失依赖（apt/dnf/yum；mc 从官方地址下载）
`)
}
