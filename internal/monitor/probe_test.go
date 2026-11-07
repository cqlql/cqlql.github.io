package monitor

// probe 脚本的只读与防注入护栏（docs/backup-monitor.md §11.2）。
// 口径与 componentdist_test.go 的 TestComponentCheckScriptIsReadOnly 一致：
// 只看代码行（注释里写「不要做 X」不算「做了 X」）。

import (
	"pass-up/ops/internal/shared"
)

import (
	"regexp"
	"strings"
	"testing"
)

func probeCodeLines(s string) string {
	out := []string{}
	for _, line := range strings.Split(s, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "#") {
			continue
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

func injectionConfig() Config {
	return Config{
		PGRoot:       "/data/pg'; touch /tmp/pwned #",
		PGLog:        "/var/log/pg $(id)",
		MinioLog:     "/var/log/minio `id`",
		MinioData:    "/data/minio|du -sk",
		Disk:         "/data && sudo reboot",
		PGStaleHours: 26, MinioStaleHours: 26, DiskWarnPct: 90,
	}
}

func configPaths(c Config) map[string]string {
	return map[string]string{
		"PG_ROOT":    c.PGRoot,
		"PG_LOG":     c.PGLog,
		"MINIO_LOG":  c.MinioLog,
		"MINIO_DATA": c.MinioData,
		"DISK":       c.Disk,
	}
}

// 硬约束 1：远端脚本不含 rm / mv / > / sudo，也不调用会写日志、推告警的状态脚本。
func TestProbeScriptIsReadOnly(t *testing.T) {
	script := probeScript(testConfig())
	code := probeCodeLines(script)

	// 词边界：format / hostname 里的字母不算命令；`>` 一个都不许有（含重定向）。
	bad := regexp.MustCompile(`(^|[^A-Za-z0-9_])(rm|mv|sudo)([^A-Za-z0-9_]|$)|>`)
	if m := bad.FindString(code); m != "" {
		t.Errorf("只读采集脚本出现禁用 token %q：\n%s", m, code)
	}
	for _, token := range []string{
		"pg_backup_status.sh", "minio_backup_status.sh", "tee ", ">> ", "> /etc",
		"apt-get install", "usermod", "systemctl restart", "docker run", "mkdir ",
		"crontab", "curl", "wget", "docker pull", "mv ", "rm -",
	} {
		if strings.Contains(code, token) {
			t.Errorf("只读采集脚本不该出现 %q", token)
		}
	}
	if strings.Contains(script, "\r\n") {
		t.Error("脚本必须是 LF（远端 sh 会把 CR 当命令的一部分）")
	}
}

// 分节协议固定：四个分节 + 远端算 epoch + 只读采集命令。
func TestProbeScriptSectionsAndRemoteEpoch(t *testing.T) {
	script := probeScript(testConfig())
	sections := []string{"==META", "==PG", "==MINIO", "==DISK"}
	prev := -1
	for _, sec := range sections {
		i := strings.Index(script, sec)
		if i < 0 {
			t.Fatalf("脚本缺少分节 %s", sec)
		}
		if i <= prev {
			t.Errorf("分节顺序错乱：%s", sec)
		}
		prev = i
	}
	for _, must := range []string{
		"date +%s", "date -d", "last_success.txt", "du -sk", "df -P -m",
		"find ", "*.dump", "sh -s", "hostname",
	} {
		if !strings.Contains(script, must) {
			t.Errorf("脚本缺少 %q", must)
		}
	}
	// 没采到写一行 `-`，不许用 0 兜底。
	if !strings.Contains(script, "'-'") {
		t.Error("脚本缺少 `-` 占位输出")
	}
}

// 防注入：所有路径统一 ShQuote 后注入，命令行里不出现未加引号的原始路径。
func TestProbeScriptQuotesEveryPath(t *testing.T) {
	cfg := injectionConfig()
	script := probeScript(cfg)
	for name, path := range configPaths(cfg) {
		want := name + "=" + shared.ShQuote(path)
		found := false
		for _, line := range strings.Split(script, "\n") {
			if line == want {
				found = true
				continue
			}
			// 原始注入片段（含空格 / 引号 / 元字符）绝不能裸奔在赋值行里。
			if strings.HasPrefix(line, name+"=") {
				t.Errorf("%s 出现未转义的赋值行：%q（想要 %q）", name, line, want)
			}
		}
		if !found {
			t.Errorf("%s 没有用 ShQuote 注入：%q", name, path)
		}
		if strings.Count(script, name+"=") != 1 {
			t.Errorf("%s 被拼进脚本多次，转义可能失效", name)
		}
		if strings.Contains(script, name+"="+path) {
			t.Errorf("%s 出现未转义的路径：%q", name, path)
		}
	}
	// 注入片段只能作为「单引号里的数据」出现一次，不许变成第二条命令。
	if strings.Count(script, "touch /tmp/pwned") != 1 {
		t.Errorf("注入片段被拼进脚本多次：%d 次", strings.Count(script, "touch /tmp/pwned"))
	}
}
