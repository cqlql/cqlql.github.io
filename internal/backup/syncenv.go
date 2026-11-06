package backup

import (
	"pass-up/ops/internal/shared"
)

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path"
	"strings"
	"time"
)

// ops backup sync-env：只把本机填好的 backup config 推到远端 <组件>/backup.env，
// **不重跑 install.sh、不动脚本与 crontab**。
//
// 为什么需要它：deploy 在「远端 backup.env 已是 OK」时默认保留远端配置
// （--force 才覆盖），而界面不开放 --force。改完本机配置若没有一个显式、
// 轻量的同步入口，页面上「保存成功」其实是假成功。见 docs/ui.md §12。
//
// 🔴 走 root=false：部署目录由 prepareDir 以登录账号（cql）属主创建，
// 配置以登录账号写入即可；这样 stdin 能整份留给配置内容，不必和 sudo 密码
// 抢同一个管道。凭证内容既不进命令行，也不打印到输出。

const timeoutSyncEnv = 60 * time.Second

func runBackupSyncEnv(args []string) int {
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

	for _, c := range comps {
		local := c.envFile(cfg)
		data, err := os.ReadFile(local)
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 读取本机配置失败：%v\n", err)
			return 1
		}
		if len(bytes.TrimSpace(data)) == 0 {
			fmt.Fprintf(os.Stderr, "ERROR: %s 的本机配置是空的，先填好再同步\n", c)
			return 1
		}
		if bytes.Contains(data, []byte("CHANGE_ME")) || bytes.Contains(data, []byte("YOUR_")) {
			fmt.Fprintf(os.Stderr, "ERROR: %s 的本机配置仍含占位符，填好再同步\n", c)
			return 1
		}

		remoteDir := path.Join(cfg.DeployDir, c.remoteDir())
		cmd := fmt.Sprintf(
			`set -e; d=%s; [ -d "$d" ] || { echo '远端目录不存在：请先安装备份能力'; exit 1; }; `+
				`if [ -f "$d/backup.env" ]; then cp -p "$d/backup.env" "$d/backup.env.bak"; fi; `+
				`umask 077; cat > "$d/backup.env.tmp"; chmod 600 "$d/backup.env.tmp"; `+
				`mv "$d/backup.env.tmp" "$d/backup.env"`,
			shared.ShQuote(remoteDir))
		fmt.Printf("==> 同步 %s 配置 → %s@%s:%s/backup.env\n", c, srv.User, srv.Host, remoteDir)

		ctx, cancel := context.WithTimeout(context.Background(), timeoutSyncEnv)
		code, err := t.Stream(ctx, cmd, false, bytes.NewReader(data))
		cancel()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: 同步 %s 失败：%v\n", c, err)
			return 1
		}
		if code != 0 {
			fmt.Fprintf(os.Stderr, "ERROR: 同步 %s 失败（exit %d）\n", c, code)
			return 1
		}
	}
	fmt.Println("==> 同步完成：远端 backup.env 已更新（脚本与定时任务未改动）")
	return 0
}
