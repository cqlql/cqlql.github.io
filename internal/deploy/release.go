package deploy

// P3b-2：本机发版台账（append-only JSONL，0600）与门 5 的纯函数校验。
//
// 🔴 台账是**正式发布尝试事件流**，不是「成功清单」：过了门 3 真正开跑的发布，
//    成功 / 失败都留一条；预演、校验失败、预检不通过、连不上、本地单例撞锁都不写。
// 🔴 只有执行链路在任务结束时 append 一行，没有编辑 / 删除 / 重发 / 事后补记入口；
//    进程被 kill / 断电可能丢一次尝试（结论 E 已接受），不猜、不补写、不加 running。
// 🔴 不写远端 state.env、不写配置键、不存凭证 / 私钥路径 / .env 全文；
//    备注只进 JSONL 与报告，不拼进任何 shell 命令。
// 🔴 本刀不产生 kind=rollback 事件（rollback / ps / logs 仍属 P4）。

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	// ReleaseLogFile 与 servers.json 同在本机配置目录（§10.4.1）。
	ReleaseLogFile = "deploy-releases.jsonl"

	KindRelease  = "release"
	KindRollback = "rollback" // P4 才写；本刀只预留枚举、不产生

	ResultSuccess = "success"
	ResultFailed  = "failed"
)

// 门禁名称同时被 RunRelease / ShouldRecord / 单测引用，避免两处字面量漂移（§11.6）。
const (
	GateReleasePreflight = "只读预检门"
	GateDualLock          = "双锁"
	GateBackup            = "发布前留退路"
)

// ---- 门 5：ValidateRelease（纯函数，不发请求、不落台账、不拼命令） ----
//
// P3b-1 落地时放在 deploy.go，P3b-2 随台账一起移到本文件；判据未放宽：
// 发版号三段式、备注单行 ≤200 字且无控制字符，**不是镜像 tag**。
// §10.1 设计稿里的宽白名单 ^[A-Za-z0-9.]{1,32}$ 已被三段式取代，见 deploy.md §10.1。
var releaseVersionRe = regexp.MustCompile(`^v?[0-9]+\.[0-9]+\.[0-9]+$`)

func ValidateRelease(version, note string) error {
	if version == "" || !releaseVersionRe.MatchString(version) {
		return errors.New("发版号必须是三段式（如 1.16.1），不猜、不自动推算、不当镜像 tag")
	}
	if strings.ContainsAny(note, "\r\n") {
		return errors.New("项目备注必须单行（不写远端、不拼进任何命令）")
	}
	for _, r := range note {
		if r < 0x20 || r == 0x7f {
			return fmt.Errorf("项目备注不能含控制字符（U+%04X）；只作纯文本展示", r)
		}
	}
	if len([]rune(note)) > 200 {
		return errors.New("项目备注最长 200 字")
	}
	return nil
}

// ReleaseEvent 是 JSONL 的一行，字段与 deploy.md §10.2 一一对应。
// bump 是界面的「更新类型」辅助字段，CLI 没有这个输入，恒留空、不推算。
type ReleaseEvent struct {
	TS             string `json:"ts"`
	Server         string `json:"server"`
	Scope          string `json:"scope"`
	Kind           string `json:"kind"`
	OnlineVersion  string `json:"online_version"`
	ReleaseVersion string `json:"release_version"`
	Bump           string `json:"bump"`
	Note           string `json:"note"`
	ImageTag       string `json:"image_tag"`
	Result         string `json:"result"`
	FailedStage    string `json:"failed_stage"`
	TaskID         string `json:"task_id"`
}

// ReleaseLogPath：台账固定在本机配置目录（与默认的 servers.json 同目录）。
// 🔴 读写两侧都传 shared.UserConfigDir()，**不跟** ops.env 里可能覆盖的
//    PASS_UP_OPS_SERVERS_FILE 走 —— 否则发布时写 A、历史读 B，历史会凭空少一半。
// configDir 为空时退化为相对文件名（供纯函数单测用）。
func ReleaseLogPath(configDir string) string {
	if configDir == "" {
		return ReleaseLogFile
	}
	return filepath.Join(configDir, ReleaseLogFile)
}

