package component

// 只读体检：把远端 check.sh 的 KEY=VALUE 输出解析成结构化状态。
//
// 🔴 「连不上」不等于「未安装」：ssh 自身失败（exit 255）时 Collected=false、
//     所有组件标 unknown，绝不用 0 / 空值兜底（AGENTS.md 硬约束 3）。
// 🔴 失败响应里的数组一律是 [] 而不是 null：Go 的 nil slice 编成 JSON 是 null，
//     前端 .find / .map 会整页白屏（见 docs/ui.md §11.4）。
// 🔴 每个已接入组件一份 <id>/check.sh，Collect 逐个跑、合并 KEY=VALUE；
//     新增组件 = 注册表加一条 + 放一个只读脚本，不用改采集循环。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/base64"
	"fmt"
	"io/fs"
	"strconv"
	"strings"
)

const (
	componentRoot    = "deploy/component"
	dockerCheckRel   = "docker/check.sh"
	dockerInstallRel = "docker/install.sh"
	minioCheckRel    = "minio/check.sh"
	minioInstallRel  = "minio/install.sh"
)

// LocalFacts 来自**本机**配置文件（backup/minio.env），不是远端采集结果。
// 🔴 只放「是否已配置」这样的布尔标记与非凭证的 URL 端口，绝不把凭证值
//    塞进 StatusView —— 它会进 HTTP 响应、进页面、进日志。
type LocalFacts struct {
	MinioRootUserSet   bool   `json:"minio_root_user_set"`
	MinioRootSecretSet bool   `json:"minio_root_secret_set"`
	DestURL            string `json:"dest_url,omitempty"`
	DestURLPort        string `json:"dest_url_port,omitempty"`
	MinioEnvPath       string `json:"-"` // 只给 CLI 提示用，不进页面
}

type CheckItem struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Value string `json:"value"`
	State string `json:"state"` // ok / warn / err / off
}

// ImageInfo 是目标机上已导入的离线镜像（只读体检采集）。
type ImageInfo struct {
	Reference string `json:"reference"`
	ID        string `json:"id"`
	Size      string `json:"size"`
	Created   string `json:"created"`
}

type ComponentStatus struct {
	Component
	State     string      `json:"state"` // missing / ok / degraded / unknown / planned
	Version   string      `json:"version"`
	Checks    []CheckItem `json:"checks"`
	Collected bool        `json:"collected"`
	Error     string      `json:"error,omitempty"`
	// Preflight 是**这个组件**的安装预检结论。全局 view.preflight 是 docker 的兼容视图，
	// 页面按选中组件读这里，免得选中 MinIO 却显示 Docker 的 apt 检查结论。
	Preflight Preflight `json:"preflight"`
}

// Preflight 是安装前的只读结论；服务端 dry-run 门直接用它拦人。
type Preflight struct {
	Ready    bool     `json:"ready"`
	Blockers []string `json:"blockers"`
	Warnings []string `json:"warnings"`
}

type StatusView struct {
	Server     string               `json:"server"`
	Collected  bool                 `json:"collected"`
	Error      string               `json:"error,omitempty"`
	Components []ComponentStatus    `json:"components"`
	Checks     []CheckItem           `json:"checks"`
	Raw        map[string]string    `json:"raw"`
	Preflight  Preflight            `json:"preflight"`  // 兼容旧前端：docker 的预检
	Preflights map[string]Preflight `json:"preflights"` // 按组件 id 的预检
	Images     []ImageInfo          `json:"images"`     // 目标机已导入的离线镜像
	Local      LocalFacts           `json:"local"`      // 本机配置事实，不含凭证
	// Actions 是 Go 侧按注册表 + 体检结果算好的写动作计划（§8.4）：
	// 能否执行、阻塞原因、影响清单、附加确认全在这里，前端只渲染。
	Actions map[string][]ActionPlan `json:"actions"`
}

func emptyView(server string) StatusView {
	return StatusView{
		Server:     server,
		Components: []ComponentStatus{},
		Checks:     []CheckItem{},
		Raw:        map[string]string{},
		Preflight:  Preflight{Blockers: []string{}, Warnings: []string{}},
		Preflights: map[string]Preflight{},
		Images:     []ImageInfo{},
		Actions:    map[string][]ActionPlan{},
	}
}

