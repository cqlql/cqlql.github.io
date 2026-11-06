package main

// 组件脚本是 //go:embed 编进二进制的：改了脚本不重新 build，远端跑的还是旧脚本。
// 这几个测试锁死「脚本完整 / 只读脚本真的只读 / 安装脚本仍是官方流程 / 无凭证」。

import (
	"io/fs"
	"regexp"
	"strings"
	"testing"
)

func readComponentScript(t *testing.T, name string) string {
	t.Helper()
	b, err := fs.ReadFile(componentScripts, name)
	if err != nil {
		t.Fatalf("嵌入产物缺少 %s：%v", name, err)
	}
	s := string(b)
	if !strings.HasPrefix(s, "#!/bin/bash\n") {
		head := s
		if len(head) > 20 {
			head = head[:20]
		}
		t.Errorf("%s 必须以 #!/bin/bash 开头且用 LF：%q", name, head)
	}
	if strings.Contains(s, "\r\n") {
		t.Errorf("%s 含 CRLF，远端 bash 会报 $'\\r' 错误", name)
	}
	return s
}

// 只取代码行：注释里写「不要做 X」不该被当成「做了 X」。
func codeLines(s string) string {
	out := []string{}
	for _, line := range strings.Split(s, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "#") {
			continue
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

func TestEmbeddedComponentScriptsComplete(t *testing.T) {
	for _, name := range []string{
		"deploy/component/docker/check.sh", "deploy/component/docker/install.sh",
		"deploy/component/docker/update.sh", "deploy/component/docker/uninstall.sh",
		"deploy/component/minio/check.sh", "deploy/component/minio/install.sh",
		"deploy/component/minio/update.sh", "deploy/component/minio/uninstall.sh",
	} {
		readComponentScript(t, name)
	}
}

// 2026-11-07：update / uninstall 四份脚本的行为边界（docs/components.md §8.2 / §8.3）。
// 注释里写「不要做 X」不算「做了 X」，所以统一只看 codeLines。
func TestComponentWriteScriptsBoundaries(t *testing.T) {
	du := codeLines(readComponentScript(t, "deploy/component/docker/update.sh"))
	for _, must := range []string{
		"apt-cache policy docker-ce", "--only-upgrade", "systemctl restart docker",
		"docker info", "/minio/health/live", "COMPONENT_DOCKER_TARGET_VERSION",
	} {
		if !strings.Contains(du, must) {
			t.Errorf("引擎更新脚本缺少 %q", must)
		}
	}
	for _, bad := range []string{"docker pull", "docker run", "docker rm", "docker rmi", "rm -rf", "/etc/apt/apt.conf.d"} {
		if strings.Contains(du, bad) {
			t.Errorf("引擎更新脚本不该出现 %q（只升引擎包）", bad)
		}
	}

	dx := codeLines(readComponentScript(t, "deploy/component/docker/uninstall.sh"))
	for _, must := range []string{
		"COMPONENT_ACK_DOWNSTREAM", "systemctl stop docker.service", "apt-get purge",
		"/var/lib/docker", "预期结果", "MinIO 容器运行中",
	} {
		if !strings.Contains(dx, must) {
			t.Errorf("引擎卸载脚本缺少 %q", must)
		}
	}
	for _, bad := range []string{"rm -rf", "docker pull", "docker rmi", "crontab -", "docker rm -v"} {
		if strings.Contains(dx, bad) {
			t.Errorf("引擎卸载脚本不该出现 %q", bad)
		}
	}

	mu := codeLines(readComponentScript(t, "deploy/component/minio/update.sh"))
	for _, must := range []string{
		"OLD_IMAGE", "docker stop", "docker rm \"$CONTAINER\"", "start_container \"$OLD_IMAGE\"",
		"/minio/health/live", "MINIO_ROOT_PASSWORD=\"$ROOT_SECRET\"", "COMPONENT_MINIO_IMAGE",
		"数据卷未参与回滚",
	} {
		if !strings.Contains(mu, must) {
			t.Errorf("MinIO 更新脚本缺少 %q", must)
		}
	}
	for _, bad := range []string{"docker pull", "docker rm -v", "rm -rf", "docker rmi", "> /var/log"} {
		if strings.Contains(mu, bad) {
			t.Errorf("MinIO 更新脚本不该出现 %q", bad)
		}
	}

	mx := codeLines(readComponentScript(t, "deploy/component/minio/uninstall.sh"))
	for _, must := range []string{
		"COMPONENT_PURGE_DATA", "PURGE=\"${COMPONENT_PURGE_DATA:-no}\"",
		"docker rm \"$CONTAINER\"", "预期结果", "数据目录 /data/minio 完整保留",
	} {
		if !strings.Contains(mx, must) {
			t.Errorf("MinIO 卸载脚本缺少 %q", must)
		}
	}
	for _, bad := range []string{"docker rm -v", "docker pull"} {
		if strings.Contains(mx, bad) {
			t.Errorf("MinIO 卸载脚本不该出现 %q", bad)
		}
	}
	// 🔴 删数据是独立勾选项且默认不勾：rm -rf 只能出现在 PURGE=yes 的分支里，
	//    且路径必须是硬编码常量，绝不拼用户输入。
	branch := strings.Index(mx, `if [ "$PURGE" = "yes" ]; then`)
	rmLine := strings.Index(mx, "rm -rf /data/minio")
	if branch < 0 || rmLine < 0 || rmLine < branch {
		t.Errorf("删数据必须落在 PURGE=yes 分支内：branch=%d rm=%d", branch, rmLine)
	}
}

// 🔴 check.sh 是「采集」脚本：绝不写远端、绝不提权、绝不装包 / 拉镜像
//    （AGENTS.md 硬约束 1）。每个组件一份，全部都要过这一关。
func TestComponentCheckScriptIsReadOnly(t *testing.T) {
	for _, name := range []string{
		"deploy/component/docker/check.sh", "deploy/component/minio/check.sh",
	} {
		code := codeLines(readComponentScript(t, name))
		for _, bad := range []string{
			"apt-get install", "apt install", "usermod", "groupadd",
			"systemctl enable", "systemctl restart", "systemctl start",
			"tee ", "rm -", "mv ", ">> /", "> /etc", "docker pull", "sudo -i",
			"docker run", "docker load", "mkdir ",
		} {
			if strings.Contains(code, bad) {
				t.Errorf("%s 的只读体检脚本里不该出现 %q", name, bad)
			}
		}
		if !strings.Contains(code, "CHECK_OK yes") {
			t.Errorf("%s 必须输出 CHECK_OK 标记，Go 侧据此判定 collected", name)
		}
	}
}

func TestComponentInstallFollowsOfficialDockerDocs(t *testing.T) {
	s := readComponentScript(t, "deploy/component/docker/install.sh")
	for _, must := range []string{
		"https://download.docker.com/linux/ubuntu/gpg",
		"/etc/apt/keyrings/docker.asc",
		"/etc/apt/sources.list.d/docker.sources",
		"Types: deb", "Suites: ${CODENAME}", "Architectures: ${ARCH}",
		"docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
		"systemctl enable --now docker",
		"usermod -aG docker",
		"COMPONENT_RUN_USER",
		"COMPONENT_APT_PROXY", "APT_PROXY_OPTS",
		"Acquire::http::Proxy=", "Acquire::https::Proxy=", "https_proxy",
	} {
		if !strings.Contains(s, must) {
			t.Errorf("安装脚本缺少官方流程关键片段 %q", must)
		}
	}
	// 内网目标机 Docker Hub 超时：验证绝不能靠拉 hello-world 镜像。
	// 代理只能临时生效，绝不写 /etc/apt/apt.conf.d/ 之类的远端系统配置。
	for _, bad := range []string{"docker run", "docker pull", "/etc/apt/apt.conf.d"} {
		if strings.Contains(codeLines(s), bad) {
			t.Errorf("安装脚本不该出现 %q（会依赖外网镜像仓库 / 留下系统级改动）", bad)
		}
	}
	if !strings.Contains(s, "docker info") {
		t.Error("安装后必须用只读的 docker info 验证，而不是拉镜像")
	}
}

// MinIO 安装：只用离线镜像、不重建已有容器、不删数据、不动 crontab / backup.env。
func TestMinioInstallScriptNeverPullsOrDeletesData(t *testing.T) {
	s := codeLines(readComponentScript(t, "deploy/component/minio/install.sh"))
	for _, must := range []string{
		"docker image inspect", "docker run -d", "--restart unless-stopped",
		"MINIO_ROOT_USER=", "MINIO_ROOT_PASSWORD=", "/data/minio",
		"/minio/health/live", "COMPONENT_MINIO_IMAGE", "mkdir -p \"$DATA_DIR\"",
		"非独立数据盘",
	} {
		if !strings.Contains(s, must) {
			t.Errorf("MinIO 安装脚本缺少关键片段 %q", must)
		}
	}
	for _, bad := range []string{
		"docker pull", "docker rm ", "rm -rf", "crontab", "backup.env",
		"docker rmi", "> /var/log", "die \"目标机没有 /data",
	} {
		if strings.Contains(s, bad) {
			t.Errorf("MinIO 安装脚本不该出现 %q", bad)
		}
	}
	// 只取容器状态，不 inspect 全量配置（那会把 root 凭证带进日志）。
	if !strings.Contains(s, "docker start") {
		t.Error("已有但未运行的容器应直接 start，不该重建")
	}
}

// 🔴 deploy/component 整目录编进 exe，不许出现任何真实凭证（AGENTS.md 硬约束 20）。
// 「-e MINIO_ROOT_PASSWORD=\"$VAR\"」是变量引用，不是凭证；字面值才算泄漏。
var credLiteralRe = regexp.MustCompile(`(?m)(MINIO_ROOT_USER|MINIO_ROOT_PASSWORD|DEST_KEY|DEST_SECRET)\s*=\s*['"][^$'"]{3,}['"]`)

func TestComponentScriptsHaveNoCredentials(t *testing.T) {
	err := fs.WalkDir(componentScripts, "deploy/component", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		low := strings.ToLower(d.Name())
		for _, banned := range []string{".env", ".key", ".pem", "secret", "password", "credential"} {
			if strings.Contains(low, banned) {
				t.Errorf("组件目录不该出现凭证类文件：%s", p)
			}
		}
		b, e := fs.ReadFile(componentScripts, p)
		if e != nil {
			return e
		}
		s := string(b)
		for _, banned := range []string{"BEGIN PRIVATE KEY", "sudo.password"} {
			if strings.Contains(s, banned) {
				t.Errorf("%s 里不该出现凭证片段 %q", p, banned)
			}
		}
		if m := credLiteralRe.FindString(s); m != "" {
			t.Errorf("%s 里出现了硬编码凭证赋值：%q", p, m)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
