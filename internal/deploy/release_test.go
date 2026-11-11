package deploy

// P3b-2 判据集：发版台账 append-only + 只读历史 + 门 5 白名单。
//
// 锁住：① 发版号三段式 / 备注无控制字符；② 入账界线（门 3 之前不写、之后都写）；
// ③ 追加不覆盖旧行、失败必带 failed_stage；④ 空数组恒 [] / ok=true + data.error；
// ⑤ 按 server 筛选 + 按 ts 倒序；⑥ 历史只读不创建文件；⑦ 线上版本号只读采集。

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func testEvent() ReleaseEvent {
	return ReleaseEvent{
		TS: "2026-11-11T22:10:00+08:00", Server: "k3", Scope: ScopeAll,
		Kind: KindRelease, OnlineVersion: "未采集", ReleaseVersion: "1.16.1",
		Note: "测试环境冒烟", ImageTag: "abc1234", Result: ResultSuccess,
		TaskID: "cli-20261111-221000-k3",
	}
}

// ---------- 门 5：白名单与备注 ----------

func TestValidateReleaseWhitelistAndNote(t *testing.T) {
	for _, v := range []string{"1.16.1", "v2.0.0", "0.0.1"} {
		if err := ValidateRelease(v, ""); err != nil {
			t.Errorf("%q 应通过三段式白名单：%v", v, err)
		}
	}
	for _, v := range []string{"", "latest", "1.16", "abc", "1.16.1;rm -rf /"} {
		if err := ValidateRelease(v, ""); err == nil {
			t.Errorf("%q 不该通过白名单", v)
		}
	}
	// §10.1 早期设计稿的宽白名单 ^[A-Za-z0-9.]{1,32}$ 已被三段式取代。
	if err := ValidateRelease("abc.def", ""); err == nil {
		t.Error("宽白名单不该放行非三段式发版号")
	}
	// 控制字符一律挡掉；普通特殊字符只作纯文本，不因「不拼命令」被拒。
	for _, n := range []string{"a\x00b", "a\x07b", "a\x7fb", "a\tb"} {
		if err := ValidateRelease("1.16.1", n); err == nil {
			t.Errorf("备注含控制字符 %q 应被拒", n)
		}
	}
	if err := ValidateRelease("1.16.1", "a;b|c&d $(whoami) <script>"); err != nil {
		t.Errorf("备注不拼命令，普通特殊字符不该被拒：%v", err)
	}
}

func TestReleaseNoteIsEscapedInJSONL(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ReleaseLogFile)
	ev := testEvent()
	ev.Note = `引号" 反斜杠\ 尖括号<script> $(whoami)`
	if err := AppendRelease(path, ev); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	if strings.Count(s, "\n") != 1 || !strings.HasSuffix(s, "\n") {
		t.Fatalf("台账必须是一行一条 JSON：%q", s)
	}
	if strings.Contains(s, "<script>") {
		t.Error("备注里的尖括号应被 json.Marshal 转成 \\u003c，不能原样落盘")
	}
	var back ReleaseEvent
	if err := json.Unmarshal([]byte(strings.TrimSpace(s)), &back); err != nil {
		t.Fatalf("落盘行必须能被反解：%v", err)
	}
	if back.Note != ev.Note {
		t.Errorf("备注往返不一致：%q != %q", back.Note, ev.Note)
	}
}

// ---------- 入账界线 ----------

func TestShouldRecordGateBoundary(t *testing.T) {
	cases := []struct {
		name  string
		gates []GateResult
		want  bool
	}{
		{"门 3 之前的校验失败：一条 gate 都没有", nil, false},
		{"门 3 预检不通过", []GateResult{{Name: GateReleasePreflight, OK: false}}, false},
		{"门 3 通过但门 4 撞锁（§11.2：撞锁不写）", []GateResult{
			{Name: GateReleasePreflight, OK: true}, {Name: GateDualLock, OK: false}}, false},
		{"只有门 4 过、门 3 没过", []GateResult{
			{Name: GateReleasePreflight, OK: false}, {Name: GateDualLock, OK: true}}, false},
		{"门 3 + 门 4 都过，门 6 备份失败（执行段内要留痕）", []GateResult{
			{Name: GateReleasePreflight, OK: true}, {Name: GateDualLock, OK: true},
			{Name: GateBackup, OK: false}}, true},
		{"门 3 + 门 4 都过，构建 / 健康门失败", []GateResult{
			{Name: GateReleasePreflight, OK: true}, {Name: GateDualLock, OK: true},
			{Name: GateBackup, OK: true}}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rep := ReleaseReport{Gates: c.gates}
			if got := ShouldRecord(rep); got != c.want {
				t.Fatalf("ShouldRecord=%v，期望 %v", got, c.want)
			}
		})
	}
}

