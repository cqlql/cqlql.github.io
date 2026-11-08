package restore

// ops restore：三段式「只读候选 → 预演 → 显式执行」。
//
// 🔴 不重写恢复逻辑：正式执行只 `bash <部署目录>/<组件>/*_restore.sh`（脚本已随
//    ops backup deploy 落地、编进二进制），脚本内二次确认由工具按**已通过的门禁**
//    经 stdin 喂入；Go 侧不实现 pg_restore / mc mirror。
// 🔴 --server 只认备份机（脚本执行地 / 候选来源 / 采集地）；生产端由该机
//    backup.env 决定，接口不接受任意主机、任意路径、任意命令。
// 🔴 恢复不提权（root=false、清 sudo 密码）、不读 / 改 crontab、不自动重试或清场、
//    不改 last_success.txt；报告只报脚本结果（分册 §5.1 / §5.4）。
// 🔴 界面预演不是执行凭证：服务端写动作前会自己先跑一次本文件的 --dry-run，
//    非 0 就地停、不写生产端（R4）。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// RunTimeout 是 CLI 正式恢复的上限；界面子进程另有 30 分钟上限（backuprun.go）。
const RunTimeout = 6 * time.Hour

var secretAssignRe = regexp.MustCompile(`(?i)(SRC_KEY|SRC_SECRET|DEST_KEY|DEST_SECRET|PG_SSH_KEY|PASSWORD|SECRET|TOKEN)\s*=\s*[^\s'"]+`)

// redactWriter 按行脱敏后再写 os.Stdout（→ 界面任务日志）。
// 与 backupLogWriter 的分工：那边替换一次性 sudo 密码，这边挡远端脚本意外回显的
// 凭证赋值与私钥路径。行内缓冲，切片边界永远落在换行处。
type redactWriter struct {
	out io.Writer
	buf strings.Builder
}

func (w *redactWriter) Write(p []byte) (int, error) {
	w.buf.Write(p)
	for {
		s := w.buf.String()
		i := strings.IndexByte(s, '\n')
		if i < 0 {
			break
		}
		line := s[:i+1]
		w.buf.Reset()
		w.buf.WriteString(s[i+1:])
		if _, err := io.WriteString(w.out, redactLine(line)); err != nil {
			return len(p), err
		}
	}
	return len(p), nil
}

func (w *redactWriter) Flush() {
	if w.buf.Len() > 0 {
		_, _ = io.WriteString(w.out, redactLine(w.buf.String()))
		w.buf.Reset()
	}
}

func redactLine(s string) string {
	s = privatePathRe.ReplaceAllString(s, "<已隐去>")
	return secretAssignRe.ReplaceAllString(s, "${1}=***")
}

type restoreOptions struct {
	Sub             string
	Server          string
	Component       string
	Candidate       string
	DB              string
	DB2             string
	Confirm         string
	MinioConfirm    string
	Checks          string
	CronConfirmed   bool
	CoverProduction bool
	DryRun          bool
	JSON            bool
}

