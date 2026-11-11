package ui

import (
	"pass-up/ops/internal/shared"
)

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

type spawnCall struct {
	launcher string
	args     []string
	logPath  string
}

type sideEffects struct {
	opened  []string
	spawned []spawnCall
}

// stubSideEffects 换掉两个「真的会动系统」的出口：单测不弹浏览器、
// 也不 spawn 隐藏 cmd，只记录调用。t.Cleanup 保证用例之间不串味。
func stubSideEffects(t *testing.T) *sideEffects {
	t.Helper()
	s := &sideEffects{}
	oldOpen, oldSpawn, oldWait := openBrowser, spawnGuard, waitReady
	openBrowser = func(u string) { s.opened = append(s.opened, u) }
	spawnGuard = func(l string, a []string, lp string) error {
		s.spawned = append(s.spawned, spawnCall{l, a, lp})
		return nil
	}
	// 假的 spawn 不会真的写 ui.json，不换掉等待的话每个用例都要干等 6 秒。
	waitReady = func(string, time.Time, time.Duration) error { return nil }
	t.Cleanup(func() { openBrowser, spawnGuard, waitReady = oldOpen, oldSpawn, oldWait })
	return s
}

// stubSingleton 让用例自己决定「有没有另一个界面在跑」，跨平台可跑
// （非 Windows 的 shared.AcquireSingleton 永远返回 true）。
func stubSingleton(t *testing.T, ok bool) {
	t.Helper()
	old := acquireSingleton
	acquireSingleton = func(string) (func(), bool) { return func() {}, ok }
	t.Cleanup(func() { acquireSingleton = old })
}

func TestBackgroundUIRejectsBadArgs(t *testing.T) {
	if rc := backgroundUI(nil); rc == 0 {
		t.Error("--background 没有 --launcher 应该被拒")
	}
	if rc := backgroundUI([]string{"--launcher"}); rc == 0 {
		t.Error("--launcher 缺路径应该被拒")
	}
}

func TestCmdUIRoutesBackgroundBeforeFlagParsing(t *testing.T) {
	t.Setenv(shared.ConfigDirEnv, t.TempDir())
	s := stubSideEffects(t)
	stubSingleton(t, true)
	launcher := `D:\_work\pass-up\pass-up.ops\启动运维.cmd`
	if rc := CmdUI([]string{"--background", "--launcher", launcher}, fstest.MapFS{}, nil, nil, nil); rc != 0 {
		t.Fatalf("CmdUI --background = %d，想要 0", rc)
	}
	if len(s.spawned) != 1 {
		t.Fatalf("应该 spawn 一个隐藏守护，实得 %d 次", len(s.spawned))
	}
}

func TestBackgroundUIStartsHiddenGuard(t *testing.T) {
	t.Setenv(shared.ConfigDirEnv, t.TempDir())
	s := stubSideEffects(t)
	stubSingleton(t, true)
	launcher := `D:\_work\pass-up\pass-up.ops\启动运维.cmd`

	if rc := backgroundUI([]string{"--launcher", launcher, "--no-open"}); rc != 0 {
		t.Fatalf("backgroundUI = %d，想要 0", rc)
	}
	if len(s.spawned) != 1 {
		t.Fatalf("应该 spawn 一个隐藏守护，实得 %d 次", len(s.spawned))
	}
	call := s.spawned[0]
	if call.launcher != launcher {
		t.Errorf("守护拿到的启动器 = %q", call.launcher)
	}
	if strings.Join(call.args, " ") != "--no-open" {
		t.Errorf("透传给 ops ui 的参数 = %v，想要 [--no-open]", call.args)
	}
	if filepath.Base(call.logPath) != uiLogName {
		t.Errorf("后台日志路径 = %q，想要 %s", call.logPath, uiLogName)
	}
	if len(s.opened) != 0 {
		t.Error("父进程不该开浏览器：那是守护里的 ops ui 开的")
	}
}

func TestBackgroundUIReusesRunningInstance(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	s := stubSideEffects(t)
	stubSingleton(t, false)
	if err := writeUIInfo(dir, uiInfo{Port: 7790, Token: "abc123"}); err != nil {
		t.Fatal(err)
	}

	if rc := backgroundUI([]string{"--launcher", "launcher.cmd"}); rc != 0 {
		t.Fatalf("backgroundUI = %d，想要 0", rc)
	}
	if len(s.spawned) != 0 {
		t.Error("已有实例时又起了一个守护（会变成两个服务抢端口）")
	}
	if len(s.opened) != 1 || s.opened[0] != "http://127.0.0.1:7790/?token=abc123" {
		t.Fatalf("应该把浏览器指到已有实例，实得 %v", s.opened)
	}
}

func TestBackgroundUIMissingInfoIsAnError(t *testing.T) {
	t.Setenv(shared.ConfigDirEnv, t.TempDir())
	s := stubSideEffects(t)
	stubSingleton(t, false) // 有实例，但 ui.json 丢了 / 写坏了

	if rc := backgroundUI([]string{"--launcher", "launcher.cmd"}); rc == 0 {
		t.Error("读不到已有实例的端口/token 时不能装作成功")
	}
	if len(s.spawned) != 0 || len(s.opened) != 0 {
		t.Errorf("不该起守护也不该开浏览器：spawn=%v open=%v", s.spawned, s.opened)
	}
}