func unknownComponents(view *StatusView, reason string) {
	for _, c := range All() {
		view.Components = append(view.Components, ComponentStatus{
			Component: c, State: "unknown", Version: "—",
			Checks: []CheckItem{}, Collected: false, Error: reason,
			Preflight: Preflight{Blockers: []string{reason}, Warnings: []string{}},
		})
	}
	view.Preflight.Blockers = append(view.Preflight.Blockers, reason)
	// 采不到状态时也要下发一份「全部禁用 + 原因」的计划，别让前端自己算。
	view.Actions = BuildActions(*view)
}

// readScript 从注入的脚本树里读一个文件；src 可以是 embed.FS 的 Sub，也可以是 MapFS。
func readScript(scripts fs.FS, rel string) ([]byte, error) {
	sub, err := fs.Sub(scripts, componentRoot)
	if err != nil {
		return nil, err
	}
	return fs.ReadFile(sub, rel)
}

// remoteScriptCmd 把脚本 base64 后交给远端 bash，避免多行 / 单引号 / $'..'
// 在 ssh 参数里被二次解释。脚本内容完全来自二进制，不接任何用户输入。
func remoteScriptCmd(data []byte) string {
	return "printf %s " + shared.ShQuote(base64.StdEncoding.EncodeToString(data)) + " | base64 -d | bash"
}

func parseKV(out string) map[string]string {
	m := map[string]string{}
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSuffix(strings.TrimSpace(line), "\r")
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(k)
		if k == "" || strings.ContainsAny(k, " \t") {
			continue
		}
		for _, ch := range k {
			if !(ch >= 'A' && ch <= 'Z') && ch != '_' && !(ch >= '0' && ch <= '9') {
				k = ""
				break
			}
		}
		if k != "" {
			m[k] = strings.TrimSpace(v)
		}
	}
	return m
}

// Collect 是 4 参数兼容入口（测试与不关心本机配置时用它）。
func Collect(ctx context.Context, t *shared.SSHTarget, scripts fs.FS, server string) StatusView {
	return CollectWithLocal(ctx, t, scripts, server, LocalFacts{})
}

// CollectWithLocal 在目标机跑每个已接入组件的**只读**体检。
// 它不写任何远端文件、不提权、不装包；一个组件采不到就整体 collected=false，
// 绝不拿「空值」冒充「未安装」。
func CollectWithLocal(ctx context.Context, t *shared.SSHTarget, scripts fs.FS, server string, local LocalFacts) StatusView {
	view := emptyView(server)
	view.Local = local
	raw := map[string]string{}

	for _, c := range All() {
		if c.Phase != PhaseReady {
			continue
		}
		rel := c.ID + "/check.sh"
		data, err := readScript(scripts, rel)
		if err != nil {
			reason := "嵌入的组件脚本不完整（" + rel + "）：" + err.Error()
			view.Error = reason
			unknownComponents(&view, reason)
			return view
		}
		out, _, err := t.Capture(ctx, remoteScriptCmd(data), false)
		if err != nil {
			reason := "ssh 连接失败（exit 255，不推断组件状态）：" + err.Error()
			view.Error = reason
			unknownComponents(&view, reason)
			return view
		}
		part := parseKV(out)
		if part["CHECK_OK"] != "yes" {
			reason := "只读体检脚本未正常完成（" + rel + "），未能采集组件状态"
			view.Error = reason
			unknownComponents(&view, reason)
			return view
		}
		for k, v := range part {
			if k != "CHECK_OK" {
				raw[k] = v
			}
		}
	}

	view.Raw = raw
	view.Collected = true
	view.Checks = dockerCheckItems(raw)
	view.Images = parseImageLines(raw["MINIO_IMAGE_LINES"])
	view.Preflight = Evaluate(raw)
	view.Preflights["docker"] = view.Preflight

	// 先算状态，再按依赖声明算各组件的预检门。
	// 🔴 update 态由「apt 候选版本 ≠ 已装版本」/「已导入镜像 ≠ 当前容器镜像」推导，
	//    两者都来自 check.sh 的只读采集，绝不在线查询版本。
	states := map[string]string{}
	for _, c := range All() {
		if c.Phase != PhaseReady {
			states[c.ID] = "planned"
			continue
		}
		switch c.ID {
		case "minio":
			states[c.ID], _ = deriveMinioStateWithImages(raw, view.Images)
		default:
			states[c.ID], _ = deriveDockerState(raw)
		}
	}
	view.Preflights["minio"] = EvaluateMinio(raw, local, DependsReady(mustLookup("minio"), states))

	for _, c := range All() {
		cs := ComponentStatus{
			Component: c, Checks: []CheckItem{}, Collected: true,
			Preflight: Preflight{Blockers: []string{}, Warnings: []string{}},
		}
		if c.Phase == PhasePlanned {
			cs.State = "planned"
			cs.Version = "—"
			cs.Collected = false
			cs.Preflight.Blockers = []string{"该组件尚未接入"}
		} else {
			cs.State = states[c.ID]
			switch c.ID {
			case "minio":
				_, cs.Version = deriveMinioStateWithImages(raw, view.Images)
				cs.Checks = minioCheckItems(raw, local)
				cs.Preflight = view.Preflights["minio"]
			default:
				_, cs.Version = deriveDockerState(raw)
				cs.Checks = view.Checks
				cs.Preflight = view.Preflights["docker"]
			}
		}
		view.Components = append(view.Components, cs)
	}
	view.Actions = BuildActions(view)
	return view
}

