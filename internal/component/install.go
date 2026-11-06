package component

// 组件安装：只读预检 →（dry-run 到此为止）→ 上传脚本 → root 执行 → 清理 → 复核。
//
// 🔴 --dry-run 绝不改远端：上传与执行都在 dry-run 分支之前就 return 了。
// 🔴 远端临时路径是固定常量，不接受任何用户输入；执行完（含失败）一定清理。
// 🔴 sudo 密码只由 SSHTarget 从 stdin 带进去，不进命令行、不落脚本、不进日志。
// 🔴 MinIO root 凭证只从本机 backup/minio.env 读，在内存里拼到上传脚本头部；
//    嵌入二进制的 install.sh 里没有、也不会打印任何凭证值。

import (
	"pass-up/ops/internal/shared"
)

import (
	"archive/tar"
	"bytes"
	"context"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const (
	remoteInstallPath     = "/tmp/passup-component-docker-install.sh"
	remoteMinioInstallPath = "/tmp/passup-component-minio-install.sh"
	remoteImageTarPath    = "/tmp/passup-component-minio-image.tar"
	maxImageTarBytes      = int64(2) << 30
)

var (
	safeCodename = regexp.MustCompile(`^[a-z]+$`)
	safeImageRef = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._/:-]*$`)
)

// MinioCredentials 只活在进程内存里：从本机 backup/minio.env 读出后直接注入上传流，
// 不进 argv、不进 HTTP 响应、不进任务日志（见 docs/components.md §4）。
type MinioCredentials struct {
	RootUser     string
	RootPassword string
}

type InstallOptions struct {
	ID     string
	DryRun bool
	Minio  MinioCredentials
	// Proxy 只给 Docker 安装用：本次 apt / curl 临时走代理，不写远端配置。
	Proxy string
}

// Install 按组件 id 分派；注册表 Runnable 已在 parseArgs / 界面里挡过一遍，
// 这里再兜一次，避免有人绕过 CLI 直接调包。
func Install(ctx context.Context, t *shared.SSHTarget, scripts fs.FS, view StatusView, opt InstallOptions) int {
	if !Runnable(opt.ID) {
		fmt.Fprintln(os.Stderr, "ERROR: 组件未注册或尚未接入，拒绝写操作："+opt.ID)
		return 1
	}
	// 🔴 直接调包也要再校验一次代理：它会拼进远端命令字符串。
	proxy, err := ValidProxy(opt.Proxy)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	opt.Proxy = proxy
	if proxy != "" && opt.ID != "docker" {
		fmt.Fprintln(os.Stderr, "ERROR: 代理只用于安装 Docker 引擎（apt / curl 下载）")
		return 1
	}
	// 🔴 「连不上」不等于「未安装」：采不到状态时不放行任何写操作（硬约束 3）。
	//   不能只靠下面的 blockers 间接挡住——体检失败时各组件预检本来就是空的。
	if !view.Collected {
		fmt.Fprintln(os.Stderr, "ERROR: 只读体检没采到状态（"+valueOr(view.Error, "原因未知")+"）；状态未知时拒绝安装")
		return 1
	}
	if opt.ID == "minio" {
		return installMinio(ctx, t, scripts, view, opt)
	}
	return installDocker(ctx, t, scripts, view, opt)
}

// probeSudoCapability 只读地确认「这台机器能不能拿到 root」。
// 用它而不是 sudoCapable(raw)：image-load 没有先跑组件体检，raw 里没有 SUDO_NOPASSWD。
func probeSudoCapability(ctx context.Context, t *shared.SSHTarget) (bool, string) {
	if t.IsRoot || t.SudoPassword != "" {
		return true, ""
	}
	_, code, err := t.Capture(ctx, "sudo -n true", false)
	if err != nil {
		return false, "ssh 连接失败，无法确认提权能力：" + err.Error()
	}
	if code != 0 {
		return false, "目标机没有免密 sudo，也没提供一次性 sudo 密码（--password-stdin 或先跑 ops servers apply-sudo）"
	}
	return true, ""
}

func preflightFor(view StatusView, id string) Preflight {
	if p, ok := view.Preflights[id]; ok {
		return p
	}
	return view.Preflight
}

func printPlan(t *shared.SSHTarget, view StatusView, proxy string) {
	raw := view.Raw
	fmt.Println("")
	fmt.Println("========== Docker 引擎安装计划 ==========")
	fmt.Printf("目标机        ：%s（清单 user=%s）\n", view.Server, t.User)
	fmt.Printf("apt 代理      ：%s\n", valueOr(proxy, "直连（未配置）"))
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

func printMinioPlan(t *shared.SSHTarget, view StatusView) {
	raw := view.Raw
	fmt.Println("")
	fmt.Println("========== MinIO 服务安装计划 ==========")
	fmt.Printf("目标机        ：%s（清单 user=%s）\n", view.Server, t.User)
	fmt.Printf("Docker 引擎   ：%s / %s\n",
		valueOr(raw["DOCKER_VERSION"], "未安装"), valueOr(raw["DOCKER_SERVICE"], "—"))
	fmt.Printf("离线镜像      ：%s（共 %s 个，不执行 docker pull）\n",
		valueOr(raw["MINIO_IMAGE_FIRST"], "无"), valueOr(raw["MINIO_IMAGE_COUNT"], "0"))
	fmt.Printf("容器 / 健康   ：%s / %s\n",
		minioContainerText(raw["MINIO_CONTAINER"]), minioHealthText(raw["MINIO_HEALTH"]))
	fmt.Printf("端口          ：9000 API / 9001 Console（占用：%s）\n",
		valueOr(raw["MINIO_PORT_BUSY"], "?"))
	fmt.Printf("数据目录      ：/data/minio（已存在：%s，保留 /data/backups）\n",
		boolText(yes(raw, "MINIO_DATA_DIR")))
	fmt.Printf("本机 root 凭证：%s（取自 backup/minio.env，不回显）\n",
		boolText(view.Local.MinioRootUserSet && view.Local.MinioRootSecretSet))
	fmt.Println("将执行        ：只读校验引擎 / 镜像 / 端口 → 创建 /data/minio →")
	fmt.Println("                docker run -d --name minio --restart unless-stopped → 健康检查")
	fmt.Println("不做          ：不 docker pull、不重建已有容器、不删 /data/minio、不动引擎 /")
	fmt.Println("                镜像、不改 crontab / backup.env、不跑备份")
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

func installDocker(ctx context.Context, t *shared.SSHTarget, scripts fs.FS, view StatusView, opt InstallOptions) int {
	printPlan(t, view, opt.Proxy)
	blockers := append([]string{}, preflightFor(view, "docker").Blockers...)
	if ok, why := sudoCapable(t, view.Raw); !ok {
		blockers = append(blockers, why)
	}
	if codename := view.Raw["OS_CODENAME"]; !safeCodename.MatchString(codename) {
		blockers = append(blockers, "Ubuntu codename 含非法字符，拒绝拼进 apt 源："+valueOr(codename, "空"))
	}
	for _, w := range preflightFor(view, "docker").Warnings {
		fmt.Println("WARN: " + w)
	}
	if len(blockers) > 0 {
		for _, b := range blockers {
			fmt.Fprintln(os.Stderr, "ERROR: "+b)
		}
		return 1
	}

	if opt.DryRun {
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
	// 变量赋值是远端 sh -c 命令字符串的一部分（sudo 不重置它们），
	// 因此代理不会落到 /etc/apt/apt.conf.d/，只在本次安装进程内生效。
	env := fmt.Sprintf("COMPONENT_RUN_USER=%s COMPONENT_OS_CODENAME=%s",
		shared.ShQuote(t.User), shared.ShQuote(view.Raw["OS_CODENAME"]))
	if opt.Proxy != "" {
		env += " COMPONENT_APT_PROXY=" + shared.ShQuote(opt.Proxy)
	}
	runCmd := env + " bash " + shared.ShQuote(remoteInstallPath)
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
	printRecheck(ctx, t, scripts, view.Server)
	fmt.Println("==> 安装完成。")
	return 0
}

// installMinio 把凭证拼在上传脚本的**头部**：远端临时文件是 0600、执行完必删，
// 凭证不出现在 argv、ssh 命令行、日志与嵌入脚本里。
func installMinio(ctx context.Context, t *shared.SSHTarget, scripts fs.FS, view StatusView, opt InstallOptions) int {
	printMinioPlan(t, view)
	pre := preflightFor(view, "minio")
	blockers := append([]string{}, pre.Blockers...)
	if ok, why := sudoCapable(t, view.Raw); !ok {
		blockers = append(blockers, why)
	}
	if opt.Minio.RootUser == "" || opt.Minio.RootPassword == "" {
		blockers = append(blockers, "本机 backup/minio.env 的 DEST_KEY / DEST_SECRET 未配置或仍是占位符")
	}
	image := strings.TrimSpace(view.Raw["MINIO_IMAGE_FIRST"])
	if image == "" {
		blockers = append(blockers, "目标机没有可用的 MinIO 离线镜像：请先跑 image-load 导入 tar")
	}
	if image != "" && !safeImageRef.MatchString(image) {
		blockers = append(blockers, "离线镜像引用含非法字符，拒绝拼进 docker run："+image)
	}
	for _, w := range pre.Warnings {
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

	data, err := readScript(scripts, minioInstallRel)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 嵌入的安装脚本不可用："+err.Error())
		return 1
	}
	// 🔴 这一段只存在于内存与上传流里；install.sh 本身不含任何凭证。
	header := fmt.Sprintf(
		"COMPONENT_MINIO_ROOT_USER=%s\nCOMPONENT_MINIO_ROOT_PASSWORD=%s\nCOMPONENT_MINIO_IMAGE=%s\nCOMPONENT_RUN_USER=%s\n",
		shared.ShQuote(opt.Minio.RootUser), shared.ShQuote(opt.Minio.RootPassword),
		shared.ShQuote(image), shared.ShQuote(t.User))
	payload := append([]byte(header), data...)

	uploadCmd := "umask 077; cat > " + shared.ShQuote(remoteMinioInstallPath) +
		" && chmod 700 " + shared.ShQuote(remoteMinioInstallPath)
	code, err := t.Stream(ctx, uploadCmd, false, bytes.NewReader(payload))
	if err != nil || code != 0 {
		fmt.Fprintln(os.Stderr, "ERROR: 上传安装脚本失败（未执行 docker run）")
		return 1
	}
	fmt.Println("==> 远端执行安装脚本（安装期提权到 root；凭证只在 0600 临时脚本里）")
	code, err = t.Stream(ctx, "bash "+shared.ShQuote(remoteMinioInstallPath), true, nil)

	// 含凭证的临时脚本：无论成败、无论远端报什么错，都必须删掉。
	_, _ = t.Stream(ctx, "rm -f "+shared.ShQuote(remoteMinioInstallPath), false, nil)

	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 远端安装脚本执行失败："+err.Error())
		return 1
	}
	if code != 0 {
		fmt.Printf("ERROR: 远端安装脚本退出码 %d；未做任何回滚，请按上方输出复核。\n", code)
		return code
	}
	printRecheck(ctx, t, scripts, view.Server)
	fmt.Println("==> 安装完成。备份脚本的 DEST_URL 仍需指向本机 9000（见「配置」页）。")
	return 0
}

func printRecheck(ctx context.Context, t *shared.SSHTarget, scripts fs.FS, server string) {
	fmt.Println("==> 复核只读体检")
	after := Collect(ctx, t, scripts, server)
	if !after.Collected {
		fmt.Println("WARN: 复核体检没采到状态（不推断安装结果）：" + after.Error)
		return
	}
	for _, c := range after.Components {
		fmt.Printf("%s 状态：%s，版本：%s\n", c.ID, c.State, valueOr(c.Version, "—"))
	}
	fmt.Printf("离线镜像：%d 个\n", len(after.Images))
}

// LoadImage 把本机 docker save 的 tar 上传到目标机并 docker load。
// 🔴 不执行 docker pull；远端临时 tar 固定路径、0600、无论成败都清理。
func LoadImage(ctx context.Context, t *shared.SSHTarget, tarPath string, dryRun bool) int {
	path := strings.TrimSpace(tarPath)
	if path == "" {
		fmt.Fprintln(os.Stderr, "ERROR: 缺少 --image-tar")
		return 1
	}
	if !strings.HasSuffix(strings.ToLower(path), ".tar") {
		fmt.Fprintln(os.Stderr, "ERROR: 只接受 docker save 出来的 .tar 镜像包")
		return 1
	}
	st, err := os.Stat(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 读不到本机镜像包："+err.Error())
		return 1
	}
	if !st.Mode().IsRegular() || st.Size() == 0 {
		fmt.Fprintln(os.Stderr, "ERROR: 镜像包不是非空普通文件")
		return 1
	}
	if st.Size() > maxImageTarBytes {
		fmt.Fprintln(os.Stderr, "ERROR: 镜像包超过 2 GiB 上限")
		return 1
	}
	if err := validateImageTar(path); err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 镜像包校验失败："+err.Error())
		return 1
	}

	fmt.Println("")
	fmt.Println("========== MinIO 离线镜像导入 ==========")
	fmt.Printf("本机镜像包    ：%s（%.1f MB）\n", filepath.Base(path), float64(st.Size())/(1<<20))
	fmt.Printf("目标机        ：%s（清单 user=%s）\n", t.Host, t.User)
	fmt.Println("将执行        ：上传到远端 0600 临时文件 → docker load → 清理 → 回显镜像清单")
	fmt.Println("不做          ：不 docker pull、不启动容器、不改 /data/minio、不改 backup.env")
	fmt.Println("")
	if dryRun {
		fmt.Println("--dry-run：本机镜像包校验通过，未上传、未修改远端任何文件。")
		return 0
	}
	// image-load 不跑组件体检，所以这里现做一次只读的 sudo 能力探测：
	// 清单 user 可能在 docker 组（不用提权），也可能靠免密 sudo 或一次性密码。
	if ok, why := probeSudoCapability(ctx, t); !ok {
		fmt.Fprintln(os.Stderr, "ERROR: "+why)
		return 1
	}

	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 打开本机镜像包失败："+err.Error())
		return 1
	}
	defer f.Close()

	uploadCmd := "umask 077; cat > " + shared.ShQuote(remoteImageTarPath) +
		" && chmod 600 " + shared.ShQuote(remoteImageTarPath)
	code, err := t.Stream(ctx, uploadCmd, false, f)
	if err != nil || code != 0 {
		fmt.Fprintln(os.Stderr, "ERROR: 上传镜像包失败")
		_, _ = t.Stream(ctx, "rm -f "+shared.ShQuote(remoteImageTarPath), false, nil)
		return 1
	}
	fmt.Println("==> 远端 docker load（读临时文件，stdin 留给 sudo 密码）")
	code, err = t.Stream(ctx, "docker load -i "+shared.ShQuote(remoteImageTarPath), true, nil)
	_, _ = t.Stream(ctx, "rm -f "+shared.ShQuote(remoteImageTarPath), false, nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: docker load 执行失败："+err.Error())
		return 1
	}
	if code != 0 {
		fmt.Printf("ERROR: docker load 退出码 %d；临时 tar 已清理，请重新导入。\n", code)
		return code
	}
	out, _, err := t.Capture(ctx, "docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep -i minio || true", false)
	if err == nil && strings.TrimSpace(out) != "" {
		fmt.Println("==> 目标机现有 MinIO 镜像：")
		fmt.Print(out)
	}
	fmt.Println("==> 导入完成。请点「重新检查」复核组件状态。")
	return 0
}

// validateImageTar 确认这是 docker save 的产物（含 manifest.json），
// 避免把任意文件塞给远端 docker load；只在本机读，不落盘、不解压。
func validateImageTar(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	tr := tar.NewReader(f)
	for {
		h, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("不是可读的 tar 包：%w", err)
		}
		if h.Name == "manifest.json" || strings.HasSuffix(h.Name, "/manifest.json") {
			return nil
		}
	}
	return fmt.Errorf("tar 里没有 manifest.json（请传 docker save 导出的镜像包）")
}
