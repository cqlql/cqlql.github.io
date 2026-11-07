package backup

import (
	"strings"
	"testing"
)

// 「界面上安装缺少依赖」的边界：参数门、只读采集、官方安装源、采不到不等于已装。

func TestParseDepsArgs(t *testing.T) {
	opt, err := parseDepsArgs([]string{"minio", "--server", "bk", "--json", "--dry-run", "--pg-major", "16", "--password-stdin"})
	if err != nil {
		t.Fatal(err)
	}
	if !opt.JSON || !opt.DryRun || !opt.PasswordStdin || opt.PgMajor != 16 || opt.Server != "bk" {
		t.Errorf("选项解析不对：%+v", opt)
	}
	if len(opt.comps) != 1 || opt.comps[0] != compMinio {
		t.Errorf("comps = %v", opt.comps)
	}
	opt2, err := parseDepsArgs([]string{"--server=bk", "--pg-major=17"})
	if err != nil || opt2.Server != "bk" || opt2.PgMajor != 17 {
		t.Errorf("--key=value 形式：%+v, %v", opt2, err)
	}
	if _, err := parseDepsArgs([]string{"--password", "secret"}); err == nil {
		t.Error("不该存在 --password 参数")
	}
	if _, err := parseDepsArgs([]string{"pg", "minio"}); err == nil {
		t.Error("只能指定一个组件")
	}
	for _, bad := range []string{"--pg-major", "abc", "--pg-major=0", "--pg-major=100", "--pg-major=16;rm"} {
		if _, err := parseDepsArgs([]string{bad}); err == nil {
			t.Errorf("非法 --pg-major %q 应被拒绝", bad)
		}
	}
}

func TestValidatePgMajor(t *testing.T) {
	for _, raw := range []string{"1", "16", "99"} {
		if _, err := validatePgMajor(raw); err != nil {
			t.Errorf("%q 应通过：%v", raw, err)
		}
	}
	for _, raw := range []string{"", "0", "100", "-1", "1;echo", "1 2", "abc"} {
		if _, err := validatePgMajor(raw); err == nil {
			t.Errorf("%q 不该通过（会拼进远端 apt 包名）", raw)
		}
	}
}

func TestDepCatalogFiltersByComponent(t *testing.T) {
	all := depCatalog([]component{compPG, compMinio})
	if !hasDep(all, "pg_restore") || !hasDep(all, "mc") || !hasDep(all, "logrotate") {
		t.Fatalf("all 应含全部依赖：%v", depNames(all))
	}
	pg := depCatalog([]component{compPG})
	if !hasDep(pg, "pg_restore") || hasDep(pg, "mc") {
		t.Errorf("只装 pg 时不应要求 mc：%v", depNames(pg))
	}
	minio := depCatalog([]component{compMinio})
	if hasDep(minio, "pg_restore") || !hasDep(minio, "mc") {
		t.Errorf("只装 minio 时不应要求 pg_restore：%v", depNames(minio))
	}
	// 顺序稳定：不在采集循环里用 map 遍历，页面表格不会乱跳。
	if got := strings.Join(depNames(all), ","); got != strings.Join(depNames(depCatalog([]component{compPG, compMinio})), ",") {
		t.Error("依赖清单顺序不稳定")
	}
}

func depNames(in []depSpec) []string {
	out := make([]string, 0, len(in))
	for _, d := range in {
		out = append(out, d.Name)
	}
	return out
}

func hasDep(in []depSpec, name string) bool {
	for _, d := range in {
		if d.Name == name {
			return true
		}
	}
	return false
}

