package backup

// 「备份依赖」独立子命令：ops backup deps。
//
// 🔴 与 deploy --install-deps 的区别：deps **只装命令**，不上传脚本、不写 crontab /
//    logrotate / backup.env、不跑备份。这样界面才能把「预检报缺 mc / pg_restore」
//    变成一个可点、可二次确认、可 dry-run 的独立动作，而不用顺带重部署。
// 🔴 --json 与 --dry-run 都不改远端（后者连包管理器都不碰），正式安装才提权。
// 🔴 结构化状态、安装计划、官方文档链接全部由 Go 侧算好下发，前端只渲染。
// 🔴 安装源按官方文档：PG 客户端可选走 PGDG 官方 apt 仓库（指定主版本），
//    mc 走官方二进制地址并保留已验证的回退链路（见 depsInstallScriptWithMajor）。
// 🔴 2026-11-10 版本对齐（分册 §7.9）：--pg-major 是显式目标主版本。旧口径只看命令
//    在不在，16.15 已装却答「没有缺少的依赖」，归档深校验会一直被版本挡（§4 第 6 条）。
//    现在已装但主版本低于目标也算待装；不带 --pg-major 的行为完全不变。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

const (
	docPGClient = "https://www.postgresql.org/download/linux/debian/"
	docMCClient = "https://min.io/docs/minio/linux/reference/minio-mc.html#install-mc"
)

// depSpec 是依赖清单的唯一声明：deploy 的 checkDeps 与界面状态都从这张表推导。
// Component: all = 两个组件都要，pg / minio = 仅该组件；Optional 只提示不拦安装。
type depSpec struct {
	Name      string
	Label     string
	Component string
	Source    string
	Doc       string
	Optional  bool
}

type DepItem struct {
	Name      string `json:"name"`
	Label     string `json:"label"`
	Component string `json:"component"`
	Installed bool   `json:"installed"`
	Version   string `json:"version"`
	Optional  bool   `json:"optional"`
	Source    string `json:"source"`
	Doc       string `json:"doc"`
}

type DepDoc struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// DepsView 是 GET /api/backup/deps 的数据源（CLI --json 直接输出它）。
// 🔴 所有数组都初始化成 []：nil slice 编成 JSON null，前端 .map 会整页白屏。
type DepsView struct {
	Server    string    `json:"server"`
	Component string    `json:"component"`
	Collected bool      `json:"collected"`
	Error     string    `json:"error,omitempty"`
	Items     []DepItem `json:"items"`
	Missing   []string  `json:"missing"`
	Optional  []string  `json:"optional"`
	Plan      []string  `json:"plan"`
	Docs      []DepDoc  `json:"docs"`
	PgMajor   int       `json:"pg_major,omitempty"`
	// Uninstall 是卸载弹窗的判据与文案，随只读状态一起下发，前端只渲染。
	Uninstall DepsUninstallPlan `json:"uninstall"`
}

func emptyDepsView(server, comp string, pgMajor int) DepsView {
	return DepsView{
		Server: server, Component: comp, PgMajor: pgMajor,
		Items: []DepItem{}, Missing: []string{}, Optional: []string{},
		Plan: []string{},
		Docs: []DepDoc{
			{Label: "PostgreSQL 官方 apt 仓库（PGDG）", URL: docPGClient},
			{Label: "MinIO 官方 mc 安装文档", URL: docMCClient},
		},
		Uninstall: depsUninstallPlan(),
	}
}

var depCatalogAll = []depSpec{
	{Name: "tar", Label: "tar 归档", Component: "all", Source: "系统包：tar"},
	{Name: "crontab", Label: "定时任务", Component: "all", Source: "系统包：cron / cronie"},
	{Name: "ssh", Label: "SSH 客户端", Component: "all", Source: "系统包：openssh-client / openssh-clients"},
	{Name: "scp", Label: "scp", Component: "all", Source: "系统包：openssh-client / openssh-clients"},
	{Name: "nc", Label: "端口探测", Component: "all", Source: "系统包：netcat-openbsd / nmap-ncat"},
	{Name: "pg_restore", Label: "PostgreSQL 客户端（pg_restore / pg_dump）", Component: "pg",
		Source: "postgresql-client；指定主版本时走 PGDG 官方 apt 仓库的 postgresql-client-<major>", Doc: docPGClient},
	{Name: "mc", Label: "MinIO 客户端 mc", Component: "minio",
		Source: "目标机已导入的 MinIO 镜像离线提取 → 官方文档地址下载（每个 90 秒硬超时，绝不 docker pull）", Doc: docMCClient},
	{Name: "logrotate", Label: "日志轮转（可选）", Component: "all", Source: "系统包：logrotate", Optional: true},
}

