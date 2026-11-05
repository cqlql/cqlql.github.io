package servers

import (
	"pass-up/ops/internal/shared"
)

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"
)

func CmdServers(args []string) int {
	if len(args) == 0 {
		serversUsage()
		return 2
	}
	switch args[0] {
	case "list":
		return runServersList(args[1:])
	case "check":
		return runServersCheck(args[1:])
	case "apply-sudo":
		return runServersApplySudo(args[1:])
	case "help", "-h", "--help":
		serversUsage()
		return 0
	default:
		fmt.Fprintf(os.Stderr, "未知子命令：servers %s\n\n", args[0])
		serversUsage()
		return 2
	}
}

func serversUsage() {
	fmt.Print(`用法:
  ops servers list [--json]
      清单与最近一次检查结果（未检查过显示 —）
  ops servers check [name|all] [--json]
      只读：SSH 可达 + 能否 sudo -n；退出码 0=已免密/root，1=需要配置，2=连接失败
  ops servers apply-sudo <name> [--password-stdin] [--yes]
      写：落地 /etc/sudoers.d/90-<user>-nopasswd 并以该用户身份验证
      --password-stdin  从 stdin 读初始 sudo 密码（没有 --password 参数）
      --yes             跳过本地二次确认
`)
}

func runServersList(args []string) int {
	jsonOut := false
	for _, a := range args {
		switch a {
		case "--json":
			jsonOut = true
		case "-h", "--help":
			serversUsage()
			return 0
		default:
			fmt.Fprintf(os.Stderr, "ERROR: 未知参数：%s\n", a)
			return 2
		}
	}
	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	states := shared.LoadServerState(list.Path)

	if jsonOut {
		return printJSON(ServerInfos(list, states))
	}
	fmt.Printf("清单：%s\n", list.Path)
	fmt.Printf("%-16s %-7s %-22s %-8s %-9s %-8s %s\n", "NAME", "ROLE", "TARGET", "SUDO", "SSH", "CHECKED", "NOTE")
	for i := range list.Servers {
		s := &list.Servers[i]
		st := states[s.Name]
		checked := "—"
		if st.CheckedAt != "" {
			checked = formatCheckedAt(st.CheckedAt)
		}
		fmt.Printf("%-16s %-7s %-22s %-8s %-9s %-8s %s\n",
			s.Name, s.Role, fmt.Sprintf("%s@%s:%d", s.User, s.Host, s.Port),
			shared.SudoLabel(st), shared.SSHLabel(st), checked, s.Note)
	}
	return 0
}

func formatCheckedAt(v string) string {
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return v
	}
	return t.Format("01-02 15:04")
}

func runServersCheck(args []string) int {
	jsonOut := false
	target := ""
	for _, a := range args {
		switch {
		case a == "--json":
			jsonOut = true
		case a == "-h" || a == "--help":
			serversUsage()
			return 0
		case strings.HasPrefix(a, "-"):
			fmt.Fprintf(os.Stderr, "ERROR: 未知参数：%s\n", a)
			return 2
		case target != "":
			fmt.Fprintf(os.Stderr, "ERROR: 只能指定一个服务器\n")
			return 2
		default:
			target = a
		}
	}

	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}

	var targets []*shared.Server
	if target == "" || target == "all" {
		for i := range list.Servers {
			targets = append(targets, &list.Servers[i])
		}
	} else {
		s, err := list.Get(target)
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
			return 2
		}
		targets = []*shared.Server{s}
	}

	states := shared.LoadServerState(list.Path)
	rows := make([]shared.CheckRow, 0, len(targets))
	worst := 0
	for _, s := range targets {
		ctx, cancel := context.WithTimeout(context.Background(), TimeoutServerCheck)
		st := CheckServer(ctx, s)
		cancel()
		states[s.Name] = st
		rows = append(rows, shared.CheckRow{Name: s.Name, Role: s.Role, ServerStatus: st})
		switch st.Sudo {
		case "error":
			worst = 2
		case "need":
			if worst < 1 {
				worst = 1
			}
		}
	}
	if err := shared.SaveServerState(list.Path, states); err != nil {
		fmt.Fprintf(os.Stderr, "WARN: 保存检查结果失败：%v\n", err)
	}

	if jsonOut {
		return printJSON(rows)
	}
	fmt.Printf("%-16s %-7s %-9s %-10s %s\n", "NAME", "ROLE", "SSH", "SUDO", "DETAIL")
	for _, r := range rows {
		fmt.Printf("%-16s %-7s %-9s %-10s %s\n", r.Name, r.Role, shared.SSHLabel(r.ServerStatus), shared.SudoLabel(r.ServerStatus), r.Detail)
	}
	return worst
}

