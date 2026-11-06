package component

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"testing/fstest"
)

func TestRegistryWhitelist(t *testing.T) {
	for _, id := range []string{"docker", " Docker ", "DOCKER"} {
		if !Runnable(strings.TrimSpace(strings.ToLower(id))) {
			t.Fatalf("docker 必须可安装：%q", id)
		}
	}
	for _, id := range []string{"", "minio", "postgres", "../etc", "docker;rm"} {
		if Runnable(id) {
			t.Errorf("不该允许写操作：%q", id)
		}
	}
	c, ok := Lookup("minio")
	if !ok || c.Phase != PhasePlanned || c.Depends != "docker" {
		t.Errorf("minio 应作为 planned 占位且依赖 docker：%+v", c)
	}
	if !DependsReady(c, map[string]string{"docker": "ok"}) {
		t.Error("docker 就绪时 minio 的依赖应算满足")
	}
	if DependsReady(c, map[string]string{"docker": "missing"}) {
		t.Error("docker 未装时 minio 的依赖不该算满足")
	}
}

func TestParseArgs(t *testing.T) {
	o, err := parseArgs([]string{"install", "docker", "--server", "k1", "--dry-run", "--password-stdin"})
	if err != nil {
		t.Fatal(err)
	}
	if o.Verb != "install" || o.ID != "docker" || o.Server != "k1" || !o.DryRun || !o.PasswordStdin {
		t.Errorf("解析结果不对：%+v", o)
	}
	if _, err := parseArgs([]string{"install", "--server", "k1"}); err == nil {
		t.Error("install 不指定 id 必须拒绝")
	}
	if _, err := parseArgs([]string{"install", "minio", "--server", "k1"}); err == nil {
		t.Error("planned 组件必须拒绝安装")
	}
	if _, err := parseArgs([]string{"install", "docker", "--server", "127.0.0.1", "--force"}); err == nil {
		t.Error("--force 不该出现在界面/CLI 白名单里")
	}
	if _, err := parseArgs([]string{"list", "--server=k1", "--json"}); err != nil {
		t.Errorf("list --json 应可用：%v", err)
	}
	if _, err := parseArgs([]string{"list", "--dry-run"}); err == nil {
		t.Error("list 本来就是只读的，不该接 --dry-run")
	}
}

func TestParseKVIgnoresNoise(t *testing.T) {
	raw := parseKV("OS_ID=ubuntu\nnoise line\nDOCKER_VERSION=Docker version 29.9.3, build abc\nBAD KEY=x\nSUDO_NOPASSWD=yes\r\n")
	if raw["OS_ID"] != "ubuntu" || raw["SUDO_NOPASSWD"] != "yes" {
		t.Fatalf("解析失败：%v", raw)
	}
	if _, ok := raw["BAD KEY"]; ok {
		t.Error("带空格的 key 不该被收进来")
	}
	if !strings.Contains(raw["DOCKER_VERSION"], "29.9.3") {
		t.Errorf("值里的等号后内容要保留：%q", raw["DOCKER_VERSION"])
	}
}

func TestEvaluateBlockers(t *testing.T) {
	good := map[string]string{
		"OS_ID": "ubuntu", "OS_CODENAME": "noble", "APT_GET": "yes", "CURL": "yes",
		"APT_REPO_REACHABLE": "yes", "DISK_FREE_MB": "32000", "SUDO_NOPASSWD": "yes",
		"USER_IN_DOCKER_GROUP": "yes",
	}
	if p := Evaluate(good); !p.Ready {
		t.Fatalf("正常环境不该被拦：%+v", p.Blockers)
	}
	bad := map[string]string{}
	for k, v := range good {
		bad[k] = v
	}
	bad["OS_ID"] = "centos"
	bad["APT_REPO_REACHABLE"] = "no"
	bad["DISK_FREE_MB"] = "100"
	p := Evaluate(bad)
	if p.Ready || len(p.Blockers) < 2 {
		t.Errorf("非 Ubuntu / 空间不足都应拦住：%+v", p)
	}
	// 仓库探测不稳，只警告不硬拦：apt-get update 才是权威结论。
	repoNo := map[string]string{}
	for k, v := range good {
		repoNo[k] = v
	}
	repoNo["APT_REPO_REACHABLE"] = "no"
	p = Evaluate(repoNo)
	if !p.Ready {
		t.Errorf("仓库探测失败不该硬拦安装：%+v", p.Blockers)
	}
	found := false
	for _, w := range p.Warnings {
		if strings.Contains(w, "download.docker.com") {
			found = true
		}
	}
	if !found {
		t.Errorf("仓库不可达必须给出明确警告：%+v", p.Warnings)
	}
}

