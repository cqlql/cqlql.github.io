package main

// 组件脚本是 //go:embed 编进二进制的：改了脚本不重新 build，远端跑的还是旧脚本。
// 这几个测试锁死「脚本完整 / 只读脚本真的只读 / 安装脚本仍是官方流程 / 无凭证」。

import (
	"io/fs"
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

func TestEmbeddedComponentScriptsComplete(t *testing.T) {
	readComponentScript(t, "deploy/component/docker/check.sh")
	readComponentScript(t, "deploy/component/docker/install.sh")
}

// 🔴 check.sh 是「采集」脚本：绝不写远端、绝不提权、绝不装包（AGENTS.md 硬约束 1）。
func TestComponentCheckScriptIsReadOnly(t *testing.T) {
	s := readComponentScript(t, "deploy/component/docker/check.sh")
	for _, bad := range []string{
		"apt-get install", "apt install", "usermod", "groupadd",
		"systemctl enable", "systemctl restart", "systemctl start",
		"tee ", "rm -", "mv ", ">> /", "> /etc", "docker pull", "sudo -i",
	} {
		if strings.Contains(s, bad) {
			t.Errorf("只读体检脚本里不该出现 %q", bad)
		}
	}
	if !strings.Contains(s, "CHECK_OK") {
		t.Error("check.sh 必须输出 CHECK_OK 标记，Go 侧据此判定 collected")
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
	} {
		if !strings.Contains(s, must) {
			t.Errorf("安装脚本缺少官方流程关键片段 %q", must)
		}
	}
	// 内网目标机 Docker Hub 超时：验证绝不能靠拉 hello-world 镜像。
	for _, bad := range []string{"docker run", "docker pull"} {
		if strings.Contains(s, bad) {
			t.Errorf("安装脚本不该出现 %q（会依赖外网镜像仓库）", bad)
		}
	}
	if !strings.Contains(s, "docker info") {
		t.Error("安装后必须用只读的 docker info 验证，而不是拉镜像")
	}
}

// 🔴 deploy/component 整目录编进 exe，不许出现任何真实凭证（AGENTS.md 硬约束 20）。
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
		for _, banned := range []string{"BEGIN PRIVATE KEY", "MINIO_ROOT_PASSWORD=", "DEST_SECRET=", "sudo.password"} {
			if strings.Contains(string(b), banned) {
				t.Errorf("%s 里不该出现凭证片段 %q", p, banned)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
