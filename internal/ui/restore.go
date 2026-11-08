package ui

// 界面「备份恢复」页的只读接口 + 写动作门禁（写任务仍走 POST /api/backup/run）。
//
// 🔴 候选 / 计划都只读：不占任务锁、不要 confirm、不写远端、不提权、不读 crontab；
//    「停定时备份」只是本机表单状态（cron_confirmed），不是采集事实（分册 §5.0 R1）。
// 🔴 换选中行 = 重新请求一次 /api/restore/plan：服务端重新采集并自己算 available /
//    全局 blockers / 候选行 row_blockers，前端只渲染（R3）。
// 🔴 执行复用**同一把** backupTask 锁与增量日志：恢复与备份 / 部署 / 装依赖 / 重启
//    互斥（409），任务脱离 HTTP 请求、日志按行脱敏、界面不开放任意路径与 sudo 密码。
// 🔴 恢复是覆盖生产数据的写动作：门禁字段由界面传、CLI 逐字再验一次，
//    界面「预演」不是执行凭证，服务端每次写动作前自己再跑 --dry-run（R4）。

import (
	"pass-up/ops/internal/restore"
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// restoreProbe 是「真正去连远端只读采集」那一层的注入缝：默认走 restore 包，
// 单测塞假实现，全项目不写需要真实 SSH 的单测。
type restoreProbe func(cfg *shared.Config, list *shared.ServerList, name, component string) (restore.Snapshot, error)

func defaultRestoreProbe(cfg *shared.Config, list *shared.ServerList, name, component string) (restore.Snapshot, error) {
	// 故意不用 r.Context()：刷新 / 切走标签页不该掐断一次只读采集；
	// restore.Collect 自带 60s 总超时。
	return restore.CollectForServer(context.Background(), cfg, list, name, component)
}

// restoreReadGate 是只读接口共同的选机门：严格 LoadConfig（硬约束 26 ⑤），
// name 只认清单，配置错也回 200 + 完整空快照，不把整页打白。
func (u *uiState) restoreReadGate(name, component string) (*shared.Config, *shared.ServerList, restore.Snapshot, int, string) {
	cfg, err := shared.LoadConfig()
	if err != nil {
		return nil, nil, restore.FailureSnapshot(name, component, "读取本机 ops.env 失败："+err.Error()), 0, ""
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		return nil, nil, restore.FailureSnapshot(name, component, "读取服务器清单失败："+err.Error()), 0, ""
	}
	if _, err := list.Get(name); err != nil {
		return nil, nil, restore.Snapshot{}, http.StatusNotFound, err.Error()
	}
	return cfg, list, restore.Snapshot{}, 0, ""
}

func (u *uiState) collectRestore(cfg *shared.Config, list *shared.ServerList, name, component string) restore.Snapshot {
	probe := u.restoreProbe
	if probe == nil {
		probe = defaultRestoreProbe
	}
	snap, err := probe(cfg, list, name, component)
	if err != nil {
		return restore.FailureSnapshot(name, component, err.Error())
	}
	return snap
}

func (u *uiState) handleRestoreCandidates(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	component := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("component")))
	if name == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if !restore.ValidComponent(component) {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知组件（可选 pg / minio）"})
		return
	}
	cfg, list, fail, code, msg := u.restoreReadGate(name, component)
	if code != 0 {
		writeAPI(w, code, apiResponse{Error: msg})
		return
	}
	if fail.Error != "" {
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: fail})
		return
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: u.collectRestore(cfg, list, name, component)})
}

func (u *uiState) handleRestorePlan(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	name := strings.TrimSpace(q.Get("name"))
	component := strings.ToLower(strings.TrimSpace(q.Get("component")))
	if name == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if !restore.ValidComponent(component) {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知组件（可选 pg / minio）"})
		return
	}
	candidate := strings.TrimSpace(q.Get("candidate"))
	db := strings.TrimSpace(q.Get("db"))
	if db == "" {
		db = restore.DefaultTestDB
	}
	if candidate != "" && !restore.ValidCandidateID(candidate) {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "候选 ID 不合法：只认备份根目录下本次采集到的相对路径 / 桶名"})
		return
	}
	if component == restore.CompPG && !restore.ValidDB(db) {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "目标库名不合法"})
		return
	}
	cfg, list, fail, code, msg := u.restoreReadGate(name, component)
	if code != 0 {
		writeAPI(w, code, apiResponse{Error: msg})
		return
	}
	snap := fail
	if fail.Error == "" {
		snap = u.collectRestore(cfg, list, name, component)
	}
	plan := restore.BuildPlan(snap, restore.PlanRequest{
		Server:        name,
		Component:     component,
		CandidateID:   candidate,
		DB:            db,
		CronConfirmed: q.Get("cron_confirmed") == "1",
		Busy:          u.backupBusy(),
	})
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: plan})
}

