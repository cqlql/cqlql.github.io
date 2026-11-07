package shared

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

// SSHTarget 只封装「本机 ssh CLI」，不实现 SSH 协议：
// 复用 known_hosts / ssh-agent / ssh config，避免再造一套密钥管理。
type SSHTarget struct {
	Host         string
	Port         int
	User         string
	Key          string
	SudoPassword string
	IsRoot       bool // 远端账号已是 root，无需 sudo
}

func NewSSHTarget(s *Server) *SSHTarget {
	port := s.Port
	if port == 0 {
		port = 22
	}
	return &SSHTarget{
		Host:         s.Host,
		Port:         port,
		User:         s.User,
		Key:          s.Key,
		SudoPassword: s.Sudo.Password,
		IsRoot:       s.User == "root" || s.Sudo.Mode == SudoModeRoot,
	}
}

func (t *SSHTarget) sshArgs(remoteCmd string) []string {
	args := []string{
		"-o", "BatchMode=yes",
		"-o", "ConnectTimeout=10",
		"-o", "ServerAliveInterval=5",
		"-o", "StrictHostKeyChecking=accept-new",
		"-T",
		"-p", strconv.Itoa(t.Port),
	}
	if t.Key != "" {
		args = append(args, "-i", t.Key)
	}
	dest := t.Host
	if t.User != "" {
		dest = t.User + "@" + t.Host
	}
	args = append(args, dest, remoteCmd)
	return args
}

// rootWrap 让非 root 账号走免密 sudo；没有免密 sudo 时预检会提前失败。
func (t *SSHTarget) rootWrap(cmd string, root bool) string {
	if !root || t.IsRoot {
		return cmd
	}
	if t.SudoPassword != "" {
		// -p '' 让 sudo 不打印提示；密码从 stdin 读，不出现在命令行与日志。
		return "sudo -S -p '' sh -c " + ShQuote(cmd)
	}
	return "sudo -n sh -c " + ShQuote(cmd)
}

// sudoStdin：有密码时每次提权命令喂一行密码；否则不占用 stdin。
func (t *SSHTarget) sudoStdin(root bool) io.Reader {
	if root && !t.IsRoot && t.SudoPassword != "" {
		return strings.NewReader(t.SudoPassword + "\n")
	}
	return nil
}

// sshExitTransport 是 ssh **自己**失败的退出码（连接被拒 / 被重置 / 认证失败 / 主机不可达），
// 与远端命令的退出码没有关系。
//
// 🔴 必须单独识别：不区分开就会把「连不上」当成「远端命令失败」。
// 2026-11-05 踩过一次——ssh 被重置时 Capture 返回 (报错文本, 255, nil)，
// checkAccess 于是看到「id -u 没输出、sudo -n true 非零」，报出「sudo 不可用」，
// 把排查方向带到了 sudoers 上，实际是网络/sshd 的问题。
const sshExitTransport = 255

// sshCommand 只构造、不执行：所有 ssh 子进程都从这一个出口走，
// 「后台界面不弹黑窗口」的口径才不会漏掉某一条路径。见 HideConsole。
func (t *SSHTarget) sshCommand(ctx context.Context, cmd string, root bool) *exec.Cmd {
	c := exec.CommandContext(ctx, "ssh", t.sshArgs(t.rootWrap(cmd, root))...)
	HideConsole(c)
	return c
}

// Capture 用于只读检查：返回输出与退出码。非零退出码不算 Go 错误，
// **但 255 例外**——那是 ssh 自身失败，不是远端命令的结论。
func (t *SSHTarget) Capture(ctx context.Context, cmd string, root bool) (string, int, error) {
	c := t.sshCommand(ctx, cmd, root)
	c.Stdin = t.sudoStdin(root)
	out, err := c.CombinedOutput()
	code := 0
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			code = ee.ExitCode()
			err = nil
		}
	}
	if err != nil {
		return string(out), -1, err
	}
	if code == sshExitTransport {
		return string(out), code, fmt.Errorf("ssh 连接失败（exit 255）：%s", strings.TrimSpace(string(out)))
	}
	return string(out), code, nil
}

