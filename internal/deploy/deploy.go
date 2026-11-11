package deploy

// P3b-1：CLI 主链路执行器（六阶段状态机 + 落盘流转 + 两个 compose 单元 + 健康门）。
//
// 🔴 这一刀只开放 `ops deploy release ... --confirm yes` 一条显式发布路径；
//    `ops deploy ... --dry-run` 仍是 P3a 的只读预演，不带任何动词二者皆拒绝。
// 🔴 门禁按 §11.1：显式动词 / --confirm yes 服务端逐字再验 / 只读预检门 /
//    本地单例 + 远端 flock -n 双锁 / ValidateRelease / 配置备份与 :previous。
// 🔴 失败一律停在当前阶段、不跨阶段自动修复、不写「部署成功 / 服务已恢复正常」；
//    健康门失败**不自动回滚**（结论 C），保留现场供排障。
// 🔴 不发版台账、不写 state.env、不改 web/、不读 §8 的 12 个方案键（结论 F）。
// 🔴 本机没有 rsync：配置同步用 Go 内建 tar 流实现等价的分目录语义
//    （www 先清后传 = --delete；secrets 不清、权限 600；.env / compose / Caddyfile 覆盖）。
// 🔴 单测不真构建、不真 compose up、不真造故障：所有外部动作走可注入的 Runner。

import (
	"pass-up/ops/internal/shared"
)

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	StagePreflight  = "预检"
	StageConfigSync = "配置同步"
	StageBuild      = "构建"
	StageTransfer   = "传输"
	StageUp         = "拉起"
	StageHealth     = "健康门"

	// 结论 D：150 s 内置默认，不启用 PASS_UP_OPS_DEPLOY_HEALTH_TIMEOUT。
	DefaultHealthWindow = 150 * time.Second
	DefaultHealthPoll   = 5 * time.Second
	HealthStreak        = 2

	deployLockName = "pass-up-ops-deploy-release"
	maxHealthRound = 40
)

var stageOrder = []string{
	StagePreflight, StageConfigSync, StageBuild, StageTransfer, StageUp, StageHealth,
}

var healthEndpoints = []struct{ Name, URL string }{
	{"backend readiness", "http://127.0.0.1:8009/actuator/health/readiness"},
	{"ai health", "http://127.0.0.1:8006/resume/health"},
	{"web", "http://127.0.0.1:80/"},
}

// ReleaseConfig 是执行段的全部输入。参数来自 CLI / 清单 / compose / 内置默认，
// 没有任何一个来自 ops.env 的方案键。
type ReleaseConfig struct {
	Server, Host, Scope          string
	RemoteDir                    string
	ImagePrefix, ImageTag        string
	ConfigDir, AIConfigDir       string
	BackendRepo, AIRepo, WebRepo string
	ReleaseVersion, ReleaseNote  string
	NoBuild                      bool
	Timestamp                    string
	HealthWindow, HealthPoll     time.Duration
}

// GateResult / StageResult / ReleaseReport：所有切片恒非 nil（空数组红线）。
type GateResult struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail"`
}

type StageResult struct {
	Name    string `json:"name"`
	OK      bool   `json:"ok"`
	Skipped bool   `json:"skipped"`
	Detail  string `json:"detail"`
}

type ReleaseReport struct {
	Server         string        `json:"server"`
	Host           string        `json:"host"`
	Scope          string        `json:"scope"`
	ImagePrefix    string        `json:"image_prefix"`
	ImageTag       string        `json:"image_tag"`
	ReleaseVersion string        `json:"release_version"`
	ReleaseNote    string        `json:"release_note"`
	Gates          []GateResult  `json:"gates"`
	Stages         []StageResult `json:"stages"`
	FailedStage    string        `json:"failed_stage"`
	Completed      bool          `json:"completed"`
	Log            []string      `json:"log"`
	Warnings       []string      `json:"warnings"`
	Images         []string      `json:"images"`
	Error          string        `json:"error"`
	Note           string        `json:"note"`
	EnvLineEnding  string        `json:"env_line_ending"`
	PreviousTag    string        `json:"previous_tag"`
	DurationMS     int64         `json:"duration_ms"`
}