// depCatalog 按本次组件过滤，顺序稳定（不靠 map 遍历），页面表格不会乱跳。
func depCatalog(comps []component) []depSpec {
	want := map[string]bool{}
	for _, c := range comps {
		want[string(c)] = true
	}
	out := []depSpec{}
	for _, d := range depCatalogAll {
		if d.Component == "all" || want[d.Component] {
			out = append(out, d)
		}
	}
	return out
}

func depsProbeCommand(catalog []depSpec) string {
	names := make([]string, 0, len(catalog))
	for _, d := range catalog {
		names = append(names, d.Name)
	}
	var b strings.Builder
	// 只读：只跑 command -v 与 --version，不写任何远端文件、不提权。
	// printf 的格式串在单引号里，命令名来自本文件的白名单，不接用户输入。
	b.WriteString("set +e\n")
	// 🔴 判据分两层，两层都踩过坑：
	//    ① 2026-11-07 k4：mc 下载到一半（110 KB 截断 ELF、0644），dash 的
	//       command -v 仍返回路径 → 必须先确认 [ -x ]；
	//    ② 同日晚：PG 客户端包卸完后 `/usr/bin/pg_restore` 仍是
	//       postgresql-client-common 提供的 pg_wrapper 壳链接，`--version`
	//       直接报 "You must install at least one postgresql-client-<version> package"。
	//       光看文件可执行会把空壳当「已安装」→ pg_restore / mc 还必须真能跑 --version。
	b.WriteString(`for c in ` + strings.Join(names, " ") + `; do
  p=$(command -v "$c" 2>/dev/null || true)
  if [ -n "$p" ] && [ -x "$p" ]; then
    case "$c" in
      pg_restore|mc)
        if "$p" --version >/dev/null 2>&1; then printf '%s=yes\n' "$c"; else printf '%s=no\n' "$c"; fi ;;
      *) printf '%s=yes\n' "$c" ;;
    esac
  else
    printf '%s=no\n' "$c"
  fi
done` + "\n")
	b.WriteString(`if command -v pg_restore >/dev/null 2>&1 && pg_restore --version >/dev/null 2>&1; then printf 'VER_pg_restore=%s\n' "$(pg_restore --version 2>/dev/null | head -1)"; fi` + "\n")
	b.WriteString(`if command -v mc >/dev/null 2>&1 && mc --version >/dev/null 2>&1; then printf 'VER_mc=%s\n' "$(mc --version 2>/dev/null | head -1)"; fi` + "\n")
	b.WriteString("printf 'DEPS_CHECK_OK=yes\\n'\n")
	return b.String()
}

// probeDeps 一次 ssh 拿全量状态；采集失败一律 collected=false，绝不拿「没输出」当「已装」。
func probeDeps(t *shared.SSHTarget, ctx context.Context, comps []component, server, comp string, pgMajor int) (DepsView, error) {
	view := emptyDepsView(server, comp, pgMajor)
	catalog := depCatalog(comps)
	out, code, err := t.Capture(ctx, depsProbeCommand(catalog), false)
	if err != nil {
		return view, err
	}
	if code != 0 {
		return view, fmt.Errorf("依赖检查脚本退出码 %d：%s", code, strings.TrimSpace(out))
	}
	return parseDepsProbeOutput(out, catalog, view)
}

// pgMajorFromVersion 从 `pg_restore (PostgreSQL) 18.6` 这类 --version 输出里取主版本号。
// PostgreSQL 10 起主版本号就是第一个数字段；取不到回 0，调用方按「版本未知」保守跳过，
// 绝不因为解析失败就把一台装好的机器判成需要重装。
func pgMajorFromVersion(s string) int {
	start := -1
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			start = i
			break
		}
	}
	if start < 0 {
		return 0
	}
	end := start
	for end < len(s) && s[end] >= '0' && s[end] <= '9' {
		end++
	}
	n, err := strconv.Atoi(s[start:end])
	if err != nil || n < 1 || n > 99 {
		return 0
	}
	return n
}