// parseRestoreArgs 只认白名单参数。刻意不接 --force / --password-stdin /
// --run-now / --host / --file：候选路径由服务端按采集结果拼，恢复不提权。
func parseRestoreArgs(args []string) (restoreOptions, error) {
	opt := restoreOptions{Component: CompPG, DB: DefaultTestDB, DB2: DefaultTestDB}
	if len(args) == 0 {
		return opt, errHelp
	}
	switch args[0] {
	case "list", "plan", "run":
		opt.Sub = args[0]
	case "help", "-h", "--help":
		return opt, errHelp
	default:
		return opt, fmt.Errorf("未知子命令：restore %s", args[0])
	}
	for i := 1; i < len(args); i++ {
		a := args[i]
		need := func() (string, error) {
			if i+1 >= len(args) {
				return "", fmt.Errorf("%s 缺少参数", a)
			}
			i++
			return args[i], nil
		}
		switch {
		case a == "--server":
			v, err := need()
			if err != nil {
				return opt, err
			}
			opt.Server = v
		case strings.HasPrefix(a, "--server="):
			opt.Server = strings.TrimPrefix(a, "--server=")
		case a == "--component":
			v, err := need()
			if err != nil {
				return opt, err
			}
			opt.Component = v
		case a == "--candidate":
			v, err := need()
			if err != nil {
				return opt, err
			}
			opt.Candidate = v
		case a == "--db":
			v, err := need()
			if err != nil {
				return opt, err
			}
			opt.DB = v
		case a == "--db-confirm":
			v, err := need()
			if err != nil {
				return opt, err
			}
			opt.DB2 = v
		case a == "--confirm":
			v, err := need()
			if err != nil {
				return opt, err
			}
			opt.Confirm = v
		case a == "--minio-confirm":
			v, err := need()
			if err != nil {
				return opt, err
			}
			opt.MinioConfirm = v
		case a == "--checks":
			v, err := need()
			if err != nil {
				return opt, err
			}
			opt.Checks = v
		case a == "--cron-confirmed":
			opt.CronConfirmed = true
		case a == "--cover-production":
			opt.CoverProduction = true
		case a == "--dry-run":
			opt.DryRun = true
		case a == "--json":
			opt.JSON = true
		case strings.HasPrefix(a, "-"):
			return opt, fmt.Errorf("未知参数：%s（恢复不接受 --force / --password-stdin / --run-now / --host / --file）", a)
		default:
			return opt, fmt.Errorf("多余的位置参数：%s", a)
		}
	}
	if !ValidComponent(opt.Component) {
		return opt, fmt.Errorf("未知组件：%s（可选 pg / minio）", opt.Component)
	}
	if opt.Sub == "run" && opt.JSON {
		return opt, errors.New("--json 只用于 list / plan")
	}
	return opt, nil
}

var errHelp = errors.New("help")

func parseChecks(s string) ([3]bool, error) {
	var out [3]bool
	parts := strings.Split(s, ",")
	if len(parts) != 3 {
		return out, errors.New("--checks 必须是 1,1,1（三项前置全勾才放行）")
	}
	for i, p := range parts {
		n, err := strconv.Atoi(strings.TrimSpace(p))
		if err != nil || (n != 0 && n != 1) {
			return out, errors.New("--checks 只接受 0/1，且必须全为 1（已停写 / 已停定时备份 / 已留现场）")
		}
		out[i] = n == 1
	}
	return out, nil
}

func (o restoreOptions) gate() (Gate, error) {
	checks := [3]bool{}
	if o.Checks != "" {
		var err error
		checks, err = parseChecks(o.Checks)
		if err != nil {
			return Gate{}, err
		}
	}
	return Gate{
		Component:       o.Component,
		CandidateID:     o.Candidate,
		DB:              o.DB,
		DB2:             o.DB2,
		Confirm:         o.Confirm,
		MinioConfirm:    o.MinioConfirm,
		Checks:          checks,
		CronConfirmed:   o.CronConfirmed,
		CoverProduction: o.CoverProduction,
	}, nil
}

func loadForRestore(server string) (*shared.Config, *shared.ServerList, *shared.Server, error) {
	cfg, err := shared.LoadConfig()
	if err != nil {
		return nil, nil, nil, err
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		return nil, nil, nil, err
	}
	srv, err := list.Resolve(server, cfg.DefaultServer)
	if err != nil {
		return nil, nil, nil, err
	}
	if srv.Role != "" && srv.Role != "backup" {
		fmt.Printf("WARN: %s 在清单里的 role 是 %s，不是 backup；确认它就是恢复脚本所在的备份机。\n", srv.Name, srv.Role)
	}
	return cfg, list, srv, nil
}

// CmdRestore 是 restore 顶层动词的唯一入口（main.go 注册）。
func CmdRestore(args []string) int {
	opt, err := parseRestoreArgs(args)
	if errors.Is(err, errHelp) {
		restoreUsage()
		return 0
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}
	cfg, list, _, err := loadForRestore(opt.Server)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", safeError(err.Error()))
		return 2
	}
	root := context.Background()
	s, err := CollectForServer(root, cfg, list, opt.Server, opt.Component)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", safeError(err.Error()))
		return 2
	}
	switch opt.Sub {
	case "list":
		return printList(s, opt.JSON)
	case "plan":
		p := BuildPlan(s, PlanRequest{
			Server: opt.Server, Component: opt.Component, CandidateID: opt.Candidate,
			DB: opt.DB, CronConfirmed: opt.CronConfirmed,
		})
		if opt.JSON {
			return writeJSON(p)
		}
		printPlan(p)
		fmt.Println("🔴 只读预演的结果不是执行凭证；正式执行前服务端会自己再跑一次 --dry-run。")
		return 0
	default:
		return runRestore(root, cfg, list, s, opt)
	}
}

