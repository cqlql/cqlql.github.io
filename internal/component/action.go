package component

// update / uninstall 的执行链路。与 install 同构：
// 只读预检 →（dry-run 到此为止）→ 上传脚本 → root 执行 → 清理 → 复核。
//
// 🔴 --dry-run 绝不改远端：上传与执行都在 dry-run 分支之前 return。
// 🔴 远端临时路径是固定常量，不接受任何用户输入；含凭证的脚本成败都删。
// 🔴 动作计划（能否执行 / 阻塞原因 / 影响清单）来自 actions.go 的同一份 BuildActions，
//    CLI 直接调包也绕不过；附加参数门由 ValidateActionFlags 再挡一次。
// 🔴 MinIO 更新重建容器要重新注入 root 凭证，仍只走内存 → ssh stdin → 0600 临时脚本。

import (
	"pass-up/ops/internal/shared"
)

import (
	"bytes"
	"context"
	"fmt"
	"io/fs"
	"os"
	"strings"
)

const (
	remoteDockerUpdatePath    = "/tmp/passup-component-docker-update.sh"
	remoteDockerUninstallPath = "/tmp/passup-component-docker-uninstall.sh"
	remoteMinioUpdatePath     = "/tmp/passup-component-minio-update.sh"
	remoteMinioUninstallPath  = "/tmp/passup-component-minio-uninstall.sh"
)

// 每个「组件 + 动词」一份脚本；路径只由注册表白名单推导，不接用户输入。
func actionScriptRel(id, verb string) (string, string, bool) {
	switch id {
	case "docker":
		switch verb {
		case VerbUpdate:
			return "docker/update.sh", remoteDockerUpdatePath, true
		case VerbUninstall:
			return "docker/uninstall.sh", remoteDockerUninstallPath, true
		}
	case "minio":
		switch verb {
		case VerbUpdate:
			return "minio/update.sh", remoteMinioUpdatePath, true
		case VerbUninstall:
			return "minio/uninstall.sh", remoteMinioUninstallPath, true
		}
	}
	return "", "", false
}

