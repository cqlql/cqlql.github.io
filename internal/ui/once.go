package ui

// 手动备份页的只读动作计划：GET /api/backup/once/plan?name=<清单 name>&component=<all|pg|minio>
//
// 🔴 纯本机、不连远端、不占任务锁、不要 confirm：只查清单与当前任务锁，
//    再把「能否执行 / 阻塞原因 / 影响清单 / 将执行的命令」整份下发给前端渲染
//    （与 components.BuildActions 同一条规矩：前端不算任何指标）。
// 🔴 预检退出码、撞锁、组件失败、超时都是**运行期**结果，不在这里预测：
//    预演（mode=once-dry）与服务端预检门会给出结论，计划卡不能假装能挡住
//    （docs/backup-once.md §2.4 O3）。
// 🔴 定时任务状态恒为「不采集」：工具不读 crontab，也不改监控采集协议。
//
// 影响清单与 internal/backup/once.go 的 onceImpact / onceWarnings 同源：
// ui 不能 import backup（依赖方向硬约束 21），与 pg_major / 卸载白名单一样
// 各留一份纯数据，改文案要两处同步，测试会挡关键句漂移。

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// 备份来源（只读）：回答「这次到底备份哪台机器 / 哪些桶」。
//
// 🔴 生产端不由界面指定：它在备份机的 <组件>/backup.env 里（PG_SSH_HOST /
//    SRC_URL / SRC_BUCKETS），工具只把**非凭证白名单字段**读回来给人看，
//    避免「选了 k4，却不知道实际备份的是谁」。硬约束 12 的那套「主机只来自
//    servers.json」不受影响：这里显示的是 backup.env 里的生产端，不是新的目标机入口。
// 🔴 复用 `ops backup compare-env` 已有的只读抓取（一条 cat、凭证在 CLI 侧已掩码）；
//    这里再挑一次白名单，并且 URL 只留 scheme + host:port（去 userinfo / path / query）。
//    `*_KEY` / `*_SECRET` / `PG_SSH_KEY` 一律不进响应，错误里也过滤私钥路径（硬约束 8）。
// ---------------------------------------------------------------------------

type onceSourceKey struct {
	Key   string
	Label string
	Kind  string // "endpoint" 只留主机端口；"plain" 直接显示非凭证文本
}

var onceSourceKeys = map[string][]onceSourceKey{
	"pg": {
		{"PG_SSH_HOST", "生产端主机（PG 所在机器）", "plain"},
		{"PG_SSH_PORT", "SSH 端口", "plain"},
		{"PG_SSH_USER", "SSH 用户", "plain"},
		{"PG_DB_NAME", "要备份的库", "plain"},
		{"PG_CONTAINER_NAME", "PG 容器", "plain"},
		{"PG_BACKUP_ROOT", "dump 落在备份机的目录", "plain"},
	},
	"minio": {
		{"SRC_URL", "生产端 MinIO 地址", "endpoint"},
		{"SRC_BUCKETS", "要备份的桶", "plain"},
		{"DEST_URL", "备份端 MinIO 地址", "endpoint"},
		{"DEST_BUCKET_PREFIX", "备份端桶前缀", "plain"},
	},
}

type onceSourceItem struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Value string `json:"value"`
}

type onceSourceView struct {
	Server    string           `json:"server"`
	Component string           `json:"component"`
	Collected bool             `json:"collected"`
	FetchedAt string           `json:"fetched_at"`
	Error     string           `json:"error,omitempty"`
	PG        []onceSourceItem `json:"pg"`
	MinIO     []onceSourceItem `json:"minio"`
	Note      string           `json:"note"`
}

const onceSourceNote = "备份对象（生产端）由这台备份机上的 <组件>/backup.env 决定，不在本页指定；" +
	"要改生产端请到「配置」页编辑本机 backup/{postgres,minio}.env 并「同步到远端」，或直接改备份机上的 backup.env。" +
	"本页只回显非凭证字段，凭证不进响应与任务日志。"

func emptyOnceSource(name, component, errText string) onceSourceView {
	return onceSourceView{
		Server: name, Component: component, Collected: false,
		Error: errText, PG: []onceSourceItem{}, MinIO: []onceSourceItem{}, Note: onceSourceNote,
	}
}