func printList(s Snapshot, asJSON bool) int {
	if asJSON {
		return writeJSON(s)
	}
	fmt.Printf("恢复点候选（只读 · %s · 目标机 %s）\n", s.Component, s.Server)
	fmt.Printf("  采集：%s  执行身份：%s  心跳：%s  备份盘余量：%s\n",
		collectedText(s.Collected), s.Identity, s.Heartbeat, s.DiskFree)
	fmt.Printf("  恢复目标回显：PG %s@%s · 库 %s / 容器 %s；MinIO 生产端 %s · 桶 %s（来源 %s，前缀 %s）\n",
		s.PGHost, s.PGPort, s.PGDB, s.PGContainer, s.SrcURL, s.SrcBuckets, s.DestURL, s.DestPrefix)
	fmt.Printf("  数据方向：%s\n", s.Direction)
	fmt.Printf("  停定时备份：%s（%s）\n", s.CronStatus, s.CronNote)
	if s.Error != "" {
		fmt.Printf("  采集错误：%s\n", s.Error)
	}
	fmt.Printf("  %-46s %-10s %-12s %-8s %-10s %-10s %s\n", "候选", "时间", "大小 / 对象", "分级", "校验和", "归档", "状态")
	if !s.Collected || len(s.Candidates) == 0 {
		fmt.Println("  （没采到：collected=false，数值一律 —，不用 0 兜底）")
	} else {
		for _, c := range s.Candidates {
			state := "可用"
			if !c.Selectable {
				state = "不可选：" + strings.Join(c.RowBlockers, "；")
			}
			size := c.Size
			if s.Component == CompMinio {
				size = c.Objects
			}
			fmt.Printf("  %-46s %-10s %-12s %-8s %-10s %-10s %s\n",
				c.ID, c.Time, size, c.Grade, c.Checksum, c.Archive, state)
		}
	}
	for _, b := range s.Blockers {
		fmt.Printf("  🔴 阻塞：%s\n", b)
	}
	return 0
}

func collectedText(ok bool) string {
	if ok {
		return "collected=true"
	}
	return "collected=false"
}

func writeJSON(v any) int {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 输出 JSON 失败：%v\n", err)
		return 1
	}
	return 0
}

func printPlan(p Plan) {
	fmt.Println("恢复动作计划（只读 · 服务端下发）")
	fmt.Printf("  %s\n", p.Target)
	fmt.Println("  影响清单：")
	for _, l := range p.Impact {
		fmt.Printf("    - %s\n", l)
	}
	fmt.Println("  全局阻塞：")
	if len(p.Blockers) == 0 {
		fmt.Println("    - 无")
	}
	for _, b := range p.Blockers {
		fmt.Printf("    - 🔴 %s\n", b)
	}
	if len(p.RowBlockers) > 0 {
		fmt.Println("  选中行的阻塞：")
		for _, b := range p.RowBlockers {
			fmt.Printf("    - %s\n", b)
		}
	}
	fmt.Println("  警告：")
	for _, w := range p.Warnings {
		fmt.Printf("    - %s\n", w)
	}
	fmt.Println("  将执行 / 只读预演的命令：")
	for _, c := range p.Commands {
		fmt.Printf("    %s\n", c)
	}
	fmt.Printf("  available=%v · %s\n", p.Available, p.Note)
}

