package component

// 只读体检：把远端 check.sh 的 KEY=VALUE 输出解析成结构化状态。
//
// 🔴 「连不上」不等于「未安装」：ssh 自身失败（exit 255）时 Collected=false、
//     所有组件标 unknown，绝不用 0 / 空值兜底（AGENTS.md 硬约束 3）。
// 🔴 失败响应里的数组一律是 [] 而不是 null：Go 的 nil slice 编成 JSON 是 null，
//     前端 .find / .map 会整页白屏（见 docs/ui.md §11.4）。

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
)

type CheckItem struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Value string `json:"value"`
	State string `json:"state"` // ok / warn / err / off
}

type ComponentStatus struct {
	Component
	State     string      `json:"state"` // missing / ok / degraded / unknown / planned
	Version   string      `json:"version"`
	Checks    []CheckItem `json:"checks"`
	Collected bool        `json:"collected"`
	Error     string      `json:"error,omitempty"`
}

// Preflight 是安装前的只读结论；服务端 dry-run 门直接用它拦人。
type Preflight struct {
	Ready    bool     `json:"ready"`
	Blockers []string `json:"blockers"`
	Warnings []string `json:"warnings"`
}

type StatusView struct {
	Server     string            `json:"server"`
	Collected  bool              `json:"collected"`
	Error      string            `json:"error,omitempty"`
	Components []ComponentStatus `json:"components"`
	Checks     []CheckItem        `json:"checks"`
	Raw        map[string]string `json:"raw"`
	Preflight  Preflight         `json:"preflight"`
}

func emptyView(server string) StatusView {
	return StatusView{
		Server:     server,
		Components: []ComponentStatus{},
		Checks:     []CheckItem{},
		Raw:        map[string]string{},
		Preflight:  Preflight{Blockers: []string{}, Warnings: []string{}},
	}
}

func unknownComponents(view *StatusView, reason string) {
	for _, c := range All() {
		view.Components = append(view.Components, ComponentStatus{
			Component: c, State: "unknown", Version: "—",
			Checks: []CheckItem{}, Collected: false, Error: reason,
		})
	}
	view.Preflight.Blockers = append(view.Preflight.Blockers, reason)
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

// Collect 在目标机跑一次**只读**体检。它不写任何远端文件、不提权、不装包。
func Collect(ctx context.Context, t *shared.SSHTarget, scripts fs.FS, server string) StatusView {
	view := emptyView(server)
	data, err := readScript(scripts, dockerCheckRel)
	if err != nil {
		reason := "嵌入的组件脚本不完整：" + err.Error()
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
	raw := parseKV(out)
	view.Raw = raw
	if raw["CHECK_OK"] != "yes" {
		reason := "只读体检脚本未正常完成，未能采集组件状态"
		view.Error = reason
		unknownComponents(&view, reason)
		return view
	}
	view.Collected = true
	view.Checks = dockerCheckItems(raw)
	view.Preflight = Evaluate(raw)

	states := map[string]string{}
	for _, c := range All() {
		cs := ComponentStatus{
			Component: c, Checks: []CheckItem{}, Collected: true,
		}
		if c.Phase == PhasePlanned {
			cs.State = "planned"
			cs.Version = "—"
			cs.Collected = false
		} else {
			cs.State, cs.Version = deriveDockerState(raw)
			cs.Checks = view.Checks
		}
		states[c.ID] = cs.State
		view.Components = append(view.Components, cs)
	}
	_ = states
	return view
}

func deriveDockerState(raw map[string]string) (string, string) {
	if raw["DOCKER_INSTALLED"] != "yes" {
		return "missing", ""
	}
	v := raw["DOCKER_VERSION"]
	if raw["DOCKER_SERVICE"] != "active" || raw["COMPOSE_PLUGIN"] != "yes" {
		return "degraded", v
	}
	return "ok", v
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
		func() string { if yes(raw, "SUDO_NOPASSWD") { return "ok" }; return "warn" }())
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
		func() string { if conf != "" { return "warn" }; return "ok" }())
	add("DOCKER_REPO", "官方 apt 仓库", boolText(yes(raw, "DOCKER_REPO")),
		stateOf(yes(raw, "DOCKER_REPO"), false))
	add("APT_REPO_REACHABLE", "仓库可达性", boolText(yes(raw, "APT_REPO_REACHABLE")),
		stateOf(yes(raw, "APT_REPO_REACHABLE"), true))
	add("DISK_FREE_MB", "根分区剩余", valueOr(raw["DISK_FREE_MB"], "?")+" MB", "ok")
	return items
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

// Evaluate 是 dry-run 与正式安装共用的前置结论。
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
	//    一次网络抖动就把预检判死，反而比 apt 自己的报错更难排查。
	if !yes(raw, "APT_REPO_REACHABLE") {
		p.Warnings = append(p.Warnings,
			"探测不到 download.docker.com：安装可能在 apt-get update 处失败；若目标机走代理或内网镜像源，请先配好 apt")
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
