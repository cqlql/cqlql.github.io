package main

// P3b-3：ui.DeployAPI 的唯一实现（根包适配层）。
//
// 🔴 依赖方向 main → ui → shared，另有 main → deploy；ui **不 import deploy**，
//    所以预演 / 发布 / 历史 / 校验都从这里注入，与 backuprun.go 的 BackupRunner 同构。
// 🔴 不另算指标、不另起采集：只读预演与 CLI 共用 buildDryRunPlan，发布主链路
//    与 CLI 共用 RunReleaseWith（六道门 / 六阶段 / 台账 append），历史复用 P3b-2 投影。
// 🔴 不写远端 state.env、0 新键、不做 P4 回滚；界面不接受任意本机路径。

import (
	"pass-up/ops/internal/deploy"
	"pass-up/ops/internal/ui"
)

import (
	"context"
	"encoding/json"
	"time"
)

type deployAPI struct{}

func newDeployAPI() ui.DeployAPI { return &deployAPI{} }

func (a *deployAPI) Stages() []string           { return deploy.StageNames() }
func (a *deployAPI) ValidScope(s string) bool   { return deploy.ValidScope(s) }
func (a *deployAPI) ValidBump(s string) bool    { return deploy.ValidBump(s) }
func (a *deployAPI) Validate(v, n string) error { return deploy.ValidateRelease(v, n) }
func (a *deployAPI) Plan(server, scope string) json.RawMessage {
	return deploy.UIPlanJSON(server, scope)
}
func (a *deployAPI) History(server string) json.RawMessage {
	return deploy.UIHistoryJSON(server)
}
func (a *deployAPI) Precheck(server, scope string) (bool, string) {
	return deploy.UIPrecheck(server, scope)
}

// Release 跑在界面后台 goroutine 里，脱离 HTTP 请求；emit 把报告里已有的行
// 实时投给界面任务日志与阶段条。报告仍是唯一事实源。
func (a *deployAPI) Release(req ui.DeployReleaseRequest, taskID string, emit func(ui.DeployEvent)) (json.RawMessage, int) {
	ctx, cancel := context.WithTimeout(context.Background(), releaseTimeoutForUI())
	defer cancel()

	forward := func(ev deploy.ProgressEvent) {
		if emit == nil {
			return
		}
		emit(ui.DeployEvent{
			Kind: string(ev.Kind), Name: ev.Name, Stage: ev.Stage,
			Detail: ev.Detail, Completed: ev.Completed,
		})
	}
	rep, err := deploy.RunReleaseForUI(ctx, deploy.UIReleaseInput{
		Server: req.Server, Scope: req.Scope,
		ReleaseVersion: req.ReleaseVersion, ReleaseNote: req.ReleaseNote,
		Bump: req.Bump, TaskID: taskID,
	}, forward)
	if err != nil {
		// 门禁 / 前置没过：没有开始执行，回一份所有数组恒为 [] 的最小报告。
		b, _ := json.Marshal(map[string]any{
			"server": req.Server, "scope": req.Scope,
			"release_version": req.ReleaseVersion,
			"online_version":  "未采集",
			"completed":       false,
			"error":           err.Error(),
			"note":            "门禁或发布前置未过，本次没有开始执行；远端没有被修改、台账没有记录。",
			"gates":           []any{}, "stages": []any{}, "log": []string{},
			"warnings": []string{}, "images": []string{},
			"ledger_recorded": false, "ledger_error": "", "duration_ms": 0,
		})
		return b, 2
	}
	b, mErr := json.Marshal(rep)
	if mErr != nil {
		b, _ = json.Marshal(map[string]any{
			"completed": false, "error": "报告编码失败：" + mErr.Error(),
			"note":  "报告编码失败，请看任务日志；不猜结果、不写「发布成功」。",
			"gates": []any{}, "stages": []any{}, "log": []string{},
			"warnings": []string{}, "images": []string{},
		})
		return b, 1
	}
	if rep.Completed {
		return b, 0
	}
	return b, 1
}

// releaseTimeoutForUI 与 CLI 的 releaseTimeout 同源（30 分钟），不在根包再抄一个数字。
func releaseTimeoutForUI() time.Duration { return deploy.UIReleaseTimeout() }