// runRestore 是正式执行 / 服务端预检共用的唯一实现。
func runRestore(root context.Context, cfg *shared.Config, list *shared.ServerList, s Snapshot, opt restoreOptions) int {
	g, err := opt.gate()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}
	p := BuildPlan(s, PlanRequest{
		Server: opt.Server, Component: opt.Component, CandidateID: opt.Candidate,
		DB: opt.DB, CronConfirmed: opt.CronConfirmed,
	})
	printPlan(p)

	phase(1, "预检")
	if !s.Collected {
		fmt.Fprintln(os.Stderr, "ERROR: 没采到备份机快照，本次不执行；远端没有被修改。")
		phaseFailed(1)
		return 1
	}
	if !s.ScriptsOK {
		fmt.Fprintln(os.Stderr, "ERROR: 备份机上的恢复脚本不齐全，先运行 ops backup deploy。")
		phaseFailed(1)
		return 1
	}
	// 只读预演也要卡住「任意路径 / 候选不在表」：服务端门禁不依赖前端选了什么。
	if !ValidCandidateID(opt.Candidate) {
		fmt.Fprintln(os.Stderr, "ERROR: 候选 ID 不合法；接口不接受任意路径。")
		phaseFailed(1)
		return 2
	}
	c, ok := s.CandidateByID(opt.Candidate)
	if !ok {
		fmt.Fprintln(os.Stderr, "ERROR: 候选不在本次采集里；点「刷新候选」重新取一次。")
		phaseFailed(1)
		return 1
	}
	if opt.Component == CompPG && !ValidDB(opt.DB) {
		fmt.Fprintln(os.Stderr, "ERROR: 目标库名不合法。")
		phaseFailed(1)
		return 2
	}

	srv, err := list.Resolve(opt.Server, cfg.DefaultServer)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", safeError(err.Error()))
		phaseFailed(1)
		return 2
	}
	t := shared.NewSSHTarget(srv)
	// 🔴 恢复以清单 user 跑：清掉 sudo 密码，root=false，弹窗没有密码框。
	t.SudoPassword = ""
	rw := &redactWriter{out: os.Stdout}

	phase(2, "预演（只读，不写生产端）")
	preCode := runRestoreDryRun(root, t, cfg, s, c, opt, rw)
	if preCode == 0 && !p.Available {
		// 只读检查过了，但计划有全局阻塞：预演仍可看（日志里是完整计划），
		// 执行入口禁用；服务端写动作会在这一步就地停下，不写生产端。
		fmt.Fprintln(rw, "==> 只读检查完成，但动作计划有全局阻塞，执行入口禁用：")
		for _, b := range p.Blockers {
			fmt.Fprintf(rw, "    - %s\n", b)
		}
		preCode = 1
	}
	rw.Flush()
	if preCode != 0 {
		fmt.Fprintf(os.Stderr, "ERROR: 只读预演没过（退出码 %d），不执行恢复；生产端没有被修改。\n", preCode)
		phaseFailed(2)
		return 1
	}
	if opt.DryRun {
		fmt.Println()
		fmt.Println("预演完成：没有执行恢复脚本、没有写生产端、没有改心跳 / crontab。")
		fmt.Println("🔴 预演不是执行凭证：正式执行前服务端会自己再跑一遍 --dry-run，且不复用这次结果。")
		return 0
	}

	// 🔴 正式执行前重算一次门禁（s 是刚采集的，p 是刚算的）。
	if err := ValidateGate(g, s, p); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 门禁没过，本次不执行；生产端没有被修改：%v\n", err)
		phaseFailed(1)
		return 2
	}

	phase(3, "传输 / 恢复（复用已部署脚本）")
	cmd, stdin, err := restoreCommand(cfg, s, c, opt)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		phaseFailed(3)
		return 2
	}
	fmt.Printf("  远端命令：%s（stdin 为脚本内二次确认，不打印凭证）\n", cmd)
	ctx, cancel := context.WithTimeout(root, RunTimeout)
	defer cancel()
	code, err := t.StreamWith(ctx, cmd, false, strings.NewReader(stdin), rw)
	rw.Flush()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 远端执行失败：%v\n", safeError(err.Error()))
		phaseFailed(3)
		return 1
	}

	phase(4, "验证（只看脚本结果，不探活应用）")
	fmt.Println("  脚本输出见上；工具不判断应用是否可用、不查 Flyway 版本。")
	phase(5, "报告")
	return printRestoreReport(os.Stdout, opt, code)
}

