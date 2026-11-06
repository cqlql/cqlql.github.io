package component

// 组件写动作的**唯一判据层**（docs/components.md §8）。
//
// 🔴 影响清单、能否执行、阻塞原因一律由 Go 侧按注册表与只读体检结果算，
//    前端只渲染 plan 并据此禁用按钮，不许把这套文案与判据硬编码成前端常量。
// 🔴 同一个 BuildActions 同时喂给 `list --json`（页面）与 CLI 的写前校验，
//    不存在「页面看着能点、CLI 却拦下」或反过来的第二套判据。
// 🔴 update / uninstall 的附加确认也在这一层声明：删数据默认不勾且非必填，
//    卸引擎的连带影响必勾；界面不开放 --force。

import (
	"fmt"
	"strings"
)

// ActionCheck 是确认弹窗里的一个附加勾选项。
// Required=true 表示「必须勾选才能提交」（卸引擎的连带影响），
// 非必填的勾选项一律默认不勾（删数据）。
type ActionCheck struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Required bool   `json:"required"`
	Help     string `json:"help,omitempty"`
}

// ImageChoice 是 MinIO 更新时可选的目标镜像；全部来自只读体检采集到的
// 目标机**已导入**镜像，绝不接收任意字符串、绝不在线拉。
type ImageChoice struct {
	Reference string `json:"reference"`
	Current   bool   `json:"current"`
}

// ActionPlan 是「这个动词 + 这个组件」的一整套可执行判定与弹窗文案。
type ActionPlan struct {
	Verb        string        `json:"verb"`
	Label       string        `json:"label"`
	Available   bool          `json:"available"`
	Reasons     []string      `json:"reasons"`
	Title       string        `json:"title"`
	Description string        `json:"description"`
	Impacts     []string      `json:"impacts"`
	Checks      []ActionCheck `json:"checks"`
	Images      []ImageChoice `json:"images"`
	Danger      bool          `json:"danger"`
	SubmitLabel string        `json:"submit_label"`
}

// ActionOptions 是一次写动作的全部显式入参。
// 除 Verb / ID / DryRun 外，每个附加参数都只属于一个「动词 + 组件」组合。
type ActionOptions struct {
	Verb     string
	ID       string
	DryRun   bool
	Minio    MinioCredentials
	Proxy    string
	ImageRef string
	// PurgeData 只在 uninstall minio 生效，默认 false（不删数据）。
	PurgeData bool
	// AckDownstream 是 uninstall docker 的必勾确认。
	AckDownstream bool
}

func newPlan(verb, label, title string) ActionPlan {
	return ActionPlan{
		Verb: verb, Label: label, Title: title,
		Reasons: []string{}, Impacts: []string{}, Checks: []ActionCheck{}, Images: []ImageChoice{},
		Danger: true, SubmitLabel: "确认" + label,
	}
}

func readyState(s string) bool {
	// docs/components.md §8.1：ready = ok || update。
	// 实现里另有 degraded（已装但异常）：它同样是「已装」，允许更新 / 卸载来修复，
	// 但影响清单会额外提示当前状态异常；unknown / missing / planned 一律不算 ready。
	return s == "ok" || s == "update" || s == "degraded"
}

func stateText(s string) string {
	switch s {
	case "ok":
		return "正常"
	case "update":
		return "可更新"
	case "degraded":
		return "需修复"
	case "missing":
		return "未安装"
	case "planned":
		return "待接入"
	default:
		return "未知"
	}
}

// minioUpdateChoices 只从只读体检采集到的目标机镜像里挑「与当前容器不同」的那些。
// docker daemon 查不动（MINIO_DOCKER_QUERY=no）时返回空，绝不猜一个镜像出来。
func minioUpdateChoices(view StatusView) []ImageChoice {
	if view.Raw["MINIO_DOCKER_QUERY"] != "yes" {
		return []ImageChoice{}
	}
	current := strings.TrimSpace(view.Raw["MINIO_RUNNING_IMAGE"])
	out := []ImageChoice{}
	seen := map[string]bool{}
	for _, img := range view.Images {
		ref := strings.TrimSpace(img.Reference)
		if ref == "" || seen[ref] || !safeImageRef.MatchString(ref) {
			continue
		}
		seen[ref] = true
		out = append(out, ImageChoice{Reference: ref, Current: ref == current})
	}
	return out
}

