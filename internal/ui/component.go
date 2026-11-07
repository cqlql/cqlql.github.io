package ui

// 界面「环境组件」页：只读状态（含 Go 侧动作计划）+ install / update / uninstall。
//
// 🔴 与备份部署共用**同一个后台任务锁**（backupTask）：两者都会写远端，
//    同时跑会互相踩；重启的 409 门（u.backupBusy）也因此自动覆盖组件任务。
// 🔴 六道门照抄 docs/ui.md §9：
//    ① POST 必须 confirm=="yes"；② 服务端自己先跑 --dry-run，非 0 不执行；
//    ③ name 只认 servers.json、component / verb 只认注册表白名单；
//    ④ sudo 密码只在单次请求内存 → 子进程 stdin，日志按行脱敏、任务结束清空；
//    ⑤ 任务脱离 HTTP 请求（不用 r.Context()），单任务互斥 409、增量日志；
//    ⑥ 界面不开放 --force；删数据是独立勾选（默认不勾）、卸引擎的连带影响必勾，
//       附加参数由 component.ValidateActionFlags 在服务端再验一次。
//
// 🔴 影响清单、能否执行、阻塞原因由 Go 侧 BuildActions 算好，随 status 下发；
//    前端只渲染并据此禁用按钮，不在前端另算一套指标。
// 组件白名单来自 internal/component 的注册表（纯函数，不碰 SSH），
// 不在 ui 里再抄一份字符串。

import (
	"pass-up/ops/internal/component"
)

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
)

const (
	componentInstallMode   BackupMode = "component.install"
	componentUpdateMode    BackupMode = "component.update"
	componentUninstallMode BackupMode = "component.uninstall"
	componentImageMode     BackupMode = "component.image-load"
	// componentImageCopyMode 是「从另一台已登记服务器复制镜像」：
	// 源机 docker save → 本机 pipe 中转 → 目标机 docker load（不落盘、不 pull）。
	componentImageCopyMode BackupMode = "component.image-copy"
	// 与 CLI 的 2 GiB 上限一致；multipart 也卡同一道，避免先落一个超大文件再失败。
	maxComponentImageBytes = int64(2) << 30
)

type componentRunRequest struct {
	Verb      string `json:"verb"`
	Component string `json:"component"`
	Name      string `json:"name"`
	Confirm   string `json:"confirm"`
	Password  string `json:"password"`
	// Proxy 只给 install / update docker 用：本次 apt / curl 临时走代理，不落远端配置。
	// 格式由 component.ValidProxy 卡死，前端"可选"不等于服务端放行任意字符串。
	Proxy string `json:"proxy,omitempty"`
	// ImageRef 只给 update minio，且必须是只读体检采到的目标机已导入镜像。
	// image-copy 也用它：值必须是源机本地确实存在的镜像（服务端白名单再验一次）。
	ImageRef string `json:"image_ref,omitempty"`
	// FromServer 只给 image-copy：镜像从这台已登记服务器上 docker save 出来（源机）。
	FromServer string `json:"from_server,omitempty"`
	// PurgeData 只给 uninstall minio，默认 false（不删数据）。
	PurgeData bool `json:"purge_data,omitempty"`
	// AckDownstream 是 uninstall docker 的必勾确认。
	AckDownstream bool `json:"ack_downstream,omitempty"`
}

func componentRunMode(verb string) BackupMode {
	switch verb {
	case component.VerbUpdate:
		return componentUpdateMode
	case component.VerbUninstall:
		return componentUninstallMode
	case component.VerbImageCopy:
		return componentImageCopyMode
	default:
		return componentInstallMode
	}
}

// handleComponentStatus 跑一次**只读**体检给页面。
// 起的是 `ops component list --json` 子进程：不写远端、不需要 confirm，
// 与配置页「远端值对照」同一套路（失败回 ok=true + data.error，前端不抛 HTTP 错误）。
func (u *uiState) handleComponentStatus(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if u.runner == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有组件能力"})
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

	var buf bytes.Buffer
	code := u.runner([]string{"component", "list", "--server", name, "--json"}, "", &buf)
	var view map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &view); err != nil {
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]any{
			"server": name, "collected": false,
			"components": []any{}, "checks": []any{}, "raw": map[string]string{},
			"preflight": map[string]any{"ready": false, "blockers": []string{}, "warnings": []string{}},
			"preflights": map[string]any{}, "images": []any{}, "actions": map[string]any{},
			"error": "只读体检没有返回可解析的状态：" + err.Error(),
		}})
		return
	}
	if code != 0 {
		// 子进程非 0 时 JSON 里通常已带 error；只补一句，不覆盖它。
		if s, _ := view["error"].(string); s == "" {
			view["error"] = fmt.Sprintf("只读体检退出码 %d（未采集到状态），请看 ops-ui.log", code)
		}
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: view})
}

