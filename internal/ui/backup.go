package ui

// 界面上的备份能力部署：预检（--dry-run）/ 安装 / 远端自检。
//
// 🔴 这是界面里**第二个写操作**，边界比「一键免密 sudo」更严（docs/ui.md §9）：
//   - 安装必须 `confirm == "yes"`，且服务端自己先跑一遍 --dry-run，预检不过就不安装；
//   - 目标机只认 servers.json 里的 name，未知 name 直接 404，不接受任意 host；
//   - sudo 密码只在本次请求的内存里，经子进程 stdin 交给 CLI，不落盘、不进日志；
//   - 任务脱离 HTTP 请求运行：刷新页面不会打断已经开始的远端安装；
//   - 一台机器同时只跑一个任务（409），界面不开放 --force/--run-now/--install-deps；
//   - 2026-11-07 起另有 mode=deps：只装缺失命令（mc / pg_restore 等），等价于
//     独立的 `ops backup deps`，同样要 confirm==yes + 服务端 --dry-run（见 deps.go）。
//
// 执行器 BackupRunner 由 main 注入（ui 不能 import backup），日志经 backupLogWriter
// 回流到页面，写入时按行脱敏，避免任何远端回显把密码带进任务日志。

import (
	"pass-up/ops/internal/restore"
)

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// BackupRunner 执行一条 backup 子命令；args 不含 "backup" 前缀。
// 返回进程退出码，输出（stdout + stderr）写进 out。由 main.go 注入，测试塞假实现。
type BackupRunner func(args []string, password string, out io.Writer) int

type BackupMode string

const (
	backupPreflight BackupMode = "preflight"
	backupDeploy    BackupMode = "deploy"
	backupVerify    BackupMode = "verify"
	// backupDeps 只装缺失依赖，不部署脚本：界面里是第五个写动作，
	// 与 deploy 共用同一把任务锁和同一道服务端预检门。
	backupDeps BackupMode = "deps"
	// backupDepsUninstall 只卸工具装的 mc / PG 客户端（供复测），
	// 同样走 confirm + 服务端 --dry-run + 任务锁，targets 另有白名单。
	backupDepsUninstall BackupMode = "deps-uninstall"
	// backupOnce 是「立即跑一次备份」：写模式，过同一把任务锁与同一个服务端
	// --dry-run 预检门，但不收 sudo 密码（root=false 不提权，见 docs/backup-once.md §3）。
	backupOnce BackupMode = "once"
	// backupOnceDry 是只读预演：只跑 preflight + 打印计划，不执行备份脚本。
	// 单独一个 mode 才能复用同一套任务日志 / 增量轮询，且不进写模式的 confirm 门。
	backupOnceDry BackupMode = "once-dry"
	// backupRestore 是「备份恢复」：覆盖生产数据的写动作，与上面共用同一把任务锁、
	// 同一个服务端 --dry-run 预检门，但门禁更严（库名两次 / YES / 三项前置 / 覆盖生产）。
	backupRestore BackupMode = "restore"
	// backupRestoreDry 是恢复页的只读预演：不写生产端、不需要 confirm、不进写模式。
	backupRestoreDry BackupMode = "restore-dry"
	// deployReleaseMode 是 P3b-3 应用部署正式发布：只用来占用界面唯一后台任务锁
	// 与复用增量日志，**不**进 parseBackupMode / isBackupWriteMode，
	// 免得被 POST /api/backup/run 当成可调用的备份模式。
	deployReleaseMode BackupMode = "deploy-release"
)

// 日志留在内存里给页面轮询；上限只是防止一个跑飞的子进程把界面进程撑爆。
const maxBackupLogBytes = 256 << 10

type backupTask struct {
	mu        sync.Mutex
	running   bool
	done      bool
	mode      BackupMode
	server    string
	component string
	log       bytes.Buffer
	truncated bool
	exitCode  int
	startedAt time.Time
	endedAt   time.Time
	// secret 只在任务运行期间存在：写日志时替换成 ***，任务结束立刻清空。
	secret string
}

type backupTaskView struct {
	Running   bool   `json:"running"`
	Done      bool   `json:"done"`
	Mode      string `json:"mode"`
	Server    string `json:"server"`
	Component string `json:"component"`
	ExitCode  int    `json:"exit_code"`
	Log       string `json:"log"`
	Next      int    `json:"next"`
	StartedAt string `json:"started_at,omitempty"`
	EndedAt   string `json:"ended_at,omitempty"`
}

