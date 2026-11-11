package deploy

// P3a 第一刀的判据集。重点锁住四件事：
//   ① 不带 --dry-run 必拒（正式发布没有旁路）；
//   ② 远端预检脚本**全程只读**（不拿锁、不 mkdir、不归一化、不构建）；
//   ③ 只读失败回完整快照、所有数组恒 []（Go nil slice 编成 null 会白屏）；
//   ④ 与真实 deploy.sh 的对齐口径（没有 docker tag、整目录 rsync --delete）。

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// 🔴 早期版本在警告里硬编码「真实应用主机 172.16.0.222 尚未登记」；
//    15:2x 用户确认拓扑（k1=备份服务器 / k2=应用部署目标）后那句话是错的：
//    222 只是 compose 镜像仓库前缀 / 运维机本机 WSL2 转发。
//    锁住：app 角色不产生警告，且任何警告都不许带硬编码 IP。
func TestRoleWarning(t *testing.T) {
	for _, role := range []string{"app", "db", "other", ""} {
		if got := roleWarning("k2", role); got != "" {
			t.Errorf("role=%q 不该产生备份机警告：%q", role, got)
		}
	}
	w := roleWarning("k1", "backup")
	if w == "" {
		t.Fatal("备份机必须提示别把快照读成应用目标结论")
	}
	if !strings.Contains(w, "k1") || !strings.Contains(w, "backup") {
		t.Errorf("提示要说清目标机与角色：%q", w)
	}
	if regexp.MustCompile(`\d+\.\d+\.\d+\.\d+`).MatchString(w) {
		t.Errorf("警告里不许硬编码 IP（部署目标由 --server 决定）：%q", w)
	}
}

func TestDryRunGateIsOnlyEntry(t *testing.T) {
	if err := dryRunGate(options{DryRun: true}); err != nil {
		t.Fatalf("--dry-run 应该放行：%v", err)
	}
	err := dryRunGate(options{DryRun: false})
	if err == nil {
		t.Fatal("不带 --dry-run 必须拒绝，不能落到正式发布路径")
	}
	for _, want := range []string{"--dry-run", "P3b", "没有生成计划"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("拒绝文案要讲清 %q，实际：%s", want, err)
		}
	}
}

func TestParseDeployArgsWhitelist(t *testing.T) {
	cases := []struct {
		name    string
		args    []string
		wantErr string
		scope   string
		server  string
		dry     bool
	}{
		{"正常", []string{"backend", "--server", "k1", "--dry-run"}, "", "backend", "k1", true},
		{"默认 all", []string{"--dry-run", "--json"}, "", "all", "", true},
		{"等号形式", []string{"--server=k2", "--dry-run"}, "", "all", "k2", true},
		{"不带 dry-run 能解析但要被门禁挡", []string{"all"}, "", "all", "", false},
		{"未知范围", []string{"prod", "--dry-run"}, "未知发布范围", "", "", false},
		{"P3b 的 no-build 拒绝", []string{"--dry-run", "--no-build"}, "未知参数", "", "", false},
		{"发版参数拒绝", []string{"--dry-run", "--release-version", "1.2.3"}, "未知参数", "", "", false},
		{"任意 host 拒绝", []string{"--dry-run", "172.16.0.222"}, "多余的位置参数", "", "", false},
		{"缺少参数", []string{"--dry-run", "--server"}, "缺少参数", "", "", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := parseDeployArgs(c.args)
			if c.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), c.wantErr) {
					t.Fatalf("期望错误含 %q，实际 %v", c.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("不该报错：%v", err)
			}
			if got.Scope != c.scope || got.Server != c.server || got.DryRun != c.dry {
				t.Errorf("解析结果不对：%+v", got)
			}
		})
	}
}

