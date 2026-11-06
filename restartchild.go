package main

import (
	"pass-up/ops/internal/restart"
)

import (
	"fmt"
	"net"
	"os"
	"strconv"
)

// ---------------------------------------------------------------------------
// 「接手进程」：POST /api/restart 拉起的另一个进程
// ---------------------------------------------------------------------------
//
// 参数形状：__restart <监听地址> <正式 exe> <新二进制或 ->
//
//	<监听地址>  等它空出来，就是「旧进程已经让位」的唯一信号；
//	<正式 exe>  ReplaceBinary 的**目标**（不是「从哪个文件起来」）；
//	<新二进制>  重建产物，接手进程起来之后换到正式 exe 上；"-" 表示没重建。
//
// ⚠️ 最后一项与「从哪个文件起来」是两件事，混填会让 ReplaceBinary 变成
// 「next.exe → next.exe」的空操作：表面成功、正式 exe 永远停在旧版本。
// 端口与令牌不在这里传：端口从地址解析，令牌由 CmdUI 从 ui.json（0600）复用 ——
// 令牌不该出现在命令行里（任务管理器能看到）。
//
// ⚠️ 它的 stdout/stderr 已被 Spawn 重定向到 ops-ui.log。detached 进程没有控制台，
// 启动失败的原因**只**在那个文件里，界面把路径告诉人。

type restartChildArgs struct {
	Addr      string
	TargetExe string
	NewExe    string
	Port      string
}

func parseRestartChildArgs(args []string) (restartChildArgs, error) {
	const n = 3
	if len(args) != n {
		return restartChildArgs{}, fmt.Errorf(
			"__restart 的参数不齐（要 %d 个：监听地址 / 正式 exe / 新二进制或 -），这个子命令只由重启流程调用", n)
	}
	addr, target, newExe := args[0], args[1], args[2]
	if newExe == "-" {
		newExe = ""
	}
	if target == "" {
		return restartChildArgs{}, fmt.Errorf("没给正式 exe 路径，没法确定该把新二进制换到哪")
	}
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return restartChildArgs{}, fmt.Errorf("监听地址 %q 不对：%w", addr, err)
	}
	p, err := strconv.Atoi(port)
	if err != nil || p <= 0 || p > 65535 {
		return restartChildArgs{}, fmt.Errorf("端口 %q 不合法", port)
	}
	return restartChildArgs{Addr: addr, TargetExe: target, NewExe: newExe, Port: port}, nil
}

func runRestartChild(args []string) int {
	parsed, err := parseRestartChildArgs(args)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		return 2
	}

	fmt.Printf("· 接手进程启动：等 %s 让出来…\n", parsed.Addr)
	if err := restart.WaitPortFree(parsed.Addr, restart.PortWaitTimeout); err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 接手失败（服务没有起来）：", err)
		return 1
	}
	fmt.Printf("· %s 已让出来\n", parsed.Addr)

	if parsed.NewExe != "" {
		got := restart.ReplaceBinary(parsed.NewExe, parsed.TargetExe)
		if got.Error != nil {
			// ⚠️ 换不上去**不是致命的**：继续用现有二进制提供服务。
			// 如实记下来让人知道「这次重建白做了」，而不是让整个重启失败 ——
			// 后者的症状是「服务没了」，那比「跑的是旧代码」严重得多。
			fmt.Printf("!! %v\n", got.Error)
			fmt.Println("   仍按现有二进制启动（= 这次重建没有生效）")
		} else {
			fmt.Printf("· 新二进制已就位：%s\n", parsed.TargetExe)
		}
	}

	fmt.Printf("· 以 %s 身份起服务（端口 %s，沿用原访问令牌）\n", restart.TakeoverFlag, parsed.Port)
	return runUI([]string{restart.TakeoverFlag, "--port", parsed.Port})
}