func (t *backupTask) start(mode BackupMode, server, component, secret string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.running {
		return false
	}
	t.log.Reset()
	t.truncated = false
	t.running = true
	t.done = false
	t.mode = mode
	t.server = server
	t.component = component
	t.exitCode = 0
	t.startedAt = time.Now()
	t.endedAt = time.Time{}
	t.secret = secret
	return true
}

func (t *backupTask) append(s string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.secret != "" {
		s = strings.ReplaceAll(s, t.secret, "***")
	}
	if t.truncated {
		return
	}
	if t.log.Len()+len(s) > maxBackupLogBytes {
		remain := maxBackupLogBytes - t.log.Len()
		if remain > 0 {
			t.log.WriteString(s[:remain])
		}
		t.log.WriteString("\n[日志已达上限，后续输出已省略]\n")
		t.truncated = true
		return
	}
	t.log.WriteString(s)
}

func (t *backupTask) finish(code int) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.exitCode = code
	t.running = false
	t.done = true
	t.endedAt = time.Now()
	t.secret = ""
}

// view 返回从 after 字节之后的增量日志。after 由上一次响应的 next 给出，
// 所以切片边界永远落在上次的日志末尾，不会把中文截成半个字。
func (t *backupTask) view(after int) backupTaskView {
	t.mu.Lock()
	defer t.mu.Unlock()
	all := t.log.String()
	if after < 0 {
		after = 0
	}
	if after > len(all) {
		after = len(all)
	}
	v := backupTaskView{
		Running:   t.running,
		Done:      t.done,
		Mode:      string(t.mode),
		Server:    t.server,
		Component: t.component,
		ExitCode:  t.exitCode,
		Log:       all[after:],
		Next:      len(all),
	}
	if !t.startedAt.IsZero() {
		v.StartedAt = t.startedAt.Format(time.RFC3339)
	}
	if !t.endedAt.IsZero() {
		v.EndedAt = t.endedAt.Format(time.RFC3339)
	}
	return v
}

// backupLogWriter 按行转发，理由有两个：整行才做密码替换（不会漏掉跨 chunk 的一半），
// 并且切片边界落在换行处，不会把远端输出的 UTF-8 汉字切坏。
type backupLogWriter struct {
	mu   sync.Mutex
	buf  bytes.Buffer
	task *backupTask
}

func (w *backupLogWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	_, _ = w.buf.Write(p)
	for {
		line, err := w.buf.ReadString('\n')
		if err != nil {
			// ReadString 在 EOF 时返回剩余内容，放回去等下一块拼完整。
			_, _ = w.buf.WriteString(line)
			break
		}
		w.task.append(line)
	}
	return len(p), nil
}

func (w *backupLogWriter) Flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.buf.Len() > 0 {
		w.task.append(w.buf.String())
		w.buf.Reset()
	}
}

func (u *uiState) ensureTask() *backupTask {
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.task == nil {
		u.task = &backupTask{}
	}
	return u.task
}

func (u *uiState) backupBusy() bool {
	t := u.ensureTask()
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.running
}

type backupRunRequest struct {
	Mode      string `json:"mode"`
	Name      string `json:"name"`
	Component string `json:"component"`
	Password  string `json:"password"`
	Confirm   string `json:"confirm"`
	// PgMajor 只给 mode=deps：按 PGDG 官方仓库装 postgresql-client-<n>。
	// 0 / 省略 = 发行版仓库的 postgresql-client。字符集与范围由服务端再验一次。
	PgMajor int `json:"pg_major,omitempty"`
	// Targets 只给 mode=deps-uninstall：mc / pg_client，至少一个，服务端白名单再验一次。
	Targets []string `json:"targets,omitempty"`

	// ---- 仅 mode=restore / restore-dry：恢复门禁字段 ----
	// 🔴 全部由前端显式传，服务端先做字面量校验、CLI 的 ValidateGate 再逐字复核。
	//    candidate 只认本次采集到的 ID，db 有白名单，密码字段恒不接受。
	RestoreCandidate       string `json:"restore_candidate,omitempty"`
	RestoreDB              string `json:"restore_db,omitempty"`
	RestoreDB2             string `json:"restore_db2,omitempty"`
	RestoreMinioConfirm    string `json:"restore_minio_confirm,omitempty"`
	RestoreChecks          []bool `json:"restore_checks,omitempty"`
	RestoreCronConfirmed   bool   `json:"restore_cron_confirmed,omitempty"`
	RestoreCoverProduction bool   `json:"restore_cover_production,omitempty"`
}