// RunAction 是 CLI 的写动作总入口；install 转给原有的 Install（保持同一套预检 / 代理逻辑）。
func RunAction(ctx context.Context, t *shared.SSHTarget, scripts fs.FS, view StatusView, opt ActionOptions) int {
	opt.ID = strings.ToLower(strings.TrimSpace(opt.ID))
	opt.Verb = strings.TrimSpace(opt.Verb)
	opt.ImageRef = strings.TrimSpace(opt.ImageRef)
	if err := ValidateActionFlags(opt); err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	proxy, err := ValidProxy(opt.Proxy)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	opt.Proxy = proxy
	if opt.Verb == VerbInstall {
		return Install(ctx, t, scripts, view, InstallOptions{
			ID: opt.ID, DryRun: opt.DryRun, Minio: opt.Minio, Proxy: opt.Proxy,
		})
	}

	rel, remotePath, ok := actionScriptRel(opt.ID, opt.Verb)
	if !ok {
		fmt.Fprintln(os.Stderr, "ERROR: 没有对应的远端脚本："+opt.ID+"/"+opt.Verb)
		return 1
	}
	// 🔴 「连不上」不等于「未安装」：采不到状态时不放行任何写操作（硬约束 3）。
	if !view.Collected {
		fmt.Fprintln(os.Stderr, "ERROR: 只读体检没采到状态（"+valueOr(view.Error, "原因未知")+"）；状态未知时拒绝写操作")
		return 1
	}
	plan, found := PlanFor(view, opt.ID, opt.Verb)
	if !found {
		fmt.Fprintln(os.Stderr, "ERROR: 注册表里没有这个动作计划："+opt.ID+"/"+opt.Verb)
		return 1
	}

	blockers := append([]string{}, plan.Reasons...)
	if ok, why := sudoCapable(t, view.Raw); !ok {
		blockers = append(blockers, why)
	}
	if opt.ID == "docker" && !safeCodename.MatchString(view.Raw["OS_CODENAME"]) {
		blockers = append(blockers, "Ubuntu codename 含非法字符，拒绝拼进远端命令："+valueOr(view.Raw["OS_CODENAME"], "空"))
	}

	// 目标镜像只认体检采到的候选（不接任意字符串），没显式给就取第一个候选。
	target := opt.ImageRef
	if opt.Verb == VerbUpdate && opt.ID == "minio" {
		if target == "" && len(plan.Images) > 0 {
			target = plan.Images[0].Reference
		}
		chosen := false
		for _, ch := range plan.Images {
			if ch.Reference == target {
				chosen = true
			}
		}
		if target == "" || !chosen {
			blockers = append(blockers, "目标镜像不在只读体检采集到的候选里（请先导入离线 tar）："+valueOr(target, "空"))
		}
		if opt.Minio.RootUser == "" || opt.Minio.RootPassword == "" {
			blockers = append(blockers, "本机 backup/minio.env 的 DEST_KEY / DEST_SECRET 未配置或仍是占位符")
		}
		if ref, e := ValidImageRef(target); e != nil || ref == "" {
			blockers = append(blockers, "目标镜像引用非法或为空")
		}
	}

	printActionPlan(t, view, opt, plan, target)
	for _, w := range preflightFor(view, opt.ID).Warnings {
		fmt.Println("WARN: " + w)
	}
	if len(blockers) > 0 {
		for _, b := range blockers {
			fmt.Fprintln(os.Stderr, "ERROR: "+b)
		}
		return 1
	}
	if opt.DryRun {
		fmt.Println("--dry-run：预检通过，未上传脚本、未注入凭证、未修改远端任何文件。")
		return 0
	}

	data, err := readScript(scripts, rel)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 嵌入的组件脚本不可用："+err.Error())
		return 1
	}
	payload := data
	env := ""
	switch opt.ID + "/" + opt.Verb {
	case "docker/" + VerbUpdate:
		env = fmt.Sprintf("COMPONENT_RUN_USER=%s COMPONENT_OS_CODENAME=%s COMPONENT_DOCKER_TARGET_VERSION=%s",
			shared.ShQuote(t.User), shared.ShQuote(view.Raw["OS_CODENAME"]),
			shared.ShQuote(view.Raw["DOCKER_APT_CANDIDATE"]))
		if opt.Proxy != "" {
			env += " COMPONENT_APT_PROXY=" + shared.ShQuote(opt.Proxy)
		}
	case "docker/" + VerbUninstall:
		env = fmt.Sprintf("COMPONENT_RUN_USER=%s COMPONENT_ACK_DOWNSTREAM=%s",
			shared.ShQuote(t.User), shared.ShQuote(boolFlag(opt.AckDownstream)))
	case "minio/" + VerbUpdate:
		// 与 install.sh 同一套路：凭证只存在于内存与上传流的头部。
		header := fmt.Sprintf(
			"COMPONENT_MINIO_ROOT_USER=%s\nCOMPONENT_MINIO_ROOT_PASSWORD=%s\nCOMPONENT_MINIO_IMAGE=%s\nCOMPONENT_RUN_USER=%s\n",
			shared.ShQuote(opt.Minio.RootUser), shared.ShQuote(opt.Minio.RootPassword),
			shared.ShQuote(target), shared.ShQuote(t.User))
		payload = append([]byte(header), data...)
	case "minio/" + VerbUninstall:
		env = fmt.Sprintf("COMPONENT_PURGE_DATA=%s COMPONENT_RUN_USER=%s",
			shared.ShQuote(boolFlag(opt.PurgeData)), shared.ShQuote(t.User))
	}

	code := runActionScript(ctx, t, remotePath, payload, env, opt.ID+"/"+opt.Verb)
	if code != 0 {
		return code
	}
	printRecheck(ctx, t, scripts, view.Server)
	fmt.Println("==> " + plan.Label + "完成。请点「重新检查」复核组件状态。")
	if opt.Verb == VerbUninstall {
		fmt.Println("提醒：minio 备份定时任务仍在，下一次执行会失败（预期结果）；不要为消掉报错去删 crontab / 改配置。")
	}
	return 0
}

