package ui

import (
	"pass-up/ops/internal/shared"
)

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// 配置目录与 ops.env 都是环境变量驱动的，测试必须自己造一份隔离环境，
// 不能碰真机的 %AppData%\pass-up\ops。
func openFileConfigDir(t *testing.T, withList bool) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	t.Setenv("PASS_UP_OPS_ENV", "")
	if err := os.WriteFile(filepath.Join(dir, "ops.env"), []byte("# 测试配置\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if withList {
		if err := os.WriteFile(filepath.Join(dir, "servers.json"), []byte(`{"servers":[]}`), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func withFakeOpener(t *testing.T, fn func(string) (string, error)) {
	t.Helper()
	old := openInEditor
	openInEditor = fn
	t.Cleanup(func() { openInEditor = old })
}

func decodeAPI(t *testing.T, w *httptest.ResponseRecorder) struct {
	OK   bool `json:"ok"`
	Data struct {
		Editor string `json:"editor"`
		Path   string `json:"path"`
	} `json:"data"`
	Error string `json:"error"`
} {
	t.Helper()
	var resp struct {
		OK   bool `json:"ok"`
		Data struct {
			Editor string `json:"editor"`
			Path   string `json:"path"`
		} `json:"data"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("响应不是 JSON：%q（%v）", w.Body.String(), err)
	}
	return resp
}

func TestOpenServersFileNeedsToken(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/open-servers-file", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("不带 token 的状态码 = %d，想要 401", w.Code)
	}
}

func TestOpenServersFileRejectsForeignOrigin(t *testing.T) {
	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/open-servers-file?token=tok",
		map[string]string{"Origin": "http://evil.example"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("外部 Origin 的状态码 = %d，想要 403", w.Code)
	}
}

func TestOpenServersFileOnlyPost(t *testing.T) {
	// GET 落进 default 404：不能用一个链接就能顺手拉起本机进程。
	w := serve(newState(t, fakeDist(t)), http.MethodGet, "/api/open-servers-file?token=tok", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("GET 的状态码 = %d，想要 404", w.Code)
	}
}

// 最要紧的一条：路径只认服务端解析出来的 servers.json，请求体里塞什么都不看。
func TestOpenServersFileIgnoresClientPath(t *testing.T) {
	dir := openFileConfigDir(t, true)
	want := filepath.Join(dir, "servers.json")

	var gotPath string
	withFakeOpener(t, func(p string) (string, error) {
		gotPath = p
		return "测试编辑器", nil
	})

	req := httptest.NewRequest(http.MethodPost, "/api/open-servers-file?token=tok",
		strings.NewReader(`{"path":"C:\\Windows\\win.ini"}`))
	w := httptest.NewRecorder()
	newState(t, fakeDist(t)).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("状态码 = %d，想要 200；响应 %s", w.Code, w.Body.String())
	}
	if gotPath != want {
		t.Fatalf("编辑器收到的路径 = %q，想要服务端解析的 %q", gotPath, want)
	}
	resp := decodeAPI(t, w)
	if !resp.OK || resp.Data.Editor != "测试编辑器" || resp.Data.Path != want {
		t.Fatalf("响应不对：%+v", resp)
	}
}

// ops.env 还没生成时，「点清单路径打开编辑器」正是补齐配置的入口之一：
// 不能因为配置缺失就 503 —— 路径按与 LoadConfig 相同的默认规则解析，照常打开。
func TestOpenServersFileWithoutConfig(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	t.Setenv("PASS_UP_OPS_ENV", "")
	want := filepath.Join(dir, "servers.json")
	if err := os.WriteFile(want, []byte(`{"servers":[]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	var gotPath string
	withFakeOpener(t, func(p string) (string, error) {
		gotPath = p
		return "测试编辑器", nil
	})

	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/open-servers-file?token=tok", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("配置缺失时不该挡住打开清单，实得 %d：%s", w.Code, w.Body.String())
	}
	if gotPath != want {
		t.Fatalf("编辑器收到的路径 = %q，想要默认路径 %q", gotPath, want)
	}
}

func TestOpenServersFileWithoutList(t *testing.T) {
	dir := openFileConfigDir(t, false)
	withFakeOpener(t, func(string) (string, error) {
		t.Fatal("清单不存在时不该拉起编辑器")
		return "", nil
	})

	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/open-servers-file?token=tok", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("清单缺失的状态码 = %d，想要 404", w.Code)
	}
	// JSON 里的反斜杠是转义过的，比对解码后的 error 而不是原始 body。
	if !strings.Contains(decodeAPI(t, w).Error, filepath.Join(dir, "servers.json")) {
		t.Fatalf("错误信息里没带上路径：%q", w.Body.String())
	}
}

// 编辑器发现逻辑也要有覆盖：优先用户级 Code.exe，且必须走官方 cli.js 入口。
func TestVSCodeCandidatesFindsLocalInstall(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("只在 Windows 上验证 Code.exe 的候选路径")
	}
	local := t.TempDir()
	pf := t.TempDir()
	empty := t.TempDir()
	install := filepath.Join(local, "Programs", "Microsoft VS Code")
	exe := filepath.Join(install, "Code.exe")
	cli := filepath.Join(install, "a717861c07", "resources", "app", "out", "cli.js")
	for _, p := range []string{exe, cli} {
		if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte("fake"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("LOCALAPPDATA", local)
	t.Setenv("ProgramFiles", pf)
	t.Setenv("ProgramFiles(x86)", pf)
	t.Setenv("PATH", empty) // 别让真机 PATH 里的 code.cmd 混进候选

	cmd, ok := vscodeCommand(`C:\config with space\servers.json`)
	if !ok {
		t.Fatal("找到了 Code.exe + cli.js 却说没找到 VSCode")
	}
	wantArgs := []string{exe, cli, "-r", `C:\config with space\servers.json`}
	for i, want := range wantArgs {
		if !strings.EqualFold(cmd.Args[i], want) {
			t.Fatalf("argv[%d] = %q，想要 %q（全部 argv：%q）", i, cmd.Args[i], want, cmd.Args)
		}
	}
	// code.cmd 的关键一步：不加这个环境变量，Code.exe 就当普通 Electron 主程序跑，
	// 进程能起来但文件不会打开（真机踩过）。
	if !strings.Contains(strings.Join(cmd.Env, "\n"), "ELECTRON_RUN_AS_NODE=1") {
		t.Fatalf("子进程环境里缺 ELECTRON_RUN_AS_NODE=1：%q", cmd.Env)
	}
}

// 版本目录缺失时宁可回退默认程序，也不要假装能打开。
func TestVSCodeCommandNeedsCLIEntry(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("只在 Windows 上验证 Code.exe 的候选路径")
	}
	local := t.TempDir()
	empty := t.TempDir()
	exe := filepath.Join(local, "Programs", "Microsoft VS Code", "Code.exe")
	if err := os.MkdirAll(filepath.Dir(exe), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(exe, []byte("fake"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("LOCALAPPDATA", local)
	t.Setenv("ProgramFiles", empty)
	t.Setenv("ProgramFiles(x86)", empty)
	t.Setenv("PATH", empty)

	if _, ok := vscodeCommand(filepath.Join(empty, "servers.json")); ok {
		t.Fatal("只有 Code.exe、没有 cli.js 时不该声称找到了 VSCode CLI")
	}
}

func TestVSCodeCommandMissingWhenNoInstall(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("只在 Windows 上验证 Code.exe 的候选路径")
	}
	empty := t.TempDir()
	t.Setenv("LOCALAPPDATA", empty)
	t.Setenv("ProgramFiles", empty)
	t.Setenv("ProgramFiles(x86)", empty)
	t.Setenv("PATH", empty)

	if _, ok := vscodeCommand(filepath.Join(empty, "servers.json")); ok {
		t.Fatal("没有 VSCode 时应该返回 false，交给调用方回退系统默认程序")
	}
}

func TestOpenFileInEditorFallsBackToSystemDefault(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("只在 Windows 上验证 Code.exe 的候选路径")
	}
	empty := t.TempDir()
	t.Setenv("LOCALAPPDATA", empty)
	t.Setenv("ProgramFiles", empty)
	t.Setenv("ProgramFiles(x86)", empty)
	t.Setenv("PATH", empty)

	// 起一个立刻退出的自身副本，只验证「回退分支确实被调用」，不弹任何窗口。
	used := false
	old := systemFileOpener
	systemFileOpener = func(string) *exec.Cmd {
		used = true
		return exec.Command(os.Args[0], "-test.run=^$")
	}
	t.Cleanup(func() { systemFileOpener = old })

	editor, err := openFileInEditor(filepath.Join(empty, "servers.json"))
	if err != nil || editor != editorSystem {
		t.Fatalf("回退结果 = (%q, %v)，想要 (%q, nil)", editor, err, editorSystem)
	}
	if !used {
		t.Fatal("没走系统默认程序回退")
	}
}

func TestOpenServersFileReportsEditorFailure(t *testing.T) {
	dir := openFileConfigDir(t, true)
	want := filepath.Join(dir, "servers.json")
	withFakeOpener(t, func(string) (string, error) {
		return "", errors.New("VSCode 和系统默认程序都没起来")
	})

	w := serve(newState(t, fakeDist(t)), http.MethodPost, "/api/open-servers-file?token=tok", nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("拉起失败的状态码 = %d，想要 500", w.Code)
	}
	resp := decodeAPI(t, w)
	if resp.OK || !strings.Contains(resp.Error, "VSCode 和系统默认程序都没起来") || !strings.Contains(resp.Error, want) {
		t.Fatalf("失败原因不完整：%q", resp.Error)
	}
}