// onceEndpoint 只回显 scheme + host:port：SRC_URL 可能带路径，甚至有人写进
// userinfo，一律不进响应（凭证不进 HTTP / 日志）。
func onceEndpoint(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "—"
	}
	if !strings.Contains(s, "://") {
		s = "http://" + s
	}
	u, err := url.Parse(s)
	if err != nil || u.Host == "" {
		return "（地址无法解析，已隐藏）"
	}
	if u.Scheme == "http" || u.Scheme == "https" {
		return u.Scheme + "://" + u.Host
	}
	return u.Host
}

func oncePlain(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "—"
	}
	if strings.Contains(s, ".ssh/") || strings.Contains(s, "Identity file") {
		return "（已隐藏）"
	}
	if len(s) > 200 {
		s = s[:200] + "…"
	}
	return s
}

// buildOnceSource 是纯函数：从 compare-env 的快照里按白名单投影，
// 任何凭证键（secret=true 或不在白名单）都不会出现在返回的数组里。
func buildOnceSource(name, component string, snap cliEnvSnapshot, at string) onceSourceView {
	view := onceSourceView{
		Server: name, Component: component, Collected: true, FetchedAt: at,
		PG: []onceSourceItem{}, MinIO: []onceSourceItem{}, Note: onceSourceNote,
	}
	values := map[string]map[string]string{}
	for _, cs := range snap.Components {
		m := map[string]string{}
		for _, f := range cs.Fields {
			if f.Secret || !f.Configured {
				continue
			}
			m[f.Key] = f.Value
		}
		values[cs.Component] = m
	}
	for comp, keys := range onceSourceKeys {
		items := []onceSourceItem{}
		for _, k := range keys {
			v := values[comp][k.Key]
			if k.Kind == "endpoint" {
				v = onceEndpoint(v)
			} else {
				v = oncePlain(v)
			}
			items = append(items, onceSourceItem{Key: k.Key, Label: k.Label, Value: v})
		}
		if comp == "pg" {
			view.PG = items
		} else {
			view.MinIO = items
		}
	}
	return view
}

// safeOnceSourceError 过滤 ssh 的私钥提示，再截断；与 compareenv.safeRemoteError 同口径。
func safeOnceSourceError(raw string) string {
	var kept []string
	for _, line := range strings.Split(strings.TrimSpace(raw), "\n") {
		if strings.Contains(line, "Identity file") || strings.Contains(line, ".ssh/") {
			continue
		}
		kept = append(kept, strings.TrimSpace(line))
	}
	s := strings.TrimSpace(strings.Join(kept, " "))
	if len(s) > 240 {
		s = s[:240] + "…"
	}
	return s
}

func (u *uiState) handleBackupOnceSource(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	component, ok := normalizeComponent(r.URL.Query().Get("component"))
	if !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知组件（可选 all / pg / minio）"})
		return
	}
	if name == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if err := u.reload(); err != nil {
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: emptyOnceSource(name, component, "配置还没准备好："+err.Error())})
		return
	}
	u.mu.Lock()
	list := u.list
	u.mu.Unlock()
	if _, err := list.Get(name); err != nil {
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: emptyOnceSource(name, component, "目标机只认清单里的 name："+err.Error())})
		return
	}
	if u.runner == nil {
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: emptyOnceSource(name, component, "这个构建没有备份能力")})
		return
	}

	var buf bytes.Buffer
	// 固定抓 all：切组件只改前端显示哪一份，不必再连一次远端。
	code := u.runner([]string{"compare-env", "all", "--server", name}, "", &buf)
	raw := buf.String()
	if len(raw) > 64<<10 {
		raw = raw[:64<<10]
	}
	if code != 0 {
		writeAPI(w, http.StatusOK, apiResponse{OK: true,
			Data: emptyOnceSource(name, component, "没读到远端 backup.env："+safeOnceSourceError(raw))})
		return
	}
	if i := strings.Index(raw, "{"); i > 0 {
		raw = raw[i:]
	}
	var snap cliEnvSnapshot
	if err := json.Unmarshal([]byte(raw), &snap); err != nil {
		writeAPI(w, http.StatusOK, apiResponse{OK: true,
			Data: emptyOnceSource(name, component, "抓取结果无法解析（界面与 CLI 版本可能不一致）")})
		return
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true,
		Data: buildOnceSource(name, component, snap, time.Now().Format("15:04:05"))})
}

type oncePlanContext struct {
	CronStatus string `json:"cron_status"`
	CronNote   string `json:"cron_note"`
	Direction  string `json:"direction"`
	Identity   string `json:"identity"`
}

