package ui

import (
	"pass-up/ops/internal/servers"
	"pass-up/ops/internal/shared"
)

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// 界面「配置」页：把散在本机文件里的两类配置收拢到页面上编辑。
//
// 🔴 这是界面里新增的第三个/第四个写操作（前两个是一键免密 sudo 与备份安装），
// 边界见 AGENTS.md 硬约束 15 / 21 与 docs/ui.md §12：
//   - 双击落地页仍只读；每个写动作都要人点 + 二次确认（confirm == "yes"）；
//   - 路径全部由服务端从 ops.env / 配置目录解析，**接口不接收任何路径**；
//   - 只认清单里的 name、组件只认 pg|minio|all；字段/键白名单在 config_edit.go；
//   - 凭证不回显（GET 只给 configured 标记）、不进日志；写 0600 且先留 .bak；
//   - POST + token + Origin（ServeHTTP 统一 enforce）；备份任务在跑时 409；
//   - 「同步到远端」是独立动作：改本机配置不会偷偷碰远端。

type serverConfigView struct {
	shared.ServerInfo
	ExecChain string `json:"exec_chain"`
}

type envView struct {
	Component string     `json:"component"`
	Path      string     `json:"path"`
	Exists    bool       `json:"exists"`
	Fields    []envField `json:"fields"`
}

type configView struct {
	ServersFile string             `json:"servers_file"`
	Servers     []serverConfigView `json:"servers"`
	Envs        []envView          `json:"envs"`
	SyncEnabled bool               `json:"sync_enabled"`
	// SetupError 非空 = ops.env / servers.json 还读不出来。🔴 这不是错误响应：
	// 配置页必须照样能打开，否则「配置不全」时人恰恰进不去能补配置的那一页。
	SetupError string `json:"setup_error,omitempty"`
}

// configForEditing 让本机配置编辑不依赖「配置已经配好了」这个前提。
// 路径规则与 LoadConfig 完全一致（同在 shared 包里），只是文件不存在或
// 格式暂错时退回默认值，并把原因带回去给页面显示。
//
// 🔴 只用于读写**本机文件**。任何要连远端的动作（sync-env / compare / 备份部署）
// 仍走 shared.LoadConfig 的严格校验，不许拿默认路径去冒充一台目标机。
func configForEditing() (*shared.Config, string) {
	cfg, err := shared.LoadConfig()
	if err != nil {
		return shared.FallbackConfig(), err.Error()
	}
	return cfg, ""
}

// execChain 把「远端执行身份」讲清楚：现在分两层，别再混成一个人。
// 安装期由 sudo 提权到 root（写 /etc/logrotate.d、建系统目录、清理旧 crontab）；
// 但 cron 里的备份脚本、preflight 自检、--run-now 首跑一律以 s.User 运行，
// 用的是这个人的 HOME / ~/.ssh/known_hosts / 私钥，与备份机上手敲的 ssh 一致。
// 仍不是可配项：页面只读展示。见 docs/ui.md §12.1 / docs/backup-deploy.md §4.4。
func execChain(s *shared.Server) string {
	if s.User == "root" || s.Sudo.Mode == shared.SudoModeRoot {
		return s.User + " 直接以 root 登录（安装与运行都是 root；建议改用普通用户 + 免密 sudo）"
	}
	if s.Sudo.Mode == shared.SudoModeNone {
		return s.User + " 登录，无免密 sudo（安装期的系统目录写入会失败）"
	}
	return s.User + " 登录 → 安装期 sudo 提权一次（写系统目录 / 清旧 crontab）→ 定时任务、备份脚本、自检均回落为 " + s.User + " 运行"
}