// restoreCommand 拼远端命令：脚本路径与候选路径都由服务端按配置拼，
// 所有动态片段过 ShQuote；stdin 只喂脚本自身的二次确认串。
func restoreCommand(cfg *shared.Config, s Snapshot, c Candidate, opt restoreOptions) (string, string, error) {
	if opt.Component == CompMinio {
		return "bash " + shared.ShQuote(restoreScriptPath(cfg, CompMinio)), "YES\n\n", nil
	}
	remote, err := s.RemoteFile(c)
	if err != nil {
		return "", "", err
	}
	cmd := "bash " + shared.ShQuote(restoreScriptPath(cfg, CompPG)) +
		" --file " + shared.ShQuote(remote) + " --db " + shared.ShQuote(opt.DB)
	return cmd, opt.DB + "\n", nil
}

// pgRestoreDryRunScript 是 PG 归档只读检查脚本。
//
// 🔴 不能用 `pg_restore -l ... | head`：POSIX sh 没有 pipefail，pg_restore 失败时
//
//	管道退出码是 head 的 0，会**误报「归档可解析」**（2026-11-08 真机演练抓到）。
//	先把输出收进变量并显式判退出码，失败时把真实错误（如 unsupported version）
//	打到 stdout 再 exit 3。抽成纯函数是为了让 go test 锁住这条。
func pgRestoreDryRunScript(remote string) string {
	return "set -eu\n" +
		"command -v pg_restore >/dev/null 2>&1 || { echo '备份机缺 pg_restore，无法校验归档；先在「备份能力部署」页安装缺少依赖'; exit 3; }\n" +
		"out=$(pg_restore -l " + shared.ShQuote(remote) + " 2>&1) || { printf '%s\\n' \"$out\" | head -n 12; exit 3; }\n" +
		"printf '%s\\n' \"$out\" | head -n 12\n"
}

// runRestoreDryRun 只读预演：PG 跑 pg_restore -l（归档目录），MinIO 只检查
// 脚本 / mc / 桶对清单（🔴 不连生产端 MinIO、不写 ~/.mc、不调用 mirror --dry-run）。
func runRestoreDryRun(root context.Context, t *shared.SSHTarget, cfg *shared.Config, s Snapshot, c Candidate, opt restoreOptions, out io.Writer) int {
	ctx, cancel := context.WithTimeout(root, CollectTimeout)
	defer cancel()
	if opt.Component == CompPG {
		remote, err := s.RemoteFile(c)
		if err != nil {
			fmt.Fprintln(out, "ERROR: "+err.Error())
			return 1
		}
		text, err := t.RunScript(ctx, pgRestoreDryRunScript(remote))
		if text != "" {
			_, _ = io.WriteString(out, redactLine(text)+"\n")
		}
		if err != nil {
			fmt.Fprintf(out, "预演失败：%s\n", safeError(err.Error()))
			fmt.Fprintln(out, "🔴 若上面出现 unsupported version：判的是**备份机**的 pg_restore 客户端；"+
				"正式恢复用主服务器容器内的 pg_restore，版本可能不同。请按 §3.1 在目标容器内人工复核，工具不提供绕过开关。")
			return 1
		}
		fmt.Fprintln(out, "归档目录可由备份机上的 pg_restore 解析；未写生产端。")
		return 0
	}

	var lines []string
	lines = append(lines, "桶对清单（来自远端 backup.env 白名单字段，只读）：")
	for _, b := range strings.Fields(s.SrcBuckets) {
		if bucketRe.MatchString(b) {
			lines = append(lines, fmt.Sprintf("  备份端 %s%s → 生产端 %s", s.DestPrefix, b, b))
		}
	}
	lines = append(lines, "🔴 工具不连生产端 / 备份端 MinIO、不写 ~/.mc：对象数与最近同步不采集（显示 —），也不跑 mc mirror --dry-run；正式执行由 minio_restore.sh 完成。")
	script := "set -eu\n" +
		"[ -f " + shared.ShQuote(restoreScriptPath(cfg, CompMinio)) + " ] || { echo '缺少 minio_restore.sh：先运行 ops backup deploy'; exit 3; }\n" +
		"command -v mc >/dev/null 2>&1 || { echo '备份机缺 mc，恢复脚本无法运行'; exit 3; }\n" +
		"echo '恢复脚本与 mc 已就位（只读检查）'\n"
	text, err := t.RunScript(ctx, script)
	for _, l := range lines {
		fmt.Fprintln(out, l)
	}
	if text != "" {
		_, _ = io.WriteString(out, redactLine(text))
	}
	if err != nil {
		fmt.Fprintf(out, "预演失败：%s\n", safeError(err.Error()))
		return 1
	}
	return 0
}