func mustLookup(id string) Component {
	c, _ := Lookup(id)
	return c
}

// deriveDockerState：未装 = missing；服务 / 插件异常 = degraded；
// apt 候选版本比已装版本新 = update；否则 ok。
// 🔴 版本只来自 check.sh 的 apt-cache policy（只读），绝不在线查。
func deriveDockerState(raw map[string]string) (string, string) {
	if raw["DOCKER_INSTALLED"] != "yes" {
		return "missing", ""
	}
	v := raw["DOCKER_VERSION"]
	if raw["DOCKER_SERVICE"] != "active" || raw["COMPOSE_PLUGIN"] != "yes" {
		return "degraded", v
	}
	if _, _, upgrade := dockerCandidate(raw); upgrade {
		return "update", v
	}
	return "ok", v
}

// deriveMinioState 保留 1 参数兼容入口（只用于不关心镜像清单的调用 / 旧测试）。
func deriveMinioState(raw map[string]string) (string, string) {
	return deriveMinioStateWithImages(raw, nil)
}

// deriveMinioStateWithImages：容器在跑且健康、且目标机有**与当前不同的已导入镜像**
// = update；健康但没新镜像 = ok；跑着但不健康 / 停了 = degraded；
// 没有容器 = missing；采不到（脚本没给状态 / daemon 查不动）= unknown。
// 🔴 绝不把「读不到镜像列表」当成「没有新镜像」：那种情况下最多是 ok，不是 update。
func deriveMinioStateWithImages(raw map[string]string, images []ImageInfo) (string, string) {
	container := raw["MINIO_CONTAINER"]
	if container == "" || container == "unknown" {
		return "unknown", ""
	}
	version := valueOr(raw["MINIO_RUNNING_IMAGE"], "—")
	switch container {
	case "absent":
		return "missing", ""
	case "running":
		if raw["MINIO_HEALTH"] == "ok" {
			if minioHasNewerImage(raw, images) {
				return "update", version
			}
			return "ok", version
		}
		return "degraded", version
	case "stopped", "exited", "created", "paused", "restarting":
		return "degraded", version
	default:
		// 认不出来的值一律「未知」，绝不猜成已装 / 未装。
		return "unknown", ""
	}
}

// minioHasNewerImage 只认体检采到的目标机本地镜像；daemon 查不动时返回 false。
func minioHasNewerImage(raw map[string]string, images []ImageInfo) bool {
	if raw["MINIO_DOCKER_QUERY"] != "yes" {
		return false
	}
	current := strings.TrimSpace(raw["MINIO_RUNNING_IMAGE"])
	if current == "" {
		return false
	}
	for _, img := range images {
		ref := strings.TrimSpace(img.Reference)
		if ref != "" && ref != current {
			return true
		}
	}
	return false
}

