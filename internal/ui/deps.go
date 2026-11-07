package ui

// 界面「备份依赖」只读状态：GET /api/backup/deps。
//
// 🔴 只读：起的是 `ops backup deps --json`，不写远端、不要 confirm、不占任务锁。
//    「装」这个动作在 /api/backup/run 的 mode=deps（见 backup.go 的六道门）。
// 🔴 与「组件体检 / 远端值对照」同一套路：失败也回 ok=true + data.error，
//    让页面显示一段话，而不是抛 HTTP 错误把整页打白；数组一律 [] 不是 null。
// 🔴 name 只认 servers.json，组件只认白名单；pg_major 只接受 1..99 的数字
//    （它会拼进远端 apt 包名，CLI 侧 validatePgMajor 再挡一次）。

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

func parsePgMajorQuery(raw string) (int, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0, nil
	}
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0, fmt.Errorf("pg_major 只能是数字：%q", s)
		}
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 || n > 99 {
		return 0, fmt.Errorf("pg_major 超出范围（1..99）：%q", s)
	}
	return n, nil
}

func emptyDepsData(server, comp string, major int) map[string]any {
	return map[string]any{
		"server": server, "component": comp, "collected": false,
		"items": []any{}, "missing": []any{}, "optional": []any{},
		"plan": []any{}, "docs": []any{}, "pg_major": major,
		"uninstall": map[string]any{
			"title": "确认卸载备份依赖", "description": "", "targets": []any{},
			"impacts": []any{}, "submit_label": "确认卸载",
		},
	}
}

// normalizeUninstallTargets 与 internal/backup.validUninstallTargets 同一判据
// （ui 不能 import backup 的执行包，就像 pg_major 一样各留一份纯函数）。
// 🔴 它会变成远端 rm / apt remove 的参数，绝不能让任意字符串过这一关。
func normalizeUninstallTargets(raw []string) ([]string, error) {
	if len(raw) > 10 {
		return nil, fmt.Errorf("卸载目标过多（最多 2 个：mc / pg_client）")
	}
	seen := map[string]bool{}
	out := []string{}
	for _, r := range raw {
		t := strings.ToLower(strings.TrimSpace(r))
		if t != "mc" && t != "pg_client" {
			return nil, fmt.Errorf("未知卸载目标 %q（可选 mc / pg_client）", r)
		}
		if !seen[t] {
			seen[t] = true
			out = append(out, t)
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("至少要选一个卸载目标（mc / pg_client）")
	}
	return out, nil
}

func (u *uiState) handleBackupDeps(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	comp, ok := normalizeComponent(r.URL.Query().Get("component"))
	if !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知组件（可选 all / pg / minio）"})
		return
	}
	major, err := parsePgMajorQuery(r.URL.Query().Get("pg_major"))
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
		return
	}
	if name == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if u.runner == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有备份依赖能力"})
		return
	}
	if err := u.reload(); err != nil {
		writeAPI(w, http.StatusServiceUnavailable, apiResponse{Error: "配置还没准备好：" + err.Error()})
		return
	}
	u.mu.Lock()
	list := u.list
	u.mu.Unlock()
	if _, err := list.Get(name); err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}

	args := []string{"deps", comp, "--server", name, "--json"}
	if major > 0 {
		args = append(args, "--pg-major", strconv.Itoa(major))
	}
	var buf bytes.Buffer
	code := u.runner(args, "", &buf)
	var view map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &view); err != nil {
		data := emptyDepsData(name, comp, major)
		data["error"] = "依赖状态没有返回可解析的内容：" + err.Error()
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: data})
		return
	}
	if code != 0 {
		if s, _ := view["error"].(string); s == "" {
			view["error"] = fmt.Sprintf("依赖状态采集退出码 %d（未采集到状态），请看 ops-ui.log", code)
		}
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: view})
}