type oncePlanView struct {
	Server    string          `json:"server"`
	Component string          `json:"component"`
	Order     string          `json:"order"`
	Available bool            `json:"available"`
	Blockers  []string        `json:"blockers"`
	Warnings  []string        `json:"warnings"`
	Impact    []string        `json:"impact"`
	Commands  []string        `json:"commands"`
	Context   oncePlanContext `json:"context"`
}

var oncePlanImpact = map[string][]string{
	"pg": {
		"新建一份 .dump + globals_*.sql + 各自 .sha256；按日期进 daily / weekly / monthly（每月 1 号 monthly、周一 weekly）",
		"find -mtime -delete 清理三个分级目录里的旧备份",
		"全部成功后才写 last_success.txt 心跳；失败不写",
	},
	"minio": {
		"mc alias set 写 ~/.mc；备份端桶不存在时 mc mb 创建",
		"逐桶 mc mirror --overwrite：备份端同名对象会被覆盖",
		"全部桶成功后才写心跳；失败桶逐项汇总，不写心跳",
	},
}

var oncePlanWarnings = []string{
	"本次为手动触发，不代表定时任务正常；工具不读 crontab，定时任务是否正常由人判断",
	"撞锁 / 组件失败 / 超时是运行期结果，预演挡不住；脚本自带 flock -n，拿不到锁会如实退出 1、本次不执行",
	"界面子进程上限 30 分钟：超时只结束本机等待，远端可能仍在执行；不自动重试、不写「已取消」",
	"日志里可能出现 src_url / 桶名；绝不读取或回显 backup.env，凭证不进任务日志",
}

// buildOncePlan 是纯函数，便于 go test 直接锁住四条口径。
// extraBlocker 是调用方已经写好的人话（配置错 / 未知 name），空串表示没有额外阻塞。
func buildOncePlan(name, component string, busy bool, extraBlocker string) oncePlanView {
	order := component
	comps := []string{component}
	if component == "all" {
		order = "pg → minio"
		comps = []string{"pg", "minio"}
	}
	impact := []string{}
	for _, c := range comps {
		impact = append(impact, oncePlanImpact[c]...)
	}
	warnings := append([]string{}, oncePlanWarnings...)
	blockers := []string{}
	if busy {
		blockers = append(blockers, "已有备份任务在运行（409）：与部署 / 装依赖 / 依赖卸载 / 重启共用一把任务锁，等它结束再试，不排队、不强行并发。")
	}
	if extraBlocker != "" {
		blockers = append(blockers, extraBlocker)
	}
	if name == "" {
		blockers = append(blockers, "请先选择目标服务器（只接受 servers.json 里的 name）")
	}
	return oncePlanView{
		Server:    name,
		Component: component,
		Order:     order,
		Available: len(blockers) == 0,
		Blockers:  blockers,
		Warnings:  warnings,
		Impact:    impact,
		Commands: []string{
			"ops backup once " + component + " --server " + name + " --dry-run   # 只读预演：preflight + 影响清单",
			"ops backup once " + component + " --server " + name + "            # 正式：预检 → 执行 → 分组件汇总",
			"远端：bash <部署目录>/<组件>/<组件>_backup.sh                     # 路径由服务端按组件顺序拼，接口不收任意路径",
		},
		Context: oncePlanContext{
			CronStatus: "不采集（工具不读 crontab）",
			CronNote:   "手动成功同样写 last_success.txt 心跳，会掩盖定时任务故障；不改采集协议、不加来源字段，定时是否正常由人判断。",
			Direction:  "生产端 PG / MinIO → 备份机上的 *_backup.sh（pull）→ 备份端 dump / 桶 + last_success.txt；生产端由该机 backup.env 决定。",
			Identity:   "清单 user（不提权，与 cron / preflight 同 HOME、同 known_hosts、同 ~/.mc）；确认弹窗没有 sudo 密码框。",
		},
	}
}

func (u *uiState) handleBackupOncePlan(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	component, ok := normalizeComponent(r.URL.Query().Get("component"))
	if !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知组件（可选 all / pg / minio）"})
		return
	}
	extraBlocker := ""
	if err := u.reload(); err != nil {
		// 与「备份监控」页同口径：配置读不出来也回完整快照，不把整页打白。
		extraBlocker = "配置还没准备好：" + err.Error() + "（去「配置」页补齐，或点清单路径打开 servers.json）"
	} else {
		u.mu.Lock()
		list := u.list
		u.mu.Unlock()
		if _, err := list.Get(name); err != nil {
			extraBlocker = "目标机只认清单里的 name：" + err.Error()
		}
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: buildOncePlan(name, component, u.backupBusy(), extraBlocker)})
}