func dockerCandidate(raw map[string]string) (installed, candidate string, upgrade bool) {
	installed = strings.TrimSpace(raw["DOCKER_APT_INSTALLED"])
	candidate = strings.TrimSpace(raw["DOCKER_APT_CANDIDATE"])
	usable := func(v string) bool { return v != "" && v != "(none)" && v != "none" }
	upgrade = usable(installed) && usable(candidate) && candidate != installed
	return
}

// BuildActions 由只读体检结果算所有组件的动作计划。
// 任何写请求的 available=false 都带至少一条人能看懂的 reasons。
func BuildActions(view StatusView) map[string][]ActionPlan {
	out := map[string][]ActionPlan{}
	states := map[string]string{}
	for _, cs := range view.Components {
		states[cs.ID] = cs.State
	}
	for _, cs := range view.Components {
		c := cs.Component
		plans := []ActionPlan{}
		for _, verb := range Verbs(c.ID) {
			plans = append(plans, buildPlan(view, cs, states, verb))
		}
		out[c.ID] = plans
	}
	return out
}

func buildPlan(view StatusView, cs ComponentStatus, states map[string]string, verb string) ActionPlan {
	c := cs.Component
	label := map[string]string{
		VerbInstall: "安装", VerbUpdate: "更新", VerbUninstall: "卸载",
	}[verb]
	plan := newPlan(verb, label, fmt.Sprintf("确认%s %s", label, c.Name))
	plan.Description = fmt.Sprintf("这是远端写操作：%s %s（目标机 %s），服务端会先跑一次 --dry-run 预检。",
		label, c.Name, valueOr(view.Server, "未选择"))

	// 通用门：采不到状态 / 未接入 / 动词不在注册表里，一律禁用全部写动作。
	if !view.Collected || !cs.Collected {
		plan.Reasons = append(plan.Reasons,
			"只读体检没采到状态（"+valueOr(view.Error, "原因未知")+"）；状态未知时所有写按钮禁用")
	}
	if c.Phase != PhaseReady {
		plan.Reasons = append(plan.Reasons, "该组件尚未接入，本轮只做目录占位")
	}
	if !RunnableVerb(c.ID, verb) {
		plan.Reasons = append(plan.Reasons, "该动词不在注册表的白名单里")
	}
	if len(plan.Reasons) > 0 {
		return plan
	}

	depReady := DependsReady(c, states)
	pre := preflightFor(view, c.ID)
	ready := readyState(cs.State)

	switch verb {
	case VerbInstall:
		if cs.State != "missing" {
			plan.Reasons = append(plan.Reasons,
				"当前状态是「"+stateText(cs.State)+"」：只有「未安装」才能安装")
		}
		if !depReady {
			plan.Reasons = append(plan.Reasons, "上游 "+c.Depends+" 未就绪，请先在组件目录里安装上游组件")
		}
		if !pre.Ready || len(pre.Blockers) > 0 {
			plan.Reasons = append(plan.Reasons, pre.Blockers...)
		}
		if c.ID == "minio" {
			plan.Title = "确认安装 MinIO 服务"
			plan.Description = "会用目标机已导入的离线镜像创建容器，写 /data/minio 并暴露 9000 / 9001 端口。"
			plan.Impacts = append(plan.Impacts,
				"服务端先跑 --dry-run：Docker 引擎、离线镜像、端口与本机 root 凭证任一不满足就不安装。",
				"root 凭证取自本机 backup/minio.env 的 DEST_KEY / DEST_SECRET，运行时注入、日志脱敏，不回显。",
				"不执行 docker pull；不重建已有容器、不删 /data/minio、不动 Docker 引擎 / 镜像 / crontab。",
				"装完做 /minio/health/live 健康检查；不跑备份、不改 backup.env。",
				"备份脚本的 DEST_URL 要指向本机 9000（不是生产端 8007），请到「配置」页改并同步远端。")
		} else {
			plan.Title = "确认安装 Docker 引擎"
			plan.Description = "会安装系统包、写 /etc/apt/sources.list.d/docker.sources、启用 docker.service，并把清单用户加入 docker 组。"
			plan.Impacts = append(plan.Impacts,
				"服务端先跑一次 --dry-run 预检，不通过就不安装、远端不改动。",
				"不跑 hello-world（会拉 Docker Hub 镜像），不动容器 / 镜像 / /var/lib/docker。",
				"不修改 crontab、backup.env；不改 DEST_URL（仍需在「配置」页把 8007 改成 9000）。",
				"组变更需重新登录才在当前会话生效。",
				"如下方勾选代理，只作用于本次 apt / curl，不写远端 /etc/apt/apt.conf.d/ 配置。")
		}

	case VerbUpdate:
		if !ready {
			plan.Reasons = append(plan.Reasons,
				"当前状态是「"+stateText(cs.State)+"」：只有已安装（正常 / 可更新 / 需修复）才能更新")
		}
		if c.ID == "minio" {
			plan.Title = "确认更新 MinIO 服务"
			plan.Description = "只重建 MinIO 容器换到新离线镜像；Docker 引擎一个包都不动。"
			choices := minioUpdateChoices(view)
			targets := []ImageChoice{}
			for _, ch := range choices {
				if !ch.Current {
					targets = append(targets, ch)
				}
			}
			plan.Images = targets
			if view.Raw["DOCKER_INSTALLED"] != "yes" || view.Raw["DOCKER_SERVICE"] != "active" {
				plan.Reasons = append(plan.Reasons, "Docker 引擎未就绪，无法重建 MinIO 容器")
			}
			if len(targets) == 0 {
				plan.Reasons = append(plan.Reasons,
					"目标机没有与当前容器不同的已导入离线镜像：请先导入新 tar（本能力绝不 docker pull）")
			}
			if !yes(view.Raw, "MINIO_DATA_DIR") {
				plan.Reasons = append(plan.Reasons, "采不到数据目录 /data/minio，拒绝重建容器")
			}
			if !view.Local.MinioRootUserSet || !view.Local.MinioRootSecretSet {
				plan.Reasons = append(plan.Reasons,
					"本机 backup/minio.env 的 DEST_KEY / DEST_SECRET 未配好：重建容器要重新注入 root 凭证")
			}
			plan.Impacts = append(plan.Impacts,
				"当前容器镜像："+valueOr(view.Raw["MINIO_RUNNING_IMAGE"], "未采集")+
					"；目标镜像只能从下方「已导入」列表里选。",
				"记录当前容器的端口 / 挂载 / 凭证引用，用新镜像重建；不加 docker rm -v、不删 /data/minio。",
				"🔴 失败只回滚到原镜像标签 + 原容器配置，数据卷从头到尾不参与回滚（与 Flyway 单向无关）。",
				"不 docker pull、不碰 Docker 引擎、不动其它镜像 / crontab / backup.env、不跑备份。",
				"更新后做 /minio/health/live 健康检查；DEST_URL 端口问题仍去「配置」页处理。")
		} else {
			plan.Title = "确认更新 Docker 引擎"
			plan.Description = "按官方 apt 仓库只升级 docker-ce 系列包，然后重启 docker.service。"
			installed, candidate, upgrade := dockerCandidate(view.Raw)
			if !upgrade {
				plan.Reasons = append(plan.Reasons, fmt.Sprintf(
					"官方 apt 仓库当前没有可升级的 docker-ce 包（已装 %s，候选 %s）",
					valueOr(installed, "未采集"), valueOr(candidate, "未采集")))
			}
			plan.Impacts = append(plan.Impacts,
				fmt.Sprintf("只升引擎包 %s → %s；/var/lib/docker、已导入镜像、/data/minio 全部保留。",
					valueOr(installed, "?"), valueOr(candidate, "?")),
				"🔴 apt 升级会重启 docker.service，跑在它上面的 MinIO 容器会短暂中断"+
					"（下游当前状态："+stateText(states["minio"])+"）；这条连带影响不是任务日志末尾的补充。",
				"不换 / 不重建 MinIO 容器的镜像；不 docker pull、不删数据、不改 crontab / backup.env。",
				"验证：docker info + /minio/health/live（下游容器在跑时）。")
		}

	case VerbUninstall:
		if !ready {
			plan.Reasons = append(plan.Reasons,
				"当前状态是「"+stateText(cs.State)+"」：未安装 / 状态未知的组件不允许卸载")
		}
		if c.ID == "minio" {
			plan.Title = "确认卸载 MinIO 服务"
			plan.Description = "移除 MinIO 容器，Docker 引擎与 /data/minio 数据默认保留。"
			plan.Impacts = append(plan.Impacts,
				"docker stop minio + docker rm minio（不加 -v）；保留 /data/minio 全部数据、已导入镜像、Docker 引擎。",
				"不改 crontab / logrotate / backup.env：minio 备份定时任务仍在，下一次执行会失败（预期结果）。",
				"卸载后 preflight 报错 / 备份连不上是预期结果，不许为消掉报错去删 crontab 或改配置。",
				"如勾选「同时删除数据目录」，/data/minio 会被永久删除，不可恢复。")
			plan.Checks = append(plan.Checks, ActionCheck{
				Key: "purge_data", Label: "同时删除 /data/minio 数据目录",
				Required: false, Help: "默认不勾、不可逆：删掉后 MinIO 全部对象无法恢复",
			})
		} else {
			plan.Title = "确认卸载 Docker 引擎"
			plan.Description = "停 docker.service 并 apt purge 引擎包；会连带停止下游 MinIO 备份服务。"
			plan.Impacts = append(plan.Impacts,
				"🔴 下游 MinIO 容器会一起停（当前状态："+stateText(states["minio"])+"），备份链路随之中断。",
				"保留 /var/lib/docker、已导入镜像、/data/minio；不改 crontab / logrotate / backup.env。",
				"minio 备份定时任务仍在，下一次执行会失败（预期结果）；建议先单独卸载 MinIO 再回来卸引擎。",
				"卸载后 preflight 报错是预期结果，不要顺手删 crontab 或改配置。")
			plan.Checks = append(plan.Checks, ActionCheck{
				Key: "ack_downstream", Label: "我已知晓卸载引擎会连带停止 MinIO 备份服务",
				Required: true, Help: "必须勾选才能提交；建议先单独卸载 MinIO 再回来卸引擎",
			})
		}
	}

	plan.Available = len(plan.Reasons) == 0
	return plan
}

