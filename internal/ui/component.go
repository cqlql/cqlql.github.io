package ui

// 界面「环境组件」页：只读状态 + 安装动作。
//
// 🔴 与备份部署共用**同一个后台任务锁**（backupTask）：两者都会写远端，
//    同时跑会互相踩；重启的 409 门（u.backupBusy）也因此自动覆盖组件任务。
// 🔴 六道门照抄 docs/ui.md §9：
//    ① POST 必须 confirm=="yes"；② 服务端自己先跑 --dry-run，非 0 不安装；
//    ③ name 只认 servers.json、component 只认注册表里 PhaseReady 的 id；
//    ④ sudo 密码只在单次请求内存 → 子进程 stdin，日志按行脱敏、任务结束清空；
//    ⑤ 任务脱离 HTTP 请求（不用 r.Context()），单任务互斥 409、增量日志；
//    ⑥ 界面不开放 --force / uninstall / update（后两个能力尚未接入）。
//
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
	componentInstallMode BackupMode = "component.install"
	componentImageMode   BackupMode = "component.image-load"
	// 与 CLI 的 2 GiB 上限一致；multipart 也卡同一道，避免先落一个超大文件再失败。
	maxComponentImageBytes = int64(2) << 30
)

type componentRunRequest struct {
	Verb      string `json:"verb"`
	Component string `json:"component"`
	Name      string `json:"name"`
	Confirm   string `json:"confirm"`
	Password  string `json:"password"`
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
			"error":     "只读体检没有返回可解析的状态：" + err.Error(),
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

func (u *uiState) handleComponentTask(w http.ResponseWriter, r *http.Request) {
	after, err := strconv.Atoi(r.URL.Query().Get("after"))
	if err != nil {
		after = 0
	}
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: u.ensureTask().view(after)})
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
	// 本轮只开放 install；update / uninstall 尚未接入，界面也不给按钮。
	if req.Verb != "install" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "未知动作（当前只支持 install）"})
		return
	}
	comp := strings.ToLower(strings.TrimSpace(req.Component))
	if !component.Runnable(comp) {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "组件未注册或尚未接入，拒绝写操作"})
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "请先选择目标服务器（只接受清单里的 name）"})
		return
	}
	if req.Confirm != "yes" {
		writeAPI(w, http.StatusBadRequest, apiResponse{Error: "安装是写操作：请输入 yes 确认"})
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
	if _, err := list.Get(req.Name); err != nil {
		writeAPI(w, http.StatusNotFound, apiResponse{Error: err.Error()})
		return
	}

	task := u.ensureTask()
	if !task.start(componentInstallMode, req.Name, comp, req.Password) {
		writeAPI(w, http.StatusConflict, apiResponse{Error: "已有远端任务在运行，等它结束再试"})
		return
	}
	go u.runComponentTask(task, req.Name, comp, req.Password)
	writeAPI(w, http.StatusOK, apiResponse{OK: true, Data: map[string]any{
		"started": true, "verb": req.Verb, "component": comp, "server": req.Name,
	}})
}

// runComponentTask 的 --dry-run 门放在服务端：前端不点预检、直接调 API 也绕不过。
func (u *uiState) runComponentTask(t *backupTask, name, comp, password string) {
	lw := &backupLogWriter{task: t}
	fmt.Fprintf(lw, "==> 开始：安装 %s（目标：%s）\n", comp, name)
	fmt.Fprintln(lw, "==> 服务端预检（--dry-run，不改远端）")
	pre := []string{"component", "install", comp, "--server", name, "--dry-run"}
	code := u.runner(pre, password, lw)
	if code != 0 {
		fmt.Fprintln(lw, "预检没过，不执行安装；远端没有被修改。")
		lw.Flush()
		t.finish(code)
		return
	}
	if comp == "minio" {
		fmt.Fprintln(lw, "==> 预检通过，开始安装（远端会创建 /data/minio 并启动 MinIO 容器）")
	} else {
		fmt.Fprintln(lw, "==> 预检通过，开始安装（会写远端 apt 源 / 系统包 / docker 服务）")
	}
	code = u.runner([]string{"component", "install", comp, "--server", name}, password, lw)
	if code == 0 {
		fmt.Fprintln(lw, "==> 完成。请点「重新检查」复核组件状态。")
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
