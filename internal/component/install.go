package component

// Docker 引擎安装：只读预检 →（dry-run 到此为止）→ 上传脚本 → root 执行 → 清理 → 复核。
//
// 🔴 --dry-run 绝不改远端：上传与执行都在 dry-run 分支之前就 return 了。
// 🔴 远端临时脚本路径是固定常量，不接受任何用户输入；执行完一定清理。
// 🔴 sudo 密码只由 SSHTarget 从 stdin 带进去，不进命令行、不落脚本、不进日志。

import (
	"pass-up/ops/internal/shared"
)

import (
	"bytes"
	"context"
	"fmt"
	"io/fs"
	"os"
	"regexp"
	"strings"
)

// remoteInstallPath 固定：不拼组件 id / 服务器名，避免任何路径注入面。
const remoteInstallPath = "/tmp/passup-component-docker-install.sh"

var safeCodename = regexp.MustCompile(`^[a-z]+$`)

func printPlan(t *shared.SSHTarget, view StatusView) {
	raw := view.Raw
	fmt.Println("")
	fmt.Println("========== Docker 引擎安装计划 ==========")
	fmt.Printf("目标机        ：%s（清单 user=%s）\n", view.Server, t.User)
	fmt.Printf("系统 / 架构   ：%s %s (%s) · %s\n",
		valueOr(raw["OS_ID"], "?"), valueOr(raw["OS_VERSION_ID"], "?"),
		valueOr(raw["OS_CODENAME"], "?"), valueOr(raw["ARCH"], "?"))
	fmt.Printf("apt 仓库可达  ：%s\n", boolText(yes(raw, "APT_REPO_REACHABLE")))
	fmt.Printf("冲突包        ：%s\n", valueOr(strings.TrimSpace(raw["CONFLICT_PACKAGES"]), "无"))
	fmt.Printf("根分区剩余    ：%s MB\n", valueOr(raw["DISK_FREE_MB"], "?"))
	fmt.Println("将执行        ：卸载冲突包 → ca-certificates/curl → 官方 GPG key →")
	fmt.Println("                deb822 docker.sources → apt install docker-ce 等 5 个包 →")
	fmt.Println("                systemctl enable --now docker → usermod -aG docker <清单 user>")
	fmt.Println("不做          ：不跑 hello-world（会拉 Docker Hub 镜像）、不动容器/镜像、")
	fmt.Println("                不删 /var/lib/docker、不改 crontab / backup.env")
	fmt.Println("")
}

// sudoCapable 判断这次安装能不能拿到 root。
// 免密 sudo / root 登录 / 一次性 stdin 密码 三条路任一成立即可。
func sudoCapable(t *shared.SSHTarget, raw map[string]string) (bool, string) {
	if t.IsRoot {
		return true, ""
	}
	if t.SudoPassword != "" {
		return true, ""
	}
	if yes(raw, "SUDO_NOPASSWD") {
		return true, ""
	}
	return false, "目标机没有免密 sudo，也没提供一次性 sudo 密码（界面可填，或先跑 ops servers apply-sudo）"
}

// Install 返回进程退出码。输出全部打到 stdout：CLI 下是终端，界面下由子进程
// 接到任务日志（见根包 backuprun.go），不重写一套输出层。
func Install(ctx context.Context, t *shared.SSHTarget, scripts fs.FS, view StatusView, dryRun bool) int {
	printPlan(t, view)
	blockers := append([]string{}, view.Preflight.Blockers...)
	if ok, why := sudoCapable(t, view.Raw); !ok {
		blockers = append(blockers, why)
	}
	if codename := view.Raw["OS_CODENAME"]; !safeCodename.MatchString(codename) {
		blockers = append(blockers, "Ubuntu codename 含非法字符，拒绝拼进 apt 源："+valueOr(codename, "空"))
	}
	for _, w := range view.Preflight.Warnings {
		fmt.Println("WARN: " + w)
	}
	if len(blockers) > 0 {
		for _, b := range blockers {
			fmt.Fprintln(os.Stderr, "ERROR: "+b)
		}
		return 1
	}

	if dryRun {
		fmt.Println("--dry-run：预检通过，未上传脚本、未修改远端任何文件。")
		return 0
	}

	data, err := readScript(scripts, dockerInstallRel)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 嵌入的安装脚本不可用："+err.Error())
		return 1
	}

	// 上传：root=false，stdin 可以安全用来送脚本内容（sudo 密码此时不占 stdin）。
	uploadCmd := "umask 077; cat > " + shared.ShQuote(remoteInstallPath) +
		" && chmod 700 " + shared.ShQuote(remoteInstallPath)
	code, err := t.Stream(ctx, uploadCmd, false, bytes.NewReader(data))
	if err != nil || code != 0 {
		fmt.Fprintln(os.Stderr, "ERROR: 上传安装脚本失败")
		return 1
	}

	// 执行：root=true。脚本从文件读，stdin 留给 sudo -S 的密码，两者不冲突。
	runCmd := fmt.Sprintf("COMPONENT_RUN_USER=%s COMPONENT_OS_CODENAME=%s bash %s",
		shared.ShQuote(t.User), shared.ShQuote(view.Raw["OS_CODENAME"]),
		shared.ShQuote(remoteInstallPath))
	fmt.Println("==> 远端执行安装脚本（安装期提权到 root）")
	code, err = t.Stream(ctx, runCmd, true, nil)

	// 无论成败都清理自己创建的临时文件。
	_, _ = t.Stream(ctx, "rm -f "+shared.ShQuote(remoteInstallPath), false, nil)

	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 远端安装脚本执行失败："+err.Error())
		return 1
	}
	if code != 0 {
		fmt.Printf("ERROR: 远端安装脚本退出码 %d；未做任何回滚，请按上方输出复核。\n", code)
		return code
	}

	fmt.Println("==> 复核只读体检")
	after := Collect(ctx, t, scripts, view.Server)
	if !after.Collected {
		fmt.Println("WARN: 复核体检没采到状态（不推断安装结果）：" + after.Error)
		return 0
	}
	for _, c := range after.Components {
		if c.ID == "docker" {
			fmt.Printf("Docker 状态：%s，版本：%s\n", c.State, valueOr(c.Version, "—"))
		}
	}
	fmt.Println("==> 安装完成。")
	return 0
}