func phase(n int, label string) { fmt.Printf("==> PHASE %d/5 %s\n", n, label) }
func phaseFailed(n int)         { fmt.Printf("==> PHASE_FAILED %d\n", n) }

// printRestoreReport 只报脚本结果：不许写「恢复成功，服务正常」。
// 接 io.Writer 是为了让 go test 能直接锁住措辞（R5）。
func printRestoreReport(w io.Writer, opt restoreOptions, code int) int {
	fmt.Fprintln(w)
	fmt.Fprintln(w, "==> 报告（只报脚本结果）")
	if code != 0 {
		fmt.Fprintf(w, "  恢复脚本退出码 %d：停在「传输 / 恢复」阶段；失败步骤 / 失败桶见上面的脚本输出。\n", code)
		fmt.Fprintln(w, "  没有自动重试、没有自动清场（可能留下 /tmp dump）、没有改 last_success.txt 心跳。")
		fmt.Fprintln(w, "  ⚠️ 报告只报脚本结果：应用可用性 / Flyway 兼容性 / 关键表与对象核对是人工步骤（§3.3），工具不判断「服务正常」。")
		return 1
	}
	if opt.Component == CompPG {
		fmt.Fprintf(w, "  pg_restore.sh 退出 0：数据已恢复到目标库 %s（脚本结果）。\n", opt.DB)
		fmt.Fprintln(w, "  ⚠️ 数据已恢复不等于服务可用：旧 dump 的 Flyway schema 可能落后于当前镜像，需人工确认 / 前向修复（硬约束 7）。")
	} else {
		fmt.Fprintln(w, "  minio_restore.sh 退出 0：脚本按 backup.env 的 SRC_BUCKETS 逐桶执行完毕（脚本结果）。")
		fmt.Fprintln(w, "  ⚠️ 不带 --remove，不是精确回滚：生产端多出来的对象原样保留，需人工比对处理。")
	}
	fmt.Fprintln(w, "  ⚠️ 报告只报脚本结果，不承诺应用可用；验证与收尾按 §3.3 人工完成。")
	fmt.Fprintln(w, "  ⚠️ 恢复不读 / 不改 crontab：请把定时任务按 §3.0 装回去（两条 cron 都要），再跑一次只读的备份监控复核。")
	return 0
}

func restoreUsage() {
	fmt.Print(`用法:
  ops restore list --server <name> --component pg|minio [--json]
                                       只读列恢复点候选（PG dump / MinIO 桶对）+ 恢复目标回显
  ops restore plan --server <name> --component pg|minio --candidate <id> [--db <库名>]
                   [--cron-confirmed] [--dry-run] [--json]
                                       只读动作计划（两级阻塞 / 影响清单 / 将执行的命令）
  ops restore run  --server <name> --component pg|minio --candidate <id> [--db <库名>]
                   --confirm yes --db-confirm <库名> --checks 1,1,1 --cron-confirmed
                   [--minio-confirm YES] [--cover-production] [--dry-run]
                                       正式执行（复用远端 pg_restore.sh / minio_restore.sh）
                                       --dry-run 只预演，不写生产端；服务端写动作会自己先跑一次

🔴 --server 只认备份机（候选来源 / 采集地 / 脚本执行地）；生产端由该机 backup.env 决定。
   候选 ID 只认本次采集到的相对路径 / 桶名，接口不接受任意主机或任意路径。
🔴 恢复不提权、不收 sudo 密码、不读 / 改 crontab、不自动重试 / 清场、不改心跳；
   报告只报脚本结果，不承诺应用可用。恢复脚本禁止入 Crontab、必须有人值守。
🔴 三项前置（已停写 / 已停定时备份 / 已留现场）是人的声明，工具不替你验证。
   界面「预演」不是执行凭证：服务端每次写动作前自己再跑一遍 --dry-run。
`)
}
