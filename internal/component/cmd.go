package component

// ops component 的 CLI 分发。入口只做：解析参数 → 解析清单里的 name → 只读体检 →
// list 回状态 / install 走安装（含 dry-run 预检门）/ image-load 导入离线镜像。
//
// 🔴 主机只来自 servers.json：命令只接受 --server <name>，不接受任意 host。
// 🔴 组件 id 只认注册表且必须 PhaseReady；image-load 还要求组件声明了离线镜像。
// 🔴 只有 --password-stdin，没有 --password：sudo 密码不进命令行 / ps / 日志。
// 🔴 MinIO root 凭证只从本机 backup/minio.env 读，运行时注入上传脚本；
//    不进 argv、不进嵌入脚本、不进任何输出。

import (
	"pass-up/ops/internal/shared"
)

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/url"
	"os"
	"strings"
	"time"
)

var errHelp = errors.New("help")

const commandTimeout = 20 * time.Minute

type options struct {
	Verb          string
	ID            string
	Server        string
	ImageTar      string
	Proxy         string
	DryRun        bool
	JSON          bool
	PasswordStdin bool
}

func parseArgs(args []string) (options, error) {
	var opt options
	if len(args) == 0 {
		return opt, errHelp
	}
	rest := args[1:]
	switch args[0] {
	case "list":
		opt.Verb = "list"
	case "install":
		opt.Verb = "install"
	case "image-load":
		opt.Verb = "image-load"
	case "help", "-h", "--help":
		return opt, errHelp
	default:
		return opt, fmt.Errorf("未知子命令：component %s", args[0])
	}
	for i := 0; i < len(rest); i++ {
		a := rest[i]
		switch {
		case a == "--server":
			if i+1 >= len(rest) {
				return opt, fmt.Errorf("--server 缺少参数")
			}
			i++
			opt.Server = rest[i]
		case strings.HasPrefix(a, "--server="):
			opt.Server = strings.TrimPrefix(a, "--server=")
		case a == "--image-tar":
			if i+1 >= len(rest) {
				return opt, fmt.Errorf("--image-tar 缺少参数")
			}
			i++
			opt.ImageTar = rest[i]
		case strings.HasPrefix(a, "--image-tar="):
			opt.ImageTar = strings.TrimPrefix(a, "--image-tar=")
		case a == "--proxy":
			if i+1 >= len(rest) {
				return opt, fmt.Errorf("--proxy 缺少参数")
			}
			i++
			opt.Proxy = rest[i]
		case strings.HasPrefix(a, "--proxy="):
			opt.Proxy = strings.TrimPrefix(a, "--proxy=")
		case a == "--dry-run":
			opt.DryRun = true
		case a == "--json":
			opt.JSON = true
		case a == "--password-stdin":
			opt.PasswordStdin = true
		case a == "-h" || a == "--help":
			return opt, errHelp
		case strings.HasPrefix(a, "-"):
			return opt, fmt.Errorf("未知参数：%s", a)
		default:
			if opt.Verb == "list" || opt.ID != "" {
				return opt, fmt.Errorf("多余的参数：%s", a)
			}
			opt.ID = a
		}
	}
	if opt.Verb == "install" {
		if opt.ID == "" {
			return opt, fmt.Errorf("install 必须显式指定组件 id（docker / minio）")
		}
		if !Runnable(opt.ID) {
			return opt, fmt.Errorf("组件 %q 不可安装（未注册或尚未接入）", opt.ID)
		}
	}
	if opt.Verb == "image-load" {
		if opt.ID == "" {
			return opt, fmt.Errorf("image-load 必须显式指定组件 id（当前只有 minio）")
		}
		if !SupportsImage(opt.ID) {
			return opt, fmt.Errorf("组件 %q 不使用离线镜像，拒绝导入", opt.ID)
		}
		if opt.ImageTar == "" {
			return opt, fmt.Errorf("image-load 需要 --image-tar <本机 .tar 路径>")
		}
	}
	if opt.Verb == "list" && (opt.DryRun || opt.ImageTar != "") {
		return opt, fmt.Errorf("list 本身就是只读的，不需要 --dry-run / --image-tar")
	}
	// 🔴 代理值会拼进远端命令字符串：格式必须在 CLI 边界就卡死。
	proxy, err := ValidProxy(opt.Proxy)
	if err != nil {
		return opt, err
	}
	opt.Proxy = proxy
	if proxy != "" && (opt.Verb != "install" || opt.ID != "docker") {
		return opt, fmt.Errorf("--proxy 只用于 install docker（apt / curl 下载），其它动作不走网络")
	}
	return opt, nil
}

// readSudoPassword 与 backup 包同款：只读一行，不回显、不落盘。
func readSudoPassword() (string, error) {
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("读取密码失败：%w", err)
	}
	pw := strings.TrimRight(line, "\r\n")
	if pw == "" {
		return "", fmt.Errorf("stdin 没有读到 sudo 密码")
	}
	return pw, nil
}

