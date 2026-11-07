package main

import (
	"fmt"
	"io"
	"os"

	"pass-up/ops/internal/shared"
)

// __config-path 是给 启动运维.cmd 用的内部命令：只输出 Go 侧真正会读的 ops.env 路径。
//
// 以前 cmd 自己拼 `%APPDATA%\pass-up\ops.env`、只认 PASS_UP_OPS_ENV；而 Go 的
// ConfigPath() 还认 PASS_UP_OPS_CONFIG_DIR / XDG_CONFIG_HOME / os.UserConfigDir。
// 一旦验收或单测用覆盖变量换了配置目录，cmd 每次都误判「首次运行」去跑 ops init，
// 失败提示也指着另一个目录里的 ops-ui.log。
//
// 🔴 输出契约：stdout **一行**纯路径，没有提示、没有日志、没有 BOM；
// 启动器用 `for /f` 捕获，多余一行都会把它解析坏。错误信息只走 stderr。
// 同样不进 commandHandler / usage / 菜单，且不做任何写操作。
const configPathCommand = "__config-path"

func cmdConfigPath(w io.Writer) int {
	if _, err := fmt.Fprintln(w, shared.ConfigPath()); err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 输出配置路径失败：", err)
		return 1
	}
	return 0
}