func (u *uiState) handleComponentTask(w http.ResponseWriter, r *http.Request) {	after, err := strconv.Atoi(r.URL.Query().Get("after"))
	if err != nil {
		after = 0
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: u.ensureTask().view(after)})
}

// handleComponentImages 只读列出某台已登记服务器**本地**的 MinIO 镜像，
// 给「从服务器复制」的来源下拉当候选。它不写远端、不需要 confirm、
// 与只读体检同一套路（失败回 ok=true + data.error，前端不抛 HTTP 错误）。
func (u *uiState) handleComponentImages(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择服务器（只接受清单里的 name）"})
		return
	}
	if u.runner == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有组件能力"})
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

	var buf bytes.Buffer
	code := u.runner([]string{"component", "images", "--server", name, "--json"}, "", &buf)
	var view map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &view); err != nil {
		writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]any{
			"server": name, "collected": false, "elevated": false, "images": []any{},
			"error": "镜像清单没有返回可解析的内容：" + err.Error(),
		}})
		return
	}
	if code != 0 {
		if s, _ := view["error"].(string); s == "" {
			view["error"] = fmt.Sprintf("镜像清单退出码 %d（未采集到状态），请看 ops-ui.log", code)
		}
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: view})
}

func (u *uiState) handleComponentRun(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求体过大"})
		return
	}
	var req componentRunRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请求格式错误"})
		return
	}
	// /api/components/run 负责四个动词；image-load（上传本机 tar）走 multipart 接口。
	verb := strings.ToLower(strings.TrimSpace(req.Verb))
	switch verb {
	case component.VerbInstall, component.VerbUpdate, component.VerbUninstall, component.VerbImageCopy:
	default:
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知动作（只支持 install / update / uninstall / image-copy）"})
		return
	}
	comp := strings.ToLower(strings.TrimSpace(req.Component))
	if !component.RunnableVerb(comp, verb) {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "组件未注册、未接入或不允许该动作，拒绝写操作"})
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if req.Confirm != "yes" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "这是远端写操作：请输入 yes 确认"})
		return
	}
	if verb == component.VerbImageCopy {
		// 🔴 源机只认清单里的 name，源 ≠ 目标；镜像引用由 ValidImageRef 卡字符集，
		//    「必须在源机本地存在」由 CLI 侧的只读清单再验一次。
		req.FromServer = strings.TrimSpace(req.FromServer)
		if req.FromServer == "" {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请选择镜像来源服务器（只接受清单里的 name）"})
			return
		}
		if req.FromServer == strings.TrimSpace(req.Name) {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: "来源服务器与目标服务器不能是同一台"})
			return
		}
		ref, err := component.ValidImageRef(req.ImageRef)
		if err != nil {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
			return
		}
		req.ImageRef = ref
		// 代理 / 删数据 / 连带确认都不属于这个动作。
		if req.Proxy != "" || req.PurgeData || req.AckDownstream {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: "image-copy 不接受代理 / 删数据 / 连带影响确认参数"})
			return
		}
	} else {
		// 🔴 附加参数门由 Go 侧同一份 ValidateActionFlags 裁决：
		//    代理 / 镜像引用 / 删数据 / 连带影响确认各归其位，前端勾没勾不算数。
		proxy, err := component.ValidProxy(req.Proxy)
		if err != nil {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
			return
		}
		if err := component.ValidateActionFlags(component.ActionOptions{
			Verb: verb, ID: comp, Proxy: proxy, ImageRef: req.ImageRef,
			PurgeData: req.PurgeData, AckDownstream: req.AckDownstream,
		}); err != nil {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: err.Error()})
			return
		}
		req.Proxy = proxy
		if req.FromServer != "" {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: "from_server 只给 image-copy"})
			return
		}
	}
	if u.runner == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有组件能力"})
		return
	}
	if err := u.reload(); err != nil {
		writeAPI(w, http.StatusServiceUnavailable, apiResponse{Error: "配置还没准备好：" + err.Error()})
		return
	}
	u.mu.Lock()
	list := u.list
	u.mu.Unlock()
	if _, err := list.Get(req.Name); err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}
	if verb == component.VerbImageCopy {
		// 源机也必须是清单里的 name（不代理任意主机），且不能等于目标机。
		if _, err := list.Get(req.FromServer); err != nil {
			writeAPI(w, http.StatusNotFound, apiResponse{Error: "镜像来源服务器不在清单里：" + err.Error()})
			return
		}
	}

	req.Verb = verb
	req.Name = strings.TrimSpace(req.Name)
	task := u.ensureTask()
	if !task.start(componentRunMode(verb), req.Name, comp, req.Password) {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "已有远端任务在运行，等它结束再试"})
		return
	}
	go u.runComponentTask(task, req, comp)
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]any{
		"started": true, "verb": verb, "component": comp, "server": req.Name,
		"from_server": req.FromServer,
	}})
}