// loadMinioConfig 读本机 backup/minio.env（不入 Git、不进二进制）。
// 只把「是否已配置」和 DEST_URL 端口放进页面可见的 LocalFacts；
// 真正的凭证值只在内存里的 MinioCredentials，交给安装器注入上传脚本。
func loadMinioConfig(cfg *shared.Config) (LocalFacts, MinioCredentials) {
	local := LocalFacts{MinioEnvPath: cfg.MinioEnvFile}
	creds := MinioCredentials{}
	data, err := os.ReadFile(cfg.MinioEnvFile)
	if err != nil {
		return local, creds
	}
	env := shared.ParseEnvText(string(data))
	local.DestURL = env["DEST_URL"]
	if u, err := url.Parse(env["DEST_URL"]); err == nil && u.Port() != "" {
		local.DestURLPort = u.Port()
	} else if u != nil && u.Scheme != "" {
		// http 默认 80 / https 默认 443：没写端口也照实显示，便于提示「不是 9000」。
		local.DestURLPort = map[string]string{"http": "80", "https": "443"}[u.Scheme]
	}
	user, secret := strings.TrimSpace(env["DEST_KEY"]), strings.TrimSpace(env["DEST_SECRET"])
	local.MinioRootUserSet = !isPlaceholderCredential(user)
	local.MinioRootSecretSet = !isPlaceholderCredential(secret)
	if local.MinioRootUserSet && local.MinioRootSecretSet {
		creds.RootUser = user
		creds.RootPassword = secret
	}
	return local, creds
}

func isPlaceholderCredential(v string) bool {
	if v == "" {
		return true
	}
	up := strings.ToUpper(v)
	return strings.HasPrefix(up, "YOUR_") || strings.HasPrefix(up, "CHANGE_ME") ||
		v == "<...>" || v == "TODO"
}

// CmdComponent 由 main.go 注入嵌入的脚本树（与 backup.CmdBackup 同构）。
func CmdComponent(args []string, scripts fs.FS) int {
	opt, err := parseArgs(args)
	if errors.Is(err, errHelp) {
		usage()
		return 0
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 2
	}

	cfg, err := shared.LoadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	list, err := shared.LoadServers(cfg)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	srv, err := list.Resolve(opt.Server, cfg.DefaultServer)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		return 1
	}
	t := shared.NewSSHTarget(srv)
	if opt.PasswordStdin && opt.Verb != "list" {
		pw, err := readSudoPassword()
		if err != nil {
			fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
			return 1
		}
		if t.SudoPassword == "" {
			t.SudoPassword = pw
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()

	local, creds := loadMinioConfig(cfg)

	// image-load 不需要先跑一遍组件体检：它只校验本机 tar，导入后由「重新检查」复核。
	if opt.Verb == "image-load" {
		return LoadImage(ctx, t, opt.ImageTar, opt.DryRun)
	}

	view := CollectWithLocal(ctx, t, scripts, srv.Name, local)
	if opt.Verb == "list" {
		if opt.JSON {
			// stdout 只放 JSON，界面用它做状态源；别的提示都走 stderr。
			_ = json.NewEncoder(os.Stdout).Encode(view)
			if !view.Collected {
				fmt.Fprintln(os.Stderr, "WARN: "+view.Error)
				return 1
			}
			return 0
		}
		printStatus(view)
		if !view.Collected {
			return 1
		}
		return 0
	}
	return Install(ctx, t, scripts, view, InstallOptions{
		ID: opt.ID, DryRun: opt.DryRun, Minio: creds, Proxy: opt.Proxy,
	})
}

func printStatus(v StatusView) {
	fmt.Println("")
	fmt.Println("========== 环境组件状态（只读） ==========")
	fmt.Printf("目标机：%s · 采集：%s\n", v.Server, boolText(v.Collected))
	if v.Error != "" {
		fmt.Println("ERROR: " + v.Error)
		fmt.Println("（连不上时组件状态是「未知」，不是「未安装」）")
		return
	}
	fmt.Println("")
	for _, c := range v.Components {
		fmt.Printf("  %-6s %-12s %-10s %s\n", c.ID, c.Name, c.State, c.Version)
	}
	fmt.Println("")
	for _, it := range v.Checks {
		fmt.Printf("  %-22s %-8s %s\n", it.Label, it.State, it.Value)
	}
	fmt.Println("")
	fmt.Printf("离线镜像：%d 个", len(v.Images))
	for _, img := range v.Images {
		fmt.Printf("\n  %s (%s)", img.Reference, img.Size)
	}
	fmt.Println("")
	for id, p := range v.Preflights {
		fmt.Printf("预检 %-8s：%s", id, boolText(p.Ready))
		for _, b := range p.Blockers {
			fmt.Printf("\n  BLOCK: %s", b)
		}
		for _, w := range p.Warnings {
			fmt.Printf("\n  WARN : %s", w)
		}
		fmt.Println("")
	}
}

func usage() {
	fmt.Print(`用法:
  ops component list --server <name> [--json]
                                       只读体检：组件状态 + 检查项 + 已导入镜像
  ops component install docker --server <name> [--proxy <http://host:port>] [--dry-run] [--password-stdin]
                                       按 Docker 官方 apt 仓库安装引擎（写操作）
  ops component install minio --server <name> [--dry-run] [--password-stdin]
                                       用已导入的离线镜像拉起 MinIO 服务（写操作）
  ops component image-load minio --server <name> --image-tar <本机 .tar> [--dry-run]
                                       把离线镜像 tar 上传到目标机并 docker load（写操作）

--dry-run 只做只读预检与计划打印，绝不上传脚本 / 镜像、绝不修改远端。
--server 只接受 servers.json 里的 name；不接受任意主机地址。
--password-stdin 从 stdin 读一次性 sudo 密码（密码不进命令行 / 日志）。
--proxy 只用于 install docker：本次 apt / curl 临时走该代理，只接受
        http://host:port（不含认证 / 路径），不写 /etc/apt/apt.conf.d/ 等任何远端配置。
        界面安装弹窗里也有同一个可选项；留空则直连。

🔴 MinIO 不执行 docker pull：目标机拉不到 Docker Hub / quay.io / dl.min.io，
   镜像必须由人从本机导入。root 凭证取自本机 backup/minio.env 的
   DEST_KEY / DEST_SECRET，运行时注入，不进二进制、不进命令行、不进日志。
`)
}