// checkRestoreChecks 把界面三个前置勾选翻成 --checks 1,1,1。
// 缺一项就在 HTTP 层挡下，正式执行时 CLI 的 ValidateGate 还会再验一次。
func checkRestoreChecks(v []bool) ([3]bool, error) {
	var out [3]bool
	if len(v) != 3 {
		return out, errors.New("三项前置确认必须全部勾选（已停写 / 已停定时备份 / 已留现场）")
	}
	for i, b := range v {
		if !b {
			return out, errors.New("三项前置确认没有勾全；这是人的声明，工具不会替你验证")
		}
		out[i] = true
	}
	return out, nil
}

// validateRestoreRunRequest 是界面写动作的纯字面量校验（不连远端）。
// CLI 的 ValidateGate 仍是最后一道门：前端绕过这里也过不了正式执行。
func validateRestoreRunRequest(mode BackupMode, req backupRunRequest, component string) (restore.Gate, error) {
	g := restore.Gate{
		Component:       component,
		CandidateID:     req.RestoreCandidate,
		DB:              req.RestoreDB,
		DB2:             req.RestoreDB2,
		Confirm:         req.Confirm,
		MinioConfirm:    req.RestoreMinioConfirm,
		CronConfirmed:   req.RestoreCronConfirmed,
		CoverProduction: req.RestoreCoverProduction,
		Password:        req.Password,
	}
	if g.DB == "" {
		g.DB = restore.DefaultTestDB
	}
	if g.Password != "" {
		return g, errors.New("恢复不提权，不接受 sudo 密码")
	}
	if !restore.ValidCandidateID(g.CandidateID) {
		return g, errors.New("候选 ID 不合法：只认本次采集到的相对路径 / 桶名，不接受任意路径")
	}
	if mode == backupRestoreDry {
		// 只读预演不需要门禁（但 candidate / db / password 这几道白名单仍要过）。
		if component == restore.CompPG && !restore.ValidDB(g.DB) {
			return g, errors.New("目标库名不合法")
		}
		return g, nil
	}
	checks, err := checkRestoreChecks(req.RestoreChecks)
	if err != nil {
		return g, err
	}
	g.Checks = checks
	if !g.CronConfirmed {
		return g, errors.New("未确认已停定时备份：工具不读 crontab、不自动停任务，请人在页面显式勾选")
	}
	if err := restore.ValidateGateLiterals(g); err != nil {
		return g, err
	}
	return g, nil
}

// restoreCommandArgs 把界面门禁字段原样映射成 CLI 白名单参数。
// 服务端写动作会先跑同一条命令 + --dry-run（runBackupTask 的预检门），
// 预演本身（mode=restore-dry）只带只读参数，不带 confirm / checks。
func restoreCommandArgs(mode BackupMode, req backupRunRequest, component, db string) []string {
	args := []string{"restore", "run", "--server", req.Name, "--component", component,
		"--candidate", req.RestoreCandidate}
	if component == restore.CompPG {
		args = append(args, "--db", db, "--db-confirm", req.RestoreDB2)
	} else if req.RestoreMinioConfirm != "" {
		args = append(args, "--minio-confirm", req.RestoreMinioConfirm)
	}
	if req.RestoreCronConfirmed {
		args = append(args, "--cron-confirmed")
	}
	if mode == backupRestoreDry {
		return append(args, "--dry-run")
	}
	args = append(args, "--confirm", req.Confirm, "--checks", "1,1,1")
	if req.RestoreCoverProduction {
		args = append(args, "--cover-production")
	}
	return args
}

// appendRestoreReport 把任务日志如实翻成一句结论（分册 §5.4 / R5）。
// 🔴 报告只报脚本结果：不许写「恢复成功，服务正常」；Flyway / 应用健康是人工步骤。
func appendRestoreReport(lw io.Writer, t *backupTask, code int) {
	log := t.view(0).Log
	switch {
	case strings.Contains(log, "超过 30 分钟上限"):
		fmt.Fprintln(lw, "==> 报告：本机已停止等待（30 分钟上限），远端恢复脚本可能仍在执行；本机没有终止远端脚本，也不会自动重试 / 自动清场。请去备份机核对脚本输出与生产端状态。")
	case code != 0:
		fmt.Fprintln(lw, "==> 报告：恢复任务未成功，停在日志里的失败阶段；失败步骤 / 失败桶见上面的脚本输出。没有自动重试、没有自动清场、没有改 last_success.txt 心跳。")
	default:
		fmt.Fprintln(lw, "==> 报告：恢复脚本退出 0（只报脚本结果）。数据已写入生产端，但工具不判断应用是否可用。")
	}
	fmt.Fprintln(lw, "⚠️ 应用可用性 / Flyway schema 兼容性 / 关键表与对象核对是 §3.3 的人工步骤；旧 dump 落后时需前向修复，不许假装服务正常。")
	fmt.Fprintln(lw, "⚠️ 恢复是「补齐 + 覆盖」不是精确回滚；多余对象保留、由人比对。工具不读 / 不改 crontab，请按 §3.0 装回两条定时任务后再看只读的备份监控页。")
}