func newReleaseReport(cfg ReleaseConfig) ReleaseReport {
	return ReleaseReport{
		Server: cfg.Server, Host: cfg.Host, Scope: cfg.Scope,
		ImagePrefix: cfg.ImagePrefix, ImageTag: cfg.ImageTag,
		ReleaseVersion: cfg.ReleaseVersion, ReleaseNote: cfg.ReleaseNote,
		Gates: []GateResult{}, Stages: []StageResult{},
		Log: []string{}, Warnings: []string{}, Images: []string{},
		EnvLineEnding: "unknown", PreviousTag: "—",
		Note: "报告只报脚本结果；失败停在当前阶段、只报脚本结果，不宣称发布成功。",
	}
}

func (rep *ReleaseReport) gateOK(name, detail string) {
	rep.Gates = append(rep.Gates, GateResult{Name: name, OK: true, Detail: detail})
	rep.Log = append(rep.Log, "[门禁通过] "+name+"："+detail)
}

func (rep *ReleaseReport) stageOK(name, detail string) {
	rep.Stages = append(rep.Stages, StageResult{Name: name, OK: true, Detail: detail})
	rep.Log = append(rep.Log, "[阶段完成] "+name+"："+detail)
}

func (rep *ReleaseReport) stageSkip(name, detail string) {
	rep.Stages = append(rep.Stages, StageResult{Name: name, OK: true, Skipped: true, Detail: detail})
	rep.Log = append(rep.Log, "[阶段跳过] "+name+"："+detail)
}

func (rep *ReleaseReport) failAt(stage, gate string, err error) {
	if gate != "" {
		rep.Gates = append(rep.Gates, GateResult{Name: gate, OK: false, Detail: err.Error()})
	}
	rep.Stages = append(rep.Stages, StageResult{Name: stage, OK: false, Detail: err.Error()})
	rep.FailedStage = stage
	rep.Error = err.Error()
	rep.Log = append(rep.Log, "[失败] 停在「"+stage+"」阶段："+err.Error())
	rep.Note = "发布链路停在失败阶段；现场保留，不自动回滚、不自动修复、只报脚本结果。"
}

// ---- 门 5：ValidateRelease（纯函数，不发请求、不落台账、不拼命令） ----

var releaseVersionRe = regexp.MustCompile(`^v?[0-9]+\.[0-9]+\.[0-9]+$`)

func ValidateRelease(version, note string) error {
	if version == "" || !releaseVersionRe.MatchString(version) {
		return errors.New("发版号必须是三段式（如 1.16.1），不猜、不自动推算、不当镜像 tag")
	}
	if strings.ContainsAny(note, "\r\n") {
		return errors.New("项目备注必须单行（不写远端、不拼进任何命令）")
	}
	if len([]rune(note)) > 200 {
		return errors.New("项目备注最长 200 字")
	}
	return nil
}

// ---- 命令拼装（纯函数，单测锁死；不含任何真实凭证） ----

func lockPath(dir string) string { return dir + "/.deploy/lock" }

// withLock：正式发布路径的每条远端写命令都包 flock -n，拿不到立刻失败、不排队。
func withLock(dir, cmd string) string {
	return "flock -n " + shared.ShQuote(lockPath(dir)) + " sh -c " + shared.ShQuote(cmd)
}

func lockProbeCmd(dir string) string {
	return "mkdir -p " + shared.ShQuote(dir+"/.deploy") + " && flock -n " +
		shared.ShQuote(lockPath(dir)) + " -c 'echo LOCK_OK'"
}

func backupCommands(dir, ts string) []string {
	b := dir + "/.deploy/backup/" + ts
	return []string{
		"mkdir -p " + shared.ShQuote(b),
		"for f in .env docker-compose.base.yml docker-compose.yml Caddyfile; do " +
			"[ -f " + shared.ShQuote(dir+"/docker") + "/$f ] && cp -a " +
			shared.ShQuote(dir+"/docker") + "/$f " + shared.ShQuote(b) + "/ || true; done",
		"echo " + shared.ShQuote("BACKUP_OK "+b),
	}
}

func crlfProbeCmd(dir string) string {
	e := shared.ShQuote(dir + "/docker/.env")
	return "if [ -f " + e + " ]; then tr -cd '\\r' < " + e + " | wc -c | tr -d '[:space:]'; else echo missing; fi"
}