func TestBuildReleaseEventProjection(t *testing.T) {
	cfg := ReleaseConfig{Server: "k3", Timestamp: "20261111-221000"}
	now := time.Date(2026, 11, 11, 22, 10, 0, 0, time.FixedZone("CST", 8*3600))

	ok := ReleaseReport{Server: "k3", Scope: ScopeAll, ReleaseVersion: "1.16.1",
		ReleaseNote: "冒烟", ImageTag: "abc1234", Completed: true}
	ev := BuildReleaseEvent(ok, cfg, now)
	if ev.Kind != KindRelease || ev.Result != ResultSuccess || ev.FailedStage != "" {
		t.Fatalf("成功事件投影不对：%+v", ev)
	}
	if ev.OnlineVersion != "未采集" || ev.Bump != "" {
		t.Errorf("线上版本未采集要如实写、bump 不由 CLI 推算：%+v", ev)
	}
	if ev.TaskID != "cli-20261111-221000-k3" || ev.TS != "2026-11-11T22:10:00+08:00" {
		t.Errorf("task_id / ts 不对：%+v", ev)
	}

	failed := ok
	failed.Completed = false
	failed.FailedStage = StageHealth
	f2 := BuildReleaseEvent(failed, cfg, now)
	if f2.Result != ResultFailed || f2.FailedStage != StageHealth {
		t.Fatalf("失败事件要带停在哪个阶段：%+v", f2)
	}
}

// ---------- append-only ----------

func TestAppendReleaseIsAppendOnly(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ReleaseLogFile)
	first := testEvent()
	second := testEvent()
	second.TS = "2026-11-11T22:20:00+08:00"
	second.ReleaseVersion = "1.16.2"
	second.Result = ResultFailed
	second.FailedStage = StageBuild
	if err := AppendRelease(path, first); err != nil {
		t.Fatal(err)
	}
	if err := AppendRelease(path, second); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(string(b)), "\n")
	if len(lines) != 2 {
		t.Fatalf("两次 append 应得到两行，实际 %d", len(lines))
	}
	var gotFirst ReleaseEvent
	if err := json.Unmarshal([]byte(lines[0]), &gotFirst); err != nil {
		t.Fatal(err)
	}
	if gotFirst.ReleaseVersion != "1.16.1" || gotFirst.Result != ResultSuccess {
		t.Errorf("旧行被覆盖 / 改写了：%+v", gotFirst)
	}
	if runtime.GOOS != "windows" {
		st, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if st.Mode().Perm() != 0o600 {
			t.Errorf("台账权限应 0600，实际 %o", st.Mode().Perm())
		}
	}
}

func TestAppendReleaseRejectsIncompleteRecord(t *testing.T) {
	path := filepath.Join(t.TempDir(), ReleaseLogFile)
	cases := []struct {
		name string
		mut  func(*ReleaseEvent)
	}{
		{"失败却没写停在哪个阶段", func(e *ReleaseEvent) {
			e.Result, e.FailedStage = ResultFailed, ""
		}},
		{"kind 不是已定枚举", func(e *ReleaseEvent) { e.Kind = "resend" }},
		{"result 不是已定枚举", func(e *ReleaseEvent) { e.Result = "running" }},
		{"缺 server", func(e *ReleaseEvent) { e.Server = "" }},
		{"发版号非法", func(e *ReleaseEvent) { e.ReleaseVersion = "latest" }},
		{"备注含控制字符", func(e *ReleaseEvent) { e.Note = "a\x00b" }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ev := testEvent()
			c.mut(&ev)
			if err := AppendRelease(path, ev); err == nil {
				t.Error("不完整的记录不该落盘")
			}
		})
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Error("被拒的记录不该创建台账文件")
	}
}

// ---------- 只读历史：空数组红线 ----------