// parseImageLines 解析 check.sh 的 `ref;id;size;created|...` 编码。
// 用分隔符而不是 JSON：远端只装了 bash/coreutils，不能假设有 jq。
func parseImageLines(s string) []ImageInfo {
	out := []ImageInfo{}
	for _, item := range strings.Split(strings.Trim(s, "|"), "|") {
		if strings.TrimSpace(item) == "" {
			continue
		}
		f := strings.SplitN(item, ";", 4)
		if len(f) != 4 {
			continue
		}
		out = append(out, ImageInfo{
			Reference: strings.TrimSpace(f[0]), ID: strings.TrimSpace(f[1]),
			Size: strings.TrimSpace(f[2]), Created: strings.TrimSpace(f[3]),
		})
	}
	return out
}

func yes(raw map[string]string, key string) bool { return raw[key] == "yes" }

func stateOf(good bool, missingIsErr bool) string {
	if good {
		return "ok"
	}
	if missingIsErr {
		return "err"
	}
	return "off"
}

func dockerCheckItems(raw map[string]string) []CheckItem {
	items := []CheckItem{}
	add := func(key, label, value, state string) {
		items = append(items, CheckItem{Key: key, Label: label, Value: value, State: state})
	}
	osText := fmt.Sprintf("%s %s (%s) · %s",
		valueOr(raw["OS_ID"], "?"), valueOr(raw["OS_VERSION_ID"], "?"),
		valueOr(raw["OS_CODENAME"], "?"), valueOr(raw["ARCH"], "?"))
	add("OS", "系统 / 架构", osText, stateOf(raw["OS_ID"] == "ubuntu", true))
	add("SUDO_NOPASSWD", "免密 sudo", boolText(yes(raw, "SUDO_NOPASSWD")),
		func() string {
			if yes(raw, "SUDO_NOPASSWD") {
				return "ok"
			}
			return "warn"
		}())
	add("APT_GET", "apt-get", boolText(yes(raw, "APT_GET")), stateOf(yes(raw, "APT_GET"), true))
	add("CURL", "curl", boolText(yes(raw, "CURL")), stateOf(yes(raw, "CURL"), true))
	add("DOCKER_INSTALLED", "Docker Engine",
		valueOr(raw["DOCKER_VERSION"], "未安装"), stateOf(yes(raw, "DOCKER_INSTALLED"), false))
	add("COMPOSE_PLUGIN", "compose 插件", boolText(yes(raw, "COMPOSE_PLUGIN")),
		stateOf(yes(raw, "COMPOSE_PLUGIN"), false))
	add("DOCKER_SERVICE", "docker.service", valueOr(raw["DOCKER_SERVICE"], "—"),
		stateOf(raw["DOCKER_SERVICE"] == "active", false))
	add("DOCKER_GROUP", "docker 用户组", boolText(yes(raw, "DOCKER_GROUP")),
		stateOf(yes(raw, "DOCKER_GROUP"), false))
	add("USER_IN_DOCKER_GROUP", "当前用户在组内", boolText(yes(raw, "USER_IN_DOCKER_GROUP")),
		stateOf(yes(raw, "USER_IN_DOCKER_GROUP"), false))
	conf := strings.TrimSpace(raw["CONFLICT_PACKAGES"])
	add("CONFLICT_PACKAGES", "冲突包", valueOr(conf, "无"),
		func() string {
			if conf != "" {
				return "warn"
			}
			return "ok"
		}())
	add("DOCKER_REPO", "官方 apt 仓库", boolText(yes(raw, "DOCKER_REPO")),
		stateOf(yes(raw, "DOCKER_REPO"), false))
	add("APT_REPO_REACHABLE", "仓库可达性", boolText(yes(raw, "APT_REPO_REACHABLE")),
		stateOf(yes(raw, "APT_REPO_REACHABLE"), true))
	add("DISK_FREE_MB", "根分区剩余", valueOr(raw["DISK_FREE_MB"], "?")+" MB", "ok")
	// 更新判据的依据必须看得见：apt 候选版本来自只读的 apt-cache policy。
	installed, candidate, upgrade := dockerCandidate(raw)
	add("DOCKER_APT_VERSION", "docker-ce 已装 / 候选",
		fmt.Sprintf("%s → %s", valueOr(installed, "未采集"), valueOr(candidate, "未采集")),
		func() string {
			if upgrade {
				return "warn"
			}
			return "ok"
		}())
	return items
}

