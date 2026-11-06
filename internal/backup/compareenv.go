package backup

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"sort"
	"strings"
	"time"
)

// ops backup compare-env：**只读**抓远端 <组件>/backup.env，供界面做「本机 vs 远端」对照。
//
// 边界（AGENTS.md 硬约束 23、docs/ui.md §12）：
//   - 只读：一条 cat，不写文件、不跑 install.sh、不动 crontab；
//   - 凭证不出明文：按 shared.IsSecretEnvKey 判定，凭证只回掩码 + 指纹；
//     页面靠指纹判断是否一致，明文既不进 HTTP 响应也不进任务日志；
//   - 失败如实回原因：远端未安装 / 权限不足 / ssh 不通分别给能照做的提示，不猜空值。

const timeoutCompareEnv = 45 * time.Second

type envSnapshotField struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Secret      bool   `json:"secret"`
	Configured  bool   `json:"configured"`
	Fingerprint string `json:"fingerprint"`
}

type envSnapshot struct {
	Component string             `json:"component"`
	Path      string             `json:"path"`
	Fields    []envSnapshotField `json:"fields"`
}

type compareEnvOutput struct {
	Components []envSnapshot `json:"components"`
}

func runBackupCompareEnv(args []string) int {
	comps := []component{compPG, compMinio}
	var server string
	seenComp := false
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--server":
			if i+1 >= len(args) {
				fmt.Fprintln(os.Stderr, "ERROR: --server 缺少参数")
				return 2
			}
			i++
			server = args[i]
		case strings.HasPrefix(a, "--server="):
			server = strings.TrimPrefix(a, "--server=")
		case strings.HasPrefix(a, "-"):
			fmt.Fprintf(os.Stderr, "ERROR: 未知参数：%s\n", a)
			return 2
		default:
			if seenComp {
				fmt.Fprintln(os.Stderr, "ERROR: 只能指定一个组件")
				return 2
			}
			var err error
			comps, err = parseComponents(a)
			if err != nil {
				fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
				return 2
			}
			seenComp = true
		}
	}

	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	srv, err := list.Resolve(server, cfg.DefaultServer)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		return 1
	}
	t := shared.NewSSHTarget(srv)

	out := compareEnvOutput{}
	for _, c := range comps {
		remotePath := path.Join(cfg.DeployDir, c.remoteDir(), "backup.env")
		cmd := "if [ -f " + shared.ShQuote(remotePath) + " ]; then cat " + shared.ShQuote(remotePath) +
			"; else exit 3; fi"
		ctx, cancel := context.WithTimeout(context.Background(), timeoutCompareEnv)
		text, code, err := t.Capture(ctx, cmd, false)
		cancel()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 读取远端配置失败：%s\n", safeRemoteError(err))
			return 1
		}
		switch code {
		case 3:
			fmt.Fprintf(os.Stderr, "ERROR: 远端配置不存在：%s（这台机可能还没安装备份能力）\n", remotePath)
			return 1
		case 0:
		default:
			fmt.Fprintf(os.Stderr, "ERROR: 读取远端配置失败（exit %d，可能没有读权限）\n", code)
			return 1
		}

		values := shared.ParseEnvText(text)
		keys := make([]string, 0, len(values))
		for k := range values {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		snap := envSnapshot{Component: string(c), Path: remotePath}
		for _, k := range keys {
			raw := values[k]
			secret := shared.IsSecretEnvKey(k)
			display := raw
			if secret {
				display = shared.MaskEnvValue(raw)
			}
			snap.Fields = append(snap.Fields, envSnapshotField{
				Key:         k,
				Value:       display,
				Secret:      secret,
				Configured:  raw != "",
				Fingerprint: shared.EnvFingerprint(raw),
			})
		}
		out.Components = append(out.Components, snap)
	}
	if err := json.NewEncoder(os.Stdout).Encode(out); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: 输出对比结果失败：%v\n", err)
		return 1
	}
	return 0
}

// safeRemoteError 把 ssh 错误整理成一句可读原因；🔴 私钥路径一律不出现
// （ssh 在密钥不可读时会打印 "Warning: Identity file ..."）。
func safeRemoteError(err error) string {
	if err == nil {
		return ""
	}
	var kept []string
	for _, line := range strings.Split(err.Error(), "\n") {
		if strings.Contains(line, "Identity file") || strings.Contains(line, ".ssh/") {
			continue
		}
		kept = append(kept, strings.TrimSpace(line))
	}
	s := strings.TrimSpace(strings.Join(kept, " "))
	if len(s) > 240 {
		s = s[:240] + "…"
	}
	if s == "" {
		return "ssh 连接失败（原因含私钥路径，已隐藏）"
	}
	return s
}
