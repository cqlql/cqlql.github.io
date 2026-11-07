package monitor

// CollectForServer 是 CLI 与网页共用的入口。这里只测「不连 SSH 就会停下来的」两条
// 失败路径：没配只读账号、name 不在清单里。全项目不写需要真实 SSH 的单测。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func testList(t *testing.T, raw string) *shared.ServerList {
	t.Helper()
	path := filepath.Join(t.TempDir(), "servers.json")
	if err := os.WriteFile(path, []byte(raw), 0o600); err != nil {
		t.Fatal(err)
	}
	var l shared.ServerList
	if err := json.Unmarshal([]byte(raw), &l); err != nil {
		t.Fatal(err)
	}
	l.Path = path
	return &l
}

func TestCollectForServerRejectsMissingMonitorAccount(t *testing.T) {
	list := testList(t, `{"servers":[{"name":"bk","role":"backup","host":"10.0.0.1","user":"ubuntu"}]}`)
	st, err := CollectForServer(context.Background(), &shared.Config{}, list, "bk")
	if err == nil {
		t.Fatal("没配 monitor 却放行了采集（会复用安装账号）")
	}
	if !strings.Contains(err.Error(), "只读监控账号未配好") {
		t.Errorf("错误没说清缺什么：%q", err.Error())
	}
	if st.Connection.OK || len(st.Problems) != 1 || st.Problems[0].Level != "danger" {
		t.Errorf("配置错仍要回完整快照：%+v", st)
	}
	if st.PG.Collected || st.MinIO.Collected || st.Disk.Collected {
		t.Error("不该假装有采集数据")
	}
}

func TestCollectForServerRejectsUnknownName(t *testing.T) {
	list := testList(t, `{"servers":[{"name":"bk","role":"backup","host":"10.0.0.1","user":"ubuntu"}]}`)
	st, err := CollectForServer(context.Background(), &shared.Config{}, list, "10.0.0.1")
	if err == nil || !strings.Contains(err.Error(), "选择目标机失败") {
		t.Fatalf("未知 name 没被挡住：err=%v", err)
	}
	if len(st.Problems) != 1 || st.Problems[0].Level != "danger" {
		t.Errorf("未知 name 仍要回完整快照：%+v", st.Problems)
	}
}

func TestFailureStatusDesensitizes(t *testing.T) {
	// ssh / 配置报错里可能夹带私钥路径；共用入口的错误文本必须过脱敏。
	st := FailureStatus("bk", "ssh: /home/u/.ssh/id_rsa 权限不对")
	if strings.Contains(st.Connection.Error, "id_rsa") || strings.Contains(st.Connection.Error, ".ssh/") {
		t.Errorf("私钥路径没脱敏：%q", st.Connection.Error)
	}
}
