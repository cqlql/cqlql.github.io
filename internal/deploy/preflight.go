package deploy

// 远端只读预检：一条 `sh -s` 脚本，全程只读，不提权、不喂 sudo 密码。
//
// 🔴 脚本里不能有 mkdir / touch / rm / flock -n / sed -i / rsync / docker build /
//    docker save / compose up / 任何写文件重定向；deploy_test.go 会锁住这条。
//    「第一刀不拿远端锁」见 docs/deploy.md §3.1 —— 拿锁本身就是写文件。
// 🔴 输出走 `SEC k=v` 分节纯文本（与 monitor 采集同口径），不回显 .env / secrets
//    内容，也不打印私钥路径；错误只说 user@host:port。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"fmt"
	"regexp"
	"strings"
)

// preflightScript 只做只读探测。值里的换行全部压掉，保证一行一条 SEC。
func preflightScript() string {
	return `set +e
D=/opt/passup
E="$D/docker/.env"
echo "SEC proto=1"
if command -v docker >/dev/null 2>&1; then
  v=$(docker info --format '{{.ServerVersion}}' 2>/dev/null | head -n 1)
  echo "SEC docker=${v:-—}"
  cv=$(docker compose version --short 2>/dev/null | head -n 1)
  echo "SEC compose=${cv:-—}"
else
  echo "SEC docker=—"
  echo "SEC compose=—"
fi
if [ -d "$D" ]; then echo "SEC dir=present"; else echo "SEC dir=missing"; fi
if [ -w "$D" ]; then echo "SEC dir_w=yes"; else echo "SEC dir_w=no"; fi
if [ -f "$E" ]; then
  n=$(tr -cd '\r' < "$E" 2>/dev/null | wc -c | tr -d '[:space:]')
  echo "SEC env=present"
  echo "SEC env_cr=${n:-—}"
else
  echo "SEC env=missing"
  echo "SEC env_cr=—"
fi
n=0
for f in docker-compose.base.yml docker-compose.yml Caddyfile; do
  if [ -f "$D/docker/$f" ]; then n=$((n+1)); fi
done
echo "SEC compose_files=$n/3"
if command -v ss >/dev/null 2>&1; then
  # 🔴 旧写法按行尾锚点匹配端口，永远采不到：ss -ltn 的行尾是 Peer Address，
  #    端口只在第 4 列 Local Address:Port。取第 4 列末段（兼容 IPv6 的 [::]:80），
  #    再按本项目端口白名单过滤。见 TestPreflightPortProbeUsesLocalAddress。
  p=$(ss -ltn 2>/dev/null | awk 'NR==1{next}{n=split($4,a,":");print ":" a[n]}' | grep -xE ':(80|81|82|5432|6379|8005|8006|8007|8008|8009)' | sort -u | tr '\n' ',' | sed 's/,$//')
  echo "SEC ports=${p:-—}"
else
  echo "SEC ports=—"
fi
if [ -d "$D" ]; then
  d=$(df -Pk "$D" 2>/dev/null | awk 'NR==2 {print $4}')
  echo "SEC disk_kb=${d:-—}"
else
  echo "SEC disk_kb=—"
fi
if [ -f "$D/.deploy/state.env" ]; then
  r=$(sed -n 's/^RELEASE_VERSION=//p' "$D/.deploy/state.env" 2>/dev/null | head -n 1)
  echo "SEC release=${r:-—}"
else
  echo "SEC release=—"
fi
echo "SEC end=1"
`
}

// Collect 跑一次只读预检。连不上 / 脚本失败也回一份完整快照（collected=false）。
func Collect(ctx context.Context, t *shared.SSHTarget, host string) Preflight {
	// 只读采集不提权：清掉 sudo 密码，RunScript 也不接受 root 参数。
	t.SudoPassword = ""
	text, err := t.RunScript(ctx, preflightScript())
	if err != nil {
		pf := emptyPreflight(host, scrub(err.Error()))
		// 远端脚本可能已经吐出部分分节数据：只有真采到（collected=true）才合并，
		// 否则会把 pf.Error 里真正的 ssh 失败原因覆盖成「没有分节数据」。
		if parsed := parsePreflight(text, host); parsed.Collected && len(parsed.Checks) > 0 {
			pf.Checks = parsed.Checks
			pf.EnvLineEnding = parsed.EnvLineEnding
		}
		return pf
	}
	return parsePreflight(text, host)
}

var identityPathRe = regexp.MustCompile(`(?i)Identity file [^\s,;]+|/[\w./-]*id_rsa[\w.-]*|\.pem\b`)

// scrub 挡住 ssh 报错里可能带出的私钥路径（硬约束 8）。
func scrub(s string) string {
	return identityPathRe.ReplaceAllString(s, "<已隐去>")
}

