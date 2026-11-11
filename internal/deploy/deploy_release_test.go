package deploy

// P3b-1 判据集：全部走可注入的 fakeRunner，不真构建、不真 compose up、不真造故障。
//
// 锁住：① 六道门（尤其 --confirm yes 逐字再验 / 缺前置点名）；② 命令拼装
// （flock / 备份 / 分目录同步 / 无 docker tag / 两个 compose 单元 / 150 s 窗口）；
// ③ 阶段失败停点；④ 断点续跑按远端大小跳过；⑤ 健康门连续 2 次 200 四类判定；
// ⑥ 报告如实、数组恒 []、不写「部署成功」。

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// ---------- 门 1 / 2 / 5：参数与服务端逐字再验 ----------

func TestReleaseGate(t *testing.T) {
	full := options{
		Release: true, Server: "k4", Confirm: "yes", ConfigDir: "cfg",
		ReleaseVersion: "1.16.1", ReleaseNote: "测试环境冒烟",
	}
	if err := releaseGate(full); err != nil {
		t.Fatalf("完整门禁不该报错：%v", err)
	}
	cases := []struct {
		name string
		mut  func(*options)
		want string
	}{
		{"缺显式动词", func(o *options) { o.Release = false }, "release"},
		{"预演与发布混用", func(o *options) { o.DryRun = true }, "不能同用"},
		{"缺 server", func(o *options) { o.Server = "" }, "--server"},
		{"confirm 为空", func(o *options) { o.Confirm = "" }, "--confirm yes"},
		{"confirm 大小写不对", func(o *options) { o.Confirm = "YES" }, "--confirm yes"},
		{"confirm 带空格", func(o *options) { o.Confirm = "yes " }, "--confirm yes"},
		{"缺 config-dir", func(o *options) { o.ConfigDir = "" }, "--config-dir"},
		{"发版号非三段式", func(o *options) { o.ReleaseVersion = "latest" }, "三段式"},
		{"备注多行", func(o *options) { o.ReleaseNote = "a\nb" }, "单行"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			o := full
			c.mut(&o)
			err := releaseGate(o)
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("期望拒绝含 %q，实际 %v", c.want, err)
			}
		})
	}
}

func TestValidateRelease(t *testing.T) {
	for _, v := range []string{"1.16.1", "v2.0.0", "0.0.1"} {
		if err := ValidateRelease(v, ""); err != nil {
			t.Errorf("%q 应通过：%v", v, err)
		}
	}
	for _, v := range []string{"", "latest", "1.16", "1.16.1.2", "abc"} {
		if err := ValidateRelease(v, ""); err == nil {
			t.Errorf("%q 不该通过白名单", v)
		}
	}
	if err := ValidateRelease("1.16.1", strings.Repeat("长", 201)); err == nil {
		t.Error("超过 200 字的备注要拒绝")
	}
	// 备注不拼进命令：这里只验单行，命令拼装里不该出现备注内容。
	if err := ValidateRelease("1.16.1", "a;b|c&d"); err != nil {
		t.Errorf("备注只是人读元信息，不因特殊字符被拒（因为不拼命令）：%v", err)
	}
}

func TestParseDeployArgsReleaseMode(t *testing.T) {
	got, err := parseDeployArgs([]string{"release", "backend", "--server", "k4", "--confirm", "yes",
		"--config-dir", "cfg", "--release-version", "1.16.1", "--no-build", "--json"})
	if err != nil {
		t.Fatal(err)
	}
	if !got.Release || got.Scope != ScopeBackend || got.Server != "k4" || got.Confirm != "yes" ||
		got.ConfigDir != "cfg" || got.ReleaseVersion != "1.16.1" || !got.NoBuild || !got.JSON {
		t.Fatalf("release 参数解析不对：%+v", got)
	}
	got2, err := parseDeployArgs([]string{"release", "--server=k4", "--confirm=yes", "--config-dir=cfg", "--image-tag=abc1234"})
	if err != nil || got2.Confirm != "yes" || got2.ImageTag != "abc1234" {
		t.Fatalf("等号形式解析不对：%+v / %v", got2, err)
	}
	// 只读预演模式仍拒绝 P3b 参数（P3a 白名单不动）。
	for _, a := range []string{"--no-build", "--release-version", "--confirm"} {
		if _, err := parseDeployArgs([]string{"--dry-run", a, "x"}); err == nil ||
			!strings.Contains(err.Error(), "未知参数") {
			t.Errorf("--dry-run 模式仍应拒绝 %s：%v", a, err)
		}
	}
}