func isRestoreMode(mode BackupMode) bool {
	return mode == backupRestore || mode == backupRestoreDry
}

func parseBackupMode(s string) (BackupMode, bool) {
	switch BackupMode(s) {
	case backupPreflight, backupDeploy, backupVerify, backupDeps, backupDepsUninstall,
		backupOnce, backupOnceDry, backupRestore, backupRestoreDry:
		return BackupMode(s), true
	default:
		return "", false
	}
}

// isBackupWriteMode 是 confirm 门与服务端预检门共用的判据。
// 🔴 两处都要用它（handleBackupRun / runBackupTask）：少一处就是「前端点了
// 预检才算数」或「漏掉 confirm」的漏门（docs/backup-once.md §3 六道门）。
func isBackupWriteMode(mode BackupMode) bool {
	return mode == backupDeploy || mode == backupDeps ||
		mode == backupDepsUninstall || mode == backupOnce || mode == backupRestore
}

// 组件白名单：CLI 的 parseComponents 还接受 postgres 等别名，界面只给这三个，
// 免得把「用户随手填的字符串」变成一条会改远端的命令参数。
func normalizeComponent(s string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "", "all":
		return "all", true
	case "pg", "minio":
		return strings.ToLower(strings.TrimSpace(s)), true
	default:
		return "", false
	}
}

func backupCommandArgs(mode BackupMode, name, component string) []string {
	switch mode {
	case backupPreflight:
		return []string{"deploy", component, "--server", name, "--dry-run"}
	case backupDeploy:
		return []string{"deploy", component, "--server", name}
	case backupDeps:
		// 独立的 `ops backup deps`：不传 --install-deps（那是 deploy 的附加开关，
		// 会顺带跑完整部署），也不开放 --force / --run-now。
		return []string{"deps", component, "--server", name}
	case backupDepsUninstall:
		// 卸载不接受组件参数（固定 all）；--target 由 handleBackupRun 按白名单追加。
		return []string{"deps-uninstall", "--server", name}
	case backupOnce:
		// 独立子命令：不传 --force / --run-now / --install-deps / --password-stdin。
		return []string{"once", component, "--server", name}
	case backupOnceDry:
		return []string{"once", component, "--server", name, "--dry-run"}
	default:
		return []string{"verify", component, "--server", name}
	}
}