func boolFlag(v bool) string {
	if v {
		return "yes"
	}
	return "no"
}

func printActionPlan(t *shared.SSHTarget, view StatusView, opt ActionOptions, plan ActionPlan, target string) {
	fmt.Println("")
	fmt.Printf("========== %s %s 计划（只读预检） ==========\n", plan.Label, valueOr(view.Server, "?"))
	fmt.Printf("目标机        ：%s（清单 user=%s）\n", valueOr(view.Server, "?"), t.User)
	fmt.Printf("动词 / 组件   ：%s / %s\n", opt.Verb, opt.ID)
	fmt.Printf("当前状态      ：%s\n", stateText(componentState(view, opt.ID)))
	if target != "" {
		fmt.Printf("目标镜像      ：%s（目标机已离线导入，绝不 pull）\n", target)
	}
	if opt.Verb == VerbUpdate && opt.ID == "docker" {
		installed, candidate, _ := dockerCandidate(view.Raw)
		fmt.Printf("引擎版本      ：%s → %s（官方 apt 候选，只读采集）\n",
			valueOr(installed, "?"), valueOr(candidate, "?"))
	}
	if opt.Verb == VerbUninstall && opt.ID == "minio" {
		fmt.Printf("删除数据目录  ：%s（独立勾选项，默认不勾）\n", boolText(opt.PurgeData))
	}
	if opt.Proxy != "" {
		fmt.Printf("apt 代理      ：%s（仅本次生效，不写远端配置）\n", opt.Proxy)
	}
	fmt.Println("影响清单      ：")
	for _, s := range plan.Impacts {
		fmt.Println("  - " + s)
	}
	for _, c := range plan.Checks {
		fmt.Printf("附加确认      ：%s（%s）\n", c.Label,
			map[bool]string{true: "必须勾选", false: "默认不勾"}[c.Required])
	}
	fmt.Println("不做          ：不 docker pull、不开放 --force、不删数据（除显式勾选）、不碰 crontab / backup.env")
	fmt.Println("")
}

func componentState(view StatusView, id string) string {
	for _, c := range view.Components {
		if c.ID == id {
			return c.State
		}
	}
	return "unknown"
}

// runActionScript 复用 install 的上传 → root 执行 → 清理三段式。
// env 拼在远端 sh -c 命令串里（sudo 不重置），不落任何远端配置文件。
func runActionScript(ctx context.Context, t *shared.SSHTarget, remotePath string, payload []byte, env, label string) int {
	uploadCmd := "umask 077; cat > " + shared.ShQuote(remotePath) +
		" && chmod 700 " + shared.ShQuote(remotePath)
	code, err := t.Stream(ctx, uploadCmd, false, bytes.NewReader(payload))
	if err != nil || code != 0 {
		fmt.Fprintln(os.Stderr, "ERROR: 上传远端脚本失败（"+label+"）")
		return 1
	}
	runCmd := "bash " + shared.ShQuote(remotePath)
	if env != "" {
		runCmd = env + " " + runCmd
	}
	fmt.Println("==> 远端执行 " + label + " 脚本（安装期提权到 root）")
	code, err = t.Stream(ctx, runCmd, true, nil)

	// 无论成败都清理自己创建的临时文件；含凭证的脚本尤其不能留在远端。
	_, _ = t.Stream(ctx, "rm -f "+shared.ShQuote(remotePath), false, nil)

	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 远端脚本执行失败："+err.Error())
		return 1
	}
	if code != 0 {
		fmt.Printf("ERROR: 远端脚本退出码 %d；未做任何额外回滚，请按上方输出复核。\n", code)
		return code
	}
	return 0
}
