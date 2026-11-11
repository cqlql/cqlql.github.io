package deploy

// P3b-3 进度钩子与界面同源投影的单测：不连真机、不写远端、不写台账。
// 复用了 deploy_release_test.go 的 fakeRunner / testReleaseConfig。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestRunReleaseWithEmitsProgress(t *testing.T) {
	var events []ProgressEvent
	f := &fakeRunner{remoteSize: -1}
	rep := RunReleaseWith(context.Background(), testReleaseConfig(t), f, func(ev ProgressEvent) {
		events = append(events, ev)
	})
	if !rep.Completed {
		t.Fatalf("全绿链路应跑完：failed=%q err=%q", rep.FailedStage, rep.Error)
	}
	kinds := map[ProgressKind]int{}
	var logs []string
	done := 0
	for _, ev := range events {
		kinds[ev.Kind]++
		if ev.Kind == ProgressLog {
			logs = append(logs, ev.Detail)
		}
		if ev.Kind == ProgressDone {
			done++
			if !ev.Completed {
				t.Error("done 事件要带 completed=true")
			}
		}
	}
	if kinds[ProgressGate] == 0 || kinds[ProgressStage] == 0 || kinds[ProgressLog] == 0 {
		t.Fatalf("门禁 / 阶段 / 日志事件缺失：%+v", kinds)
	}
	if done != 1 {
		t.Errorf("done 事件应恰好一条，实得 %d", done)
	}
	// 🔴 事件只是报告行的实时投影：日志事件必须与 rep.Log 逐字一致，不许另算一套。
	if strings.Join(logs, "\n") != strings.Join(rep.Log, "\n") {
		t.Errorf("进度日志与最终报告不一致：events=%d rep.Log=%d", len(logs), len(rep.Log))
	}
	// CLI 的 RunRelease（nil 钩子）报告结构不变。
	plain := RunRelease(context.Background(), testReleaseConfig(t), &fakeRunner{remoteSize: -1})
	if len(plain.Stages) != len(rep.Stages) || len(plain.Gates) != len(rep.Gates) ||
		plain.Completed != rep.Completed || plain.DurationMS < 0 {
		t.Errorf("带钩子与不带钩子的报告结构漂移：plain=%+v hooked=%+v", plain, rep)
	}
}

func TestRunReleaseWithFailEmitsFailAndDone(t *testing.T) {
	var events []ProgressEvent
	// testReleaseConfig 是 --no-build 快路径；要测失败停点得把默认构建打开。
	cfg := testReleaseConfig(t)
	cfg.NoBuild = false
	f := &fakeRunner{remoteSize: -1, failContains: "docker build"}
	rep := RunReleaseWith(context.Background(), cfg, f, func(ev ProgressEvent) {
		events = append(events, ev)
	})
	if rep.Completed {
		t.Fatal("注入构建失败后不该 completed")
	}
	hasFail, hasDone := false, false
	for _, ev := range events {
		if ev.Kind == ProgressFail && ev.Stage == StageBuild {
			hasFail = true
		}
		if ev.Kind == ProgressDone {
			hasDone = true
			if ev.Completed {
				t.Error("失败时 done 事件不许标 completed=true")
			}
		}
	}
	if !hasFail || !hasDone {
		t.Errorf("失败链路要有 fail + done 事件：%+v", events)
	}
}

func TestProgressHookPanicDoesNotBreakRelease(t *testing.T) {
	// 界面写日志是旁路：回调 panic 不许把发布主链路带走。
	rep := RunReleaseWith(context.Background(), testReleaseConfig(t), &fakeRunner{remoteSize: -1},
		func(ProgressEvent) { panic("界面日志挂了") })
	if !rep.Completed {
		t.Errorf("钩子 panic 不该影响发布结果：failed=%q err=%q", rep.FailedStage, rep.Error)
	}
}