func (u *uiState) handleConfigView(w http.ResponseWriter) {
	// 🔴 配置不全时这里**不能**回 503：那一页正是用来补配置的。
	// ops.env 缺失 → 用同一套路径规则给默认值；servers.json 为空 / 不存在 →
	// servers 回空数组，并在 setup_error 里说清原因；两份 env 照常可编辑。
	cfg, setupErr := configForEditing()
	// 两份文件各自独立：ops.env 缺失但 servers.json 已经写好时，清单照样要显示，
	// 只在 setup_error 里把还差的那份讲清楚。
	list, listErr := shared.LoadServers(cfg)
	if listErr != nil {
		if setupErr == "" {
			setupErr = listErr.Error()
		} else {
			setupErr += "；" + listErr.Error()
		}
	}
	u.mu.Lock()
	states := u.states
	u.mu.Unlock()

	rows := make([]serverConfigView, 0)
	if list != nil {
		infos := servers.ServerInfos(list, states)
		for i := range list.Servers {
			s := &list.Servers[i]
			var mine shared.ServerInfo
			for _, r := range infos {
				if r.Name == s.Name {
					mine = r
					break
				}
			}
			rows = append(rows, serverConfigView{ServerInfo: mine, ExecChain: execChain(s)})
		}
	}

	envs := make([]envView, 0, 2)
	for _, c := range []struct {
		name string
		path string
	}{{"pg", cfg.PGEnvFile}, {"minio", cfg.MinioEnvFile}} {
		defs, _ := envDefsFor(c.name)
		fields, _, err := readEnvFields(c.path, defs)
		if err != nil {
			writeAPI(w, http.StatusInternalServerError, apiResponse{Error: err.Error()})
			return
		}
		_, statErr := os.Stat(c.path)
		envs = append(envs, envView{c.name, c.path, statErr == nil, fields})
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: configView{
		ServersFile: cfg.ServersFile,
		Servers:     rows,
		Envs:        envs,
		SyncEnabled: u.runner != nil,
		SetupError:  setupErr,
	}})
}

func readConfigBody(w http.ResponseWriter, r *http.Request, dst any) bool {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求体过大"})
		return false
	}
	if err := json.Unmarshal(body, dst); err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求格式错误"})
		return false
	}
	return true
}

// configWriteBlocked 与「重启」共用同一道门：备份任务正在写远端时，
// 改配置 / 同步 env 都会留下半状态，直接 409。
func (u *uiState) configWriteBlocked(w http.ResponseWriter) bool {
	if u.backupBusy() {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "备份预检 / 安装 / 自检正在运行，等它结束再改配置"})
		return true
	}
	return false
}

type configServersRequest struct {
	Name    string            `json:"name"`
	Mode    string            `json:"mode"` // "" = 编辑已有；"add" = 新增一台
	Confirm string            `json:"confirm"`
	Fields  map[string]string `json:"fields"`
}

func (u *uiState) handleConfigServers(w http.ResponseWriter, r *http.Request) {
	var req configServersRequest
	if !readConfigBody(w, r, &req) {
		return
	}
	if req.Mode != "" && req.Mode != "add" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知的保存模式（可选 edit / add）"})
		return
	}
	if req.Confirm != "yes" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "保存配置是写操作：请输入 yes 确认"})
		return
	}
	adding := req.Mode == "add"
	if !adding && strings.TrimSpace(req.Name) == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择服务器"})
		return
	}
	if u.configWriteBlocked(w) {
		return
	}
	u.opMu.Lock()
	defer u.opMu.Unlock()

	if adding {
		// 🔴 新增特意允许「配置还没准备好」：ops.env 缺失 / 清单为空时，
		// 这一页正是把第一台服务器写进去的地方。路径按默认规则取，
		// 写入本身仍过 confirm=yes、字段白名单与全量校验（见 config_edit.go）。
		cfg, _ := configForEditing()
		res, err := addServersFile(cfg.ServersFile, req.Fields)
		if err != nil {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
			return
		}
		if err := u.reload(); err != nil {
			writeAPI(w, http.StatusInternalServerError, apiResponse{Error: "已保存，但重新加载失败：" + err.Error()})
			return
		}
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: res})
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
	if _, err := list.Get(req.Name); err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}
	res, err := editServersFile(cfg.ServersFile, req.Name, req.Fields)
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
		return
	}
	// user / sudo.mode 变了，旧的检查结果（尤其「sudo -n 可用」）不再可信。
	if res.NeedsSudoReapply {
		u.mu.Lock()
		delete(u.states, req.Name)
		_ = shared.SaveServerState(cfg.ServersFile, u.states)
		u.mu.Unlock()
	}
	if err := u.reload(); err != nil {
		writeAPI(w, http.StatusInternalServerError, apiResponse{Error: "已保存，但重新加载失败：" + err.Error()})
		return
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: res})
}