// 🔴 源码级判据：预检脚本一旦被加进任何写动作，这里立刻红。
func TestPreflightScriptIsReadOnly(t *testing.T) {
	s := preflightScript()
	forbidden := []string{
		"mkdir", "touch", "rm -f", "flock -n", "sed -i", "rsync ",
		"docker build", "docker save", "compose up", "tee ", ">>",
		"docker load", "docker compose up", "export IMAGE_TAG",
	}
	for _, f := range forbidden {
		if strings.Contains(s, f) {
			t.Errorf("只读预检脚本里出现了写动作 %q（§3.1：第一刀不拿锁、不写远端）", f)
		}
	}
	// 剥掉丢弃输出的惯用写法后，脚本里不该有任何 > 重定向到文件。
	// 顺序要长串在前，否则 "2>/dev/null" 会先被 ">/dev/null" 削成 "2"。
	cleaned := s
	for _, harmless := range []string{"2>/dev/null", ">/dev/null", "2>&1", "1>&2", ">&2"} {
		cleaned = strings.ReplaceAll(cleaned, harmless, "")
	}
	if strings.Contains(cleaned, ">") {
		t.Errorf("只读预检脚本里有文件重定向：\n%s", cleaned)
	}
	// 关键探测项一个都不能少。
	for _, key := range []string{"SEC docker=", "SEC compose=", "SEC env_cr=", "SEC release=", "SEC end=1"} {
		if !strings.Contains(s, key) {
			t.Errorf("预检脚本缺分节 %q", key)
		}
	}
	if !strings.Contains(s, "tr -cd '\\r'") {
		t.Error("CRLF 必须用远端 tr -cd '\\r' 探测，不能写死归一化")
	}
}

// 🔴 ss -ltn 的行尾是 Peer Address，不是端口；旧正则用行尾锚点匹配端口，
//    真机上永远采不到（2026-11-11 WSL 实测返回空）。锁住「取第 4 列末段」的改法。
func TestPreflightPortProbeUsesLocalAddress(t *testing.T) {
	s := preflightScript()
	if !strings.Contains(s, `n=split($4,a,":")`) {
		t.Error("端口探测必须从 ss -ltn 第 4 列 Local Address:Port 取末段")
	}
	if strings.Contains(s, `[[:space:]]*$`) {
		t.Error("端口探测不能用行尾锚点：行尾是 Peer Address，会永远采不到")
	}
	if !strings.Contains(s, "grep -xE ':(80|81|82|5432|6379|8005|8006|8007|8008|8009)'") {
		t.Error("端口必须按本项目白名单过滤，不要把别的监听端口算进来")
	}
	// 纯函数侧再验一次：SEC 分节能原样带回带冒号的端口串。
	pf := parsePreflight(fullSECText("present", "0", "—"), "k1")
	if got := pf.Checks[6].Value; got != ":80,:8009," {
		t.Errorf("端口串应原样回显，实际 %q", got)
	}
}

func fullSECText(env, cr, release string) string {
	return "SEC proto=1\n" +
		"SEC docker=27.3.1\nSEC compose=2.29.7\n" +
		"SEC dir=present\nSEC dir_w=yes\n" +
		"SEC env=" + env + "\nSEC env_cr=" + cr + "\n" +
		"SEC compose_files=3/3\n" +
		"SEC ports=:80,:8009,\nSEC disk_kb=12345678\n" +
		"SEC release=" + release + "\nSEC end=1\n"
}

// 2026-11-11 在 WSL Ubuntu-24.04 的真实 `sh -s` 里跑 preflightScript() 抓回的原文
// （base64 传入，避开 Windows→WSL 的 stdin 换行转换）。本机有 docker 29.7.2 /
// compose 5.4.0、无 /opt/passup；端口第 4 列探测拿到 5432/6379/8007/8008。
// 这不是生产目标机快照，只用来钉死「真实 sh 输出能被 parsePreflight 吃下」。
const realShellSEC = `SEC proto=1
SEC docker=29.7.2
SEC compose=5.4.0
SEC dir=missing
SEC dir_w=no
SEC env=missing
SEC env_cr=—
SEC compose_files=0/3
SEC ports=:5432,:6379,:8007,:8008
SEC disk_kb=—
SEC release=—
SEC end=1
`

