package servers

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

const (
	TimeoutServerCheck = 60 * time.Second
	TimeoutApplySudo   = 2 * time.Minute
)

// 🔴 只写一个 drop-in；权限必须 0440 root:root，否则 sudo 忽略该片段。
func sudoersDropInPath(user string) string {
	return path.Join("/etc/sudoers.d", "90-"+user+"-nopasswd")
}

func sudoersContent(user string) string {
	return user + " ALL=(ALL) NOPASSWD:ALL\n"
}

// CheckServer 只读：SSH 可达 + 当前账号能否 sudo -n。
// 绝不复用清单里的 sudo.password —— 那会把「有密码」误报成「已免密」。
func CheckServer(ctx context.Context, s *shared.Server) shared.ServerStatus {
	st := shared.ServerStatus{SSH: "unknown", CheckedAt: time.Now().Format(time.RFC3339)}
	t := shared.NewSSHTarget(s)
	t.SudoPassword = ""

	uid, code, err := t.Capture(ctx, "id -u", false)
	if err != nil {
		st.SSH = "fail"
		st.Sudo = "error"
		st.Detail = "SSH 连接失败：" + shared.FirstLine(err.Error())
		return st
	}
	if code != 0 {
		st.SSH = "fail"
		st.Sudo = "error"
		st.Detail = "SSH 登录失败：" + shared.FirstLine(uid)
		return st
	}
	st.SSH = "ok"

	if s.User == "root" || s.Sudo.Mode == shared.SudoModeRoot || strings.TrimSpace(uid) == "0" {
		st.Sudo = "root"
		st.Detail = "root 登录，无需配置免密 sudo"
		return st
	}
	if s.Sudo.Mode == shared.SudoModeNone {
		st.Sudo = "disabled"
		st.Detail = "清单标记 sudo.mode=none，不配置"
		return st
	}

	_, code, err = t.Capture(ctx, "true", true)
	if err != nil {
		st.Sudo = "error"
		st.Detail = "检查 sudo 失败：" + shared.FirstLine(err.Error())
		return st
	}
	if code == 0 {
		st.Sudo = "ok"
		st.Detail = "sudo -n 可用"
	} else {
		st.Sudo = "need"
		st.Detail = "需要密码（sudo: a password is required）"
	}
	return st
}

type applyOutcome struct {
	AlreadyOK  bool
	Changed    bool
	BackupPath string
	Message    string
}

