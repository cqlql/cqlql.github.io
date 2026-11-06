package shared

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
)

var envLineRe = regexp.MustCompile(`^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$`)

// UnquoteEnvValue 还原 `KEY="value"` 的字面量（含写回时做的 shell 转义）。
func UnquoteEnvValue(s string) string {
	s = strings.TrimSpace(s)
	if len(s) >= 2 && (s[0] == '"' || s[0] == '\'') && s[len(s)-1] == s[0] {
		s = s[1 : len(s)-1]
	}
	s = strings.ReplaceAll(s, `\"`, `"`)
	s = strings.ReplaceAll(s, `\$`, `$`)
	s = strings.ReplaceAll(s, "\\`", "`")
	return strings.ReplaceAll(s, `\\`, `\`)
}

// ParseEnvText 解析 env 文本；注释、空行、非 KEY=VALUE 行一律跳过，重复键取第一次。
func ParseEnvText(text string) map[string]string {
	out := map[string]string{}
	for _, line := range strings.Split(text, "\n") {
		m := envLineRe.FindStringSubmatch(strings.TrimSuffix(line, "\r"))
		if m == nil {
			continue
		}
		if _, exists := out[m[1]]; exists {
			continue
		}
		out[m[1]] = UnquoteEnvValue(m[2])
	}
	return out
}

// env 文件里「哪些键是凭证」的判定、展示掩码与一致性指纹。
//
// 🔴 这三项在 `internal/ui`（配置页）和 `internal/backup`（只读抓取 CLI）
// 必须是同一套实现：否则会出现「CLI 认为某键是凭证、页面却当成普通值回显」，
// 或者两端指纹算法不一致导致把相同的值误判成差异。见 docs/ui.md §12。

func IsSecretEnvKey(k string) bool {
	for _, frag := range []string{"PASSWORD", "PASSWD", "SECRET", "TOKEN", "KEY"} {
		if strings.Contains(k, frag) {
			return true
		}
	}
	return false
}

// MaskEnvValue 只给「看得出变了、但读不出原文」的信息量。
func MaskEnvValue(v string) string {
	if v == "" {
		return ""
	}
	if len(v) <= 9 {
		return "••••••"
	}
	return v[:3] + "…" + v[len(v)-3:]
}

// EnvFingerprint 用于在**不传输明文**的前提下判断两端的凭证值是否相同。
// 页面只拿指纹比较，展示用掩码；明文既不进 HTTP 响应也不进任务日志。
func EnvFingerprint(v string) string {
	sum := sha256.Sum256([]byte(v))
	return hex.EncodeToString(sum[:])[:12]
}