// minioCheckItems 只显示与 MinIO 有关的体检项；不回显任何凭证值。
func minioCheckItems(raw map[string]string, local LocalFacts) []CheckItem {
	items := []CheckItem{}
	add := func(key, label, value, state string) {
		items = append(items, CheckItem{Key: key, Label: label, Value: value, State: state})
	}
	add("DOCKER_SERVICE", "Docker 引擎", valueOr(raw["DOCKER_SERVICE"], "—"),
		stateOf(raw["DOCKER_SERVICE"] == "active", true))
	add("MINIO_CONTAINER", "MinIO 容器", minioContainerText(raw["MINIO_CONTAINER"]),
		func() string {
			switch raw["MINIO_CONTAINER"] {
			case "running":
				return "ok"
			case "absent":
				return "off"
			default:
				return "warn"
			}
		}())
	add("MINIO_HEALTH", "9000 健康检查", minioHealthText(raw["MINIO_HEALTH"]),
		stateOf(raw["MINIO_HEALTH"] == "ok", false))
	add("MINIO_PORTS", "9000 / 9001 端口",
		fmt.Sprintf("%s / %s", valueOr(raw["MINIO_PORT_9000"], "?"), valueOr(raw["MINIO_PORT_9001"], "?")),
		func() string {
			if raw["MINIO_PORT_BUSY"] == "yes" && raw["MINIO_CONTAINER"] == "absent" {
				return "err"
			}
			return "ok"
		}())
	add("MINIO_DATA_DIR", "数据目录 /data/minio",
		func() string {
			if yes(raw, "MINIO_DATA_DIR") {
				return "已存在"
			}
			if !yes(raw, "MINIO_DATA_PARENT") {
				return "将自动创建（根分区 " + valueOr(raw["MINIO_DATA_FREE_MB"], "?") + " MB 可用）"
			}
			return "待创建"
		}(), stateOf(yes(raw, "MINIO_DATA_DIR"), false))
	add("MINIO_IMAGE_COUNT", "离线镜像（已导入）",
		valueOr(raw["MINIO_IMAGE_COUNT"], "0")+" 个 · "+valueOr(raw["MINIO_IMAGE_FIRST"], "无"),
		func() string {
			if raw["MINIO_DOCKER_QUERY"] == "no" {
				return "warn"
			}
			if raw["MINIO_IMAGE_COUNT"] == "" || raw["MINIO_IMAGE_COUNT"] == "0" {
				return "off"
			}
			return "ok"
		}())
	add("MINIO_CREDS", "本机 root 凭证",
		func() string {
			if local.MinioRootUserSet && local.MinioRootSecretSet {
				return "已配置 · 不回显"
			}
			return "未配置（backup/minio.env）"
		}(),
		stateOf(local.MinioRootUserSet && local.MinioRootSecretSet, true))
	add("DEST_URL", "备份脚本目标地址",
		valueOr(local.DestURL, "未配置")+"（端口 "+valueOr(local.DestURLPort, "?")+"）",
		func() string {
			if local.DestURLPort != "" && local.DestURLPort != minioAPIPort {
				return "warn"
			}
			return "ok"
		}())
	// 更新判据的依据：当前容器镜像 vs 目标机已导入的离线镜像（不回显任何凭证）。
	cur := valueOr(raw["MINIO_RUNNING_IMAGE"], "—")
	candidate := valueOr(raw["MINIO_UPDATE_CANDIDATE"], "无")
	add("MINIO_UPDATE_CANDIDATE", "当前镜像 / 新镜像",
		cur+" → "+candidate,
		func() string {
			if raw["MINIO_DOCKER_QUERY"] != "yes" {
				return "off"
			}
			if candidate != "无" {
				return "warn"
			}
			return "ok"
		}())
	return items
}

