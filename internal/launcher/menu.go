package launcher

import (
	"pass-up/ops/internal/shared"
)

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// 交互菜单是启动器无参数时的入口。菜单逻辑放 Go 里（不塞进 .cmd）：
// 可单测，能力探测不用去 parse usage 文本，动词表也不必维护第三份。
//
// 🔴 双击绝不触发写操作：默认选中项是只读预检，安装必须「预检成功 + 输入 yes」。
type menu struct {
	in     *bufio.Reader
	out    io.Writer
	exec   func([]string) int
	pause  bool
	choose func() (string, bool) // 单测注入，避免为了测菜单去连真 SSH
}

func (m *menu) targetServer() (string, bool) {
	if m.choose != nil {
		return m.choose()
	}
	return m.chooseServer()
}

type menuAction struct {
	Key   string
	label string
}

// menuItems 只列已实现的动词。ui / status 靠 probe 条件注册：能力已实现就多一项，
// 未注册时菜单、.lnk、.cmd 的形状都不用改。
func menuItems(probe func(string) bool) []menuAction {
	items := []menuAction{
		{"1", "查看 / 生成配置模板（ops init）"},
		{"2", "备份部署预检（只读，--dry-run）"},
		{"3", "安装 / 升级备份能力（写，需二次确认）"},
		{"4", "远端自检（backup verify）"},
		{"5", "帮助（ops help）"},
	}
	if probe("ui") {
		items = append(items, menuAction{"6", "打开网页面板（ops ui，Ctrl+C 结束）"})
	}
	if probe("status") {
		items = append(items, menuAction{"7", "查看备份状态（ops status，只读）"})
	}
	return items
}

// menuChoice：空输入停在第 2 项（只读预检），绝不落到写操作上。
func menuChoice(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return "2"
	}
	switch s {
	case "q", "quit", "exit":
		return "0"
	}
	return s
}

func CmdMenu(args []string, exec func([]string) int, probe func(string) bool) int {
	for _, a := range args {
		if a == "-h" || a == "--help" {
			fmt.Print(`用法:
  ops menu

交互菜单：只列已实现的动词，双击启动器时打开。
带参数调用启动器时跳过菜单，参数原样交给 ops.exe。
`)
			return 0
		}
		fmt.Fprintf(os.Stderr, "ERROR: 未知参数：%s\n", a)
		return 2
	}

	release, ok := acquireMenuSingleton()
	if !ok {
		fmt.Println("运维菜单已经在运行了：请切回那个窗口，不要开第二个。")
		return 0
	}
	defer release()
	if fi, err := os.Stdin.Stat(); err != nil || fi.Mode()&os.ModeCharDevice == 0 {
		fmt.Fprintln(os.Stderr, "菜单需要交互终端；脚本化使用请直接运行 ops <命令>。")
		return 2
	}
	return runMenu(&menu{in: bufio.NewReader(os.Stdin), out: os.Stdout, exec: exec, pause: true}, probe)
}

func runMenu(m *menu, probe func(string) bool) int {
	for {
		fmt.Fprintln(m.out, "\nPassUp 本地运维菜单（双击不会触发写操作）")
		for _, item := range menuItems(probe) {
			fmt.Fprintf(m.out, "  %s. %s\n", item.Key, item.label)
		}
		fmt.Fprintln(m.out, "  0. 退出")
		fmt.Fprint(m.out, "请选择 [2]：")
		line, err := m.in.ReadString('\n')
		if err != nil && !errors.Is(err, io.EOF) {
			return 2
		}
		choice := menuChoice(line)
		if choice == "0" {
			fmt.Fprintln(m.out, "已退出。")
			return 0
		}
		if !menuKeyExists(choice, probe) {
			fmt.Fprintf(m.out, "没有这个选项：%s\n", choice)
			continue
		}

		rc := m.runAction(choice)
		if rc != 0 {
			fmt.Fprintf(m.out, "命令退出码：%d\n", rc)
		}
		if m.pause {
			fmt.Fprint(m.out, "按回车返回菜单...")
			_, _ = m.in.ReadString('\n')
		}
		if errors.Is(err, io.EOF) {
			return 0
		}
	}
}

func menuKeyExists(key string, probe func(string) bool) bool {
	for _, item := range menuItems(probe) {
		if item.Key == key {
			return true
		}
	}
	return false
}

// runAction 把动作交回 run()，退出码不被吞掉；写操作单独走二次确认。
func (m *menu) runAction(key string) int {
	switch key {
	case "1":
		return m.exec([]string{"init"})
	case "5":
		return m.exec([]string{"help"})
	case "6":
		return m.exec([]string{"ui"})
	}

	// 2/3/4/7 都要选目标机：只接受清单里的 name，回车用默认。
	name, ok := m.targetServer()
	if !ok {
		return 1
	}
	serverArgs := []string{}
	if name != "" {
		serverArgs = append(serverArgs, "--server", name)
	}
	precheck := append([]string{"backup", "deploy", "--dry-run"}, serverArgs...)

	switch key {
	case "2":
		return m.exec(precheck)
	case "7":
		return m.exec(append([]string{"status"}, serverArgs...))
	case "4":
		return m.exec(append([]string{"backup", "verify"}, serverArgs...))
	case "3":
		fmt.Fprintln(m.out, "先跑只读预检，成功后再问一次：")
		if rc := m.exec(precheck); rc != 0 {
			fmt.Fprintln(m.out, "预检没过，不执行安装。")
			return rc
		}
		if !m.confirmWrite() {
			fmt.Fprintln(m.out, "已取消，远端没有被修改。")
			return 0
		}
		return m.exec(append([]string{"backup", "deploy"}, serverArgs...))
	}
	return 2
}

// chooseServer 只回清单里存在的 name；空字符串表示省略 --server，由底层 Resolve。
func (m *menu) chooseServer() (string, bool) {
	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintf(m.out, "读取配置失败：%v\n", err)
		return "", false
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(m.out, "读取服务器清单失败：%v\n", err)
		return "", false
	}
	fmt.Fprint(m.out, "可用服务器：")
	for i := range list.Servers {
		fmt.Fprintf(m.out, " %s", list.Servers[i].Name)
	}
	fmt.Fprint(m.out, "\n目标服务器 name（回车用默认）：")
	line, err := m.in.ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", false
	}
	name := strings.TrimSpace(line)
	if name == "" {
		return "", true
	}
	if _, err := list.Get(name); err != nil {
		fmt.Fprintf(m.out, "%v\n", err)
		return "", false
	}
	return name, true
}

func (m *menu) confirmWrite() bool {
	fmt.Fprint(m.out, "这是写操作（会改远端 crontab / 目录）；确认请输入 yes：")
	line, _ := m.in.ReadString('\n')
	return strings.TrimSpace(line) == "yes"
}
