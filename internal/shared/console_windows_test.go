//go:build windows

package shared

import (
	"context"
	"os/exec"
	"strings"
	"testing"
)

// 后台界面（隐藏守护 / detached 接手进程）没有控制台；不隐藏的话，
// 每起一个 ssh.exe 就弹一个可见黑窗口。这里只检查 flag，不真连 SSH。
func TestHideConsoleFlags(t *testing.T) {
	cmd := exec.Command("ssh", "-V")
	HideConsole(cmd)
	if cmd.SysProcAttr == nil {
		t.Fatal("SysProcAttr 没设置，子进程仍会弹控制台窗口")
	}
	if !cmd.SysProcAttr.HideWindow || cmd.SysProcAttr.CreationFlags != createNoWindow {
		t.Errorf("隐藏窗口的 flag 不对：%+v", cmd.SysProcAttr)
	}
}

func TestSSHCommandHidesConsole(t *testing.T) {
	tgt := &SSHTarget{Host: "127.0.0.1", Port: 1, User: "u"}
	c := tgt.sshCommand(context.Background(), "id -u", false)
	if c.SysProcAttr == nil || !c.SysProcAttr.HideWindow ||
		c.SysProcAttr.CreationFlags != createNoWindow {
		t.Errorf("检查用的 ssh 子进程没有隐藏窗口：%+v", c.SysProcAttr)
	}
	// 隐藏窗口不能顺手改掉命令行：ssh 参数、BatchMode 与远端命令都在。
	joined := ""
	for _, a := range c.Args {
		joined += a + " "
	}
	for _, want := range []string{"ssh", "BatchMode=yes", "id -u", "u@127.0.0.1"} {
		if !strings.Contains(joined, want) {
			t.Errorf("ssh 命令里少了 %q：%s", want, joined)
		}
	}
}