// needsPgVersionAlign 是「版本对齐」的唯一判据：显式给了目标主版本、客户端确实装了、
// 版本串能解析、且已装主版本低于目标。高于目标不降级（高版本客户端能读低版本 dump）；
// 没给 --pg-major 时一律不启用，保持「只补缺失」的旧语义。
func needsPgVersionAlign(view DepsView, installed bool, version string) (int, bool) {
	if view.PgMajor <= 0 || !installed {
		return 0, false
	}
	cur := pgMajorFromVersion(version)
	return cur, cur > 0 && cur < view.PgMajor
}

// parseDepsProbeOutput 是纯函数，便于把「连不上 / 脚本没跑完」与「真的没装」分开测：
// 缺结束标记一律 collected=false，绝不拿空输出冒充「依赖齐全」。
func parseDepsProbeOutput(out string, catalog []depSpec, view DepsView) (DepsView, error) {
	if !strings.Contains(out, "DEPS_CHECK_OK=yes") {
		return view, fmt.Errorf("依赖检查脚本未正常完成：%s", strings.TrimSpace(out))
	}
	installed := map[string]bool{}
	versions := map[string]string{}
	for _, line := range strings.Split(out, "\n") {
		k, v, ok := strings.Cut(strings.TrimSuffix(strings.TrimSpace(line), "\r"), "=")
		if !ok {
			continue
		}
		if len(v) > 200 {
			v = v[:200]
		}
		switch {
		case strings.HasPrefix(k, "VER_"):
			versions[strings.TrimPrefix(k, "VER_")] = strings.TrimSpace(v)
		case k == "DEPS_CHECK_OK":
			// 结束标记，不进清单。
		default:
			installed[k] = v == "yes"
		}
	}
	// 🔴 版本对齐（分册 §7.9）：把「已装但主版本不够」也计入 Missing，让原本「只补缺失」
	//    的安装链路顺带装版本化客户端。判据在循环外只算一次，插入仍走 catalog 顺序
	//    （页面表格 / CLI 清单顺序稳定，不能事后 append 把 pg_restore 排到 mc 后面）。
	//    PGDG 的 postgresql-client-<n> 与旧版共存，pg_wrapper 自动指向最高版本，不卸载任何包。
	alignFrom, needAlign := needsPgVersionAlign(view, installed["pg_restore"], versions["pg_restore"])
	for _, d := range catalog {
		it := DepItem{
			Name: d.Name, Label: d.Label, Component: d.Component,
			Installed: installed[d.Name], Version: versions[d.Name],
			Optional: d.Optional, Source: d.Source, Doc: d.Doc,
		}
		view.Items = append(view.Items, it)
		if !it.Installed {
			if it.Optional {
				view.Optional = append(view.Optional, it.Name)
			} else {
				view.Missing = append(view.Missing, it.Name)
			}
		} else if needAlign && d.Name == "pg_restore" {
			view.Missing = append(view.Missing, it.Name)
		}
	}
	view.Collected = true
	view.Plan = depPlan(view.Missing, view.PgMajor)
	if needAlign {
		// 放在计划最前面：界面已经渲染 plan，前端无需新增字段就能看到「为什么已装还要装」。
		view.Plan = append([]string{fmt.Sprintf(
			"版本对齐：已装 pg_restore 主版本 %d，低于指定主版本 %d；本次会按 PGDG 装 postgresql-client-%d（与旧版共存、不卸载，pg_wrapper 自动指向最高版本）",
			alignFrom, view.PgMajor, view.PgMajor)}, view.Plan...)
	}
	return view, nil
}

// depPlan 是给人看的「这次会装什么」，与真正执行的脚本同源推导，不在前端另算一套。
func depPlan(missing []string, pgMajor int) []string {
	if len(missing) == 0 {
		return []string{}
	}
	set := map[string]bool{}
	for _, m := range missing {
		set[m] = true
	}
	out := []string{}
	if set["pg_restore"] {
		if pgMajor > 0 {
			out = append(out, fmt.Sprintf(
				"按 PostgreSQL 官方 PGDG apt 仓库安装 postgresql-client-%d（与服务端主版本一致，避免 pg_restore 版本过低误判 dump 损坏）", pgMajor))
		} else {
			out = append(out, "安装发行版仓库的 postgresql-client（pg_restore / pg_dump）；服务端 PG 版本更新时可指定主版本改走 PGDG 官方仓库")
		}
	}
	if set["mc"] {
		out = append(out, "安装 mc 到 /usr/local/bin/mc：先从目标机已导入的 MinIO 镜像离线提取，取不到才按官方文档地址下载（每个地址 90 秒硬超时、逐个打印进度；绝不 docker pull）")
	}
	pkgs := aptPackagesWithMajor(set, pgMajor)
	if len(pkgs) > 0 {
		out = append(out, "系统包管理器（apt / dnf / yum）安装："+strings.Join(pkgs, "、"))
	}
	out = append(out, "安装完自动复查每个命令；不上传脚本、不改 crontab / logrotate / backup.env、不跑备份。")
	return out
}