func TestEmptyPlanAndUIViewsKeepArrays(t *testing.T) {
	b := withError(MarshalPlan(EmptyPlan("k2", "all", "连不上目标机")), "连不上目标机")
	var m map[string]json.RawMessage
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"alignments", "commands", "impact"} {
		if string(m[k]) != "[]" {
			t.Errorf("%s 必须是 []，实得 %s", k, m[k])
		}
	}
	// warnings / blockers 要带上失败原因，但必须是数组而不是 null。
	for _, k := range []string{"warnings", "blockers"} {
		var arr []string
		if err := json.Unmarshal(m[k], &arr); err != nil || arr == nil {
			t.Errorf("%s 必须是非 null 数组，实得 %s", k, m[k])
		}
	}
	var checks map[string]json.RawMessage
	if err := json.Unmarshal(m["preflight"], &checks); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"checks", "blockers", "warnings"} {
		if string(checks[k]) != "[]" {
			t.Errorf("preflight.%s 必须是 []，实得 %s", k, checks[k])
		}
	}
	if string(m["available"]) != "false" {
		t.Errorf("失败视图不能标 available=true：%s", m["available"])
	}
	if string(m["error"]) != `"连不上目标机"` {
		t.Errorf("失败原因缺失：%s", m["error"])
	}
}

func TestUIPlanAndHistoryJSON(t *testing.T) {
	t.Setenv(shared.ConfigDirEnv, t.TempDir())
	// 未知范围不连远端，就地回完整空视图。
	plan := UIPlanJSON("k2", "ghost")
	if !strings.Contains(string(plan), `"available":false`) || !strings.Contains(string(plan), "未知发布范围") {
		t.Errorf("非法范围要回完整空视图 + error：%s", plan)
	}
	h := UIHistoryJSON("k2")
	if !strings.Contains(string(h), `"items":[]`) {
		t.Errorf("台账不存在时 items 必须是 []：%s", h)
	}
	if !strings.Contains(string(h), "台账文件不存在") {
		t.Errorf("台账不存在要如实说明，不猜、不补写：%s", h)
	}
}

func TestUIValidatorsAndFixedConfigDir(t *testing.T) {
	if got := StageNames(); len(got) != 6 || got[0] != StagePreflight || got[5] != StageHealth {
		t.Errorf("六阶段名字表不对：%v", got)
	}
	for _, s := range []string{"all", "infra", "ai", "backend", "web"} {
		if !ValidScope(s) {
			t.Errorf("ValidScope 不认 %q", s)
		}
	}
	if ValidScope("../../etc") {
		t.Error("范围白名单不能放行任意串")
	}
	for _, b := range []string{"", "major", "minor", "patch", "manual"} {
		if !ValidBump(b) {
			t.Errorf("ValidBump 不认 %q", b)
		}
	}
	if ValidBump("rm -rf") {
		t.Error("更新类型白名单不能放行任意串")
	}
	// 🔴 配置目录固定由服务端解析：不来自请求、不是可配项、不在 ops.env。
	if a, b := UIDefaultConfigDir(), UIDefaultConfigDir(); a != b || a == "" {
		t.Errorf("配置目录必须是稳定的固定规则：%q / %q", a, b)
	}
	if !strings.Contains(UIDefaultConfigDir(), "deploy") {
		t.Errorf("配置目录应落在配置目录的 deploy/ 下：%q", UIDefaultConfigDir())
	}
}

func TestUIPrecheckRejectsMissingLocalEnvWithoutReadingIt(t *testing.T) {
	t.Setenv(shared.ConfigDirEnv, t.TempDir())
	// 🔴 本机前置排在最前：没备好 .env 时立刻返回，不连远端、不读值、不打印。
	ok, detail := UIPrecheck("k2", "all")
	if ok {
		t.Fatal("缺配置时预检门必须挡住")
	}
	if !strings.Contains(detail, "缺 .env") {
		t.Errorf("挡住时要点名缺哪一项：%q", detail)
	}
}