// ---------- 命令拼装（纯函数） ----------

func TestReleaseCommandsAreSafe(t *testing.T) {
	cfg := ReleaseConfig{RemoteDir: DefaultRemoteDir, ImagePrefix: "reg/passup", ImageTag: "abc1234"}
	all := []string{lockProbeCmd(cfg.RemoteDir)}
	all = append(all, backupCommands(cfg.RemoteDir, "20261111-210000")...)
	all = append(all, syncCommands(cfg.RemoteDir)...)
	all = append(all, crlfProbeCmd(cfg.RemoteDir), crlfNormalizeCmd(cfg.RemoteDir))
	all = append(all, upCommands(cfg)...)
	all = append(all, withLock(cfg.RemoteDir, "echo x"))
	for _, c := range buildCommands(cfg) {
		all = append(all, strings.Join(c.Argv, " "))
	}
	joined := strings.Join(all, "\n")
	for _, bad := range []string{"docker tag", "down -v", "--remove-orphans", "rm -rf /opt/passup", "sudo -S"} {
		if strings.Contains(joined, bad) {
			t.Errorf("命令拼装里出现危险动作 %q", bad)
		}
	}
	for _, want := range []string{
		"flock -n", "mkdir -p", "BACKUP_OK", "chmod 600", "-mindepth 1 -delete",
		"docker-compose.base.yml -f docker-compose.yml up -d", "&& IMAGE_TAG=",
		"tr -cd", "sed -i",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("命令拼装缺判据 %q", want)
		}
	}
	if len(upCommands(cfg)) != 2 {
		t.Error("拉起必须是两个 compose 单元")
	}
	if DefaultHealthWindow.Seconds() != 150 || DefaultHealthPoll.Seconds() != 5 || HealthStreak != 2 {
		t.Error("健康门窗口 / 轮询 / 连续次数必须按结论 D 内置")
	}
	if len(healthEndpoints) != 3 {
		t.Error("健康门应覆盖 backend / ai / web 三个 URL")
	}
}

func TestReleaseCommandsDontLeakReleaseNote(t *testing.T) {
	cfg := ReleaseConfig{RemoteDir: DefaultRemoteDir, ImageTag: "abc1234", ReleaseNote: "备注;不要拼进命令"}
	joined := strings.Join(upCommands(cfg), "\n") + strings.Join(syncCommands(cfg.RemoteDir), "\n")
	if strings.Contains(joined, cfg.ReleaseNote) {
		t.Error("项目备注绝不能拼进任何命令")
	}
}

func TestImageRefsFromCompose(t *testing.T) {
	dir := t.TempDir()
	ai := t.TempDir()
	mustWrite(t, filepath.Join(dir, "docker-compose.base.yml"), "services:\n  pg:\n    image: postgres:18\n")
	mustWrite(t, filepath.Join(dir, "docker-compose.yml"), "services:\n  backend-java:\n    image: reg/passup/backend-java:${IMAGE_TAG:-latest}\n  pg:\n    image: postgres:18\n")
	mustWrite(t, filepath.Join(ai, "docker-compose.yml"), "services:\n  ai:\n    image: reg/passup/ai:${IMAGE_TAG:-latest}\n")
	refs, err := imageRefsFromCompose(ReleaseConfig{ConfigDir: dir, AIConfigDir: ai, ImageTag: "abc1234"})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"postgres:18", "reg/passup/backend-java:abc1234", "reg/passup/ai:abc1234"}
	if strings.Join(refs, ",") != strings.Join(want, ",") {
		t.Fatalf("镜像引用应逐字取自 compose、去重、替换 IMAGE_TAG：%v", refs)
	}
	if archiveName(refs[1]) != "reg_passup_backend-java_abc1234.tar.gz" {
		t.Errorf("归档名不安全：%q", archiveName(refs[1]))
	}
	if _, err := imageRefsFromCompose(ReleaseConfig{ConfigDir: t.TempDir(), ImageTag: "x"}); err == nil {
		t.Error("compose 缺文件必须报错，不猜镜像")
	}
}

func TestShouldSkipUpload(t *testing.T) {
	for _, c := range []struct {
		local, remote int64
		want          bool
	}{
		{100, 100, true}, {100, 99, false}, {100, -1, false}, {0, 0, false}, {100, 101, false},
	} {
		if got := shouldSkipUpload(c.local, c.remote); got != c.want {
			t.Errorf("local=%d remote=%d → %v，期望 %v", c.local, c.remote, got, c.want)
		}
	}
}