func runServersApplySudo(args []string) int {
	name := ""
	passwordStdin := false
	yes := false
	for _, a := range args {
		switch {
		case a == "--password-stdin":
			passwordStdin = true
		case a == "--yes":
			yes = true
		case a == "-h" || a == "--help":
			serversUsage()
			return 0
		case strings.HasPrefix(a, "-"):
			fmt.Fprintf(os.Stderr, "ERROR: 未知参数：%s（不存在 --password 参数，用 --password-stdin）\n", a)
			return 2
		case name != "":
			return usageErr("只能指定一个服务器 name")
		default:
			name = a
		}
	}
	if name == "" {
		return usageErr("必须指定服务器 name")
	}

	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	s, err := list.Get(name)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}

	ctx, cancel := context.WithTimeout(context.Background(), TimeoutServerCheck)
	st := CheckServer(ctx, s)
	cancel()
	states := shared.LoadServerState(list.Path)
	states[s.Name] = st
	_ = shared.SaveServerState(list.Path, states)

	if st.SSH == "fail" {
		fmt.Fprintf(os.Stderr, "ERROR: %s\n", st.Detail)
		return 2
	}
	if st.Sudo == "root" || st.Sudo == "ok" {
		fmt.Printf("%s：%s\n", s.Name, st.Detail)
		return 0
	}
	if st.Sudo == "disabled" {
		return usageErr(fmt.Sprintf("%s 的 sudo.mode=none，不配置免密 sudo", s.Name))
	}

	var stdin *bufio.Reader
	password := ""
	if passwordStdin {
		stdin = bufio.NewReader(os.Stdin)
		line, err := stdin.ReadString('\n')
		if err != nil && err != io.EOF {
			fmt.Fprintf(os.Stderr, "ERROR: 读取密码失败：%v\n", err)
			return 1
		}
		password = strings.TrimRight(line, "\r\n")
		if password == "" {
			return usageErr("stdin 没有读到 sudo 密码")
		}
	}
	if choosePassword(s, password) == "" {
		return usageErr("需要初始 sudo 密码：在清单里填 sudo.password，或用 --password-stdin")
	}

	if !yes && !confirmApply(stdin, s) {
		fmt.Fprintln(os.Stderr, "已取消。")
		return 1
	}

	ctx, cancel = context.WithTimeout(context.Background(), TimeoutApplySudo)
	_, err = ApplySudo(ctx, s, password, os.Stdout)
	cancel()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}

	ctx, cancel = context.WithTimeout(context.Background(), TimeoutServerCheck)
	st = CheckServer(ctx, s)
	cancel()
	states = shared.LoadServerState(list.Path)
	states[s.Name] = st
	if err := shared.SaveServerState(list.Path, states); err != nil {
		fmt.Fprintf(os.Stderr, "WARN: 保存检查结果失败：%v\n", err)
	}

	if s.Sudo.Password != "" {
		fmt.Println("提示：清单里的 sudo.password 是长期凭据，配置成功后建议删除。")
	}
	return 0
}

func confirmApply(r *bufio.Reader, s *shared.Server) bool {
	fmt.Fprintf(os.Stderr, "将为 %s@%s:%d 写入 %s\n", s.User, s.Host, s.Port, sudoersDropInPath(s.User))
	fmt.Fprint(os.Stderr, "确认执行？[y/N] ")
	if r == nil {
		fi, err := os.Stdin.Stat()
		if err != nil || fi.Mode()&os.ModeCharDevice == 0 {
			fmt.Fprintln(os.Stderr, "\n非交互环境：请加 --yes")
			return false
		}
		r = bufio.NewReader(os.Stdin)
	}
	line, _ := r.ReadString('\n')
	ans := strings.ToLower(strings.TrimSpace(line))
	return ans == "y" || ans == "yes"
}

func usageErr(msg string) int {
	fmt.Fprintf(os.Stderr, "ERROR: %s\n\n", msg)
	serversUsage()
	return 2
}

func printJSON(v any) int {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 生成 JSON 失败：%v\n", err)
		return 1
	}
	fmt.Printf("%s\n", b)
	return 0
}

func ServerInfos(list *shared.ServerList, states map[string]shared.ServerStatus) []shared.ServerInfo {
	out := make([]shared.ServerInfo, 0, len(list.Servers))
	for i := range list.Servers {
		s := &list.Servers[i]
		out = append(out, s.Info(states[s.Name]))
	}
	return out
}