// handleBackupRun 启动一个后台任务并立刻返回；日志由 GET /api/backup/task 轮询。
// 不用 r.Context()：浏览器刷新/关标签页绝不能把已经开始的远端安装掐断。
func (u *uiState) handleBackupRun(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求体过大"})
		return
	}
	var req backupRunRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求格式错误"})
		return
	}
	mode, ok := parseBackupMode(req.Mode)
	if !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知模式（可选 preflight / deploy / verify / deps / deps-uninstall / once / once-dry / restore / restore-dry）"})
		return
	}
	component, ok := normalizeComponent(req.Component)
	if !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知组件（可选 all / pg / minio）"})
		return
	}
	if isRestoreMode(mode) {
		// 恢复一次只处理一个组件、一个候选；不开放 all（脚本按组件各自跑）。
		if component == "all" {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: "恢复一次只处理一个组件（pg / minio），不开放 all"})
			return
		}
		if _, err := validateRestoreRunRequest(mode, req, component); err != nil {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
			return
		}
	}
	if strings.TrimSpace(req.Name) == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if isBackupWriteMode(mode) && req.Confirm != "yes" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "这是远端写操作：请输入 yes 确认"})
		return
	}
	// 🔴 手动备份以清单 user 跑（root=false 不提权）：界面不收 sudo 密码，
	//    也不把密码交给子进程 stdin（确认弹窗没有密码框，docs/backup-once.md §3 门④）。
	if (mode == backupOnce || mode == backupOnceDry) && req.Password != "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "手动备份不提权，不接受 sudo 密码"})
		return
	}
	// 🔴 --pg-major 只属于 deps，且只接受纯数字 1..99：它会拼进远端 apt 包名。
	if mode != backupDeps && req.PgMajor != 0 {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "pg_major 只用于安装缺少依赖（mode=deps）"})
		return
	}
	if req.PgMajor < 0 || req.PgMajor > 99 {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "pg_major 超出范围（1..99）"})
		return
	}
	// 🔴 targets 只属于 deps-uninstall，且必须由服务端按白名单裁决：
	//    「卸什么」绝不由前端字符串直接变成远端 rm / apt remove 的参数。
	if mode != backupDepsUninstall && len(req.Targets) > 0 {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "targets 只用于卸载备份依赖（mode=deps-uninstall）"})
		return
	}
	targets := []string{}
	if mode == backupDepsUninstall {
		var err error
		targets, err = normalizeUninstallTargets(req.Targets)
		if err != nil {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
			return
		}
	}
	if u.runner == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有备份部署能力"})
		return
	}
	if err := u.reload(); err != nil {
		writeAPI(w, http.StatusServiceUnavailable, apiResponse{Error: "配置还没准备好：" + err.Error()})
		return
	}
	u.mu.Lock()
	list := u.list
	u.mu.Unlock()
	if _, err := list.Get(req.Name); err != nil {
		// 只认清单里的 name：界面绝不能变成「代理任意主机」的入口。
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}

	task := u.ensureTask()
	if !task.start(mode, req.Name, component, req.Password) {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "已有备份任务在运行，等它结束再试"})
		return
	}
	args := backupCommandArgs(mode, req.Name, component)
	if isRestoreMode(mode) {
		db := req.RestoreDB
		if db == "" {
			db = restore.DefaultTestDB
		}
		args = restoreCommandArgs(mode, req, component, db)
	}
	if mode == backupDeps && req.PgMajor > 0 {
		args = append(args, "--pg-major", strconv.Itoa(req.PgMajor))
	}
	for _, t := range targets {
		args = append(args, "--target", t)
	}
	go u.runBackupTask(task, mode, req.Name, component, args, req.Password)

	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]any{
		"started":   true,
		"mode":      string(mode),
		"server":    req.Name,
		"component": component,
	}})
}

func (u *uiState) runBackupTask(t *backupTask, mode BackupMode, server, component string, args []string, password string) {
	lw := &backupLogWriter{task: t}
	fmt.Fprintf(lw, "==> 开始：%s %s（目标：%s）\n", modeLabel(mode), component, server)

	code := 0
	// 🔴 四个写模式共用一个服务端预检门：deploy / deps / deps-uninstall / once
	//    都先跑 --dry-run，前端不点预检、或直接调 API，都绕不过这一步。
	//    once 的 --dry-run 只跑 preflight + 打印计划，不是执行凭证。
	writeMode := isBackupWriteMode(mode)
	if writeMode {
		action := "安装"
		if mode == backupDepsUninstall {
			action = "卸载"
		}
		if mode == backupOnce {
			action = "备份"
		}
		if mode == backupRestore {
			action = "恢复"
		}
		if mode == backupRestore {
			fmt.Fprintln(lw, "==> 服务端预检（--dry-run，只读预演，不写生产端）")
		} else {
			fmt.Fprintln(lw, "==> 服务端预检（--dry-run，不改远端）")
		}
		pre := append(append([]string{}, args...), "--dry-run")
		code = u.runner(pre, password, lw)
		if code != 0 {
			fmt.Fprintf(lw, "预检没过，不执行%s；远端没有被修改。\n", action)
			lw.Flush()
			t.finish(code)
			return
		}
		switch mode {
		case backupDeps:
			fmt.Fprintln(lw, "==> 预检通过，开始安装缺失依赖（只装命令，不部署脚本 / 不写 crontab / 不跑备份）")
		case backupDepsUninstall:
			fmt.Fprintln(lw, "==> 预检通过，开始卸载勾选的依赖（只删工具装的东西，不 autoremove / 不碰数据与定时任务）")
		case backupOnce:
			fmt.Fprintln(lw, "==> 预检通过，开始执行一次备份（不重装脚本、不写 crontab；脚本自带 flock -n 防并发）")
		case backupRestore:
			fmt.Fprintln(lw, "==> 预检通过，开始执行恢复（复用已部署的 *_restore.sh；不提权、不读 / 改 crontab、不自动重试或清场）")
		default:
			fmt.Fprintln(lw, "==> 预检通过，开始安装（会写远端 crontab / logrotate / 目录）")
		}
	}
	code = u.runner(args, password, lw)
	switch mode {
	case backupOnce:
		lw.Flush()
		appendOnceReport(lw, t, code)
	case backupOnceDry:
		fmt.Fprintln(lw, "==> 预演完成：远端没有被修改。预演只是给人看的只读结果，不是执行凭证；"+
			"真正备份仍要点「立即备份…」并过确认弹窗，服务端会自己再跑一遍 --dry-run。")
	case backupRestore:
		lw.Flush()
		appendRestoreReport(lw, t, code)
	case backupRestoreDry:
		fmt.Fprintln(lw, "==> 只读预演结束：没有执行恢复脚本、没有写生产端。预演不是执行凭证；"+
			"真正恢复仍要点「执行恢复…」过确认弹窗，服务端会自己再跑一遍 --dry-run。")
	}
	if code == 0 {
		fmt.Fprintln(lw, "==> 完成。")
	} else if isRestoreMode(mode) {
		fmt.Fprintf(lw, "==> 结束，退出码 %d。失败停在日志里的阶段；没有自动重试 / 清场，没有改心跳。请按分册 §3.3 人工收尾。\n", code)
	} else {
		fmt.Fprintf(lw, "==> 结束，退出码 %d。请跑一次「远端自检」复核远端状态。\n", code)
	}
	lw.Flush()
	t.finish(code)
}