// addr 是「user@host:port」展示串：只用于给人看的错误信息，绝不含私钥路径。
func (t *SSHTarget) addr() string {
	dest := t.Host
	if t.User != "" {
		dest = t.User + "@" + dest
	}
	return fmt.Sprintf("%s:%d", dest, t.Port)
}

// RunScript 把固定脚本从 stdin 喂给远端 `sh -s`，stdout / stderr 分开收。
//
// 🔴 不用 Capture()：CombinedOutput() 会把远端警告混进分节纯文本被误解析
//    （docs/backup-monitor.md §3.1）。采集不提权，stdin 全程只给脚本。
// 🔴 错误里只说 user@host:port，不回显远端 stderr —— ssh 的
//    「Identity file ... not accessible」会带出私钥路径（硬约束 8）。
func (t *SSHTarget) RunScript(ctx context.Context, script string) (string, error) {
	c := exec.CommandContext(ctx, "ssh", t.sshArgs("sh -s")...)
	HideConsole(c)
	c.Stdin = strings.NewReader(script)
	var stdout, stderr bytes.Buffer
	c.Stdout = &stdout
	c.Stderr = &stderr
	err := c.Run()
	if err == nil {
		return stdout.String(), nil
	}
	var ee *exec.ExitError
	if errors.As(err, &ee) {
		code := ee.ExitCode()
		if code == sshExitTransport {
			return stdout.String(), fmt.Errorf(
				"ssh 连接失败（exit 255）：无法连到 %s（认证 / 网络 / 主机密钥变化）", t.addr())
		}
		return stdout.String(), fmt.Errorf("远端只读脚本失败（exit %d，%s）", code, t.addr())
	}
	return stdout.String(), fmt.Errorf("本机 ssh 执行失败（检查是否安装 OpenSSH Client）：%v", err)
}

// Stream 用于安装 / 自检 / 首跑：输出直接给人看，stdin 可接 tar 流。
func (t *SSHTarget) Stream(ctx context.Context, cmd string, root bool, stdin io.Reader) (int, error) {
	c := t.sshCommand(ctx, cmd, root)
	if p := t.sudoStdin(root); p != nil {
		c.Stdin = p
	} else {
		c.Stdin = stdin
	}
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	err := c.Run()
	if err == nil {
		return 0, nil
	}
	var ee *exec.ExitError
	if errors.As(err, &ee) {
		return ee.ExitCode(), nil
	}
	return -1, err
}

// StreamTo 把远端命令的 **stdout** 写进 dst，stderr 仍直接给人看。
// 只给「源机 docker save 的 tar 流经本机中转」用：本机不落盘，读到哪写到哪。
// root=true 且带一次性密码时 stdin 归 sudo，stdout 仍是纯数据流，两者不打架。
func (t *SSHTarget) StreamTo(ctx context.Context, cmd string, root bool, dst io.Writer) (int, error) {
	c := t.sshCommand(ctx, cmd, root)
	c.Stdin = t.sudoStdin(root)
	c.Stdout = dst
	c.Stderr = os.Stderr
	err := c.Run()
	if err == nil {
		return 0, nil
	}
	var ee *exec.ExitError
	if errors.As(err, &ee) {
		code := ee.ExitCode()
		if code == sshExitTransport {
			return code, errors.New("ssh 连接失败（exit 255）：源机命令没能执行")
		}
		return code, nil
	}
	return -1, err
}

func ShQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

func mustCapture(ctx context.Context, t *SSHTarget, cmd string, root bool) (string, error) {
	out, code, err := t.Capture(ctx, cmd, root)
	if err != nil {
		return "", fmt.Errorf("ssh 执行失败：%w", err)
	}
	if code != 0 {
		return "", fmt.Errorf("ssh 命令失败（exit %d）：%s", code, strings.TrimSpace(out))
	}
	return out, nil
}