func crlfNormalizeCmd(dir string) string {
	return "sed -i 's/\\r$//' " + shared.ShQuote(dir+"/docker/.env")
}

// syncCommands：www 用 --delete 语义（先清内容再传），secrets 不清且权限 600。
func syncCommands(dir string) []string {
	return []string{
		"mkdir -p " + shared.ShQuote(dir+"/docker/www") + " " + shared.ShQuote(dir+"/docker/secrets") + " " + shared.ShQuote(dir+"/ai"),
		"find " + shared.ShQuote(dir+"/docker/www") + " -mindepth 1 -delete 2>/dev/null || true",
		"chmod 600 " + shared.ShQuote(dir+"/docker/secrets") + "/* 2>/dev/null || true",
	}
}

type LocalCmd struct {
	Desc string
	Dir  string
	Argv []string
}

func buildCommands(cfg ReleaseConfig) []LocalCmd {
	return []LocalCmd{
		{"构建 backend-java", cfg.BackendRepo, []string{"docker", "build", "-f", "docker/Dockerfile", "-t", cfg.ImagePrefix + "/backend-java:" + cfg.ImageTag, "."}},
		{"构建 ai", cfg.AIRepo, []string{"docker", "build", "-f", "docker/Dockerfile", "-t", cfg.ImagePrefix + "/ai:" + cfg.ImageTag, "."}},
		{"构建 web user", cfg.WebRepo, []string{"pnpm", "build:user"}},
		{"构建 web admin", cfg.WebRepo, []string{"pnpm", "build:admin"}},
	}
}

var (
	composeImageRe = regexp.MustCompile(`(?m)^\s*image:\s*([^\s#]+)`)
	imageTagVarRe  = regexp.MustCompile(`\$\{IMAGE_TAG(?::-latest)?\}`)
)

// imageRefsFromCompose：镜像引用逐字取自 compose 的 image:，只把 ${IMAGE_TAG} 换成
// 本次 tag；不做 docker tag 绕路（§4 / §11.3）。
func imageRefsFromCompose(cfg ReleaseConfig) ([]string, error) {
	files := []string{
		filepath.Join(cfg.ConfigDir, "docker-compose.base.yml"),
		filepath.Join(cfg.ConfigDir, "docker-compose.yml"),
	}
	if cfg.AIConfigDir != "" {
		files = append(files, filepath.Join(cfg.AIConfigDir, "docker-compose.yml"))
	}
	seen := map[string]bool{}
	refs := []string{}
	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			return nil, fmt.Errorf("读不到 compose %s：%w", filepath.Base(f), err)
		}
		for _, m := range composeImageRe.FindAllSubmatch(b, -1) {
			ref := imageTagVarRe.ReplaceAllString(string(m[1]), cfg.ImageTag)
			if ref == "" || seen[ref] {
				continue
			}
			seen[ref] = true
			refs = append(refs, ref)
		}
	}
	if len(refs) == 0 {
		return nil, errors.New("compose 里没有解析到任何 image: 引用")
	}
	return refs, nil
}

func archiveName(ref string) string {
	s := strings.NewReplacer("/", "_", ":", "_", "@", "_").Replace(ref)
	return s + ".tar.gz"
}

// shouldSkipUpload：断点续跑判据 —— 远端文件大小与本机一致才跳过。
func shouldSkipUpload(localSize, remoteSize int64) bool {
	return localSize > 0 && remoteSize >= 0 && remoteSize == localSize
}

// healthVerdict：每个 URL 都要在样本里出现连续 2 次 200。
// 四类判据：全 200 / 404 / 超时（0 或负数）/「第一次 200、第二次失败」。
func healthVerdict(samples map[string][]int) bool {
	for _, ep := range healthEndpoints {
		streak, ok := 0, false
		for _, code := range samples[ep.Name] {
			if code == 200 {
				streak++
				if streak >= HealthStreak {
					ok = true
					break
				}
			} else {
				streak = 0
			}
		}
		if !ok {
			return false
		}
	}
	return true
}

func upCommands(cfg ReleaseConfig) []string {
	d := cfg.RemoteDir
	tag := shared.ShQuote(cfg.ImageTag)
	return []string{
		"cd " + shared.ShQuote(d+"/docker") + " && IMAGE_TAG=" + tag +
			" docker compose -f docker-compose.base.yml -f docker-compose.yml up -d",
		"cd " + shared.ShQuote(d+"/ai") + " && IMAGE_TAG=" + tag +
			" docker compose -f docker-compose.yml up -d",
	}
}