// ApplySudo 为 shared.Server.User 落地免密 sudo；password 走 stdin，不进命令行。
func ApplySudo(ctx context.Context, s *shared.Server, password string, log io.Writer) (*applyOutcome, error) {
	if s.User == "root" || s.Sudo.Mode == shared.SudoModeRoot {
		return &applyOutcome{AlreadyOK: true, Message: "root 登录，无需配置免密 sudo"}, nil
	}
	if s.Sudo.Mode == shared.SudoModeNone {
		return nil, fmt.Errorf("清单把 %s 标记为 sudo.mode=none，不配置免密 sudo", s.Name)
	}
	if password == "" {
		password = s.Sudo.Password
	}
	if password == "" {
		return nil, fmt.Errorf("需要初始 sudo 密码：在清单里填 sudo.password，或用 --password-stdin / 界面一次性输入")
	}

	t := shared.NewSSHTarget(s)
	t.SudoPassword = ""

	uid, code, err := t.Capture(ctx, "id -u", false)
	if err != nil {
		return nil, fmt.Errorf("SSH 连接失败：%w", err)
	}
	if code != 0 {
		return nil, fmt.Errorf("SSH 登录失败：%s", shared.FirstLine(uid))
	}
	if strings.TrimSpace(uid) == "0" {
		return &applyOutcome{AlreadyOK: true, Message: "远端账号已是 root，无需配置"}, nil
	}

	_, code, err = t.Capture(ctx, "true", true)
	if err == nil && code == 0 {
		return &applyOutcome{AlreadyOK: true, Message: "已存在可用的免密 sudo，无需重复配置"}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("检查 sudo 失败：%w", err)
	}

	// 先用初始密码确认 sudo 本身可用，再动文件。
	t.SudoPassword = password
	out, code, err := t.Capture(ctx, "true", true)
	if err != nil {
		return nil, fmt.Errorf("检查 sudo 失败：%w", err)
	}
	if code != 0 {
		return nil, fmt.Errorf("sudo 密码错误或不可用：%s", shared.FirstLine(out))
	}

	dropin := sudoersDropInPath(s.User)
	desired := sudoersContent(s.User)
	existing, _, err := t.Capture(ctx, "if [ -f "+shared.ShQuote(dropin)+" ]; then cat "+shared.ShQuote(dropin)+"; fi", true)
	if err != nil {
		return nil, fmt.Errorf("读取现有 sudoers 片段失败：%w", err)
	}

	oc := &applyOutcome{}
	if strings.TrimSpace(existing) != "" && existing != desired {
		p, err := backupSudoersFragment(s.Name, existing)
		if err != nil {
			return nil, fmt.Errorf("备份原 sudoers 片段失败：%w", err)
		}
		oc.BackupPath = p
		if log != nil {
			fmt.Fprintf(log, "已备份原 sudoers 片段：%s\n", p)
		}
	}

	res, code, err := t.Capture(ctx, scriptCommand(sudoApplyScript(dropin, desired)), true)
	if err != nil {
		return nil, fmt.Errorf("写入 sudoers 片段失败：%w", err)
	}
	if code != 0 {
		return nil, fmt.Errorf("写入 sudoers 片段失败：%s", shared.FirstLine(res))
	}

	// 🔴 不能以 root 身份验证：root 自己 sudo -n 永远成功，等于没验。
	verify, code, err := t.Capture(ctx, "runuser -u "+shared.ShQuote(s.User)+" -- sudo -n true", true)
	if err != nil || code != 0 {
		detail := shared.FirstLine(verify)
		if err != nil {
			detail = err.Error()
		}
		if existing == "" {
			t.Capture(ctx, "rm -f "+shared.ShQuote(dropin), true)
		} else {
			t.Capture(ctx, scriptCommand(sudoRestoreScript(dropin, existing)), true)
		}
		if strings.Contains(detail, "runuser: command not found") {
			return nil, fmt.Errorf("验证失败：远端缺少 runuser，无法以 %s 身份验证（已回滚）", s.User)
		}
		return nil, fmt.Errorf("验证失败（runuser -u %s -- sudo -n true）：%s（已回滚）", s.User, detail)
	}

	oc.Changed = strings.TrimSpace(existing) != strings.TrimSpace(desired)
	oc.Message = "已配置免密 sudo：" + dropin
	if log != nil {
		fmt.Fprintln(log, oc.Message)
	}
	return oc, nil
}

// sudoApplyScript 在 root 下执行：临时文件 → visudo 自检 → install 落位。
func sudoApplyScript(dropin, content string) string {
	return "set -e\n" +
		"tmp=" + shared.ShQuote(dropin+".tmp.$$") + "\n" +
		"trap 'rm -f \"$tmp\"' EXIT\n" +
		"printf '%s' " + shared.ShQuote(content) + " > \"$tmp\"\n" +
		"chmod 0440 \"$tmp\"\n" +
		"visudo -cf \"$tmp\"\n" +
		"install -m 0440 -o root -g root \"$tmp\" " + shared.ShQuote(dropin) + "\n"
}

func sudoRestoreScript(dropin, content string) string {
	return "set -e\n" +
		"tmp=" + shared.ShQuote(dropin+".restore.$$") + "\n" +
		"trap 'rm -f \"$tmp\"' EXIT\n" +
		"printf '%s' " + shared.ShQuote(content) + " > \"$tmp\"\n" +
		"install -m 0440 -o root -g root \"$tmp\" " + shared.ShQuote(dropin) + "\n"
}

// scriptCommand 用 base64 传脚本：stdin 只留给 sudo 密码，不用 ssh -t。
func scriptCommand(script string) string {
	enc := base64.StdEncoding.EncodeToString([]byte(script))
	return "echo " + shared.ShQuote(enc) + " | base64 -d | sh"
}

// backupSudoersFragment 把已有的不同内容拉回本机（600，路径不含私钥）。
func backupSudoersFragment(name, content string) (string, error) {
	dir := filepath.Join(shared.UserConfigDir(), "backups", "sudoers")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	base := filepath.Join(dir, name+"-"+time.Now().Format("20060102-150405"))
	p := base + ".sudoers"
	for i := 2; ; i++ {
		if _, err := os.Stat(p); os.IsNotExist(err) {
			break
		}
		p = fmt.Sprintf("%s-%d.sudoers", base, i)
	}
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		return "", err
	}
	return p, nil
}

// choosePassword：清单里的 sudo.password 优先，其次本次输入。
func choosePassword(s *shared.Server, input string) string {
	if s.Sudo.Password != "" {
		return s.Sudo.Password
	}
	return input
}