func TestDepsProbeCommandIsReadOnly(t *testing.T) {
	cmd := depsProbeCommand(depCatalog([]component{compPG, compMinio}))
	for _, want := range []string{
		"pg_restore", "mc", "logrotate", "DEPS_CHECK_OK=yes", "VER_mc",
		`[ -x "$p" ]`, "pg_restore|mc", "--version >/dev/null",
	} {
		if !strings.Contains(cmd, want) {
			t.Errorf("探测命令缺少 %s", want)
		}
	}
	for _, forbidden := range []string{"sudo", "rm -", "mv ", "apt-get", "docker", " > "} {
		if strings.Contains(cmd, forbidden) {
			t.Errorf("只读探测不该出现 %q：\n%s", forbidden, cmd)
		}
	}
}

func TestParseDepsProbeOutput(t *testing.T) {
	catalog := depCatalog([]component{compPG, compMinio})
	view, err := parseDepsProbeOutput(strings.Join([]string{
		"tar=yes", "crontab=yes", "ssh=yes", "scp=yes", "nc=yes",
		"pg_restore=no", "mc=no", "logrotate=no",
		"VER_mc=mc version RELEASE.2024-01-01",
		"DEPS_CHECK_OK=yes",
	}, "\n"), catalog, emptyDepsView("bk", "all", 0))
	if err != nil {
		t.Fatal(err)
	}
	if !view.Collected {
		t.Fatal("正常输出应 collected=true")
	}
	if strings.Join(view.Missing, ",") != "pg_restore,mc" {
		t.Errorf("missing = %v，想要 pg_restore,mc", view.Missing)
	}
	if strings.Join(view.Optional, ",") != "logrotate" {
		t.Errorf("optional = %v，想要 logrotate", view.Optional)
	}
	if len(view.Items) != len(catalog) {
		t.Errorf("items = %d，想要 %d", len(view.Items), len(catalog))
	}
	if len(view.Plan) < 3 {
		t.Errorf("缺两项依赖却没给出安装计划：%v", view.Plan)
	}
}

// 🔴 硬约束 3：「没采到」绝不等于「已装 / 依赖齐全」。
func TestParseDepsProbeOutputFailureIsUnknown(t *testing.T) {
	view, err := parseDepsProbeOutput("ssh: connect to host bk port 22: Connection refused",
		depCatalog([]component{compPG, compMinio}), emptyDepsView("bk", "all", 0))
	if err == nil {
		t.Fatal("探测脚本没跑完必须报错")
	}
	if view.Collected || len(view.Items) != 0 || len(view.Missing) != 0 {
		t.Errorf("采集失败不能推断任何状态：%+v", view)
	}
}

func TestDepsInstallScriptOfficialSources(t *testing.T) {
	// 默认：发行版仓库 + mc 官方地址链，不配置 PGDG（内网机器不额外依赖公网）。
	plain := depsInstallScript([]string{"pg_restore", "mc"})
	if !strings.Contains(plain, "postgresql-client") || strings.Contains(plain, "pgdg.sources") {
		t.Errorf("默认不该配置 PGDG 仓库：\n%s", plain)
	}
	for _, want := range []string{
		"dl.min.io/aistor/mc/release/linux-$arch/mc", // 官方文档当前地址
		"dl.minio.org.cn/client/mc/release/linux-$arch/mc", // 中国镜像（真机已验证）
	} {
		if !strings.Contains(plain, want) {
			t.Errorf("mc 下载地址缺少 %s", want)
		}
	}

	// 指定主版本：按 PostgreSQL 官方文档写 deb822 仓库 + 版本化客户端包。
	withMajor := depsInstallScriptWithMajor([]string{"pg_restore", "mc"}, 16)
	for _, want := range []string{
		"pgdg.sources", "apt.postgresql.org", "ACCC4CF8.asc", "postgresql-client-16",
		"VERSION_CODENAME",
	} {
		if !strings.Contains(withMajor, want) {
			t.Errorf("PGDG 安装脚本缺少 %s：\n%s", want, withMajor)
		}
	}
	if strings.Contains(withMajor, "apt-get install -y postgresql-client ") {
		t.Error("指定主版本时不该再装通用 postgresql-client")
	}
	// 只有 mc 缺失时不能生成 PGDG 段，也不能白跑 apt-get update。
	mcOnly := depsInstallScriptWithMajor([]string{"mc"}, 16)
	if strings.Contains(mcOnly, "pgdg.sources") || strings.Contains(mcOnly, "apt-get update") {
		t.Errorf("只装 mc 不该碰包管理器：\n%s", mcOnly)
	}
}