// AppendRelease 只做 O_APPEND 一行写入：不 truncate、不覆盖、不删旧行。
// json.Marshal 会把引号 / 反斜杠 / <>& 转义掉，单行 JSON 不会被备注撑成多行。
func AppendRelease(path string, ev ReleaseEvent) error {
	if ev.Kind != KindRelease && ev.Kind != KindRollback {
		return fmt.Errorf("台账 kind 只能是 release / rollback，收到 %q", ev.Kind)
	}
	if ev.Result != ResultSuccess && ev.Result != ResultFailed {
		return fmt.Errorf("台账 result 只能是 success / failed，收到 %q", ev.Result)
	}
	if ev.TS == "" || ev.Server == "" || ev.ReleaseVersion == "" {
		return errors.New("台账记录缺 ts / server / release_version，不写半条记录")
	}
	if ev.Result == ResultFailed && ev.FailedStage == "" {
		return errors.New("失败记录必须带 failed_stage，不写「失败但不知道停在哪」")
	}
	if err := ValidateRelease(ev.ReleaseVersion, ev.Note); err != nil {
		return err
	}
	b, err := json.Marshal(ev)
	if err != nil {
		return fmt.Errorf("台账记录编码失败：%w", err)
	}
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return fmt.Errorf("台账目录不可建：%w", err)
		}
	}
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0o600)
	if err != nil {
		return fmt.Errorf("台账打不开（append-only）：%w", err)
	}
	defer f.Close()
	if _, err := f.Write(append(b, '\n')); err != nil {
		return fmt.Errorf("台账追加失败：%w", err)
	}
	return f.Sync()
}

// ShouldRecord 是入账界线的唯一判据（§11.2 / §11.6 拍板定稿）：
// 门 3「只读预检门」+ 门 4「双锁」都过 = 过完门禁、真正开始执行；
// 之后的构建 / 传输 / 拉起 / 健康门失败与成功都留痕。
// 🔴 撞锁不写：门 4 失败属于 §11.2 明列的「撞锁 / 409 一律不入账」，
//    本地单例撞锁更是连远端都没碰。§10.2 早期设计稿「撞锁要写」与定稿冲突，
//    按 §11.2 定稿优先（deploy.md §9.12 如实记下这处差异）。
// 门 6 备份失败发生在阶段 ② 执行段内，仍要留痕 —— 那时远端已经动过。
func ShouldRecord(rep ReleaseReport) bool {
	preflightOK, dualLockOK := false, false
	for _, g := range rep.Gates {
		switch g.Name {
		case GateReleasePreflight:
			preflightOK = g.OK
		case GateDualLock:
			dualLockOK = g.OK
		}
	}
	return preflightOK && dualLockOK
}

// BuildReleaseEvent 把执行报告投影成一条台账事件（纯函数，时间由调用方传入便于单测）。
func BuildReleaseEvent(rep ReleaseReport, cfg ReleaseConfig, now time.Time) ReleaseEvent {
	result := ResultSuccess
	failed := ""
	if !rep.Completed {
		result = ResultFailed
		failed = rep.FailedStage
	}
	online := rep.OnlineVersion
	if online == "" {
		online = "未采集"
	}
	return ReleaseEvent{
		TS:             now.Format(time.RFC3339),
		Server:         rep.Server,
		Scope:          rep.Scope,
		Kind:           KindRelease,
		OnlineVersion:  online,
		ReleaseVersion: rep.ReleaseVersion,
		Bump:           "", // 界面「更新类型」是辅助输入，CLI 不推算
		Note:           rep.ReleaseNote,
		ImageTag:       rep.ImageTag,
		Result:         result,
		FailedStage:    failed,
		TaskID:         "cli-" + cfg.Timestamp + "-" + rep.Server,
	}
}
