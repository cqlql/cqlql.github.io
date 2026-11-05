package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

// sshTarget 只封装「本机 ssh CLI」，不实现 SSH 协议：
// 复用 known_hosts / ssh-agent / ssh config，避免再造一套密钥管理。
type sshTarget struct {
	host         string
	port         int
	user         string
	key          string
	sudoPassword string
	isRoot       bool // 远端账号已是 root，无需 sudo
}

func newSSHTarget(s *server) *sshTarget {
	port := s.Port
	if port == 0 {
		port = 22
	}
	return &sshTarget{
		host:         s.Host,
		port:         port,
		user:         s.User,
		key:          s.Key,
		sudoPassword: s.Sudo.Password,
		isRoot:       s.User == "root" || s.Sudo.Mode == sudoModeRoot,
	}
}

func (t *sshTarget) sshArgs(remoteCmd string) []string {
	args := []string{
		"-o", "BatchMode=yes",
		"-o", "ConnectTimeout=10",
		"-o", "ServerAliveInterval=5",
		"-o", "StrictHostKeyChecking=accept-new",
		"-T",
		"-p", strconv.Itoa(t.port),
	}
	if t.key != "" {
		args = append(args, "-i", t.key)
	}
	dest := t.host
	if t.user != "" {
		dest = t.user + "@" + t.host
	}
	args = append(args, dest, remoteCmd)
	return args
}

// rootWrap 让非 root 账号走免密 sudo；没有免密 sudo 时预检会提前失败。
func (t *sshTarget) rootWrap(cmd string, root bool) string {
	if !root || t.isRoot {
		return cmd
	}
	if t.sudoPassword != "" {
		// -p '' 让 sudo 不打印提示；密码从 stdin 读，不出现在命令行与日志。
		return "sudo -S -p '' sh -c " + shQuote(cmd)
	}
	return "sudo -n sh -c " + shQuote(cmd)
}

// sudoStdin：有密码时每次提权命令喂一行密码；否则不占用 stdin。
func (t *sshTarget) sudoStdin(root bool) io.Reader {
	if root && !t.isRoot && t.sudoPassword != "" {
		return strings.NewReader(t.sudoPassword + "\n")
	}
	return nil
}

// capture 用于只读检查：返回输出与退出码。非零退出码不算 Go 错误。
func (t *sshTarget) capture(ctx context.Context, cmd string, root bool) (string, int, error) {
	c := exec.CommandContext(ctx, "ssh", t.sshArgs(t.rootWrap(cmd, root))...)
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
	return string(out), code, err
}

// stream 用于安装 / 自检 / 首跑：输出直接给人看，stdin 可接 tar 流。
func (t *sshTarget) stream(ctx context.Context, cmd string, root bool, stdin io.Reader) (int, error) {
	c := exec.CommandContext(ctx, "ssh", t.sshArgs(t.rootWrap(cmd, root))...)
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

func shQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

func mustCapture(ctx context.Context, t *sshTarget, cmd string, root bool) (string, error) {
	out, code, err := t.capture(ctx, cmd, root)
	if err != nil {
		return "", fmt.Errorf("ssh 执行失败：%w", err)
	}
	if code != 0 {
		return "", fmt.Errorf("ssh 命令失败（exit %d）：%s", code, strings.TrimSpace(out))
	}
	return out, nil
}