// ---- 门 3：发布前只读预检（明确指出缺哪一项；不写远端） ----

func releasePreflightScript(dir string) string {
	return `set +e
D=` + shared.ShQuote(dir) + `
echo "SEC gate_proto=1"
[ -d "$D" ] && echo "SEC dir=present" || echo "SEC dir=missing"
[ -w "$D" ] && echo "SEC dir_w=yes" || echo "SEC dir_w=no"
[ -d "$D/docker" ] && echo "SEC docker_dir=present" || echo "SEC docker_dir=missing"
[ -d "$D/ai" ] && echo "SEC ai_dir=present" || echo "SEC ai_dir=missing"
[ -d /data ] && echo "SEC data=present" || echo "SEC data=missing"
[ -f "$D/docker/.env" ] && echo "SEC env=present" || echo "SEC env=missing"
[ -d "$D/docker/secrets" ] && echo "SEC secrets=present" || echo "SEC secrets=missing"
n=0
for f in docker-compose.base.yml docker-compose.yml Caddyfile; do
  [ -f "$D/docker/$f" ] && n=$((n+1))
done
echo "SEC compose_files=$n/3"
[ -f "$D/ai/docker-compose.yml" ] && echo "SEC ai_compose=present" || echo "SEC ai_compose=missing"
command -v docker >/dev/null 2>&1 && echo "SEC docker=yes" || echo "SEC docker=no"
docker compose version >/dev/null 2>&1 && echo "SEC compose=yes" || echo "SEC compose=no"
if [ -f "$D/.deploy/state.env" ]; then
  t=$(sed -n 's/^IMAGE_TAG=//p' "$D/.deploy/state.env" 2>/dev/null | head -n 1)
  echo "SEC previous=${t:-—}"
else
  echo "SEC previous=—"
fi
if [ -f "$D/docker/.env" ]; then
  c=$(tr -cd '\r' < "$D/docker/.env" 2>/dev/null | wc -c | tr -d '[:space:]')
  echo "SEC env_cr=${c:-—}"
else
  echo "SEC env_cr=missing"
fi
echo "SEC end=1"
`
}

type GateSnapshot struct {
	Blockers      []string
	Warnings      []string
	EnvLineEnding string
	PreviousTag   string
	DockerOK      bool
}

func parseReleasePreflight(text string) GateSnapshot {
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
	g := GateSnapshot{Blockers: []string{}, Warnings: []string{}, EnvLineEnding: "unknown", PreviousTag: "—"}
	if kv["gate_proto"] == "" {
		g.Blockers = append(g.Blockers, "发布前只读预检没返回分节数据（脚本没跑起来）")
		return g
	}
	missing := func(key, label string) {
		if kv[key] != "present" && kv[key] != "yes" {
			g.Blockers = append(g.Blockers, "缺前置："+label)
		}
	}
	missing("dir", "远端部署目录 "+DefaultRemoteDir+" 不存在")
	missing("dir_w", "部署目录对清单 user 不可写")
	missing("docker_dir", "远端 docker/ 目录不存在")
	missing("ai_dir", "远端 ai/ 目录不存在（ai 是独立 compose 单元）")
	missing("data", "远端 /data 不存在")
	missing("env", "远端 docker/.env 不存在")
	missing("secrets", "远端 docker/secrets/ 不存在")
	missing("ai_compose", "远端 ai/docker-compose.yml 不存在")
	missing("docker", "远端 docker 命令不可用")
	missing("compose", "远端 docker compose 插件不可用")
	if kv["compose_files"] != "3/3" {
		g.Blockers = append(g.Blockers, "缺前置：远端 compose / Caddyfile 不齐（"+kv["compose_files"]+"）")
	}
	g.DockerOK = kv["docker"] == "yes"
	switch {
	case kv["env"] == "missing" || kv["env_cr"] == "missing":
		g.EnvLineEnding = "missing"
	case kv["env_cr"] == "" || kv["env_cr"] == "—":
		g.EnvLineEnding = "unknown"
	case kv["env_cr"] == "0":
		g.EnvLineEnding = "lf"
	default:
		g.EnvLineEnding = "crlf"
	}
	if v := kv["previous"]; v != "" && v != "—" {
		g.PreviousTag = v
	}
	if g.EnvLineEnding == "unknown" {
		g.Warnings = append(g.Warnings, "远端 .env 换行未采集，不猜 LF；只在检出 CR 时归一化")
	}
	return g
}

