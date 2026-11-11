package deploy

// P3b-2：发版历史的**只读**投影（CLI 同源，将来的 GET /api/deploy/releases 直接复用）。
//
// 🔴 白屏红线（deploy.md §10.4.2 / ui.md §11.4-5、§12.5-3）：
//    文件不存在 / 读失败 / 解析出错，一律 ok=true + data.error + items: []；
//    数组恒为 []，不能是 null（Go nil slice 编 JSON 就是 null），也不能回 ok:false。
// 🔴 只读：不创建文件、不写台账、不连远端、不触发任务、不自动轮转 / 清理 / 归档。
// 🔴 没有编辑 / 删除 / 重发 / 上送远端；按 server 筛选，省略 = 全部，按 ts 倒序。

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
)

const maxReleaseLogLine = 1024 * 1024

type ReleaseHistoryData struct {
	Items  []ReleaseEvent `json:"items"`
	Server string         `json:"server,omitempty"`
	Error  string         `json:"error,omitempty"`
}

type ReleaseHistory struct {
	OK   bool               `json:"ok"`
	Data ReleaseHistoryData `json:"data"`
}

// emptyHistory：任何失败形态都回同一副「服务端空视图」，items 恒非 nil。
func emptyHistory(msg string) ReleaseHistory {
	return ReleaseHistory{
		OK:   true,
		Data: ReleaseHistoryData{Items: []ReleaseEvent{}, Error: msg},
	}
}

// ReadReleaseHistory 只读本机台账。任何一行坏掉就整段回空数组 + error，
// 不返回「半截历史」—— 半截数据比没有数据更容易让人误判线上状态。
func ReadReleaseHistory(path, server string) ReleaseHistory {
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return emptyHistory("台账文件不存在（还没有正式发布记录）；不猜、不补写，也不创建空文件")
		}
		return emptyHistory("台账读取失败：" + err.Error())
	}
	items := []ReleaseEvent{}
	sc := bufio.NewScanner(bytes.NewReader(b))
	sc.Buffer(make([]byte, 0, 64*1024), maxReleaseLogLine)
	lineNo := 0
	for sc.Scan() {
		lineNo++
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		var ev ReleaseEvent
		if err := json.Unmarshal([]byte(line), &ev); err != nil {
			return emptyHistory(fmt.Sprintf("台账第 %d 行解析失败：%v", lineNo, err))
		}
		if server != "" && ev.Server != server {
			continue
		}
		items = append(items, ev)
	}
	if err := sc.Err(); err != nil {
		return emptyHistory("台账扫描失败：" + err.Error())
	}
	// RFC3339 的字符串序即时间序；稳定排序保证同一秒内保持 append 顺序。
	sort.SliceStable(items, func(i, j int) bool { return items[i].TS > items[j].TS })
	return ReleaseHistory{OK: true, Data: ReleaseHistoryData{Items: items, Server: server}}
}

// resultLabel：徽标按 kind 优先，回滚单列、不混进成功数（§10.2）。
func resultLabel(ev ReleaseEvent) string {
	switch {
	case ev.Kind == KindRollback:
		return "回滚"
	case ev.Result == ResultSuccess:
		return "成功"
	case ev.Result == ResultFailed:
		return "失败"
	default:
		return "未知"
	}
}

func printReleaseHistory(h ReleaseHistory, path string) {
	fmt.Println("==> 发版历史（P3b-2 · 只读本机台账 · 按时间倒序）")
	fmt.Printf("  台账：%s\n", path)
	if h.Data.Server != "" {
		fmt.Printf("  筛选：目标机 %s（省略 --server = 全部）\n", h.Data.Server)
	}
	if h.Data.Error != "" {
		fmt.Printf("  🔴 %s\n", h.Data.Error)
	}
	if len(h.Data.Items) == 0 {
		fmt.Println("  （没有记录：items = []；不猜、不补写、不显示 null）")
	} else {
		for _, ev := range h.Data.Items {
			online := ev.OnlineVersion
			if online == "" {
				online = "未采集"
			}
			fmt.Printf("  %s  %s  %s → %s  [%s]  tag=%s  结果=%s",
				ev.TS, ev.Server, online, ev.ReleaseVersion, ev.Scope, ev.ImageTag, resultLabel(ev))
			if ev.FailedStage != "" {
				fmt.Printf("  停在=%s", ev.FailedStage)
			}
			fmt.Println()
			fmt.Printf("       备注：%s   task_id=%s\n", ev.Note, ev.TaskID)
		}
	}
	fmt.Printf("  共 %d 条；只读展示，没有编辑 / 删除 / 重发 / 上送远端入口。\n", len(h.Data.Items))
	fmt.Println("  🔴 台账是运维机本机文件，换机 / 重装会丢；不接备份能力、不上送远端（§10.4.1）。")
}

func writeReleaseHistoryJSON(h ReleaseHistory) int {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(h); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 输出 JSON 失败：%v\n", err)
		return 1
	}
	return 0
}