func minioContainerText(s string) string {
	switch s {
	case "running":
		return "运行中"
	case "absent":
		return "未创建"
	case "stopped", "exited", "created":
		return "已停止"
	case "unknown", "":
		return "未采集"
	default:
		return s
	}
}

func minioHealthText(s string) string {
	if s == "ok" {
		return "200 OK"
	}
	if s == "no" {
		return "无响应"
	}
	return "未采集"
}

func valueOr(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

func boolText(b bool) string {
	if b {
		return "是"
	}
	return "否"
}

// Evaluate 是 Docker 安装共用的前置结论。
// 🔴 这里不碰 sudo 密码：有 --password-stdin 的机器 SUDO_NOPASSWD=no 也能装，
//    由 install.go 结合 SSHTarget 判断；这里只判与主机环境相关的硬条件。
func Evaluate(raw map[string]string) Preflight {
	p := Preflight{Blockers: []string{}, Warnings: []string{}}
	if raw["OS_ID"] != "ubuntu" {
		p.Blockers = append(p.Blockers, "官方 apt 仓库只支持 Ubuntu，当前 OS_ID="+valueOr(raw["OS_ID"], "?"))
	}
	if strings.TrimSpace(raw["OS_CODENAME"]) == "" {
		p.Blockers = append(p.Blockers, "取不到 Ubuntu codename，无法确定 apt 仓库 Suites")
	}
	if !yes(raw, "APT_GET") {
		p.Blockers = append(p.Blockers, "目标机没有 apt-get")
	}
	if !yes(raw, "CURL") {
		p.Blockers = append(p.Blockers, "目标机没有 curl（无法下载官方 GPG key）")
	}
	// 🔴 仓库可达性只作警告、不作硬拦：这条探测走的是目标机出口，内网会偶发
	//    Connection reset（2026-11-06 k1 先 200 后 reset）。真正权威的结论由
	//    apt-get update 给出，安装脚本 set -e 会在失败处如实停下，不会硬装坏东西。
	if !yes(raw, "APT_REPO_REACHABLE") {
		p.Warnings = append(p.Warnings,
			"探测不到 download.docker.com：安装可能在 apt-get update 处失败；可在安装弹窗勾选 apt 代理，或先给目标机配好内网镜像源")
	}
	if mb, err := strconv.Atoi(raw["DISK_FREE_MB"]); err == nil && mb < 1024 {
		p.Blockers = append(p.Blockers, fmt.Sprintf("根分区剩余空间不足 1 GB（%d MB）", mb))
	}
	if conf := strings.TrimSpace(raw["CONFLICT_PACKAGES"]); conf != "" {
		p.Warnings = append(p.Warnings, "将卸载官方列出的冲突包："+conf+"（/var/lib/docker 保留）")
	}
	if yes(raw, "DOCKER_INSTALLED") && yes(raw, "COMPOSE_PLUGIN") {
		p.Warnings = append(p.Warnings, "已检测到 Docker Engine + compose 插件，安装会跳过 apt、只补齐服务与用户组")
	}
	if !yes(raw, "SUDO_NOPASSWD") {
		p.Warnings = append(p.Warnings, "免密 sudo 不可用：请在界面填一次性 sudo 密码，或先跑 ops servers apply-sudo")
	}
	if !yes(raw, "USER_IN_DOCKER_GROUP") {
		p.Warnings = append(p.Warnings, "安装会把清单用户加入 docker 组，组变更需重新登录才在当前会话生效")
	}
	p.Ready = len(p.Blockers) == 0
	return p
}

// minioAPIPort 是备份端本机 MinIO 的 API 端口（生产端是 8007，别混）。
const minioAPIPort = "9000"

// EvaluateMinio 是 MinIO 安装的只读前置结论。
// 🔴 绝不 docker pull：远端没有离线镜像就原地拦下（k1 实测 Docker Hub 超时、
//    quay.io 401、dl.min.io 410），不会把「装一半」留在目标机上。
// 🔴 凭证只看本机是否配置，绝不读值进结论 / 日志 / HTTP 响应。
func EvaluateMinio(raw map[string]string, local LocalFacts, depReady bool) Preflight {
	p := Preflight{Blockers: []string{}, Warnings: []string{}}
	container := raw["MINIO_CONTAINER"]
	known := map[string]bool{
		"absent": true, "running": true, "exited": true,
		"created": true, "paused": true, "restarting": true, "stopped": true,
	}
	installed := known[container] && container != "absent"
	// 🔴 「采不到」不是「已装」：未知状态绝不能跳过镜像 / 凭证 / 端口这几道门。
	if !known[container] {
		p.Blockers = append(p.Blockers,
			"读不到 MinIO 容器状态（docker daemon 不可用或体检没采到），状态未知时不放行写操作")
	}

	if !depReady || !yes(raw, "DOCKER_INSTALLED") || raw["DOCKER_SERVICE"] != "active" {
		p.Blockers = append(p.Blockers, "上游 Docker 引擎未就绪：请先在组件目录里安装 Docker 引擎")
	}
	if mb, err := strconv.Atoi(raw["DISK_FREE_MB"]); err == nil && mb < 1024 {
		p.Blockers = append(p.Blockers, fmt.Sprintf("根分区剩余空间不足 1 GB（%d MB）", mb))
	}
	if !installed {
		if raw["MINIO_DOCKER_QUERY"] == "no" {
			p.Blockers = append(p.Blockers, "读不到目标机镜像列表（docker 权限不足或 daemon 不可用），无法确认离线镜像")
		} else if raw["MINIO_IMAGE_COUNT"] == "" || raw["MINIO_IMAGE_COUNT"] == "0" {
			p.Blockers = append(p.Blockers, "目标机没有已导入的 MinIO 离线镜像：请先导入镜像 tar，本能力不执行 docker pull")
		}
		if raw["MINIO_PORT_BUSY"] == "yes" {
			p.Blockers = append(p.Blockers, "9000 / 9001 端口已被别的进程占用，装完也起不来")
		}
		if !local.MinioRootUserSet || !local.MinioRootSecretSet {
			p.Blockers = append(p.Blockers,
				"本机 backup/minio.env 的 DEST_KEY / DEST_SECRET 还没配好：MinIO root 凭证只从这里运行时注入")
		}
	}
	if installed {
		p.Warnings = append(p.Warnings, "目标机已有 MinIO 容器：安装脚本只做健康检查与必要补齐，不会重建容器 / 不删数据")
	}
	// 🔴 /data 不存在不再硬拦：k4 这类只有一块系统盘的测试机上，安装脚本会
	//    mkdir -p /data/minio 自动建父目录。但必须明确告诉人数据落在根分区、
	//    而不是独立数据盘，免得生产环境悄悄把备份写满系统盘。
	if !yes(raw, "MINIO_DATA_PARENT") {
		p.Warnings = append(p.Warnings,
			"目标机没有 /data 目录：安装会 mkdir -p /data/minio 自动创建，数据落在根分区（非独立数据盘）；生产环境请先挂载数据盘到 /data")
	}
	if local.DestURLPort != "" && local.DestURLPort != minioAPIPort {
		p.Warnings = append(p.Warnings, fmt.Sprintf(
			"本机 backup/minio.env 的 DEST_URL 端口是 %s（生产端端口），备份端本机 MinIO 是 %s；装好服务后备份脚本仍连不上，请到「配置」页改端口并同步远端",
			local.DestURLPort, minioAPIPort))
	}
	if !yes(raw, "SUDO_NOPASSWD") {
		p.Warnings = append(p.Warnings, "免密 sudo 不可用：请在界面填一次性 sudo 密码，或先跑 ops servers apply-sudo")
	}
	if n, err := strconv.Atoi(raw["MINIO_IMAGE_COUNT"]); err == nil && n > 1 {
		p.Warnings = append(p.Warnings, fmt.Sprintf("目标机有 %d 个 MinIO 镜像，安装默认使用 %s",
			n, valueOr(raw["MINIO_IMAGE_FIRST"], "列表第一项")))
	}
	p.Ready = len(p.Blockers) == 0
	return p
}