func TestReadReleaseHistoryEmptyShapes(t *testing.T) {
	dir := t.TempDir()
	missing := filepath.Join(dir, "missing.jsonl")
	h := ReadReleaseHistory(missing, "")
	if !h.OK || h.Data.Error == "" || h.Data.Items == nil || len(h.Data.Items) != 0 {
		t.Fatalf("文件不存在应回 ok=true + data.error + items:[]：%+v", h)
	}
	if _, err := os.Stat(missing); !os.IsNotExist(err) {
		t.Error("只读历史不该创建台账文件")
	}

	empty := filepath.Join(dir, "empty.jsonl")
	if err := os.WriteFile(empty, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	h2 := ReadReleaseHistory(empty, "")
	if !h2.OK || h2.Data.Error != "" || len(h2.Data.Items) != 0 {
		t.Fatalf("空文件是正常空视图，不该报 error：%+v", h2)
	}

	broken := filepath.Join(dir, "broken.jsonl")
	if err := os.WriteFile(broken, []byte("{not-json}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	h3 := ReadReleaseHistory(broken, "")
	if !h3.OK || h3.Data.Error == "" || len(h3.Data.Items) != 0 {
		t.Fatalf("解析失败也应回空数组：%+v", h3)
	}
	if !strings.Contains(h3.Data.Error, "第 1 行") {
		t.Errorf("解析失败要能定位到行：%q", h3.Data.Error)
	}

	// 🔴 任何失败形态编 JSON 后都必须是 "items":[]，不是 null，也不是 ok:false。
	for _, h := range []ReleaseHistory{h, h2, h3} {
		b, err := json.Marshal(h)
		if err != nil {
			t.Fatal(err)
		}
		s := string(b)
		if !strings.Contains(s, `"ok":true`) || !strings.Contains(s, `"items":[]`) ||
			strings.Contains(s, `"items":null`) || strings.Contains(s, `"ok":false`) {
			t.Errorf("违反白屏红线：%s", s)
		}
	}
}

func TestReadReleaseHistoryFilterAndOrder(t *testing.T) {
	path := filepath.Join(t.TempDir(), ReleaseLogFile)
	for _, e := range []ReleaseEvent{
		{TS: "2026-11-11T22:10:00+08:00", Server: "k3", Scope: ScopeAll, Kind: KindRelease,
			OnlineVersion: "未采集", ReleaseVersion: "1.16.1", ImageTag: "aaa1111",
			Result: ResultSuccess, TaskID: "cli-t1-k3"},
		{TS: "2026-11-11T22:30:00+08:00", Server: "k4", Scope: ScopeAll, Kind: KindRelease,
			OnlineVersion: "1.16.2", ReleaseVersion: "1.16.3", ImageTag: "bbb2222",
			Result: ResultFailed, FailedStage: StageHealth, TaskID: "cli-t3-k4"},
		{TS: "2026-11-11T22:20:00+08:00", Server: "k3", Scope: ScopeAll, Kind: KindRelease,
			OnlineVersion: "1.16.1", ReleaseVersion: "1.16.2", ImageTag: "ccc3333",
			Result: ResultSuccess, TaskID: "cli-t2-k3"},
	} {
		// 直接造历史行，测的是只读投影而不是 append 校验。
		b, _ := json.Marshal(e)
		f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0o600)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = f.Write(append(b, '\n'))
		_ = f.Close()
	}
	all := ReadReleaseHistory(path, "")
	if len(all.Data.Items) != 3 || all.Data.Items[0].ReleaseVersion != "1.16.3" ||
		all.Data.Items[2].ReleaseVersion != "1.16.1" {
		t.Fatalf("应按 ts 倒序：%+v", all.Data.Items)
	}
	k3 := ReadReleaseHistory(path, "k3")
	if len(k3.Data.Items) != 2 || k3.Data.Server != "k3" {
		t.Fatalf("按 server 筛选不对：%+v", k3)
	}
	for _, e := range k3.Data.Items {
		if e.Server != "k3" {
			t.Errorf("混进了别的机器：%+v", e)
		}
	}
	none := ReadReleaseHistory(path, "prod")
	if len(none.Data.Items) != 0 || none.Data.Items == nil {
		t.Errorf("筛不到也要是空数组而不是 null：%+v", none)
	}
	if resultLabel(ReleaseEvent{Kind: KindRollback, Result: ResultSuccess}) != "回滚" {
		t.Error("回滚徽标要按 kind 优先，不能混进成功数")
	}
}

// ---------- CLI 与只读采集 ----------

func TestParseDeployArgsReleases(t *testing.T) {
	got, err := parseDeployArgs([]string{"releases", "--server", "k3", "--json"})
	if err != nil {
		t.Fatal(err)
	}
	if !got.Releases || got.Release || got.DryRun || got.Server != "k3" || !got.JSON {
		t.Fatalf("releases 参数解析不对：%+v", got)
	}
	if _, err := parseDeployArgs([]string{"releases", "--dry-run"}); err == nil ||
		!strings.Contains(err.Error(), "--dry-run") {
		t.Errorf("releases 不该接受 --dry-run：%v", err)
	}
	if _, err := parseDeployArgs([]string{"releases", "--confirm", "yes"}); err == nil {
		t.Error("releases 不该接受发布参数")
	}
	// release / releases 是两个动词，不能互相吞掉。
	r, err := parseDeployArgs([]string{"release", "--server=k3", "--confirm=yes", "--config-dir=cfg", "--release-version=1.16.1"})
	if err != nil || !r.Release || r.Releases {
		t.Fatalf("release 动词被 releases 干扰：%+v / %v", r, err)
	}
}

func TestReleasePreflightCollectsOnlineVersionReadonly(t *testing.T) {
	s := releasePreflightScript(DefaultRemoteDir)
	if !strings.Contains(s, "SEC online_version=") {
		t.Error("只读预检应顺带采集线上版本号（§10.1）")
	}
	for _, forbidden := range []string{"sed -i", ">>", "tee ", "docker build", "compose up", "rm -f"} {
		if strings.Contains(s, forbidden) {
			t.Errorf("采集线上版本号不能带写动作 %q", forbidden)
		}
	}
	g := parseReleasePreflight(fullGateText())
	for _, b := range g.Blockers {
		if strings.Contains(b, "online_version") {
			t.Errorf("线上版本号是只读元信息，不该成为 blocker：%s", b)
		}
	}
	if g.OnlineVersion == "" || g.OnlineVersion == "—" {
		t.Errorf("有 RELEASE_VERSION 时应采集，实际 %q", g.OnlineVersion)
	}
	absent := parseReleasePreflight(strings.Replace(fullGateText(),
		"SEC online_version=1.16.0", "SEC online_version=—", 1))
	if absent.OnlineVersion != "未采集" {
		t.Errorf("文件不存在 / 没写版本号要如实「未采集」，不猜 0：%q", absent.OnlineVersion)
	}
}

// 端到端串联（纯函数链，不连真机）：报告 → 入账判据 → 事件 → append → 只读历史读回。
func TestReleaseReportToLedgerToHistory(t *testing.T) {
	cfg := testReleaseConfig(t)
	ledger := filepath.Join(t.TempDir(), ReleaseLogFile)
	now := time.Date(2026, 11, 11, 22, 10, 0, 0, time.FixedZone("CST", 8*3600))

	okRep := RunRelease(context.Background(), cfg, &fakeRunner{})
	if !okRep.Completed || !ShouldRecord(okRep) {
		t.Fatalf("成功报告应入账：%+v", okRep)
	}
	if err := AppendRelease(ledger, BuildReleaseEvent(okRep, cfg, now)); err != nil {
		t.Fatal(err)
	}

	// 门 3 之前的失败（预检不通过）与门 4 撞锁（§11.2）都不该产生任何记录。
	blocked := &fakeRunner{gateText: "SEC gate_proto=1\nSEC env=missing\nSEC end=1\n"}
	badRep := RunRelease(context.Background(), cfg, blocked)
	if ShouldRecord(badRep) {
		t.Error("预检不通过不该入账")
	}
	locked := &fakeRunner{failContains: "LOCK_OK"}
	lockRep := RunRelease(context.Background(), cfg, locked)
	if lockRep.FailedStage != StagePreflight || ShouldRecord(lockRep) {
		t.Errorf("门 4 撞锁应停在预检且不入账：%+v", lockRep)
	}

	// 门 3 之后停在健康门的失败也要留一条，并带 failed_stage。
	failing := &fakeRunner{healthCodes: []int{404}}
	failRep := RunRelease(context.Background(), cfg, failing)
	if failRep.Completed || !ShouldRecord(failRep) || failRep.FailedStage != StageHealth {
		t.Fatalf("健康门失败应入账并带停点：%+v", failRep)
	}
	if err := AppendRelease(ledger, BuildReleaseEvent(failRep, cfg, now.Add(time.Minute))); err != nil {
		t.Fatal(err)
	}

	h := ReadReleaseHistory(ledger, "")
	if !h.OK || len(h.Data.Items) != 2 {
		t.Fatalf("应读出 2 条（成功 + 失败），实际 %+v", h)
	}
	if h.Data.Items[0].Result != ResultFailed || h.Data.Items[0].FailedStage != StageHealth {
		t.Errorf("最新一条应是停在健康门的失败：%+v", h.Data.Items[0])
	}
	if h.Data.Items[1].Result != ResultSuccess {
		t.Errorf("较早一条应是成功：%+v", h.Data.Items[1])
	}
}

func TestRunReleaseCarriesOnlineVersion(t *testing.T) {
	cfg := testReleaseConfig(t)
	rep := RunRelease(context.Background(), cfg, &fakeRunner{})
	if !rep.Completed {
		t.Fatalf("基线报告应跑通：%+v", rep)
	}
	if rep.OnlineVersion == "" || rep.OnlineVersion == "—" {
		t.Errorf("报告要带上只读采集的线上版本号：%q", rep.OnlineVersion)
	}
	if ShouldRecord(rep) != true {
		t.Error("跑通的报告应该入账")
	}
	b, err := json.Marshal(rep)
	if err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{`"online_version"`, `"ledger_recorded"`, `"ledger_error"`} {
		if !strings.Contains(string(b), k) {
			t.Errorf("JSON 报告缺字段 %s", k)
		}
	}
}