type configEnvRequest struct {
	Component string            `json:"component"`
	Confirm   string            `json:"confirm"`
	Fields    map[string]string `json:"fields"`
	// Clear 是「人显式点了清空」的键；空值单独走这里，避免与「留空保持不变」混淆。
	Clear []string `json:"clear"`
}

func (u *uiState) handleConfigBackupEnv(w http.ResponseWriter, r *http.Request) {
	var req configEnvRequest
	if !readConfigBody(w, r, &req) {
		return
	}
	if req.Confirm != "yes" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "保存配置是写操作：请输入 yes 确认"})
		return
	}
	defs, ok := envDefsFor(req.Component)
	if !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知组件（可选 pg / minio）"})
		return
	}
	if u.configWriteBlocked(w) {
		return
	}
	u.opMu.Lock()
	defer u.opMu.Unlock()
	// 与 GET /api/config 同一套路径规则：ops.env 还没生成时，也应该能把
	// 备份配置写出来。这里只写本机文件，远端同步仍走严格 LoadConfig。
	cfg, _ := configForEditing()
	path := cfg.PGEnvFile
	if req.Component == "minio" {
		path = cfg.MinioEnvFile
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		writeAPI(w, http.StatusInternalServerError, apiResponse{Error: "创建配置目录失败：" + err.Error()})
		return
	}
	changed, err := editEnvFile(path, defs, req.Fields, req.Clear)
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
		return
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]any{
		"changed":       changed,
		"component":     req.Component,
		"remote_synced": false,
	}})
}

type configSyncRequest struct {
	Component string `json:"component"`
	Name      string `json:"name"`
	Confirm   string `json:"confirm"`
}

func (u *uiState) handleConfigSyncEnv(w http.ResponseWriter, r *http.Request) {
	var req configSyncRequest
	if !readConfigBody(w, r, &req) {
		return
	}
	if req.Confirm != "yes" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "同步到远端是写操作：请输入 yes 确认"})
		return
	}
	component, ok := normalizeComponent(req.Component)
	if !ok {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知组件（可选 all / pg / minio）"})
		return
	}
	if u.runner == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有备份部署能力"})
		return
	}
	if u.configWriteBlocked(w) {
		return
	}
	u.opMu.Lock()
	defer u.opMu.Unlock()
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
	if _, err := list.Get(req.Name); err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}
	// 占位符配置不许同步到远端：那会把 CHANGE_ME 铺进生产 cron。
	for _, c := range []string{"pg", "minio"} {
		if component != "all" && component != c {
			continue
		}
		p := cfg.PGEnvFile
		if c == "minio" {
			p = cfg.MinioEnvFile
		}
		raw, err := os.ReadFile(p)
		if err != nil {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: fmt.Sprintf("%s 的本机配置还没填好：%v", c, err)})
			return
		}
		if strings.Contains(string(raw), "CHANGE_ME") || strings.Contains(string(raw), "YOUR_") {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: c + " 的本机配置仍含占位符，填好再同步"})
			return
		}
	}
	var log bytes.Buffer
	args := []string{"sync-env", component, "--server", req.Name}
	code := u.runner(args, "", &log)
	out := log.String()
	if len(out) > 64<<10 {
		out = out[:64<<10] + "\n[输出已截断]\n"
	}
	if code != 0 {
		// 信封保持 ok=true：同步命令失败是**业务结果**（要带日志给页面看），
		// 不是请求失败。回 ok=false 会被 shared/api/http.ts 直接抛成 ApiError，
		// 页面只剩一句 "HTTP 200 OK"，反而看不到失败原因。
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]any{
			"exit_code": code, "log": out, "synced": false,
		}})
		return
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]any{
		"exit_code": 0, "log": out, "synced": true, "component": component, "server": req.Name,
	}})
}