// appendOnceReport 把任务日志如实翻成一句结论（docs/backup-once.md §3 / §4）。
//
// 🔴 报告只报脚本结果：不写「备份体系正常 / 定时任务正常」，也不把 status 的心跳
//
//	当成功凭证。撞锁 / 超时 / 分组件失败都是**运行期**结果，只能从日志里认，
//	预演（--dry-run）挡不住它们（原型 §2.4 O3）。
//
// 🔴 无论成功失败都固定带「手动触发不代表定时任务正常」那一句：手动成功会写
//
//	last_success.txt，不改采集协议，只能靠文案区分（§4.2）。
func appendOnceReport(lw io.Writer, t *backupTask, code int) {
	log := t.view(0).Log
	switch {
	case strings.Contains(log, "超过 30 分钟上限"):
		fmt.Fprintln(lw, "==> 报告：本机已停止等待（30 分钟上限），远端可能仍在执行；本机没有终止远端脚本，也不会自动重试。请去备份机自检或只读的「备份监控」页复核。")
	case strings.Contains(log, "上一次备份任务仍在运行中"):
		fmt.Fprintln(lw, "==> 报告：被锁挡下，本次未执行：脚本的 flock -n 没拿到锁，没有产生 dump、没有写心跳。不自动重试。")
	case code != 0:
		fmt.Fprintln(lw, "==> 报告：有组件未成功（分组件结果见上面的脚本输出）；没有自动重试、没有自动清场，失败组件不写心跳。")
	default:
		fmt.Fprintln(lw, "==> 报告：所选组件的备份脚本均退出 0；这不等于「备份体系正常」，要看心跳请去只读的监控页。")
	}
	fmt.Fprintln(lw, "⚠️ 本次为手动触发，不代表定时任务正常；工具不读 crontab，定时任务是否正常由人判断。")
}

func modeLabel(m BackupMode) string {
	switch m {
	case backupPreflight:
		return "备份部署预检"
	case backupDeploy:
		return "安装 / 升级备份能力"
	case backupDeps:
		return "安装缺少依赖"
	case backupDepsUninstall:
		return "卸载备份依赖"
	case backupOnce:
		return "手动备份"
	case backupOnceDry:
		return "手动备份预演"
	case backupRestore:
		return "备份恢复"
	case backupRestoreDry:
		return "备份恢复预演"
	case deployReleaseMode:
		return "应用部署正式发布"
	case componentInstallMode:
		return "安装环境组件"
	case componentUpdateMode:
		return "更新环境组件"
	case componentUninstallMode:
		return "卸载环境组件"
	case componentImageMode:
		return "导入离线镜像"
	case componentImageCopyMode:
		return "从服务器复制镜像"
	default:
		return "远端自检"
	}
}

func (u *uiState) handleBackupTask(w http.ResponseWriter, r *http.Request) {
	after, err := strconv.Atoi(r.URL.Query().Get("after"))
	if err != nil {
		after = 0
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: u.ensureTask().view(after)})
}