func TestParsePreflightRealShellSnapshot(t *testing.T) {
	pf := parsePreflight(realShellSEC, "cql@127.0.0.1:2222")
	if !pf.Collected || pf.Error != "" {
		t.Fatalf("真实 sh 输出应采集成功：%+v", pf)
	}
	if len(pf.Checks) != len(PreflightCheckNames()) {
		t.Fatalf("应有 %d 项检查，实际 %d", len(PreflightCheckNames()), len(pf.Checks))
	}
	if pf.Checks[6].Value != ":5432,:6379,:8007,:8008" {
		t.Errorf("端口应按真实 ss 第 4 列结果回显，实际 %q", pf.Checks[6].Value)
	}
	if pf.EnvLineEnding != "missing" {
		t.Errorf("远端 .env 不存在应判 missing，实际 %s", pf.EnvLineEnding)
	}
	if pf.Checks[7].Value != notCollected {
		t.Errorf("磁盘没采到不能拿 0 兜底，实际 %q", pf.Checks[7].Value)
	}
	if pf.Checks[8].Value != notCollected {
		t.Errorf("线上版本号没采到不能猜 0，实际 %q", pf.Checks[8].Value)
	}
	if len(pf.Blockers) != 0 {
		t.Errorf("缺前置只是正式发布的前置，不是第一刀的全局阻塞：%v", pf.Blockers)
	}
	assertNonNilSlices(t, pf)
}

func TestParsePreflightFull(t *testing.T) {
	pf := parsePreflight(fullSECText("present", "0", "1.16.0"), "cql@k1:22")
	if !pf.Collected || pf.Error != "" {
		t.Fatalf("完整分节应该采集成功：%+v", pf)
	}
	if pf.Host != "cql@k1:22" {
		t.Errorf("host 不对：%s", pf.Host)
	}
	if len(pf.Checks) != len(PreflightCheckNames()) {
		t.Fatalf("预检应有 %d 项，实际 %d", len(PreflightCheckNames()), len(pf.Checks))
	}
	for i, name := range PreflightCheckNames() {
		if pf.Checks[i].Name != name {
			t.Errorf("第 %d 项应是 %s，实际 %s", i, name, pf.Checks[i].Name)
		}
	}
	if pf.EnvLineEnding != "lf" {
		t.Errorf("env_cr=0 应判 LF，实际 %s", pf.EnvLineEnding)
	}
	if got := pf.Checks[8].Value; got != "1.16.0" {
		t.Errorf("线上版本号应原样回显，实际 %q", got)
	}
	if len(pf.Blockers) != 0 || len(pf.Warnings) != 0 {
		t.Errorf("全绿快照不该有阻塞 / 警告：%+v", pf)
	}
	assertNonNilSlices(t, pf)
}

func TestParsePreflightEnvEndingVariants(t *testing.T) {
	cases := []struct {
		env, cr, want, text string
		missing             bool
	}{
		{"present", "0", "lf", "LF（未检出 CR，不做归一化）", false},
		{"present", "42", "crlf", "CRLF（检出 CR", false},
		{"missing", "—", "missing", "文件不存在", true},
		{"present", "—", "unknown", "未采集", true},
	}
	for _, c := range cases {
		t.Run(c.env+"/"+c.cr, func(t *testing.T) {
			pf := parsePreflight(fullSECText(c.env, c.cr, "—"), "k1")
			if pf.EnvLineEnding != c.want {
				t.Errorf("换行判定应为 %s，实际 %s", c.want, pf.EnvLineEnding)
			}
			if !strings.Contains(EnvEndingText(pf.EnvLineEnding), c.text) {
				t.Errorf("文案应含 %q，实际 %q", c.text, EnvEndingText(pf.EnvLineEnding))
			}
			if c.missing && !strings.Contains(pf.Checks[4].Value, "不猜") {
				t.Errorf("没采到必须写「不猜」，实际 %q", pf.Checks[4].Value)
			}
			assertNonNilSlices(t, pf)
		})
	}
}