// ---- Runner：所有外部动作可注入，单测不碰真机 ----

type Runner interface {
	Remote(ctx context.Context, cmd string) (string, error)
	RemoteStdin(ctx context.Context, cmd string, stdin io.Reader) (string, error)
	RemoteSize(ctx context.Context, path string) (int64, error)
	SaveImage(ctx context.Context, ref, localPath string) (int64, error)
	Local(ctx context.Context, argv []string, dir string) (string, error)
}

type SSHRunner struct{ Target *shared.SSHTarget }

func tailText(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) > n {
		return "…" + s[len(s)-n:]
	}
	return s
}

func (r *SSHRunner) Remote(ctx context.Context, cmd string) (string, error) {
	out, code, err := r.Target.Capture(ctx, cmd, false)
	if err != nil {
		return out, err
	}
	if code != 0 {
		return out, fmt.Errorf("远端命令失败（exit %d）：%s", code, tailText(out, 300))
	}
	return out, nil
}

func (r *SSHRunner) RemoteStdin(ctx context.Context, cmd string, stdin io.Reader) (string, error) {
	var buf bytes.Buffer
	code, err := r.Target.StreamWith(ctx, cmd, false, stdin, &buf)
	if err != nil {
		return buf.String(), err
	}
	if code != 0 {
		return buf.String(), fmt.Errorf("远端流式命令失败（exit %d）：%s", code, tailText(buf.String(), 300))
	}
	return buf.String(), nil
}

func (r *SSHRunner) RemoteSize(ctx context.Context, path string) (int64, error) {
	q := shared.ShQuote(path)
	out, err := r.Remote(ctx, "if [ -f "+q+" ]; then stat -c %s "+q+"; else echo -1; fi")
	if err != nil {
		return -1, err
	}
	v, err := strconv.ParseInt(strings.TrimSpace(out), 10, 64)
	if err != nil {
		return -1, fmt.Errorf("远端文件大小解析失败：%q", strings.TrimSpace(out))
	}
	return v, nil
}

// SaveImage：docker save → Go gzip(level 1) → 本机落盘；不依赖 shell / gzip 可执行文件。
func (r *SSHRunner) SaveImage(ctx context.Context, ref, localPath string) (int64, error) {
	cmd := exec.CommandContext(ctx, "docker", "save", ref)
	pipe, err := cmd.StdoutPipe()
	if err != nil {
		return 0, err
	}
	cmd.Stderr = os.Stderr
	f, err := os.Create(localPath)
	if err != nil {
		return 0, err
	}
	gz, err := gzip.NewWriterLevel(f, gzip.BestSpeed)
	if err != nil {
		f.Close()
		return 0, err
	}
	if err := cmd.Start(); err != nil {
		f.Close()
		return 0, err
	}
	_, copyErr := io.Copy(gz, pipe)
	waitErr := cmd.Wait()
	_ = gz.Close()
	_ = f.Close()
	if copyErr != nil {
		return 0, copyErr
	}
	if waitErr != nil {
		return 0, fmt.Errorf("docker save %s 失败：%w", ref, waitErr)
	}
	st, err := os.Stat(localPath)
	if err != nil {
		return 0, err
	}
	return st.Size(), nil
}

func (r *SSHRunner) Local(ctx context.Context, argv []string, dir string) (string, error) {
	if len(argv) == 0 {
		return "", errors.New("空命令")
	}
	c := exec.CommandContext(ctx, argv[0], argv[1:]...)
	if dir != "" {
		c.Dir = dir
	}
	b, err := c.CombinedOutput()
	if err != nil {
		return tailText(string(b), 300), fmt.Errorf("%s 失败：%w", argv[0], err)
	}
	return tailText(string(b), 300), nil
}

// ---- 配置同步：Go 内建 tar 流（本机无 rsync），等价分目录语义 ----

var configFileWhitelist = []string{
	".env", "docker-compose.base.yml", "docker-compose.yml", "Caddyfile", "nginx.conf",
}