func TestUIInfoRoundTrip(t *testing.T) {
	dir := t.TempDir()
	if _, err := readUIInfo(dir); err == nil {
		t.Error("ui.json 不存在时应该报错")
	}
	if err := writeUIInfo(dir, uiInfo{Port: 7788, Token: "tok"}); err != nil {
		t.Fatal(err)
	}
	info, err := readUIInfo(dir)
	if err != nil {
		t.Fatal(err)
	}
	if info.Port != 7788 || info.Token != "tok" {
		t.Fatalf("读回的 uiInfo = %+v", info)
	}
	// 残缺内容不能当成「已有实例」：否则会把浏览器指到一个连不上的地址。
	if err := os.WriteFile(uiInfoPath(dir), []byte(`{"port":7788}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := readUIInfo(dir); err == nil {
		t.Error("ui.json 缺 token 应判定为内容不完整")
	}
}

func TestUIURL(t *testing.T) {
	if got := uiURL(7788, "abc"); got != "http://127.0.0.1:7788/?token=abc" {
		t.Errorf("uiURL 带 token = %q", got)
	}
	if got := uiURL(7790, ""); got != "http://127.0.0.1:7790/" {
		t.Errorf("uiURL 不带 token = %q", got)
	}
}

func TestQuoteArg(t *testing.T) {
	cases := map[string]string{
		"":          `""`,
		"--port":    "--port",
		"7790":      "7790",
		"a b":       `"a b"`,
		"--no-open": "--no-open",
	}
	for in, want := range cases {
		if got := quoteArg(in); got != want {
			t.Errorf("quoteArg(%q) = %q，想要 %q", in, got, want)
		}
	}
}

// 后台模式没人看着，日志只能靠「超过上限就整个重写」自己收着。
func TestOpenRotatedLog(t *testing.T) {
	p := filepath.Join(t.TempDir(), uiLogName)
	f, err := openRotatedLog(p, 16)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.WriteString("hello")
	_ = f.Close()

	// 没超限：追加（排查「起来就退」最需要的恰恰是上一次的痕迹）。
	f, err = openRotatedLog(p, 16)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.WriteString(" world")
	_ = f.Close()
	if b, _ := os.ReadFile(p); string(b) != "hello world" {
		t.Fatalf("没超限时应追加，实得 %q", b)
	}

	// 超限：整个重写。
	f, err = openRotatedLog(p, 4)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.WriteString("new")
	_ = f.Close()
	if b, _ := os.ReadFile(p); string(b) != "new" {
		t.Fatalf("超限时没轮转，实得 %q", b)
	}
}

// 互斥体是机器级的，而配置目录可被覆盖：名字必须带目录指纹，
// 否则 A 目录的界面会把 B 目录的启动挡掉，还指着 B 里不存在的 ui.json。
func TestUISingletonKeyIsPerConfigDir(t *testing.T) {
	a := uiSingletonKey(`C:\Users\x\AppData\Roaming\pass-up`)
	b := uiSingletonKey(`C:\Users\x\AppData\Local\Temp\other`)
	if a == b {
		t.Fatal("不同配置目录必须拿到不同的互斥体名")
	}
	if a != uiSingletonKey(`C:\Users\x\AppData\Roaming\pass-up`) {
		t.Error("同一路径两次必须稳定")
	}
	if a != uiSingletonKey(`c:\users\x\appdata\roaming\PASS-UP`) {
		t.Error("Windows 路径大小写不敏感，名字应该一致")
	}
	if !strings.HasPrefix(a, `Local\pass-up-ops-ui-`) {
		t.Errorf("名字前缀不对：%q", a)
	}
}

// ---- 守护到底起没起来：只看「spawn 成功」会把 bind 失败当成成功 ----

func TestWaitUIReadySeesFreshInfo(t *testing.T) {
	dir := t.TempDir()
	if err := writeUIInfo(dir, uiInfo{Port: 7788, Token: "old"}); err != nil {
		t.Fatal(err)
	}
	before := uiInfoStamp(dir)
	time.Sleep(20 * time.Millisecond) // 让 mtime 确定往前走一格
	if err := writeUIInfo(dir, uiInfo{Port: 7789, Token: "new"}); err != nil {
		t.Fatal(err)
	}
	if err := waitUIReady(dir, before, 2*time.Second); err != nil {
		t.Fatalf("新的 ui.json 已经写出，应判定就绪：%v", err)
	}
}

func TestWaitUIReadyTimesOut(t *testing.T) {
	// before 在未来 = 「永远等不到更新」，不必真的睡满 6 秒。
	before := time.Now().Add(time.Hour)
	if err := waitUIReady(t.TempDir(), before, 100*time.Millisecond); err == nil {
		t.Fatal("ui.json 一直没更新时应超时报错")
	}
}

// 端口被占时守护会在隐藏窗口里退掉；这时必须返回非 0，
// 否则 .cmd 会以为后台成功、直接 exit，双击就又变成「没反应」。
func TestBackgroundUIFailsWhenGuardNeverBecomesReady(t *testing.T) {
	t.Setenv(shared.ConfigDirEnv, t.TempDir())
	stubSideEffects(t)
	stubSingleton(t, true)
	waitReady = func(string, time.Time, time.Duration) error {
		return errors.New("等不到界面就绪")
	}
	if rc := backgroundUI([]string{"--launcher", "launcher.cmd"}); rc == 0 {
		t.Fatal("守护没起来时不能返回成功（.cmd 会因此不回退前台）")
	}
}
