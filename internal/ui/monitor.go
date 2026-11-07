package ui

// 界面「备份监控」页的唯一只读接口：GET /api/monitor/status。
//
// 🔴 只读：与 `ops status --json` 共用 monitor.CollectForServer / Status，
//    不写远端、不提权、不占后台任务锁、不需要 confirm；页面上没有重跑 / 恢复入口。
// 🔴 主机只认 servers.json 的 name（未知 404）；登录账号用清单的 user/key
//    （2026-11-08 起不再分设只读账号），远端脚本只读、不提权，
//    私钥路径既不进 JSON 也不进日志。
// 🔴 本机时钟只用来算「缓存多旧」；备份新鲜度仍是远端两个 epoch 相减（monitor 包）。
// 🔴 缓存 30s、强制刷新最小间隔 5s、采集串行：防止多标签页把备份机 SSH 打满
//    （docs/backup-monitor.md §5）。配置错不缓存，改完配置立刻能重试。
// 🔴 连不上 / 没配好都回 **200 + 完整快照**（connection.ok=false + problems），
//    不把「备份服务器连不上」变成一行报错把整页打白（AGENTS.md 硬约束 1/3）。

import (
	"pass-up/ops/internal/monitor"
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	monitorCacheTTL         = 30 * time.Second
	monitorMinForceInterval = 5 * time.Second
)

// monitorProbe 是「真正去连远端采集」那一层的注入缝：默认走 monitor 包，
// 单测塞假实现，全项目不写需要真实 SSH 的单测。
type monitorProbe func(cfg *shared.Config, list *shared.ServerList, name string) (monitor.Status, error)

type monitorCacheEntry struct {
	status monitor.Status
	at     time.Time
}

type monitorSnapshotResult struct {
	status      monitor.Status
	cached      bool
	ageSeconds  int
	notice      string
	configError string
}

type monitorThresholds struct {
	PGStaleHours    float64 `json:"pg_stale_hours"`
	MinioStaleHours float64 `json:"minio_stale_hours"`
	DiskWarnPct     float64 `json:"disk_warn_pct"`
}

// monitorStatusView 把 Status 原样嵌进 status 字段：前端不再算指标，
// 只格式化，页面另拿得到缓存 / 配置路径这些「显示用」的元信息。
type monitorStatusView struct {
	Server      string            `json:"server"`
	Status      monitor.Status    `json:"status"`
	Cached      bool              `json:"cached"`
	AgeSeconds  int               `json:"age_seconds"`
	Notice      string            `json:"notice,omitempty"`
	ConfigError string            `json:"config_error,omitempty"`
	ConfigPath  string            `json:"config_path,omitempty"`
	ServersFile string            `json:"servers_file,omitempty"`
	Thresholds  monitorThresholds `json:"thresholds"`
}

func (u *uiState) monitorTime() time.Time {
	if u.monitorNow != nil {
		return u.monitorNow()
	}
	return time.Now()
}

func defaultMonitorProbe(cfg *shared.Config, list *shared.ServerList, name string) (monitor.Status, error) {
	// 🔴 故意不用 r.Context()：刷新 / 关标签页不该掐断已经在跑的只读采集；
	// Collect 自带 30s 总超时，不会挂住整个界面进程。
	return monitor.CollectForServer(context.Background(), cfg, list, name)
}

// monitorSnapshot 串行化「查缓存 → 采集 → 写缓存」。
// 同一时刻只跑一次只读采集：备份机通常就一台，串行比按 name 做 singleflight
// 更少状态，且天然把多标签页的刷新合并掉。缓存命中时只在锁内读一次，不持锁等 SSH。
func (u *uiState) monitorSnapshot(cfg *shared.Config, list *shared.ServerList, name string, force bool) monitorSnapshotResult {
	u.monitorMu.Lock()
	defer u.monitorMu.Unlock()
	if u.monitorCache == nil {
		u.monitorCache = map[string]monitorCacheEntry{}
	}

	now := u.monitorTime()
	if entry, hit := u.monitorCache[name]; hit {
		age := now.Sub(entry.at)
		if age < 0 { // 时钟回拨：不把负数年龄渲染成「未来采集」
			age = 0
		}
		if age < monitorCacheTTL && !force {
			return monitorSnapshotResult{status: entry.status, cached: true, ageSeconds: int(age.Seconds())}
		}
		if age < monitorMinForceInterval {
			wait := int((monitorMinForceInterval - age).Seconds()) + 1
			return monitorSnapshotResult{
				status: entry.status, cached: true, ageSeconds: int(age.Seconds()),
				notice: fmt.Sprintf("刚刚采集过，%d 秒后可再次强制刷新", wait),
			}
		}
	}

	probe := u.probeMonitor
	if probe == nil {
		probe = defaultMonitorProbe
	}
	st, err := probe(cfg, list, name)
	if err != nil {
		// 配置没准备好：每次请求都该重新试，别让旧结论挡住刚补好的配置。
		// 文案取快照里已脱敏的 Connection.Error，不直接用 err.Error()：
		// ssh / 配置报错可能带私钥路径（AGENTS.md 硬约束 8）。
		delete(u.monitorCache, name)
		reason := st.Connection.Error
		if reason == "" {
			reason = err.Error()
		}
		return monitorSnapshotResult{status: st, configError: reason}
	}
	u.monitorCache[name] = monitorCacheEntry{status: st, at: u.monitorTime()}
	return monitorSnapshotResult{status: st}
}

func (u *uiState) handleMonitorStatus(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	force := r.URL.Query().Get("force") == "1"

	// 要连远端就必须严格 LoadConfig（硬约束 26 ⑤）：不许拿 FallbackConfig 的默认
	// 路径冒充一台目标机。失败仍回 200 + 完整快照 + config_error，页面给引导。
	cfg, err := shared.LoadConfig()
	if err != nil {
		u.writeMonitorConfigError(w, name, "读取本机 ops.env 失败："+err.Error())
		return
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		u.writeMonitorConfigError(w, name, "读取服务器清单失败："+err.Error())
		return
	}
	if _, err := list.Get(name); err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}

	res := u.monitorSnapshot(cfg, list, name, force)
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: monitorStatusView{
		Server:      name,
		Status:      res.status,
		Cached:      res.cached,
		AgeSeconds:  res.ageSeconds,
		Notice:      res.notice,
		ConfigError: res.configError,
		ConfigPath:  cfg.Path,
		ServersFile: list.Path,
		Thresholds: monitorThresholds{
			PGStaleHours:    cfg.Monitor.PGStaleHours,
			MinioStaleHours: cfg.Monitor.MinioStaleHours,
			DiskWarnPct:     cfg.Monitor.DiskWarnPct,
		},
	}})
}

func (u *uiState) writeMonitorConfigError(w http.ResponseWriter, name, reason string) {
	st := monitor.FailureStatus(name, reason)
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: monitorStatusView{
		Server:      name,
		Status:      st,
		ConfigError: st.Connection.Error,
	}})
}