func TestHealthVerdictFourCases(t *testing.T) {
	all := func(codes ...int) map[string][]int {
		m := map[string][]int{}
		for _, ep := range healthEndpoints {
			m[ep.Name] = append([]int{}, codes...)
		}
		return m
	}
	if !healthVerdict(all(200, 200)) {
		t.Error("三个 URL 各连续 2 次 200 应通过")
	}
	if healthVerdict(all(404, 404)) {
		t.Error("404 不该通过")
	}
	if healthVerdict(all(0, 0)) {
		t.Error("超时（0）不该通过")
	}
	if healthVerdict(all(200, 500)) {
		t.Error("第一次 200、第二次失败不该通过")
	}
	if !healthVerdict(all(500, 200, 200)) {
		t.Error("启动窗口内先失败再连续 2 次 200 应通过")
	}
	m := all(200, 200)
	m["web"] = []int{200, 404}
	if healthVerdict(m) {
		t.Error("只要有一个 URL 不满足连续 2 次 200 就不能通过")
	}
}

func TestParseReleasePreflightNamesMissingItems(t *testing.T) {
	text := strings.Replace(fullGateText(), "SEC env=present", "SEC env=missing", 1)
	g := parseReleasePreflight(text)
	found := false
	for _, b := range g.Blockers {
		if strings.Contains(b, "docker/.env") {
			found = true
		}
	}
	if !found {
		t.Errorf("缺 .env 要点名：%v", g.Blockers)
	}
	if g.EnvLineEnding != "missing" {
		t.Errorf("env_cr=missing 不该猜 LF：%s", g.EnvLineEnding)
	}
	if g := parseReleasePreflight(fullGateText()); len(g.Blockers) != 0 || g.PreviousTag != "abc1234" || g.EnvLineEnding != "lf" {
		t.Errorf("全绿快照解析不对：%+v", g)
	}
	if g := parseReleasePreflight("no sections"); len(g.Blockers) == 0 {
		t.Error("没分节数据要当阻塞，不能静默放行")
	}
}

// ---------- fakeRunner：六阶段编排 / 失败停点 / 断点续跑 ----------

type fakeRunner struct {
	remoteCalls  []string
	stdinCalls   []string
	localCalls   [][]string
	remoteSize   int64
	failContains string
	healthCodes  []int
	healthRound  int
	gateText     string
	delay        time.Duration
}

func (f *fakeRunner) Remote(_ context.Context, cmd string) (string, error) {
	f.remoteCalls = append(f.remoteCalls, cmd)
	if f.delay > 0 && len(f.remoteCalls) == 1 {
		time.Sleep(f.delay) // 让 RunRelease 的耗时统计有可观测的非零值
	}
	if f.failContains != "" && strings.Contains(cmd, f.failContains) {
		return "", errors.New("注入失败：" + f.failContains)
	}
	switch {
	case strings.Contains(cmd, "SEC gate_proto"):
		if f.gateText != "" {
			return f.gateText, nil
		}
		return fullGateText(), nil
	case strings.Contains(cmd, "LOCK_OK"):
		return "LOCK_OK", nil
	case strings.Contains(cmd, "BACKUP_OK"):
		return "BACKUP_OK", nil
	case strings.Contains(cmd, "tr -cd"):
		return "0\n", nil
	case strings.Contains(cmd, "curl"):
		code := 200
		if f.healthCodes != nil {
			i := f.healthRound % len(f.healthCodes)
			code = f.healthCodes[i]
		}
		if strings.Contains(cmd, "80/") {
			f.healthRound++
		}
		return strconvItoa(code), nil
	case strings.Contains(cmd, "gunzip -c"):
		return "Loaded image: ok", nil
	case strings.Contains(cmd, "free -m"):
		return "Mem: 1024", nil
	default:
		return "", nil
	}
}

func strconvItoa(n int) string {
	if n == 0 {
		return "000"
	}
	if n < 0 {
		return "-1"
	}
	b := []byte{}
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	return string(b)
}

func (f *fakeRunner) RemoteStdin(_ context.Context, cmd string, stdin io.Reader) (string, error) {
	f.stdinCalls = append(f.stdinCalls, cmd)
	if f.failContains != "" && strings.Contains(cmd, f.failContains) {
		return "", errors.New("注入失败：" + f.failContains)
	}
	_, _ = io.Copy(io.Discard, stdin)
	return "", nil
}