func TestParsePreflightOfflineFullSnapshot(t *testing.T) {
	for _, raw := range []string{"", "ssh: connect to host k1 port 22: Connection refused\n", "SEC docker=27.3.1\n"} {
		pf := parsePreflight(raw, "cql@k1:22")
		if pf.Collected {
			t.Errorf("没拿到 proto 分节必须 collected=false：%q", raw)
		}
		if pf.Error == "" || len(pf.Blockers) == 0 {
			t.Errorf("失败也要给完整快照（error + blockers）：%+v", pf)
		}
		assertNonNilSlices(t, pf)
	}
	// 失败快照不能拿 0 兜底，也不能猜线上版本号。
	pf := emptyPreflight("cql@k1:22", "连不上")
	b, _ := json.Marshal(pf)
	if strings.Contains(string(b), `"value":"0"`) || strings.Contains(string(b), `1.0.0`) {
		t.Errorf("失败快照里出现了猜出来的数值：%s", b)
	}
}

func assertNonNilSlices(t *testing.T, pf Preflight) {
	t.Helper()
	if pf.Checks == nil || pf.Blockers == nil || pf.Warnings == nil {
		t.Fatal("Preflight 的切片必须恒非 nil（nil 会编成 JSON null）")
	}
	b, err := json.Marshal(pf)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(b), ":null") {
		t.Errorf("Preflight JSON 里出现 null：%s", b)
	}
}

func TestBuildPlanScopeSubsets(t *testing.T) {
	want := map[string]int{
		ScopeAll: 7, ScopeInfra: 4, ScopeAI: 7, ScopeBackend: 7, ScopeWeb: 5,
	}
	pf := parsePreflight(fullSECText("present", "0", "1.16.0"), "k1")
	for scope, n := range want {
		p := BuildPlan(pf, PlanRequest{Server: "k1", Host: "k1", Scope: scope,
			ImagePrefix: "172.16.0.222:5000/passup", ImageTag: "a1b2c3d",
			RepoPaths: RepoPaths{Backend: true, AI: true, Web: true}})
		if len(p.Commands) != n {
			t.Errorf("%s 应有 %d 条命令，实际 %d", scope, n, len(p.Commands))
		}
		if !p.Available {
			t.Errorf("%s 全绿快照应 available=true", scope)
		}
		assertPlanArrays(t, p)
	}
}

func TestBuildPlanOfflineStillShowsFullPlan(t *testing.T) {
	p := BuildPlan(emptyPreflight("k1", "连不上"), PlanRequest{Server: "k1", Scope: ScopeAll})
	if p.Available {
		t.Error("连不上时不能 available=true")
	}
	if len(p.Blockers) == 0 {
		t.Error("连不上要列全局阻塞")
	}
	if len(p.Commands) != 7 || len(p.Alignments) != 7 {
		t.Errorf("连不上也要给完整计划（7 条命令 + 7 行对齐），实际 %d / %d",
			len(p.Commands), len(p.Alignments))
	}
	if p.ImagePrefix != notCollected {
		t.Errorf("镜像引用没采到必须显示 —，实际 %q", p.ImagePrefix)
	}
	assertPlanArrays(t, p)
}

func TestBuildPlanUnknownScopeIsBlocked(t *testing.T) {
	pf := parsePreflight(fullSECText("present", "0", "1.16.0"), "k1")
	p := BuildPlan(pf, PlanRequest{Server: "k1", Scope: "prod"})
	if p.Available || len(p.Blockers) == 0 {
		t.Error("未知范围必须挡住，不能生成一份看起来可执行的计划")
	}
	if len(p.Commands) != 0 {
		t.Errorf("被挡住时不该有命令，实际 %d", len(p.Commands))
	}
	assertPlanArrays(t, p)
}