func makeConfigArchive(dir string) ([]byte, error) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	add := func(path, name string) error {
		st, err := os.Stat(path)
		if err != nil || !st.Mode().IsRegular() {
			return nil // 缺文件跳过，不把整个同步搞失败
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		hdr := &tar.Header{Name: name, Mode: 0o600, Size: st.Size(), ModTime: st.ModTime()}
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		_, err = io.Copy(tw, f)
		return err
	}
	for _, name := range configFileWhitelist {
		if err := add(filepath.Join(dir, name), name); err != nil {
			return nil, err
		}
	}
	for _, sub := range []string{"www", "secrets"} {
		root := filepath.Join(dir, sub)
		_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
			if err != nil || info == nil || !info.Mode().IsRegular() {
				return nil
			}
			rel, e := filepath.Rel(dir, path)
			if e != nil {
				return nil
			}
			return add(path, filepath.ToSlash(rel))
		})
	}
	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func syncConfig(ctx context.Context, cfg ReleaseConfig, r Runner) error {
	pre := syncCommands(cfg.RemoteDir)
	if _, err := r.Remote(ctx, withLock(cfg.RemoteDir, pre[0])); err != nil {
		return err
	}
	if _, err := r.Remote(ctx, withLock(cfg.RemoteDir, pre[1])); err != nil {
		return err // www 先清后传 = --delete
	}
	mainTar, err := makeConfigArchive(cfg.ConfigDir)
	if err != nil {
		return err
	}
	cmd := "tar xzf - -C " + shared.ShQuote(cfg.RemoteDir+"/docker")
	if _, err := r.RemoteStdin(ctx, withLock(cfg.RemoteDir, cmd), bytes.NewReader(mainTar)); err != nil {
		return fmt.Errorf("同步 docker/ 配置失败：%w", err)
	}
	if cfg.AIConfigDir != "" {
		aiTar, err := makeConfigArchive(cfg.AIConfigDir)
		if err != nil {
			return err
		}
		cmd = "tar xzf - -C " + shared.ShQuote(cfg.RemoteDir+"/ai")
		if _, err := r.RemoteStdin(ctx, withLock(cfg.RemoteDir, cmd), bytes.NewReader(aiTar)); err != nil {
			return fmt.Errorf("同步 ai/ 配置失败：%w", err)
		}
	}
	if _, err := r.Remote(ctx, withLock(cfg.RemoteDir, pre[2])); err != nil {
		return err // secrets 不清、权限 600
	}
	return nil
}

// ---- 阶段 ④：逐镜像落盘 + 断点续传 + 一次只 load 一个 ----