type depsOptions struct {
	comps         []component
	Server        string
	JSON          bool
	DryRun        bool
	PasswordStdin bool
	PgMajor       int
}

func parseDepsArgs(args []string) (depsOptions, error) {
	opt := depsOptions{comps: []component{compPG, compMinio}}
	seen := false
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--json":
			opt.JSON = true
		case a == "--dry-run":
			opt.DryRun = true
		case a == "--password-stdin":
			opt.PasswordStdin = true
		case a == "--server":
			if i+1 >= len(args) {
				return opt, fmt.Errorf("--server 缺少参数")
			}
			i++
			opt.Server = args[i]
		case strings.HasPrefix(a, "--server="):
			opt.Server = strings.TrimPrefix(a, "--server=")
		case a == "--pg-major" || strings.HasPrefix(a, "--pg-major="):
			raw := ""
			if a == "--pg-major" {
				if i+1 >= len(args) {
					return opt, fmt.Errorf("--pg-major 缺少参数")
				}
				i++
				raw = args[i]
			} else {
				raw = strings.TrimPrefix(a, "--pg-major=")
			}
			n, err := validatePgMajor(raw)
			if err != nil {
				return opt, err
			}
			opt.PgMajor = n
		case a == "-h" || a == "--help":
			return opt, errHelp
		case strings.HasPrefix(a, "-"):
			return opt, fmt.Errorf("未知参数：%s", a)
		default:
			if seen {
				return opt, fmt.Errorf("只能指定一个组件")
			}
			comps, err := parseComponents(a)
			if err != nil {
				return opt, err
			}
			opt.comps = comps
			seen = true
		}
	}
	return opt, nil
}

// validatePgMajor 是界面与 CLI 共用的字符集门：只允许 1..99 的纯数字。
// 它会拼进 apt 包名与远端脚本，绝不能让任意字符串过这一关。
func validatePgMajor(raw string) (int, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0, fmt.Errorf("--pg-major 需要一个主版本号（如 16）")
	}
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0, fmt.Errorf("--pg-major 只能是数字：%q", s)
		}
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 || n > 99 {
		return 0, fmt.Errorf("--pg-major 超出范围（1..99）：%q", s)
	}
	return n, nil
}

// depsComponentLabel 与界面传的 component 白名单一致：all / pg / minio。
func depsComponentLabel(comps []component) string {
	if len(comps) == 1 {
		return string(comps[0])
	}
	return "all"
}

