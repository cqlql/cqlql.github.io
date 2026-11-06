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
	for _, id := range []string{"docker", " Docker ", "DOCKER", "minio"} {
		if !Runnable(strings.TrimSpace(strings.ToLower(id))) {
			t.Fatalf("已接入组件必须可安装：%q", id)
		}
	}
	for _, id := range []string{"", "postgres", "../etc", "docker;rm"} {
		if Runnable(id) {
			t.Errorf("不该允许写操作：%q", id)
		}
	}
	c, ok := Lookup("minio")
	if !ok || c.Phase != PhaseReady || c.Depends != "docker" {
		t.Errorf("minio 应已接入且依赖 docker：%+v", c)
	}
	if !DependsReady(c, map[string]string{"docker": "ok"}) {
		t.Error("docker 就绪时 minio 的依赖应算满足")
	}
	if DependsReady(c, map[string]string{"docker": "missing"}) {
		t.Error("docker 未装时 minio 的依赖不该算满足")
	}
	if !SupportsImage("minio") || SupportsImage("docker") || SupportsImage("../../etc") {
		t.Error("只有声明了离线镜像的组件能导入 tar")
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
	if o, err := parseArgs([]string{"install", "minio", "--server", "k1"}); err != nil || o.ID != "minio" {
		t.Errorf("minio 已接入，应可安装：%v / %+v", err, o)
	}
	if _, err := parseArgs([]string{"install", "redis", "--server", "k1"}); err == nil {
		t.Error("未注册组件必须拒绝安装")
	}
	if o, err := parseArgs([]string{"image-load", "minio", "--server", "k1", "--image-tar", "C:/tmp/minio.tar"}); err != nil || o.ImageTar == "" {
		t.Errorf("image-load 参数解析失败：%v / %+v", err, o)
	}
	for _, args := range [][]string{
		{"image-load", "docker", "--server", "k1", "--image-tar", "x.tar"},
		{"image-load", "minio", "--server", "k1"},
		{"install", "docker", "--server", "127.0.0.1", "--force"},
		{"list", "--dry-run"},
		{"list", "--image-tar", "x.tar"},
	} {
		if _, err := parseArgs(args); err == nil {
			t.Errorf("不该放行的参数组合：%v", args)
		}
	}
	if _, err := parseArgs([]string{"list", "--server=k1", "--json"}); err != nil {
		t.Errorf("list --json 应可用：%v", err)
	}
	if o, err := parseArgs([]string{"install", "docker", "--server", "k1", "--proxy=http://192.168.1.221:7897"}); err != nil || o.Proxy == "" {
		t.Errorf("合法的 --proxy 应可用：%v / %+v", err, o)
	}
	for _, args := range [][]string{
		{"install", "docker", "--server", "k1", "--proxy", "http://x;rm -rf /"},
		{"install", "docker", "--server", "k1", "--proxy", "http://u:p@x:7897"},
		{"install", "docker", "--server", "k1", "--proxy", "http://x:99999"},
		{"install", "minio", "--server", "k1", "--proxy", "http://x:7897"},
		{"list", "--server", "k1", "--proxy", "http://x:7897"},
	} {
		if _, err := parseArgs(args); err == nil {
			t.Errorf("不该放行的代理参数组合：%v", args)
		}
	}
}

func TestValidProxy(t *testing.T) {
	for _, good := range []string{
		"", "http://192.168.1.221:7897", "http://localhost:8080", "http://proxy.example:1",
	} {
		if _, err := ValidProxy(good); err != nil {
			t.Errorf("合法代理被拒 %q：%v", good, err)
		}
	}
	for _, bad := range []string{
		"http://x;rm -rf /", "http://u:p@x:7897", "https://x:7897", "http://x:0",
		"http://x:65536", "http://x:7897/path", "x:7897", "http://x:7897 && echo hi",
	} {
		if _, err := ValidProxy(bad); err == nil {
			t.Errorf("非法代理被放行 %q", bad)
		}
	}
	if got, err := ValidProxy("  http://192.168.1.221:7897  "); err != nil || got != "http://192.168.1.221:7897" {
		t.Errorf("应规范化首尾空格：%q / %v", got, err)
	}
}

