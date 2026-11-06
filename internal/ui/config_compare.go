package ui

import (
	"pass-up/ops/internal/shared"
)

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

// 配置页的「远端值对照」：只读抓一次远端 backup.env，与本机 env 逐键比对。
//
// 🔴 边界（AGENTS.md 硬约束 23、docs/ui.md §12）：
//   - 只读：GET，不写任何文件、不跑 install.sh、不动 crontab；
//   - 凭证不出明文：抓取 CLI 只回掩码 + 指纹，本机值在服务端也转成掩码；
//     页面靠 state 判断「变了没有」，拿不到任何明文凭证；
//   - 路径由服务端从 ops.env 解析；name 只认清单；失败如实回原因、不猜值、不缓存；
//   - 不进 opMu：只读抓取不共享检查/写操作的状态，不该把「检查全部」堵在后面。

type compareFieldView struct {
	Key              string `json:"key"`
	Label            string `json:"label"`
	Group            string `json:"group"`
	Remote           string `json:"remote"`
	Local            string `json:"local"`
	Secret           bool   `json:"secret"`
	RemoteConfigured bool   `json:"remote_configured"`
	LocalConfigured  bool   `json:"local_configured"`
	State            string `json:"state"` // consistent / changed / remote-only / local-only
}

type componentCompareView struct {
	Component  string             `json:"component"`
	RemotePath string             `json:"remote_path"`
	LocalPath  string             `json:"local_path"`
	Fields     []compareFieldView `json:"fields"`
}

type configCompareView struct {
	Components []componentCompareView `json:"components"`
	Error      string                 `json:"error,omitempty"`
	FetchedAt  string                 `json:"fetched_at,omitempty"`
}

// 与 internal/backup/compareenv.go 的输出逐字对应。
type cliEnvField struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Secret      bool   `json:"secret"`
	Configured  bool   `json:"configured"`
	Fingerprint string `json:"fingerprint"`
}

type cliEnvComponent struct {
	Component string        `json:"component"`
	Path      string        `json:"path"`
	Fields    []cliEnvField `json:"fields"`
}

type cliEnvSnapshot struct {
	Components []cliEnvComponent `json:"components"`
}

func (u *uiState) handleConfigCompare(w http.ResponseWriter, r *http.Request) {
	component, ok := normalizeComponent(r.URL.Query().Get("component"))
	if !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知组件（可选 all / pg / minio）"})
		return
	}
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if u.runner == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有备份部署能力"})
		return
	}
	cfg, err := shared.LoadConfig()
	if err != nil {
		writeAPI(w, http.StatusServiceUnavailable, apiResponse{Error: "配置还没准备好：" + err.Error()})
		return
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		writeAPI(w, http.StatusServiceUnavailable, apiResponse{Error: "配置还没准备好：" + err.Error()})
		return
	}
	if _, err := list.Get(name); err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}

	var buf bytes.Buffer
	code := u.runner([]string{"compare-env", component, "--server", name}, "", &buf)
	raw := buf.String()
	if len(raw) > 8<<10 {
		raw = raw[:8<<10] + "\n[输出已截断]"
	}
	// 失败也回 200：抓不到远端是**业务结果**，页面要显示原因而不是一句 HTTP 错误。
	if code != 0 {
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: configCompareView{
			Error: strings.TrimSpace(raw),
		}})
		return
	}
	// CLI 理论上只输出一行 JSON；保险起见从第一个 { 截起。
	if i := strings.Index(raw, "{"); i > 0 {
		raw = raw[i:]
	}
	var snap cliEnvSnapshot
	if err := json.Unmarshal([]byte(raw), &snap); err != nil {
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: configCompareView{
			Error: "抓取结果无法解析（界面与 CLI 版本可能不一致）",
		}})
		return
	}

	view := configCompareView{FetchedAt: time.Now().Format("15:04:05")}
	for _, cs := range snap.Components {
		localPath := cfg.PGEnvFile
		if cs.Component == "minio" {
			localPath = cfg.MinioEnvFile
		}
		localRaw, err := rawEnvValues(localPath)
		if err != nil && !os.IsNotExist(err) {
			view.Error = "读取本机配置失败：" + err.Error()
			writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: view})
			return
		}
		view.Components = append(view.Components, mergeCompare(cs, localPath, localRaw))
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: view})
}

func rawEnvValues(path string) (map[string]string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return shared.ParseEnvText(string(b)), nil
}

func mergeCompare(cs cliEnvComponent, localPath string, localRaw map[string]string) componentCompareView {
	defs, _ := envDefsFor(cs.Component)
	remote := map[string]cliEnvField{}
	for _, f := range cs.Fields {
		remote[f.Key] = f
	}

	// 顺序：模板定义顺序 → 仅远端有 → 仅本机有（后者按字母序，保证稳定）。
	seen := map[string]bool{}
	var keys []string
	for _, d := range defs {
		if _, rok := remote[d.Key]; rok {
			keys = append(keys, d.Key)
			seen[d.Key] = true
			continue
		}
		if _, lok := localRaw[d.Key]; lok {
			keys = append(keys, d.Key)
			seen[d.Key] = true
		}
	}
	var extra []string
	for k := range remote {
		if !seen[k] {
			extra = append(extra, k)
		}
	}
	for k := range localRaw {
		if !seen[k] {
			extra = append(extra, k)
		}
	}
	sort.Strings(extra)
	keys = append(keys, extra...)

	out := componentCompareView{Component: cs.Component, RemotePath: cs.Path, LocalPath: localPath}
	for _, k := range keys {
		label, group := k, "其它"
		for _, d := range defs {
			if d.Key == k {
				label, group = d.Label, d.Group
				break
			}
		}
		rf, rok := remote[k]
		lv, lok := localRaw[k]
		secret := shared.IsSecretEnvKey(k)
		field := compareFieldView{
			Key:              k,
			Label:            label,
			Group:            group,
			Secret:           secret,
			RemoteConfigured: rok && rf.Configured,
			LocalConfigured:  lok && lv != "",
			Remote:           rf.Value, // CLI 已脱敏
			Local:            lv,
		}
		if secret {
			field.Local = shared.MaskEnvValue(lv)
		}
		switch {
		case rok && lok:
			if secret {
				if rf.Fingerprint == shared.EnvFingerprint(lv) {
					field.State = "consistent"
				} else {
					field.State = "changed"
				}
			} else if rf.Value == lv {
				field.State = "consistent"
			} else {
				field.State = "changed"
			}
		case rok:
			field.State = "remote-only"
		default:
			field.State = "local-only"
		}
		out.Fields = append(out.Fields, field)
	}
	return out
}