// PlanFor 找某个组件某个动词的计划；view 里没带（手工构造）时现算一份。
func PlanFor(view StatusView, id, verb string) (ActionPlan, bool) {
	for _, p := range view.Actions[id] {
		if p.Verb == verb {
			return p, true
		}
	}
	for _, p := range BuildActions(view)[id] {
		if p.Verb == verb {
			return p, true
		}
	}
	return ActionPlan{}, false
}

// ValidImageRef 卡死更新用的目标镜像引用：只允许镜像标签字符集，
// 且 CLI 还会再验它必须出现在只读体检采集到的候选里（不接任意字符串）。
func ValidImageRef(ref string) (string, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return "", nil
	}
	if len(ref) > 256 || !safeImageRef.MatchString(ref) {
		return "", fmt.Errorf("镜像引用含非法字符：%q（只允许字母数字与 . _ / : -）", ref)
	}
	return ref, nil
}

// ValidateActionFlags 是 CLI 与界面后端共用的附加参数门。
// 这里不依赖体检结果（界面后端只有 name），只管「这个动词能不能带这个参数」。
// 体检相关的门由 CLI 的 PlanFor + 脚本前置校验再挡一次。
func ValidateActionFlags(opt ActionOptions) error {
	id, verb := strings.ToLower(strings.TrimSpace(opt.ID)), opt.Verb
	if !RunnableVerb(id, verb) {
		return fmt.Errorf("组件 %q 不允许动作 %q（未注册、未接入或动词不在白名单里）", id, verb)
	}
	if opt.ImageRef != "" {
		if verb != VerbUpdate || id != "minio" {
			return fmt.Errorf("--image-ref 只用于 update minio")
		}
		if _, err := ValidImageRef(opt.ImageRef); err != nil {
			return err
		}
	}
	if opt.PurgeData && (verb != VerbUninstall || id != "minio") {
		return fmt.Errorf("删除数据目录只用于 uninstall minio，且默认不勾")
	}
	if opt.AckDownstream && (verb != VerbUninstall || id != "docker") {
		return fmt.Errorf("连带影响确认只用于 uninstall docker")
	}
	if verb == VerbUninstall && id == "docker" && !opt.AckDownstream {
		return fmt.Errorf("卸载 Docker 引擎必须显式勾选「已知晓会连带停止 MinIO 备份服务」")
	}
	if opt.Proxy != "" {
		if id != "docker" || (verb != VerbInstall && verb != VerbUpdate) {
			return fmt.Errorf("--proxy 只用于 install / update docker（apt / curl 下载）")
		}
		if _, err := ValidProxy(opt.Proxy); err != nil {
			return err
		}
	}
	return nil
}