// parsePreflight 是纯函数：把 SEC 分节文本投影成完整快照。
func parsePreflight(text, host string) Preflight {
	kv := map[string]string{}
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "SEC ") {
			continue
		}
		parts := strings.SplitN(strings.TrimPrefix(line, "SEC "), "=", 2)
		if len(parts) == 2 {
			kv[parts[0]] = strings.TrimSpace(parts[1])
		}
	}
	if kv["proto"] == "" {
		return emptyPreflight(host, "远端只读脚本没有返回分节数据")
	}

	val := func(k string) string {
		v := strings.TrimSpace(kv[k])
		if v == "" || v == "—" {
			return notCollected
		}
		return v
	}

	pf := Preflight{
		Collected:     true,
		Host:          host,
		Checks:        []Check{},
		EnvLineEnding: "unknown",
		Blockers:      []string{},
		Warnings:      []string{},
	}

	add := func(name string, ok bool, value, detail string) {
		pf.Checks = append(pf.Checks, Check{Name: name, OK: ok, Value: value, Detail: detail})
	}

	docker := val("docker")
	add("Docker 版本", docker != notCollected, docker, "只读 docker info；不提权")
	compose := val("compose")
	add("compose 插件版本", compose != notCollected, compose, "只读 docker compose version --short")

	dir := kv["dir"]
	dirText := "缺失"
	if dir == "present" {
		dirText = "存在"
	}
	add("部署目录 "+DefaultRemoteDir, dir == "present", dirText, "只读 test -d；第一刀不 mkdir")
	if dir != "present" {
		pf.Warnings = append(pf.Warnings, "缺前置：远端 "+DefaultRemoteDir+" 不存在（正式发布前需人准备，第一刀不构建、不创建）")
	}

	writable := kv["dir_w"]
	wText := "不可写"
	if writable == "yes" {
		wText = "可写"
	}
	add("部署目录可写", writable == "yes", wText, "只读 test -w")
	if writable != "yes" {
		pf.Warnings = append(pf.Warnings, "缺前置：部署目录对清单 user 不可写（确认 docker 组 / 免密 sudo -n，勿照抄 deploy.sh 的 root 直连）")
	}

	// CRLF 只按远端探测结论说话：本机检出的 .env 是 LF，不作判据（§3.2）。
	envState := kv["env"]
	cr := kv["env_cr"]
	switch {
	case envState == "missing":
		pf.EnvLineEnding = "missing"
	case cr == "" || cr == "—":
		pf.EnvLineEnding = "unknown"
	case cr == "0":
		pf.EnvLineEnding = "lf"
	default:
		pf.EnvLineEnding = "crlf"
	}
	add("远端 .env 换行", pf.EnvLineEnding != "unknown" && pf.EnvLineEnding != "missing",
		EnvEndingText(pf.EnvLineEnding), "tr -cd '\\r' | wc -c；只读，不归一化")
	if envState == "missing" {
		pf.Warnings = append(pf.Warnings, "缺前置：远端 docker/.env 不存在；换行结论为「文件不存在」，不猜 LF")
	}

	files := val("compose_files")
	add("compose / Caddyfile", files == "3/3", files, "只读 -f 检查 3 个文件")
	if files != "3/3" {
		pf.Warnings = append(pf.Warnings, "缺前置：远端 compose / Caddyfile 不齐（"+files+"）；正式发布前需人同步，第一刀不 rsync")
	}

	ports := val("ports")
	add("关键端口监听", ports != notCollected, ports, "只读 ss -ltn，只列本项目端口")

	disk := val("disk_kb")
	diskText := notCollected
	if disk != notCollected {
		diskText = disk + " KiB 可用"
	}
	add("部署盘余量", disk != notCollected, diskText, "只读 df -Pk，原样回显、不猜单位")

	release := strings.Trim(strings.TrimSpace(kv["release"]), "'\"")
	if release == "" || release == "—" {
		release = notCollected
	}
	add("线上版本号", release != notCollected, release,
		"只读 sed 提取 state.env；未采集显示「—」，不猜 0 / 1.0.0（§10.1）")
	if release == notCollected {
		pf.Warnings = append(pf.Warnings, "线上版本号未采集（state.env 不存在或没有 RELEASE_VERSION）：显示「未采集 / 首次发版」，不猜 0")
	}

	if len(pf.Warnings) > 0 {
		pf.Warnings = append([]string{
			"下列「缺前置」是正式发布的前置条件，**不是第一刀的预演阻塞**：本次不构建、不 compose up、不改远端任何文件。",
		}, pf.Warnings...)
	}
	return pf
}

// PreflightCheckNames 给报告与单测共用，保证九项一项不少。
func PreflightCheckNames() []string {
	return []string{
		"Docker 版本", "compose 插件版本", "部署目录 /opt/passup", "部署目录可写",
		"远端 .env 换行", "compose / Caddyfile", "关键端口监听", "部署盘余量", "线上版本号",
	}
}

// HostLabel 只给展示用，绝不含私钥路径 / sudo 密码。
func HostLabel(t *shared.SSHTarget) string {
	if t == nil {
		return notCollected
	}
	return fmt.Sprintf("%s@%s:%d", t.User, t.Host, t.Port)
}