func runBackupDeps(args []string) int {
	opt, err := parseDepsArgs(args)
	if errors.Is(err, errHelp) {
		fmt.Print(depsUsage())
		return 0
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 2
	}
	cfg, err := shared.LoadConfig()
	if err != nil {
		return depsFail(opt, err.Error())
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		return depsFail(opt, err.Error())
	}
	srv, err := list.Resolve(opt.Server, cfg.DefaultServer)
	if err != nil {
		return depsFail(opt, err.Error())
	}
	t := shared.NewSSHTarget(srv)
	if opt.PasswordStdin {
		pw, err := readSudoPassword()
		if err != nil {
			return depsFail(opt, err.Error())
		}
		applySudoPassword(t, pw)
	}

	comp := depsComponentLabel(opt.comps)
	root := context.Background()
	ctx, cancel := context.WithTimeout(root, timeoutPrecheck)
	view, err := probeDeps(t, ctx, opt.comps, srv.Name, comp, opt.PgMajor)
	cancel()
	if err != nil {
		view.Error = "只读依赖检查失败（不推断依赖状态）：" + err.Error()
	}
	if opt.JSON {
		b, _ := json.Marshal(view)
		fmt.Println(string(b))
		if !view.Collected {
			return 1
		}
		return 0
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+view.Error)
		return 1
	}

	fmt.Printf("备份依赖清单 · %s（%s）\n", srv.Name, comp)
	for _, it := range view.Items {
		state := "缺失"
		if it.Installed {
			state = "已安装"
		}
		if it.Optional {
			state += "（可选）"
		}
		detail := it.Source
		if strings.TrimSpace(it.Version) != "" {
			detail = it.Version + " · " + it.Source
		}
		fmt.Printf("  %-12s %-8s %s\n", it.Name, state, detail)
	}
	if len(view.Missing) == 0 {
		fmt.Println("没有缺少的依赖。")
		if view.PgMajor > 0 {
			for _, it := range view.Items {
				if it.Name != "pg_restore" {
					continue
				}
				cur := pgMajorFromVersion(it.Version)
				switch {
				case cur >= view.PgMajor:
					fmt.Printf("pg_restore 主版本 %d 已达到指定主版本 %d，无需版本对齐。\n", cur, view.PgMajor)
				case cur == 0:
					fmt.Println("WARN: 无法解析 pg_restore 版本，版本对齐未判定，请人工核对版本串。")
				}
				break
			}
		}
		if len(view.Optional) > 0 {
			fmt.Println("WARN: 可选依赖缺失：" + strings.Join(view.Optional, ", ") + "（install.sh 会给出提示）")
		}
		return 0
	}
	fmt.Println("\n将要执行：")
	for _, line := range view.Plan {
		fmt.Println("  - " + line)
	}
	fmt.Println("官方文档：")
	for _, d := range view.Docs {
		fmt.Printf("  - %s：%s\n", d.Label, d.URL)
	}
	if opt.DryRun {
		fmt.Println("\n--dry-run：只报告缺失项，未修改远端任何文件。")
		return 0
	}

	// 🔴 正式安装才做提权能力检查；--dry-run 上面已经 return。
	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	err = checkAccess(t, ctx)
	cancel()
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	fmt.Printf("\n==> 安装缺失依赖：%s\n", strings.Join(view.Missing, ", "))
	ctx, cancel = context.WithTimeout(root, timeoutDeps)
	err = installDepsWithMajor(t, ctx, view.Missing, opt.PgMajor)
	cancel()
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	ctx, cancel = context.WithTimeout(root, timeoutPrecheck)
	after, err := probeDeps(t, ctx, opt.comps, srv.Name, comp, opt.PgMajor)
	cancel()
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 复查依赖失败："+err.Error())
		return 1
	}
	if len(after.Missing) > 0 {
		fmt.Fprintln(os.Stderr, "ERROR: 复查仍缺少依赖："+strings.Join(after.Missing, ", ")+"；请按上方官方文档手工安装")
		return 1
	}
	fmt.Println("==> 依赖已齐全；可以回到「备份能力部署」页重跑预检或安装。")
	return 0
}

// depsFail 让 --json 也始终吐出可解析的 JSON（采集失败用 collected=false 表达），
// 界面因此不会拿到一段人类可读的错误文本而解析失败。
func depsFail(opt depsOptions, reason string) int {
	if opt.JSON {
		view := emptyDepsView(opt.Server, depsComponentLabel(opt.comps), opt.PgMajor)
		view.Error = reason
		b, _ := json.Marshal(view)
		fmt.Println(string(b))
		return 1
	}
	fmt.Fprintln(os.Stderr, "ERROR: "+reason)
	return 1
}

func depsUsage() string {
	return `用法:
  ops backup deps [pg|minio|all] --server <name> [--json] [--dry-run] [--pg-major <n>] [--password-stdin]
    --json          只读：输出结构化依赖状态（界面数据源），collected=false 表示没采到
    --dry-run       只报告缺失项与安装计划，不改远端任何文件
    --pg-major <n>  目标 PostgreSQL 主版本，并启用版本对齐：按 PGDG 官方 apt 仓库装
                    postgresql-client-<n>；已装但主版本低于 <n> 时也会对齐（与旧版共存、不卸载），
                    已达到或高于则不动作；不给则沿用「只补缺失」的旧口径
    --password-stdin 从 stdin 读初始 sudo 密码（没有 --password 参数）

只安装命令，不上传备份脚本、不写 crontab / logrotate / backup.env、不跑备份。
官方文档：
  PostgreSQL  ` + docPGClient + `
  MinIO mc    ` + docMCClient + `
`
}