func (f *fakeRunner) RemoteSize(_ context.Context, path string) (int64, error) {
	return f.remoteSize, nil
}

func (f *fakeRunner) SaveImage(_ context.Context, ref, localPath string) (int64, error) {
	if err := os.WriteFile(localPath, []byte(strings.Repeat("x", 100)), 0o600); err != nil {
		return 0, err
	}
	return 100, nil
}

func (f *fakeRunner) Local(_ context.Context, argv []string, dir string) (string, error) {
	f.localCalls = append(f.localCalls, argv)
	if f.failContains != "" && strings.Contains(strings.Join(argv, " "), f.failContains) {
		return "DOCKER_BUILD_TAIL: registry mirror EOF", errors.New("注入失败：" + f.failContains)
	}
	return "ok", nil
}

func fullGateText() string {
	return strings.Join([]string{
		"SEC gate_proto=1", "SEC dir=present", "SEC dir_w=yes",
		"SEC docker_dir=present", "SEC ai_dir=present", "SEC data=present",
		"SEC env=present", "SEC secrets=present", "SEC compose_files=3/3",
		"SEC ai_compose=present", "SEC docker=yes", "SEC compose=yes",
		"SEC previous=abc1234", "SEC env_cr=0", "SEC end=1", "",
	}, "\n")
}

func testReleaseConfig(t *testing.T) ReleaseConfig {
	t.Helper()
	dir := t.TempDir()
	mustWrite(t, filepath.Join(dir, "docker-compose.base.yml"), "services:\n  pg:\n    image: postgres:18\n")
	mustWrite(t, filepath.Join(dir, "docker-compose.yml"), "services:\n  web:\n    image: nginx:1.27-alpine\n")
	mustWrite(t, filepath.Join(dir, ".env"), "TEST_KEY=test-value\n")
	return ReleaseConfig{
		Server: "k4", Host: "cql@k4:22", Scope: ScopeAll,
		RemoteDir: DefaultRemoteDir, ImagePrefix: "reg/passup", ImageTag: "abc1234",
		ConfigDir: dir, ReleaseVersion: "1.16.1", NoBuild: true,
		Timestamp: "20261111-210000", HealthWindow: 0, HealthPoll: 0,
	}
}

func mustWrite(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestRunReleaseFullFlow(t *testing.T) {
	f := &fakeRunner{remoteSize: -1}
	rep := RunRelease(context.Background(), testReleaseConfig(t), f)
	if !rep.Completed {
		t.Fatalf("全绿链路应跑完：failed=%q err=%q log=%v", rep.FailedStage, rep.Error, rep.Log)
	}
	if len(rep.Stages) != len(stageOrder) {
		t.Errorf("应有六个阶段结果，实际 %d", len(rep.Stages))
	}
	for i, s := range rep.Stages {
		if !s.OK || s.Name != stageOrder[i] {
			t.Errorf("阶段 %d 不对：%+v", i, s)
		}
	}
	if len(rep.Gates) != 3 {
		t.Errorf("应记录三道运行期门禁，实际 %d", len(rep.Gates))
	}
	if len(rep.Images) != 2 {
		t.Errorf("应流转 2 个镜像，实际 %v", rep.Images)
	}
	if rep.PreviousTag != "abc1234" || rep.EnvLineEnding != "lf" {
		t.Errorf(":previous / CRLF 结论不对：%s / %s", rep.PreviousTag, rep.EnvLineEnding)
	}
	if strings.Contains(rep.Note, "部署成功") || strings.Contains(rep.Note, "服务已恢复正常") {
		t.Errorf("报告不该写夸大结论：%s", rep.Note)
	}
	assertReleaseArrays(t, rep)
}

func TestRunReleaseStopsAtFailedStage(t *testing.T) {
	cases := []struct {
		name, fail, stage string
	}{
		{"撞锁", "LOCK_OK", StagePreflight},
		{"备份失败", "BACKUP_OK", StageConfigSync},
		{"同步失败", "tar xzf", StageConfigSync},
		{"加载镜像失败", "gunzip -c", StageTransfer},
		{"compose up 失败", "docker compose -f", StageUp},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			f := &fakeRunner{remoteSize: -1, failContains: c.fail}
			rep := RunRelease(context.Background(), testReleaseConfig(t), f)
			if rep.Completed || rep.FailedStage != c.stage {
				t.Fatalf("应停在 %s：completed=%v failed=%q", c.stage, rep.Completed, rep.FailedStage)
			}
			idx := -1
			for i, s := range rep.Stages {
				if s.Name == c.stage {
					idx = i
				}
			}
			if idx != len(rep.Stages)-1 {
				t.Errorf("失败阶段之后不该继续执行：%v", rep.Stages)
			}
			if strings.Contains(rep.Note, "部署成功") {
				t.Errorf("失败报告不能写「部署成功」：%s", rep.Note)
			}
			if !strings.Contains(rep.Note, "不自动回滚") {
				t.Errorf("失败报告要写明不自动回滚、保留现场：%s", rep.Note)
			}
			assertReleaseArrays(t, rep)
		})
	}
}

