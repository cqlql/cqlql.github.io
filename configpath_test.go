package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"pass-up/ops/internal/shared"
)

// __config-path 的输出契约：stdout 恰好一行纯路径，等于 Go 真正会读的 ConfigPath()。
// 启动器用 `for /f` 捕获，多一行提示、少一个路径都会让它把配置目录判错。
func TestCmdConfigPath(t *testing.T) {
	var buf bytes.Buffer
	if code := cmdConfigPath(&buf); code != 0 {
		t.Fatalf("cmdConfigPath 返回 %d", code)
	}
	if strings.Count(buf.String(), "\n") != 1 {
		t.Errorf("输出必须只有一行：%q", buf.String())
	}
	if got := strings.TrimSpace(buf.String()); got != shared.ConfigPath() {
		t.Errorf("输出 %q，想要 %q", got, shared.ConfigPath())
	}
}

// 路径规则只在 shared.ConfigPath() 一处：三个覆盖变量都必须在 __config-path 里生效。
// （Windows 上 os.UserConfigDir 优先于 XDG_CONFIG_HOME，所以这里只测前两个。）
func TestConfigPathEnvOverrides(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PASS_UP_OPS_ENV", "")
	t.Setenv("PASS_UP_OPS_CONFIG_DIR", "")
	if base := shared.ConfigPath(); base == "" {
		t.Fatal("默认 ops.env 路径不该为空")
	}

	t.Setenv("PASS_UP_OPS_CONFIG_DIR", dir)
	if got, want := shared.ConfigPath(), filepath.Join(dir, "ops.env"); got != want {
		t.Errorf("PASS_UP_OPS_CONFIG_DIR 覆盖后 = %q，想要 %q", got, want)
	}

	explicit := filepath.Join(dir, "custom.env")
	t.Setenv("PASS_UP_OPS_ENV", explicit) // 显式路径优先级最高
	if got := shared.ConfigPath(); got != explicit {
		t.Errorf("PASS_UP_OPS_ENV 覆盖后 = %q，想要 %q", got, explicit)
	}
}

func TestConfigPathCommandIsInternal(t *testing.T) {
	if _, ok := commandHandler(configPathCommand); ok {
		t.Errorf("%s 不该进 commandHandler（会出现在菜单能力探测里）", configPathCommand)
	}
}

// 启动器不许再自己拼 %APPDATA% 路径：这是 2026-11-07 诊断抓到的漂移，
// 用了 PASS_UP_OPS_CONFIG_DIR 之后 cmd 每次都误判「首次运行」。
// 顺带锁住 .cmd 必须 CRLF（.gitattributes 的 eol=crlf，cmd.exe 对 LF 的
// goto/label 解析不可靠，且这种坏法只会在真机双击时暴露）。
func TestLauncherAsksExeForConfigPath(t *testing.T) {
	const rel = "启动运维.cmd"
	b, err := os.ReadFile(rel)
	if err != nil {
		t.Fatal(err)
	}
	if n := bytes.Count(b, []byte("\n")) - bytes.Count(b, []byte("\r\n")); n != 0 {
		t.Errorf("%s 有 %d 个裸 LF 行尾；.cmd 必须全部 CRLF", rel, n)
	}
	text := strings.ReplaceAll(string(b), "\r\n", "\n")

	for _, want := range []string{
		configPathCommand,
		"call :resolve_paths",
		":resolve_paths",
		":config_path_failed",
		"%OPS_DIR%ops-ui.log",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("%s 缺少 %q", rel, want)
		}
	}
	for _, forbidden := range []string{
		`set "OPS_ENV=%APPDATA%`,
		`if defined PASS_UP_OPS_ENV set "OPS_ENV=`,
		`%APPDATA%\pass-up`, // 连失败提示也不许再猜一份默认目录
	} {
		if strings.Contains(text, forbidden) {
			t.Errorf("%s 又出现了手拼路径 %q；必须问 %s", rel, forbidden, configPathCommand)
		}
	}
	// 常规路径与隐藏守护路径都要先解析路径，缺一个就会拿到空 OPS_ENV。
	if n := strings.Count(text, "call :resolve_paths"); n != 2 {
		t.Errorf("%s 应有 2 处 call :resolve_paths（:env_check 与 --bg 分支），实际 %d", rel, n)
	}
}