// runComponentTask 的 --dry-run 门放在服务端：前端不点预检、直接调 API 也绕不过。
// 🔴 预检与正式动作必须带**同一组**附加参数（代理 / 镜像 / 删数据 / 连带影响确认），
//    否则「预检过了」不能代表「正式动作会这么跑」。
func (u *uiState) runComponentTask(t *backupTask, req componentRunRequest, comp string) {
	lw := &backupLogWriter{task: t}
	argsFor := func(extra ...string) []string {
		args := []string{"component", req.Verb, comp, "--server", req.Name}
		if req.Proxy != "" {
			args = append(args, "--proxy", req.Proxy)
		}
		if req.ImageRef != "" {
			args = append(args, "--image-ref", req.ImageRef)
		}
		if req.FromServer != "" {
			args = append(args, "--from-server", req.FromServer)
		}
		if req.PurgeData {
			args = append(args, "--purge-data")
		}
		if req.AckDownstream {
			args = append(args, "--ack-downstream")
		}
		return append(args, extra...)
	}
	label := map[string]string{
		component.VerbInstall: "安装", component.VerbUpdate: "更新",
		component.VerbUninstall: "卸载", component.VerbImageCopy: "复制镜像",
	}[req.Verb]
	fmt.Fprintf(lw, "==> 开始：%s %s（目标：%s）\n", label, comp, req.Name)
	if req.FromServer != "" {
		fmt.Fprintf(lw, "==> 镜像来源：%s（源机 docker save → 本机 pipe 中转 → 目标机 docker load，不落本机磁盘）\n",
			req.FromServer)
	}
	if req.Proxy != "" {
		fmt.Fprintf(lw, "==> 本次 apt / curl 走代理 %s（仅本次生效，不改远端配置）\n", req.Proxy)
	}
	if req.ImageRef != "" {
		fmt.Fprintf(lw, "==> 目标镜像 %s（只读体检采集到的离线镜像，绝不 docker pull）\n", req.ImageRef)
	}
	if req.PurgeData {
		fmt.Fprintln(lw, "==> 已显式勾选删除 /data/minio 数据目录（不可逆）")
	}
	if req.AckDownstream {
		fmt.Fprintln(lw, "==> 已确认卸载引擎会连带停止下游 MinIO 备份服务")
	}
	if req.Verb == component.VerbUninstall {
		fmt.Fprintln(lw, "==> 卸载后 minio 备份定时任务仍在，下一次执行会失败（预期结果）")
	}
	fmt.Fprintln(lw, "==> 服务端预检（--dry-run，不改远端）")
	code := u.runner(argsFor("--dry-run"), req.Password, lw)
	if code != 0 {
		fmt.Fprintf(lw, "预检没过，不执行%s；远端没有被修改。\n", label)
		lw.Flush()
		t.finish(code)
		return
	}
	fmt.Fprintf(lw, "==> 预检通过，开始%s（远端写操作，影响清单见确认弹窗）\n", label)
	code = u.runner(argsFor(), req.Password, lw)
	if code == 0 {
		fmt.Fprintf(lw, "==> %s完成。请点「重新检查」复核组件状态。\n", label)
	} else {
		fmt.Fprintf(lw, "==> 结束，退出码 %d。请点「重新检查」复核远端状态。\n", code)
	}
	lw.Flush()
	t.finish(code)
}