func transferImages(ctx context.Context, cfg ReleaseConfig, r Runner, rep *ReleaseReport) error {
	refs, err := imageRefsFromCompose(cfg)
	if err != nil {
		return err
	}
	rep.Images = append(rep.Images, refs...)
	tmp, err := os.MkdirTemp("", "passup-deploy-")
	if err != nil {
		return err
	}
	success := false
	defer func() {
		if success {
			_ = os.RemoveAll(tmp) // 只删自己这次创建的临时目录
		} else {
			rep.Warnings = append(rep.Warnings, "失败保留现场：本机暂存目录 "+tmp+" 未清理")
		}
	}()

	localPaths := []string{}
	remotePaths := []string{}
	for _, ref := range refs {
		name := archiveName(ref)
		lp := filepath.Join(tmp, name)
		rp := cfg.RemoteDir + "/.images/" + name
		size, err := r.SaveImage(ctx, ref, lp)
		if err != nil {
			return fmt.Errorf("保存镜像 %s 失败（停在传输阶段）：%w", ref, err)
		}
		localPaths = append(localPaths, lp)
		remotePaths = append(remotePaths, rp)
		rs, err := r.RemoteSize(ctx, rp)
		if err != nil {
			return err
		}
		if shouldSkipUpload(size, rs) {
			rep.Log = append(rep.Log, "断点续跑：远端 "+name+" 大小一致（"+strconv.FormatInt(size, 10)+" B），跳过上传")
			continue
		}
		f, err := os.Open(lp)
		if err != nil {
			return err
		}
		_, uploadErr := r.RemoteStdin(ctx, withLock(cfg.RemoteDir, "cat > "+shared.ShQuote(rp)), f)
		_ = f.Close()
		if uploadErr != nil {
			return fmt.Errorf("传输 %s 失败（已落盘文件保留供续跑）：%w", name, uploadErr)
		}
		rep.Log = append(rep.Log, "已落盘 "+name+"（"+strconv.FormatInt(size, 10)+" B）")
	}
	for i, rp := range remotePaths {
		out, err := r.Remote(ctx, withLock(cfg.RemoteDir, "gunzip -c "+shared.ShQuote(rp)+" | docker load"))
		if err != nil {
			return fmt.Errorf("加载镜像 %s 失败：%w", refs[i], err)
		}
		rep.Log = append(rep.Log, "load "+refs[i]+"："+tailText(out, 120))
		usage, _ := r.Remote(ctx, "free -m | head -n 2; df -Pk "+shared.ShQuote(cfg.RemoteDir)+" | tail -n 1")
		rep.Log = append(rep.Log, "load 后资源余量："+tailText(usage, 160))
	}
	// 结论 A：成功后按本次清单逐个删，不 rm -rf 暂存目录。
	quoted := make([]string, 0, len(remotePaths))
	for _, p := range remotePaths {
		quoted = append(quoted, shared.ShQuote(p))
	}
	if len(quoted) > 0 {
		if _, err := r.Remote(ctx, withLock(cfg.RemoteDir, "rm -f "+strings.Join(quoted, " "))); err != nil {
			rep.Warnings = append(rep.Warnings, "按清单清理远端 tar.gz 失败："+err.Error())
		}
	}
	for _, lp := range localPaths {
		_ = os.Remove(lp)
	}
	success = true
	return nil
}

// ---- 六阶段编排 ----

