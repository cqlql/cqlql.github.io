package component

// 安装 Docker 时的 apt/curl 代理（可选）。
//
// 🔴 只认 http://host:port，且**不落任何远端系统配置**：值被拼进远端
//    `sudo -n sh -c` 的命令字符串与 apt -o 参数，所以必须挡住 shell 元字符、
//    认证信息（user:pass@）、路径与查询串。界面和 CLI 共用这一份校验，
//    不许前端放行了服务端照样拼字符串。

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var proxyRe = regexp.MustCompile(`^http://([A-Za-z0-9][A-Za-z0-9.-]*):([0-9]{1,5})$`)

// ValidProxy 返回规范化后的代理地址；空串表示「不用代理」。
func ValidProxy(s string) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", nil
	}
	m := proxyRe.FindStringSubmatch(s)
	if m == nil {
		return "", fmt.Errorf("代理地址格式非法：只接受 http://host:port（不含认证 / 路径 / 空格）")
	}
	port, err := strconv.Atoi(m[2])
	if err != nil || port < 1 || port > 65535 {
		return "", fmt.Errorf("代理端口非法：%s", m[2])
	}
	return s, nil
}
