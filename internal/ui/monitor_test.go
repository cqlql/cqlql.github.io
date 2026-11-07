package ui

// P2+ 备份监控页的接口护栏：只读、只认清单 name、缓存与限流、
// 连接失败 / 配置错仍回完整快照、私钥路径不进响应。
// 🔴 采集层用注入的假 probe，不连真实 SSH（全项目惯例）。

import (
	"pass-up/ops/internal/monitor"
	"pass-up/ops/internal/shared"
)

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type monitorFakeProbe struct {
	calls atomic.Int32
	st    monitor.Status
	err   error
	names []string
}

func (f *monitorFakeProbe) run(_ *shared.Config, _ *shared.ServerList, name string) (monitor.Status, error) {
	f.calls.Add(1)
	f.names = append(f.names, name)
	return f.st, f.err
}

func monitorState(t *testing.T, probe monitorProbe) *uiState {
	t.Helper()
	dir := t.TempDir()
	t.Setenv(shared.ConfigDirEnv, dir)
	writeValidConfig(t, dir)
	u := newState(t, fakeDist(t))
	u.probeMonitor = probe
	return u
}

func serveMonitor(u *uiState, query string) *httptest.ResponseRecorder {
	return serve(u, http.MethodGet, "/api/monitor/status?token=tok&"+query, nil)
}