// 直接调包也要拦住非法代理（它会拼进远端命令字符串），不能只靠 CLI 边界。
func TestInstallRejectsBadProxy(t *testing.T) {
	view := emptyView("k1")
	view.Collected = true
	tgt := &shared.SSHTarget{Host: "127.0.0.1", Port: 1, User: "cql"}
	for _, opt := range []InstallOptions{
		{ID: "docker", DryRun: true, Proxy: "http://x;rm -rf /"},
		{ID: "minio", DryRun: true, Proxy: "http://192.168.1.221:7897"},
	} {
		if code := Install(context.Background(), tgt, fstest.MapFS{}, view, opt); code == 0 {
			t.Errorf("不该放行的安装选项：%+v", opt)
		}
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

func TestParseImageLines(t *testing.T) {
	got := parseImageLines("minio/minio:RELEASE.2026-08-06;sha256:abc;218 MB;2026-11-06 16:52|quay.io/minio/minio:latest;sha256:def;224 MB;2026-11-06 17:00")
	if len(got) != 2 || got[0].Reference != "minio/minio:RELEASE.2026-08-06" || got[1].Size != "224 MB" {
		t.Errorf("镜像清单解析不对：%+v", got)
	}
	if len(parseImageLines("")) != 0 || len(parseImageLines("|broken|")) != 0 {
		t.Error("空 / 坏数据要回空数组，不能是 null")
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

// MinIO 预检：没离线镜像 / 没凭证 / Docker 没起 都必须硬拦，绝不 docker pull。
func TestEvaluateMinioBlockers(t *testing.T) {
	good := map[string]string{
		"DOCKER_INSTALLED": "yes", "DOCKER_SERVICE": "active",
		"MINIO_CONTAINER": "absent", "MINIO_DOCKER_QUERY": "yes",
		"MINIO_IMAGE_COUNT": "1", "MINIO_IMAGE_FIRST": "minio/minio:RELEASE.2026-08-06",
		"MINIO_DATA_PARENT": "yes", "MINIO_PORT_BUSY": "no",
		"DISK_FREE_MB": "32000", "SUDO_NOPASSWD": "yes",
	}
	local := LocalFacts{MinioRootUserSet: true, MinioRootSecretSet: true, DestURLPort: "9000"}
	if p := EvaluateMinio(good, local, true); !p.Ready {
		t.Fatalf("依赖齐全且有离线镜像时不该被拦：%+v", p.Blockers)
	}
	for _, tc := range []struct {
		name string
		mut  func(map[string]string, *LocalFacts)
	}{
		{"没有离线镜像", func(r map[string]string, _ *LocalFacts) { r["MINIO_IMAGE_COUNT"] = "0" }},
		{"读不到镜像列表", func(r map[string]string, _ *LocalFacts) { r["MINIO_DOCKER_QUERY"] = "no" }},
		{"端口被占", func(r map[string]string, _ *LocalFacts) { r["MINIO_PORT_BUSY"] = "yes" }},
		{"Docker 没起", func(r map[string]string, _ *LocalFacts) { r["DOCKER_SERVICE"] = "inactive" }},
		{"缺凭证", func(_ map[string]string, l *LocalFacts) { l.MinioRootSecretSet = false }},
		{"空格不足", func(r map[string]string, _ *LocalFacts) { r["DISK_FREE_MB"] = "10" }},
		{"容器状态未知", func(r map[string]string, _ *LocalFacts) { r["MINIO_CONTAINER"] = "unknown" }},
	} {
		r := map[string]string{}
		for k, v := range good {
			r[k] = v
		}
		l := local
		tc.mut(r, &l)
		if p := EvaluateMinio(r, l, true); p.Ready {
			t.Errorf("%s 必须拦住：%+v", tc.name, p)
		}
	}
	// DEST_URL 指到生产端 8007 只警告，不拦安装（配置页另改）。
	l := local
	l.DestURLPort = "8007"
	p := EvaluateMinio(good, l, true)
	if !p.Ready || !strings.Contains(strings.Join(p.Warnings, " "), "8007") {
		t.Errorf("DEST_URL 端口不对应给明确警告而不是硬拦：%+v", p)
	}
	// 容器已运行时不该再要求镜像（安装脚本会跳过，不重建）。
	r := map[string]string{}
	for k, v := range good {
		r[k] = v
	}
	r["MINIO_CONTAINER"] = "running"
	r["MINIO_IMAGE_COUNT"] = "0"
	if p := EvaluateMinio(r, local, true); !p.Ready {
		t.Errorf("已有容器时不该因镜像缺失拦住：%+v", p)
	}
	// k4（换电脑后的新目标机）没有独立数据盘、也没有 /data：
	// 只警告「数据落在根分区」，不硬拦；安装脚本会 mkdir -p 自动建父目录。
	noData := map[string]string{}
	for k, v := range good {
		noData[k] = v
	}
	noData["MINIO_DATA_PARENT"] = "no"
	p = EvaluateMinio(noData, local, true)
	if !p.Ready {
		t.Errorf("没有 /data 时只警告、不硬拦：%+v", p.Blockers)
	}
	if !strings.Contains(strings.Join(p.Warnings, " "), "/data") {
		t.Errorf("必须明确警告数据落在根分区：%+v", p.Warnings)
	}
}

func TestDeriveStates(t *testing.T) {
	if s, _ := deriveDockerState(map[string]string{"DOCKER_INSTALLED": "no"}); s != "missing" {
		t.Errorf("未装 = missing，得到 %s", s)
	}
	if s, _ := deriveDockerState(map[string]string{"DOCKER_INSTALLED": "yes", "DOCKER_SERVICE": "active", "COMPOSE_PLUGIN": "yes"}); s != "ok" {
		t.Errorf("齐全 = ok，得到 %s", s)
	}
	if s, _ := deriveDockerState(map[string]string{"DOCKER_INSTALLED": "yes", "DOCKER_SERVICE": "inactive", "COMPOSE_PLUGIN": "yes"}); s != "degraded" {
		t.Errorf("服务没起 = degraded，得到 %s", s)
	}
	if s, _ := deriveMinioState(map[string]string{"MINIO_CONTAINER": "absent"}); s != "missing" {
		t.Errorf("无容器 = missing，得到 %s", s)
	}
	if s, _ := deriveMinioState(map[string]string{"MINIO_CONTAINER": "running", "MINIO_HEALTH": "ok"}); s != "ok" {
		t.Errorf("健康 = ok，得到 %s", s)
	}
	if s, _ := deriveMinioState(map[string]string{"MINIO_CONTAINER": "running", "MINIO_HEALTH": "no"}); s != "degraded" {
		t.Errorf("不健康 = degraded，得到 %s", s)
	}
	if s, _ := deriveMinioState(map[string]string{}); s != "unknown" {
		t.Errorf("采不到 = unknown，得到 %s", s)
	}
	if s, _ := deriveMinioState(map[string]string{"MINIO_CONTAINER": "unknown"}); s != "unknown" {
		t.Errorf("docker daemon 查不动时不能猜成已装 / 未装，得到 %s", s)
	}
	if s, _ := deriveMinioState(map[string]string{"MINIO_CONTAINER": "exited"}); s != "degraded" {
		t.Errorf("容器停了 = degraded，得到 %s", s)
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
	for _, key := range []string{`"components":[{`, `"checks":[]`, `"blockers":[`, `"images":[]`, `"preflights":{`} {
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
		"deploy/component/minio/install.sh":  &fstest.MapFile{Data: []byte("#!/bin/bash\necho should-not-run\n")},
	}
	view := emptyView("k1")
	view.Collected = true
	view.Raw = map[string]string{
		"OS_ID": "ubuntu", "OS_CODENAME": "noble", "ARCH": "x86_64",
		"APT_GET": "yes", "CURL": "yes", "APT_REPO_REACHABLE": "yes",
		"DISK_FREE_MB": "32000", "SUDO_NOPASSWD": "yes", "USER_IN_DOCKER_GROUP": "yes",
	}
	view.Preflight = Evaluate(view.Raw)
	view.Preflights["docker"] = view.Preflight
	tgt := &shared.SSHTarget{Host: "127.0.0.1", Port: 1, User: "cql"}
	if code := Install(context.Background(), tgt, scripts, view, InstallOptions{ID: "docker", DryRun: true}); code != 0 {
		t.Errorf("docker dry-run 预检通过应返回 0，得到 %d", code)
	}
	blocked := view
	blocked.Raw = map[string]string{"OS_ID": "ubuntu", "OS_CODENAME": "noble", "APT_REPO_REACHABLE": "no"}
	blocked.Preflight = Evaluate(blocked.Raw)
	blocked.Preflights["docker"] = blocked.Preflight
	if code := Install(context.Background(), tgt, scripts, blocked, InstallOptions{ID: "docker", DryRun: true}); code == 0 {
		t.Error("预检不通过时 dry-run 必须返回非 0，服务端才会拦住安装")
	}
}

// MinIO 的 dry-run 也不能碰远端；缺凭证 / 缺镜像必须拦在上传之前。
func TestMinioInstallDryRunGate(t *testing.T) {
	view := emptyView("k1")
	view.Collected = true
	view.Local = LocalFacts{MinioRootUserSet: true, MinioRootSecretSet: true}
	view.Raw = map[string]string{
		"DOCKER_INSTALLED": "yes", "DOCKER_SERVICE": "active", "MINIO_CONTAINER": "absent",
		"MINIO_DOCKER_QUERY": "yes", "MINIO_IMAGE_COUNT": "1",
		"MINIO_IMAGE_FIRST": "minio/minio:RELEASE.2026-08-06",
		"MINIO_DATA_PARENT": "yes", "MINIO_PORT_BUSY": "no",
		"DISK_FREE_MB": "32000", "SUDO_NOPASSWD": "yes",
	}
	view.Preflights["minio"] = EvaluateMinio(view.Raw, view.Local, true)
	tgt := &shared.SSHTarget{Host: "127.0.0.1", Port: 1, User: "cql"}
	opt := InstallOptions{ID: "minio", DryRun: true, Minio: MinioCredentials{RootUser: "opsadmin", RootPassword: "long-enough-secret"}}
	if code := Install(context.Background(), tgt, fstest.MapFS{}, view, opt); code != 0 {
		t.Errorf("预检齐全的 minio dry-run 应返回 0，得到 %d", code)
	}
	opt.Minio = MinioCredentials{}
	if code := Install(context.Background(), tgt, fstest.MapFS{}, view, opt); code == 0 {
		t.Error("缺 root 凭证时 minio dry-run 必须拦住")
	}
	opt.Minio = MinioCredentials{RootUser: "opsadmin", RootPassword: "long-enough-secret"}
	view.Preflights["minio"] = EvaluateMinio(map[string]string{
		"DOCKER_INSTALLED": "yes", "DOCKER_SERVICE": "active", "MINIO_CONTAINER": "absent",
		"MINIO_DOCKER_QUERY": "yes", "MINIO_IMAGE_COUNT": "0", "MINIO_DATA_PARENT": "yes",
		"DISK_FREE_MB": "32000", "SUDO_NOPASSWD": "yes",
	}, view.Local, true)
	if code := Install(context.Background(), tgt, fstest.MapFS{}, view, opt); code == 0 {
		t.Error("没有离线镜像时 minio dry-run 必须拦住")
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
	minioItems := minioCheckItems(map[string]string{}, LocalFacts{})
	if len(minioItems) == 0 {
		t.Error("MinIO 检查项表不该为空")
	}
	for _, it := range minioItems {
		if it.Key == "" || it.Label == "" || it.State == "" {
			t.Errorf("MinIO 检查项字段不全：%+v", it)
		}
	}
}
