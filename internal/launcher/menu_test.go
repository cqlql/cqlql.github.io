package launcher

import (
	"bufio"
	"bytes"
	"strings"
	"testing"
)

func TestMenuItemsOnlyImplementedVerbs(t *testing.T) {
	keys := map[string]bool{}
	for _, item := range menuItems(testProbe) {
		keys[item.Key] = true
		if strings.Contains(item.label, "ops status") || strings.Contains(item.label, "ops deploy") {
			t.Errorf("菜单列出了未实现的动词：%s", item.label)
		}
	}
	for _, k := range []string{"1", "2", "3", "4", "5"} {
		if !keys[k] {
			t.Errorf("缺少菜单项 %s", k)
		}
	}
	if testProbe("ui") && !keys["6"] {
		t.Error("ui 已注册，菜单却没有「打开网页面板」")
	}
}

func TestMenuChoiceDefaultsToReadonly(t *testing.T) {
	cases := map[string]string{"": "2", "  ": "2", "q": "0", "QUIT": "0", "3": "3"}
	for in, want := range cases {
		if got := menuChoice(in); got != want {
			t.Errorf("menuChoice(%q) = %q，想要 %q", in, got, want)
		}
	}
}

func newTestMenu(input string, rc int, calls *[][]string) *menu {
	return &menu{
		in:  bufio.NewReader(strings.NewReader(input)),
		out: &bytes.Buffer{},
		exec: func(args []string) int {
			*calls = append(*calls, append([]string(nil), args...))
			return rc
		},
		choose: func() (string, bool) { return "", true },
	}
}

func TestMenuDefaultActionIsDryRunOnly(t *testing.T) {
	var calls [][]string
	m := newTestMenu("\n0\n", 0, &calls)
	if rc := runMenu(m, testProbe); rc != 0 {
		t.Fatalf("runMenu = %d", rc)
	}
	if len(calls) != 1 {
		t.Fatalf("默认动作调用了 %d 次：%v", len(calls), calls)
	}
	if got := strings.Join(calls[0], " "); got != "backup deploy --dry-run" {
		t.Fatalf("默认动作 = %q，想要只读预检", got)
	}
}

func TestMenuWriteNeedsPrecheckAndConfirm(t *testing.T) {
	t.Run("预检失败不安装", func(t *testing.T) {
		var calls [][]string
		m := newTestMenu("", 1, &calls)
		if rc := m.runAction("3"); rc != 1 {
			t.Fatalf("runAction = %d", rc)
		}
		if len(calls) != 1 || strings.Join(calls[0], " ") != "backup deploy --dry-run" {
			t.Fatalf("预检失败后仍继续：%v", calls)
		}
	})
	t.Run("不确认不安装", func(t *testing.T) {
		var calls [][]string
		m := newTestMenu("no\n", 0, &calls)
		if rc := m.runAction("3"); rc != 0 {
			t.Fatalf("runAction = %d", rc)
		}
		if len(calls) != 1 || strings.Join(calls[0], " ") != "backup deploy --dry-run" {
			t.Fatalf("没确认却执行了写操作：%v", calls)
		}
	})
	t.Run("确认后才安装", func(t *testing.T) {
		var calls [][]string
		m := newTestMenu("yes\n", 0, &calls)
		if rc := m.runAction("3"); rc != 0 {
			t.Fatalf("runAction = %d", rc)
		}
		if len(calls) != 2 {
			t.Fatalf("期望预检 + 安装两次调用，实际 %v", calls)
		}
		if got := strings.Join(calls[1], " "); got != "backup deploy" {
			t.Fatalf("写操作参数 = %q", got)
		}
	})
}

func TestMenuTargetServerPassedThrough(t *testing.T) {
	var calls [][]string
	m := newTestMenu("", 0, &calls)
	m.choose = func() (string, bool) { return "backup-01", true }
	if rc := m.runAction("2"); rc != 0 {
		t.Fatalf("runAction = %d", rc)
	}
	if got := strings.Join(calls[0], " "); got != "backup deploy --dry-run --server backup-01" {
		t.Fatalf("目标机没透传：%q", got)
	}
}

func testProbe(name string) bool { return name == "ui" }