func monitorView(w *httptest.ResponseRecorder) monitorStatusView {
	var body struct {
		OK   bool               `json:"ok"`
		Data monitorStatusView `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return body.Data
}

func ptr(v float64) *float64 { return &v }

func healthyStatus() monitor.Status {
	return monitor.Status{
		Host:       "ro@10.0.0.1:22",
		CheckedAt:  "2026-11-07T23:00:00+08:00",
		RemoteHost: "backup-01",
		Connection: monitor.Connection{OK: true, LatencyMS: ptr(180)},
		PG: monitor.PGStatus{
			Collected: true, HasSuccess: true, LastSuccessRaw: "2026-11-07 03:00:12",
			LastSuccessAgeHours: ptr(7), HasLatest: true,
			LatestPath: "/data/backups/postgres/daily/passup.dump", LatestSizeMB: ptr(123.4),
			LatestAgeHours: ptr(7), TotalMB: ptr(800),
		},
		MinIO: monitor.MinIOStatus{
			Collected: true, HasSuccess: true, LastSuccessRaw: "2026-11-07 02:00:11",
			LastSuccessAgeHours: ptr(8), LogSizeMB: ptr(3.2),
		},
		Disk:     monitor.DiskStatus{Collected: true, TotalMB: ptr(102400), FreeMB: ptr(20480), UsedPct: ptr(80)},
		Problems: []monitor.Problem{},
	}
}

func TestMonitorEndpointNeedsToken(t *testing.T) {
	f := &monitorFakeProbe{st: healthyStatus()}
	u := monitorState(t, f.run)
	w := serve(u, http.MethodGet, "/api/monitor/status?name=bk", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("不带 token 读备份状态 = %d，想要 401", w.Code)
	}
	if f.calls.Load() != 0 {
		t.Fatal("401 的请求仍然触发了只读采集")
	}
}

func TestMonitorEndpointGates(t *testing.T) {
	f := &monitorFakeProbe{st: healthyStatus()}
	u := monitorState(t, f.run)
	cases := []struct {
		method, target string
		want           int
	}{
		{http.MethodGet, "/api/monitor/status?token=tok&name=", http.StatusBadRequest},
		{http.MethodGet, "/api/monitor/status?token=tok&name=not-in-list", http.StatusNotFound},
		{http.MethodGet, "/api/monitor/status?token=tok&name=10.0.0.1", http.StatusNotFound},
		{http.MethodPost, "/api/monitor/status?token=tok&name=bk", http.StatusNotFound},
	}
	for _, c := range cases {
		if w := serve(u, c.method, c.target, nil); w.Code != c.want {
			t.Errorf("%s %s → %d，想要 %d", c.method, c.target, w.Code, c.want)
		}
	}
	if f.calls.Load() != 0 {
		t.Fatalf("被拦下的请求仍采集了 %d 次", f.calls.Load())
	}
}

func TestMonitorEndpointReturnsFullSnapshot(t *testing.T) {
	f := &monitorFakeProbe{st: healthyStatus()}
	u := monitorState(t, f.run)
	// runner 故意不注入：监控必须走 monitor 包直采，不起后台任务、不占任务锁。
	w := serveMonitor(u, "name=bk")
	if w.Code != http.StatusOK {
		t.Fatalf("只读快照 = %d：%s", w.Code, w.Body.String())
	}
	v := monitorView(w)
	if v.Server != "bk" || v.Cached {
		t.Errorf("server/cached = %q/%v", v.Server, v.Cached)
	}
	if !v.Status.Connection.OK || v.Status.PG.LatestSizeMB == nil || *v.Status.PG.LatestSizeMB != 123.4 {
		t.Errorf("快照字段缺失：%+v", v.Status)
	}
	if v.Status.Problems == nil {
		t.Error("problems 必须是数组（nil 会让前端 .map 白屏）")
	}
	if v.ConfigPath == "" || v.ServersFile == "" {
		t.Errorf("页面要显示配置路径：%+v", v)
	}
	if f.calls.Load() != 1 || len(f.names) != 1 || f.names[0] != "bk" {
		t.Errorf("采集次数 / 目标 = %d / %v", f.calls.Load(), f.names)
	}
	for _, secret := range []string{".ssh", "id_rsa", "PRIVATE KEY"} {
		if strings.Contains(w.Body.String(), secret) {
			t.Errorf("响应里出现私钥痕迹 %q", secret)
		}
	}
}

func TestMonitorCacheReusesSnapshot(t *testing.T) {
	f := &monitorFakeProbe{st: healthyStatus()}
	u := monitorState(t, f.run)
	first := serveMonitor(u, "name=bk")
	second := serveMonitor(u, "name=bk")
	if f.calls.Load() != 1 {
		t.Fatalf("两次普通请求采集了 %d 次，想要 1 次（30s 缓存）", f.calls.Load())
	}
	if v := monitorView(second); !v.Cached || v.AgeSeconds < 0 {
		t.Errorf("第二次应该命中缓存：%+v", v)
	}
	if monitorView(first).Status.CheckedAt != monitorView(second).Status.CheckedAt {
		t.Error("命中缓存却换了快照")
	}
}

func TestMonitorCacheExpiresAfterTTL(t *testing.T) {
	f := &monitorFakeProbe{st: healthyStatus()}
	u := monitorState(t, f.run)
	now := time.Date(2026, 11, 7, 23, 0, 0, 0, time.UTC)
	u.monitorNow = func() time.Time { return now }
	serveMonitor(u, "name=bk")
	now = now.Add(monitorCacheTTL + time.Second)
	w := serveMonitor(u, "name=bk")
	if f.calls.Load() != 2 {
		t.Fatalf("TTL 到期后没有重采：calls=%d", f.calls.Load())
	}
	if v := monitorView(w); v.Cached {
		t.Error("重采后仍标记 cached=true")
	}
}

func TestMonitorForceHasMinimumInterval(t *testing.T) {
	f := &monitorFakeProbe{st: healthyStatus()}
	u := monitorState(t, f.run)
	now := time.Date(2026, 11, 7, 23, 0, 0, 0, time.UTC)
	u.monitorNow = func() time.Time { return now }
	serveMonitor(u, "name=bk")

	now = now.Add(2 * time.Second)
	w := serveMonitor(u, "name=bk&force=1")
	if f.calls.Load() != 1 {
		t.Fatalf("2s 内强制刷新仍采集了 %d 次", f.calls.Load())
	}
	if v := monitorView(w); !v.Cached || !strings.Contains(v.Notice, "秒后可再次强制刷新") {
		t.Errorf("限流没给出提示：%+v", v)
	}

	now = now.Add(monitorMinForceInterval)
	w = serveMonitor(u, "name=bk&force=1")
	if f.calls.Load() != 2 {
		t.Fatalf("过了最小间隔仍没重采：calls=%d", f.calls.Load())
	}
	if v := monitorView(w); v.Cached || v.Notice != "" {
		t.Errorf("真正重采后不该带缓存 / 限流标记：%+v", v)
	}
}

func TestMonitorConfigErrorNotCached(t *testing.T) {
	st := monitor.FailureStatus("bk", "只读监控账号未配好：monitor.user / monitor.key 齐全")
	f := &monitorFakeProbe{st: st, err: errors.New("含私钥路径 /home/u/.ssh/id_rsa，不该进响应")}
	u := monitorState(t, f.run)
	for i := 0; i < 2; i++ {
		w := serveMonitor(u, "name=bk")
		if w.Code != http.StatusOK {
			t.Fatalf("配置错也该回 200 + 完整快照，实际 %d", w.Code)
		}
		v := monitorView(w)
		if v.ConfigError == "" || v.Cached {
			t.Errorf("config_error / cached = %q / %v", v.ConfigError, v.Cached)
		}
		if len(v.Status.Problems) == 0 || v.Status.Problems[0].Level != "danger" {
			t.Errorf("配置错没有 danger 快照：%+v", v.Status.Problems)
		}
		if strings.Contains(w.Body.String(), "id_rsa") {
			t.Error("config_error 没脱敏，私钥路径进了响应")
		}
	}
	if f.calls.Load() != 2 {
		t.Fatalf("配置错被缓存了：calls=%d", f.calls.Load())
	}
}

func TestMonitorConnectionFailureStaysFullSnapshot(t *testing.T) {
	// 连不上是 Collect 的正常结果（CLI 退出码 1），不是 HTTP 错误、也不是 0 兜底。
	st := monitor.FailureStatus("ro@10.0.0.1:22", "ssh: connection refused")
	f := &monitorFakeProbe{st: st}
	u := monitorState(t, f.run)
	w := serveMonitor(u, "name=bk")
	if w.Code != http.StatusOK {
		t.Fatalf("连不上时状态码 = %d", w.Code)
	}
	v := monitorView(w)
	if v.Status.Connection.OK || len(v.Status.Problems) == 0 {
		t.Errorf("连不上仍要回完整快照：%+v", v.Status)
	}
	if v.Status.PG.Collected || v.Status.MinIO.Collected || v.Status.Disk.Collected {
		t.Error("四段不该假装有数据")
	}
	if v.Status.PG.LatestSizeMB != nil || v.Status.Disk.FreeMB != nil {
		t.Error("没采到必须是 null，不是 0")
	}
	if strings.Contains(w.Body.String(), `"latest_size_mb":0`) || strings.Contains(w.Body.String(), `"free_mb":0`) {
		t.Error("响应里出现了 0 兜底")
	}
}

func TestMonitorForeignOriginRejected(t *testing.T) {
	f := &monitorFakeProbe{st: healthyStatus()}
	u := monitorState(t, f.run)
	w := serve(u, http.MethodGet, "/api/monitor/status?token=tok&name=bk",
		map[string]string{"Origin": "http://evil.example"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("跨域 GET = %d，想要 403", w.Code)
	}
	if f.calls.Load() != 0 {
		t.Error("被拒的跨域请求仍触发了采集")
	}
}