func RunRelease(ctx context.Context, cfg ReleaseConfig, r Runner) ReleaseReport {
	start := time.Now()
	rep := newReleaseReport(cfg)
	defer func() { rep.DurationMS = time.Since(start).Milliseconds() }()

	// 门 3：只读预检（缺哪项就点名，不开始构建 / 不同步）
	out, err := r.Remote(ctx, releasePreflightScript(cfg.RemoteDir))
	if err != nil {
		rep.failAt(StagePreflight, "只读预检门", err)
		return rep
	}
	gate := parseReleasePreflight(out)
	if len(gate.Blockers) > 0 {
		rep.failAt(StagePreflight, "只读预检门", errors.New(strings.Join(gate.Blockers, "；")))
		return rep
	}
	rep.EnvLineEnding = gate.EnvLineEnding
	rep.PreviousTag = gate.PreviousTag
	rep.Warnings = append(rep.Warnings, gate.Warnings...)
	rep.gateOK("只读预检门", "九项前置齐全；.env 换行="+EnvEndingText(gate.EnvLineEnding))
	rep.Log = append(rep.Log, "发布前当前镜像 tag（:previous）="+gate.PreviousTag)

	// 门 4：远端锁（本地单例由 CLI 层持有）
	if _, err := r.Remote(ctx, lockProbeCmd(cfg.RemoteDir)); err != nil {
		rep.failAt(StagePreflight, "双锁", fmt.Errorf("撞锁或拿不到远端锁，立刻失败不排队：%w", err))
		return rep
	}
	rep.gateOK("双锁", "本地单例 + 远端 flock -n 均可用；撞锁不排队")
	rep.stageOK(StagePreflight, "只读预检与双锁通过，预检阶段不写业务文件")

	// 阶段 ② + 门 6：配置备份 + 同步
	for _, c := range backupCommands(cfg.RemoteDir, cfg.Timestamp) {
		if _, err := r.Remote(ctx, withLock(cfg.RemoteDir, c)); err != nil {
			rep.failAt(StageConfigSync, "发布前留退路", fmt.Errorf("配置备份没成功就不往下走：%w", err))
			return rep
		}
	}
	rep.gateOK("发布前留退路", "配置已备份到 .deploy/backup/"+cfg.Timestamp+"/，:previous="+gate.PreviousTag)
	crOut, err := r.Remote(ctx, crlfProbeCmd(cfg.RemoteDir))
	if err != nil {
		rep.failAt(StageConfigSync, "", err)
		return rep
	}
	cr := parseCRLF(crOut)
	if err := syncConfig(ctx, cfg, r); err != nil {
		rep.failAt(StageConfigSync, "", err)
		return rep
	}
	if cr == "crlf" {
		if _, err := r.Remote(ctx, withLock(cfg.RemoteDir, crlfNormalizeCmd(cfg.RemoteDir))); err != nil {
			rep.failAt(StageConfigSync, "", fmt.Errorf("检出 CR 但归一化失败：%w", err))
			return rep
		}
		rep.Log = append(rep.Log, "远端 .env 检出 CR，已归一化；本机 LF 不作判据")
	} else {
		rep.Log = append(rep.Log, "远端 .env 换行探测="+cr+"（未检出 CR，不归一化）")
	}
	rep.stageOK(StageConfigSync, "分目录同步：www 先清后传、secrets 不清且 600、不打印内容")

	// 阶段 ③：默认每轮构建；--no-build 是 §11.10 结论 9 的显式快路径。
	if cfg.NoBuild {
		rep.stageSkip(StageBuild, "显式 --no-build：复用现成镜像（§9.8 实证快路径），三条构建链本次未验证")
	} else {
		for _, c := range buildCommands(cfg) {
			if _, err := r.Local(ctx, c.Argv, c.Dir); err != nil {
				rep.failAt(StageBuild, "", fmt.Errorf("%s 失败（本机动作，不碰远端）：%w", c.Desc, err))
				return rep
			}
		}
		rep.stageOK(StageBuild, "backend / ai / web 三条构建链完成")
	}

	// 阶段 ④：落盘流转 + 断点续传
	if err := transferImages(ctx, cfg, r, &rep); err != nil {
		rep.failAt(StageTransfer, "", err)
		return rep
	}
	rep.stageOK(StageTransfer, "逐镜像 gzip 落盘 → 按远端大小跳过 → 一次只 load 一个 → 成功后按清单删除")

	// 阶段 ⑤：两个 compose 单元（合并视图 → ai 独立视图）
	for _, c := range upCommands(cfg) {
		if _, err := r.Remote(ctx, withLock(cfg.RemoteDir, c)); err != nil {
			rep.failAt(StageUp, "", fmt.Errorf("compose up 失败：%w", err))
			return rep
		}
	}
	rep.stageOK(StageUp, "合并视图 + ai 独立视图各一次 up -d；不 down -v、不加 --remove-orphans")

	// 阶段 ⑥：150 s 启动窗口、每 5 s 轮询、三个 URL 各连续 2 次 200。
	samples := map[string][]int{}
	window := cfg.HealthWindow
	if window <= 0 {
		window = DefaultHealthWindow
	}
	poll := cfg.HealthPoll
	deadline := time.Now().Add(window)
	for round := 0; round < maxHealthRound; round++ {
		for _, ep := range healthEndpoints {
			o, e := r.Remote(ctx, "curl -s -o /dev/null -w '%{http_code}' --max-time 5 "+shared.ShQuote(ep.URL))
			code := 0
			if e == nil {
				code, _ = strconv.Atoi(strings.TrimSpace(o))
			}
			samples[ep.Name] = append(samples[ep.Name], code)
		}
		if healthVerdict(samples) {
			rep.stageOK(StageHealth, "三个 URL 各连续 2 次 200（窗口 150 s 内）")
			rep.Completed = true
			rep.Note = "发布链路执行完成（六阶段全部通过）；本次未落发版台账、未写 state.env、未启用任何配置键。"
			return rep
		}
		if time.Now().After(deadline) || round == maxHealthRound-1 {
			rep.failAt(StageHealth, "", fmt.Errorf("启动窗口 %s 内没达到「三个 URL 各连续 2 次 200」；停在当前阶段、不自动回滚、保留现场", window))
			return rep
		}
		if poll <= 0 {
			continue
		}
		select {
		case <-ctx.Done():
			rep.failAt(StageHealth, "", ctx.Err())
			return rep
		case <-time.After(poll):
		}
	}
	rep.failAt(StageHealth, "", errors.New("健康门轮询异常结束"))
	return rep
}

func parseCRLF(out string) string {
	s := strings.TrimSpace(out)
	switch {
	case s == "missing", s == "":
		return "missing"
	case s == "0":
		return "lf"
	default:
		return "crlf"
	}
}