// handleComponentImage 接界面选的离线镜像 tar（multipart）。
//
// 🔴 六道门与安装一致：POST + confirm=yes + verb 白名单 + 组件/name 白名单 +
//    服务端先跑 --dry-run + 单任务互斥 409 + 任务脱离 HTTP 请求。
// 🔴 接口**不接受任何本机路径**：临时文件由服务端 os.CreateTemp 生成，
//    multipart 里的文件名只用来提示，绝不被当成路径（不变成读/写任意文件代理）。
// 🔴 临时 tar 只在任务期间存在，goroutine 结束（含失败）一律删除。
func (u *uiState) handleComponentImage(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxComponentImageBytes+1<<20)
	mr, err := r.MultipartReader()
	if err != nil {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请用 multipart/form-data 上传镜像 tar"})
		return
	}
	fields := map[string]string{}
	var tarPath, fileName string
	cleanup := func() {
		if tarPath != "" {
			_ = os.Remove(tarPath)
			tarPath = ""
		}
	}
	defer cleanup()

	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			writeAPI(w, http.StatusBadRequest, apiResponse{Error: "上传内容解析失败：" + err.Error()})
			return
		}
		key := part.FormName()
		switch key {
		case "confirm", "verb", "component", "name", "password":
			b, e := io.ReadAll(io.LimitReader(part, 4096))
			_ = part.Close()
			if e != nil {
				writeAPI(w, http.StatusBadRequest, apiResponse{Error: "表单字段读取失败"})
				return
			}
			fields[key] = string(b)
		case "image":
			if tarPath != "" {
				_ = part.Close()
				writeAPI(w, http.StatusBadRequest, apiResponse{Error: "一次只能上传一个镜像包"})
				return
			}
			fileName = part.FileName()
			f, e := os.CreateTemp("", "passup-minio-image-*.tar")
			if e != nil {
				_ = part.Close()
				writeAPI(w, http.StatusInternalServerError, apiResponse{Error: "创建临时文件失败"})
				return
			}
			tmp := f.Name()
			n, e := io.Copy(f, io.LimitReader(part, maxComponentImageBytes+1))
			closeErr := f.Close()
			_ = part.Close()
			if e != nil || closeErr != nil || n > maxComponentImageBytes {
				_ = os.Remove(tmp)
				writeAPI(w, http.StatusBadRequest, apiResponse{Error: "镜像包写入失败或超过 2 GiB 上限"})
				return
			}
			if n == 0 {
				_ = os.Remove(tmp)
				writeAPI(w, http.StatusBadRequest, apiResponse{Error: "镜像包是空文件"})
				return
			}
			tarPath = tmp
		default:
			_, _ = io.Copy(io.Discard, part)
			_ = part.Close()
		}
	}

	comp := strings.ToLower(strings.TrimSpace(fields["component"]))
	name := strings.TrimSpace(fields["name"])
	if fields["confirm"] != "yes" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "导入是写操作：请输入 yes 确认"})
		return
	}
	if fields["verb"] != "image-load" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知动作（当前只支持 image-load）"})
		return
	}
	if !component.SupportsImage(comp) {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "该组件不使用离线镜像，拒绝导入"})
		return
	}
	if name == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if tarPath == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请选择本机 .tar 镜像包"})
		return
	}
	if !strings.HasSuffix(strings.ToLower(fileName), ".tar") {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "只接受 docker save 导出的 .tar 镜像包"})
		return
	}
	if u.runner == nil {
		writeAPI(w, http.StatusNotImplemented, apiResponse{Error: "这个构建没有组件能力"})
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

	task := u.ensureTask()
	if !task.start(componentImageMode, name, comp, fields["password"]) {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "已有远端任务在运行，等它结束再试"})
		return
	}
	// 交给任务 goroutine 后不再 cleanup：由它 defer 删除临时 tar。
	path := tarPath
	tarPath = ""
	password := fields["password"]
	go u.runComponentImageTask(task, name, comp, password, path, fileName)
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]any{
		"started": true, "verb": "image-load", "component": comp, "server": name,
	}})
}

func (u *uiState) runComponentImageTask(t *backupTask, name, comp, password, tarPath, fileName string) {
	// defer 兜住 panic / 提前 return；下面还会在 finish 之前主动删一次。
	defer func() { _ = os.Remove(tarPath) }()
	lw := &backupLogWriter{task: t}
	fmt.Fprintf(lw, "==> 开始：导入 %s 离线镜像（%s → %s）\n", comp, fileName, name)
	fmt.Fprintln(lw, "==> 服务端预检（--dry-run，校验镜像包，不上传、不改远端）")
	pre := []string{"component", "image-load", comp, "--server", name, "--image-tar", tarPath, "--dry-run"}
	code := u.runner(pre, password, lw)
	if code != 0 {
		fmt.Fprintln(lw, "预检没过，不执行导入；远端没有被修改，临时镜像包已清理。")
	} else {
		fmt.Fprintln(lw, "==> 预检通过，开始上传并在目标机 docker load（不执行 pull）")
		code = u.runner([]string{"component", "image-load", comp, "--server", name, "--image-tar", tarPath}, password, lw)
		if code == 0 {
			fmt.Fprintln(lw, "==> 完成。请点「重新检查」复核镜像清单。")
		} else {
			fmt.Fprintf(lw, "==> 结束，退出码 %d。远端临时 tar 已清理，请看日志复核。\n", code)
		}
	}
	// 🔴 先删临时镜像包、再标记 done：页面一看到任务结束，文件就一定已经不在了。
	_ = os.Remove(tarPath)
	lw.Flush()
	t.finish(code)
}