func TestRunReleaseHealthTimeout(t *testing.T) {
	f := &fakeRunner{remoteSize: -1, healthCodes: []int{404}}
	rep := RunRelease(context.Background(), testReleaseConfig(t), f)
	if rep.Completed || rep.FailedStage != StageHealth {
		t.Fatalf("健康门 404 应停在健康门：%+v", rep)
	}
	if !strings.Contains(rep.Error, "连续 2 次 200") {
		t.Errorf("失败原因要写明判据：%s", rep.Error)
	}
	assertReleaseArrays(t, rep)
}

// 值类型返回 + defer 会让 DurationMS 恒为 0；命名返回值修好后必须能记录耗时。
func TestRunReleaseReportsDuration(t *testing.T) {
	f := &fakeRunner{remoteSize: -1, delay: 3 * time.Millisecond}
	rep := RunRelease(context.Background(), testReleaseConfig(t), f)
	if !rep.Completed || rep.DurationMS < 1 {
		t.Errorf("报告要记录真实耗时：completed=%v duration_ms=%d", rep.Completed, rep.DurationMS)
	}
}

func TestRunReleaseResumeBySize(t *testing.T) {
	f := &fakeRunner{remoteSize: 100} // 远端大小 == SaveImage 的 100 B
	rep := RunRelease(context.Background(), testReleaseConfig(t), f)
	if !rep.Completed {
		t.Fatalf("断点续跑应跑完：%s", rep.Error)
	}
	for _, c := range f.stdinCalls {
		if strings.Contains(c, "cat >") {
			t.Errorf("远端大小一致时不应重传：%s", c)
		}
	}
	joined := strings.Join(rep.Log, "\n")
	if !strings.Contains(joined, "跳过上传") {
		t.Errorf("日志要记录断点续跑跳过：%s", joined)
	}
	assertReleaseArrays(t, rep)
}

func TestRunReleaseBuildFailureDoesNotTouchRemote(t *testing.T) {
	cfg := testReleaseConfig(t)
	cfg.NoBuild = false
	f := &fakeRunner{remoteSize: -1, failContains: "docker build"}
	rep := RunRelease(context.Background(), cfg, f)
	if rep.Completed || rep.FailedStage != StageBuild {
		t.Fatalf("构建失败应停在构建：%+v", rep)
	}
	if !strings.Contains(rep.Error, "DOCKER_BUILD_TAIL") ||
		!strings.Contains(strings.Join(rep.Log, "\n"), "构建输出尾部") {
		t.Errorf("构建失败报告必须带日志尾部，不能只给一句「docker 失败」：%s / %v", rep.Error, rep.Log)
	}
	for _, c := range f.remoteCalls {
		if strings.Contains(c, " up -d") || strings.Contains(c, "gunzip -c") {
			t.Errorf("构建是本机动作，失败后不该碰远端拉起 / load：%s", c)
		}
	}
	assertReleaseArrays(t, rep)
}

func assertReleaseArrays(t *testing.T, rep ReleaseReport) {
	t.Helper()
	if rep.Gates == nil || rep.Stages == nil || rep.Log == nil ||
		rep.Warnings == nil || rep.Images == nil {
		t.Fatal("ReleaseReport 的所有切片必须恒非 nil")
	}
	b, err := json.Marshal(rep)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(b), ":null") {
		t.Errorf("报告 JSON 里出现 null（前端 .find 会白屏）")
	}
	for _, want := range []string{"failed_stage", "previous_tag", "env_line_ending", "release_version"} {
		if !strings.Contains(string(b), `"`+want+`"`) {
			t.Errorf("报告 JSON 缺字段 %s", want)
		}
	}
}