func assertPlanArrays(t *testing.T, p Plan) {
	t.Helper()
	if p.Commands == nil || p.Alignments == nil || p.Impact == nil ||
		p.Warnings == nil || p.Blockers == nil || p.Preflight.Checks == nil {
		t.Fatal("Plan 的所有切片必须恒非 nil")
	}
	b, err := json.Marshal(p)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(b), ":null") {
		t.Errorf("Plan JSON 里出现 null（前端 .find 会整页白屏）：%s", b)
	}
	for _, bad := range []string{"id_rsa", ".pem", "SudoPassword"} {
		if strings.Contains(string(b), bad) {
			t.Errorf("计划里出现了凭证信息 %q", bad)
		}
	}
}

func TestDeployScriptAlignmentUsesRealScript(t *testing.T) {
	a := deployScriptAlignments()
	if len(a) != 7 {
		t.Fatalf("应有 7 行对齐，实际 %d", len(a))
	}
	joined := ""
	for _, x := range a {
		joined += x.Diff
	}
	for _, want := range []string{"没有 docker tag", "整目录 rsync --delete", "不落盘", "不 down -v"} {
		if !strings.Contains(joined, want) {
			t.Errorf("对齐表缺 §4 校正口径 %q", want)
		}
	}
	steps := DeployScriptSteps()
	if len(steps) != 5 {
		t.Fatalf("deploy.sh 是 5 步，实际 %d", len(steps))
	}
	if !strings.Contains(steps[4].Note, "没有 docker tag") {
		t.Error("Step 5 必须写明脚本里没有 docker tag")
	}
	if !strings.Contains(steps[3].Cmd, "--delete") {
		t.Error("Step 4 必须是整目录 rsync --delete")
	}
}

func TestPlanBaselineHasNoDockerTag(t *testing.T) {
	cmds := planBaseline(PlanRequest{Server: "k1", Scope: ScopeAll})
	for _, c := range cmds {
		if strings.Contains(c.Cmd, "docker tag") {
			t.Errorf("新工具计划不该出现「load 后再 tag」的绕路：%s", c.Cmd)
		}
		if strings.Contains(c.Cmd, "down -v") || strings.Contains(c.Cmd, "--remove-orphans") {
			t.Errorf("计划里出现危险参数：%s", c.Cmd)
		}
	}
	if !strings.Contains(cmds[1].Note, "第一刀不拿锁") {
		t.Error("拿锁那条必须标注「第一刀不拿锁」")
	}
	if !strings.Contains(cmds[2].Note, "secrets/ 不用 --delete") {
		t.Error("配置同步那条必须写清 secrets/ 不用 --delete")
	}
}

func TestReadImagePrefix(t *testing.T) {
	dir := t.TempDir()
	compose := "services:\n  backend-java:\n    image: 172.16.0.222:5000/passup/backend-java:${IMAGE_TAG:-latest}\n"
	if err := os.WriteFile(filepath.Join(dir, "docker-compose.yml"), []byte(compose), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := ReadImagePrefix(dir)
	if err != nil || got != "172.16.0.222:5000/passup" {
		t.Fatalf("前缀应逐字取自 compose，实际 %q / %v", got, err)
	}
	if _, err := ReadImagePrefix(filepath.Join(dir, "nope")); err == nil {
		t.Error("读不到 compose 必须报错，不能猜默认值")
	}
	bad := t.TempDir()
	if err := os.WriteFile(filepath.Join(bad, "docker-compose.yml"), []byte("services: {}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := ReadImagePrefix(bad); err == nil {
		t.Error("compose 里没有 backend-java 镜像引用时必须报错")
	}
}
