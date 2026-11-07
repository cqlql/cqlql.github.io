package ui

import (
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

// dev 代理的默认端口与 Go 的 defaultUIPort 是两份手抄字面量：
// Go 改了起点、前端没跟，npm run dev 的 /api 就会静默打到旧端口。
// 不把路径规则复制进 vite（ui.json 在用户配置目录，前端不该再拼一遍），
// 只把「默认值」这一处用断言锁住；实际端口靠 OPS_UI_PORT 跟过去。
func TestViteProxyDefaultPortMatchesUI(t *testing.T) {
	const rel = "../../web/vite.config.ts"
	b, err := os.ReadFile(rel)
	if err != nil {
		t.Fatal(err)
	}
	text := string(b)
	re := regexp.MustCompile(`(?m)^\s*const opsUIPort = process\.env\.OPS_UI_PORT \?\? '(\d+)'`)
	m := re.FindStringSubmatch(text)
	if m == nil {
		t.Fatalf("%s 找不到 opsUIPort 的默认值字面量，正则或文件结构可能变了", rel)
	}
	if want := strconv.Itoa(int(defaultUIPort)); m[1] != want {
		t.Errorf("%s 的 dev 代理默认端口 %s 与 Go 的 defaultUIPort %s 不一致；改端口要两处一起改", rel, m[1], want)
	}
	for _, hint := range []string{"OPS_UI_PORT", "ui.json", "defaultUIPort"} {
		if !strings.Contains(text, hint) {
			t.Errorf("%s 缺少 %q 的说明：人需要知道实际端口会写进 ui.json、dev 用 OPS_UI_PORT 跟", rel, hint)
		}
	}
}