func TestDeriveDockerState(t *testing.T) {
	if s, _ := deriveDockerState(map[string]string{"DOCKER_INSTALLED": "no"}); s != "missing" {
		t.Errorf("未装 = missing，得到 %s", s)
	}
	if s, _ := deriveDockerState(map[string]string{"DOCKER_INSTALLED": "yes", "DOCKER_SERVICE": "active", "COMPOSE_PLUGIN": "yes"}); s != "ok" {
		t.Errorf("齐全 = ok，得到 %s", s)
	}
	if s, _ := deriveDockerState(map[string]string{"DOCKER_INSTALLED": "yes", "DOCKER_SERVICE": "inactive", "COMPOSE_PLUGIN": "yes"}); s != "degraded" {
		t.Errorf("服务没起 = degraded，得到 %s", s)
	}
}

// 失败响应的数组必须是 [] 而不是 null，否则前端 .find 会白屏（docs/ui.md §11.4）。
func TestFailureViewArraysAreEmptyNotNil(t *testing.T) {
	scripts := fstest.MapFS{} // 故意缺脚本，走 Collect 的失败分支
	view := Collect(context.Background(), &shared.SSHTarget{}, scripts, "k1")
	b, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{`"components":[{`, `"checks":[]`, `"blockers":[`} {
		if !strings.Contains(string(b), key) {
			t.Errorf("响应里应出现 %s，实际：%s", key, b)
		}
	}
	if strings.Contains(string(b), `:null`) {
		t.Errorf("失败响应里不该有 null 数组：%s", b)
	}
	for _, c := range view.Components {
		if c.State != "unknown" || c.Collected {
			t.Errorf("采集失败时组件必须是 unknown / collected=false：%+v", c)
		}
	}
}

// dry-run 必须在上传之前就返回：给一个必然连不上的目标，若实现误触发远端写会失败。
func TestInstallDryRunNeverTouchesRemote(t *testing.T) {
	scripts := fstest.MapFS{
		"deploy/component/docker/install.sh": &fstest.MapFile{Data: []byte("#!/bin/bash\necho should-not-run\n")},
	}
	view := emptyView("k1")
	view.Collected = true
	view.Raw = map[string]string{
		"OS_ID": "ubuntu", "OS_CODENAME": "noble", "ARCH": "x86_64",
		"APT_GET": "yes", "CURL": "yes", "APT_REPO_REACHABLE": "yes",
		"DISK_FREE_MB": "32000", "SUDO_NOPASSWD": "yes", "USER_IN_DOCKER_GROUP": "yes",
	}
	view.Preflight = Evaluate(view.Raw)
	tgt := &shared.SSHTarget{Host: "127.0.0.1", Port: 1, User: "cql"}
	if code := Install(context.Background(), tgt, scripts, view, true); code != 0 {
		t.Errorf("dry-run 预检通过应返回 0，得到 %d", code)
	}
	blocked := view
	blocked.Raw = map[string]string{"OS_ID": "ubuntu", "OS_CODENAME": "noble", "APT_REPO_REACHABLE": "no"}
	blocked.Preflight = Evaluate(blocked.Raw)
	if code := Install(context.Background(), tgt, scripts, blocked, true); code == 0 {
		t.Error("预检不通过时 dry-run 必须返回非 0，服务端才会拦住安装")
	}
}

func TestCheckItemsNeverNil(t *testing.T) {
	items := dockerCheckItems(map[string]string{})
	if len(items) == 0 {
		t.Error("检查项表不该为空（前端要渲染）")
	}
	for _, it := range items {
		if it.Key == "" || it.Label == "" || it.State == "" {
			t.Errorf("检查项字段不全：%+v", it)
		}
	}
}