// 2026-11-07 k4 真机踩过：中国镜像 HEAD 200 但 GET 传 110 KB 后不再动，
// curl 默认无超时 → 界面「卡住不动」7 分钟。这条测试把所有网络操作钉上硬超时。
func TestDepsInstallScriptNoHangingDownloads(t *testing.T) {
	s := depsInstallScriptWithMajor([]string{"pg_restore", "mc"}, 16)
	for _, want := range []string{
		"--connect-timeout 8", "--max-time 90", "timeout 90 wget",
		"timeout 300 apt-get update", "timeout 900 apt-get install",
		"NEEDRESTART_MODE=l", // 装客户端不该顺手重启 docker / systemd-logind
		"timeout 20 docker images", "timeout 30 docker create", "timeout 30 docker cp",
		"(^|/)minio/minio:", // 私有仓库前缀的镜像也要认
		"/usr/bin/mc", "/usr/local/bin/mc",
		"==> 安装 mc", "==> 下载 mc", "WARN:",
		"mc_ok=0", `timeout 15 "$mc_path" --version`, // 半截下载 / 不可执行不算已装
	} {
		if !strings.Contains(s, want) {
			t.Errorf("安装脚本缺少 %q", want)
		}
	}
	// 离线提取必须排在外网下载之前：有镜像就完全不碰网络。
	if i, j := strings.Index(s, "docker images"), strings.Index(s, "for url in"); i < 0 || j < 0 || i > j {
		t.Error("离线镜像提取没有被排在外网下载之前")
	}
	// 任何 curl / wget 都不能裸跑。
	for _, line := range strings.Split(s, "\n") {
		if (strings.Contains(line, "curl -fsSL") && !strings.Contains(line, "--max-time")) ||
			(strings.Contains(line, "wget -q") && !strings.Contains(line, "timeout")) {
			t.Errorf("这条下载没有硬超时：%s", line)
		}
	}
	// 只缺 mc 时不该生成 apt 段（空 then 分支在 sh 里是语法错误）。
	mcOnly := depsInstallScript([]string{"mc"})
	if strings.Contains(mcOnly, "apt-get update") || strings.Contains(mcOnly, "NEEDRESTART_MODE") {
		t.Error("只装 mc 不该触发包管理器")
	}
	if strings.Contains(mcOnly, "then\nelif") || strings.Contains(mcOnly, "then\nelse") {
		t.Errorf("生成了空 then 分支：\n%s", mcOnly)
	}
}

func TestDepPlanUsesOfficialDocs(t *testing.T) {
	plan := depPlan([]string{"mc", "pg_restore"}, 0)
	if len(plan) < 3 || !strings.Contains(strings.Join(plan, "\n"), "postgresql-client") {
		t.Errorf("默认计划不完整：%v", plan)
	}
	major := strings.Join(depPlan([]string{"pg_restore"}, 16), "\n")
	if !strings.Contains(major, "PGDG") || !strings.Contains(major, "postgresql-client-16") {
		t.Errorf("指定主版本的计划没体现官方仓库：%s", major)
	}
	if len(depPlan(nil, 0)) != 0 {
		t.Error("没有缺失项不该给出安装计划")
	}
}

func TestDepsUsageHasOfficialDocs(t *testing.T) {
	u := depsUsage()
	for _, want := range []string{"backup deps", "--json", "--dry-run", "--pg-major", docPGClient, docMCClient} {
		if !strings.Contains(u, want) {
			t.Errorf("用法说明缺少 %s", want)
		}
	}
}
