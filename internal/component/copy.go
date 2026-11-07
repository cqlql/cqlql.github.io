package component

// 从**另一台已登记服务器**直接复制镜像（ops component image-copy minio --from-server <name>）。
//
// 链路：源机 `docker save <ref>`（stdout）→ 本机 pipe 中转 → 目标机 0600 临时 tar →
//       `docker load -i` → 清理。本机不落盘、不经镜像仓库、绝不 docker pull。
// 判据见 docs/components.md §9。
//
// 🔴 源机与目标机都只认 servers.json 的 name，源 ≠ 目标（硬约束 12）。
// 🔴 源机镜像只允许「源机本地确实存在」且字符集合法的引用，不接任意字符串。
// 🔴 源机 docker 权限两路都试：先无 sudo，失败再试免密 sudo / 清单里的一次性密码；
//    走的是哪条要写进计划，不让人猜。
// 🔴 传输上限与 image-load 同一个 2 GiB，超了就地中断，不留半截 tar。
// 🔴 只做 save / load：不启动容器、不重建、不删 /data/minio、不碰 crontab / backup.env。

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"strings"
	"time"

	"pass-up/ops/internal/shared"
)

// remoteCopyTarPath 与 image-load 用同一个固定路径：都不接用户输入。
const remoteCopyTarPath = "/tmp/passup-component-minio-image.tar"

// SourceImages 是 `ops component images --server <name> --json` 的输出，
// 也是界面里「从服务器复制」的镜像候选来源（只读，不写任何远端文件）。
type SourceImages struct {
	Server    string      `json:"server"`
	Collected bool        `json:"collected"`
	Elevated  bool        `json:"elevated"`
	Error     string      `json:"error,omitempty"`
	Images    []ImageInfo `json:"images"`
}

// dockerAccess 只读地确认「这台机器能不能用 docker」，并回一句「要不要提权」。
// 两路都试：先按清单 user 直接跑，失败再试 sudo（免密 / 清单里的一次性密码）。
// 🔴 提权只用来跑只读的 docker info / images / save，不改任何远端配置。
func dockerAccess(ctx context.Context, t *shared.SSHTarget) (bool, error) {
	_, code, err := t.Capture(ctx, "docker info >/dev/null 2>&1", false)
	if err != nil {
		return false, err
	}
	if code == 0 {
		return false, nil
	}
	_, code, err = t.Capture(ctx, "docker info >/dev/null 2>&1", true)
	if err != nil {
		return false, err
	}
	if code == 0 {
		return true, nil
	}
	return false, errors.New("docker 不可用：清单 user 不在 docker 组，也没有可用的免密 sudo")
}

// listSourceImages 读源机本地的 MinIO 镜像清单（只读）。
// 查不动时 Collected=false + Error，绝不拿空列表冒充「源机没有镜像」。
func listSourceImages(ctx context.Context, t *shared.SSHTarget, server string) SourceImages {
	res := SourceImages{Server: server, Images: []ImageInfo{}}
	root, err := dockerAccess(ctx, t)
	if err != nil {
		res.Error = err.Error()
		return res
	}
	out, code, err := t.Capture(ctx,
		"docker images --format '{{.Repository}}:{{.Tag}};{{.ID}};{{.Size}};{{.CreatedAt}}'", root)
	if err != nil {
		res.Error = "ssh 执行失败：" + err.Error()
		return res
	}
	if code != 0 {
		res.Error = fmt.Sprintf("源机 docker images 退出码 %d", code)
		return res
	}
	lines := strings.Join(strings.Split(strings.TrimSpace(out), "\n"), "|")
	for _, img := range parseImageLines("|" + lines) {
		if !strings.Contains(strings.ToLower(img.Reference), "minio") {
			continue
		}
		if strings.HasPrefix(img.Reference, "<none>") || !safeImageRef.MatchString(img.Reference) {
			continue
		}
		res.Images = append(res.Images, img)
	}
	res.Collected = true
	res.Elevated = root
	return res
}

// pickSourceImage 在源机候选里选目标镜像：显式给的就必须在候选里（白名单），
// 省略时取第一个（docker images 默认按创建时间倒序，即最新的那个）。
func pickSourceImage(images []ImageInfo, want string) (string, error) {
	want = strings.TrimSpace(want)
	if want == "" {
		if len(images) == 0 {
			return "", errors.New("源机没有名字里带 minio 的本地镜像")
		}
		return images[0].Reference, nil
	}
	ref, err := ValidImageRef(want)
	if err != nil {
		return "", err
	}
	for _, img := range images {
		if img.Reference == ref {
			return ref, nil
		}
	}
	return "", fmt.Errorf("镜像 %s 不在源机本地镜像清单里（只接受源机确实存在的镜像）", ref)
}

// CopyOptions 是一次镜像复制的显式入参；没有任何隐藏在环境变量里的开关。
type CopyOptions struct {
	ID       string
	ImageRef string
	DryRun   bool
}

// CopyImage 是 image-copy 的执行入口。src / dst 都是清单里的服务器。
func CopyImage(
	ctx context.Context,
	src, dst *shared.SSHTarget,
	srcName, dstName string,
	scripts fs.FS,
	opt CopyOptions,
) int {
	// 注册表白名单：只有声明了离线镜像的组件才允许复制（不变成通用搬运后门）。
	if !SupportsImageCopy(opt.ID) {
		fmt.Fprintln(os.Stderr, "ERROR: 该组件不使用离线镜像，拒绝复制")
		return 1
	}
	if strings.EqualFold(srcName, dstName) {
		fmt.Fprintln(os.Stderr, "ERROR: 来源服务器与目标服务器是同一台，拒绝复制")
		return 1
	}
	if src.Host == dst.Host && src.Port == dst.Port {
		fmt.Fprintln(os.Stderr, "ERROR: 来源与目标指向同一主机（"+src.Host+"），拒绝复制")
		return 1
	}

	fmt.Println("")
	fmt.Println("========== MinIO 镜像复制（源机 → 目标机） ==========")
	fmt.Printf("目标机        ：%s（%s，清单 user=%s）\n", dstName, dst.Host, dst.User)
	fmt.Printf("源机          ：%s（%s:%d，清单 user=%s）\n", srcName, src.Host, src.Port, src.User)

	srcImgs := listSourceImages(ctx, src, srcName)
	if !srcImgs.Collected {
		fmt.Fprintln(os.Stderr, "ERROR: 源机镜像清单没查出来（不推断成「没有镜像」）："+srcImgs.Error)
		return 1
	}
	ref, err := pickSourceImage(srcImgs.Images, opt.ImageRef)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		if len(srcImgs.Images) > 0 {
			fmt.Fprintln(os.Stderr, "源机候选镜像：")
			for _, img := range srcImgs.Images {
				fmt.Fprintf(os.Stderr, "  %s (%s)\n", img.Reference, img.Size)
			}
		}
		return 1
	}
	fmt.Printf("源机 docker   ：%s\n", map[bool]string{true: "经免密 sudo 提权（清单 user 不在 docker 组）", false: "清单 user 直接可用"}[srcImgs.Elevated])
	fmt.Printf("源机镜像      ：%s（本地候选 %d 个，只认源机确实存在的）\n", ref, len(srcImgs.Images))

	dstRoot, err := dockerAccess(ctx, dst)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: 目标机 "+err.Error())
		return 1
	}
	fmt.Printf("目标机 docker ：%s\n", map[bool]string{true: "经 sudo 提权", false: "清单 user 直接可用"}[dstRoot])
	fmt.Printf("传输大小参考  ：%s（上限 2 GiB，超了就地中断）\n", sourceImageSize(srcImgs.Images, ref))
	fmt.Println("将执行        ：源机 docker save → 本机 pipe 中转（不落盘）→ 目标机 0600 临时 tar →")
	fmt.Println("                docker load → 删临时文件 → 回显镜像清单")
	fmt.Println("不做          ：不落本机磁盘、不经镜像仓库、绝不 docker pull、不启动 / 重建容器、")
	fmt.Println("                不删 /data/minio、不改 Docker 引擎 / crontab / backup.env")
	fmt.Println("")

	if opt.DryRun {
		fmt.Println("--dry-run：源 / 目标两侧 docker 与镜像白名单均只读校验通过，未传输、未修改任何远端文件。")
		return 0
	}

	// ---------- 传输：源机 save 的 stdout 直接喂进目标机的 stdin ----------
	upStart := time.Now()
	outcome, err := streamSaveToLoad(ctx, src, dst, srcImgs.Elevated, dstRoot, ref)
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR: "+err.Error())
		_, _ = dst.Stream(ctx, "rm -f "+shared.ShQuote(remoteCopyTarPath), false, nil)
		return 1
	}
	fmt.Printf("==> 已传输 %.1f MB（耗时 %.1fs），目标机 docker load 完成\n",
		float64(outcome.bytes)/(1<<20), time.Since(upStart).Seconds())

	fmt.Println("==> 复核目标机 MinIO 镜像")
	after := listSourceImages(ctx, dst, dstName)
	if !after.Collected {
		fmt.Println("WARN: 复核体检没采到镜像清单（不推断结果）：" + after.Error)
	} else {
		for _, img := range after.Images {
			fmt.Printf("  %s (%s)\n", img.Reference, img.Size)
		}
	}
	printRecheck(ctx, dst, scripts, dstName)
	fmt.Println("==> 复制完成。接下来可以装 MinIO（用已导入镜像）或更新容器镜像。")
	return 0
}

// saveOutcome 记下这次中转实际搬了多少字节，日志里给人一个可核对的数字。
type saveOutcome struct {
	bytes int64
}

// streamSaveToLoad 做真正的传输。两侧任一失败都立刻关掉管道，
// 目标机临时 tar 由调用方统一清理（含失败路径）。
func streamSaveToLoad(
	ctx context.Context,
	src, dst *shared.SSHTarget,
	srcRoot, dstRoot bool,
	ref string,
) (saveOutcome, error) {
	pr, pw := io.Pipe()
	saveDone := make(chan error, 1)
	go func() {
		code, err := src.StreamTo(ctx, "docker save "+shared.ShQuote(ref), srcRoot, pw)
		if err == nil && code != 0 {
			err = fmt.Errorf("源机 docker save 退出码 %d", code)
		}
		_ = pw.CloseWithError(err)
		saveDone <- err
	}()

	capped := &cappedReader{r: pr, max: maxImageTarBytes}
	uploadCmd := "umask 077; cat > " + shared.ShQuote(remoteCopyTarPath) +
		" && chmod 600 " + shared.ShQuote(remoteCopyTarPath)
	code, err := dst.Stream(ctx, uploadCmd, false, capped)
	// 不管成功失败都让源机那条连接收尾，否则 goroutine 会挂在管道上。
	_ = pr.CloseWithError(errors.New("目标机上传结束"))
	saveErr := <-saveDone

	if err != nil {
		return saveOutcome{}, fmt.Errorf("写目标机临时文件失败：%w", err)
	}
	if code != 0 {
		return saveOutcome{}, fmt.Errorf("写目标机临时文件失败（退出码 %d）", code)
	}
	if saveErr != nil {
		return saveOutcome{}, saveErr
	}

	fmt.Println("==> 目标机 docker load（读临时文件，stdin 留给 sudo 密码）")
	code, err = dst.Stream(ctx, "docker load -i "+shared.ShQuote(remoteCopyTarPath), dstRoot, nil)
	_, _ = dst.Stream(ctx, "rm -f "+shared.ShQuote(remoteCopyTarPath), false, nil)
	if err != nil {
		return saveOutcome{}, fmt.Errorf("docker load 执行失败：%w", err)
	}
	if code != 0 {
		return saveOutcome{}, fmt.Errorf("docker load 退出码 %d（临时 tar 已清理，可重试）", code)
	}
	return saveOutcome{bytes: capped.n}, nil
}

// cappedReader 一边转发一边计数，超过上限就报错中断（不写满 /tmp 再失败）。
type cappedReader struct {
	r   io.Reader
	n   int64
	max int64
}

func (c *cappedReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	if c.n > c.max {
		return n, fmt.Errorf("镜像流超过 %d MiB 上限，已中断传输", c.max>>20)
	}
	return n, err
}

func sourceImageSize(images []ImageInfo, ref string) string {
	for _, img := range images {
		if img.Reference == ref {
			return valueOr(img.Size, "未知")
		}
	}
	return "未知"
}

// printSourceImages 是 `ops component images` 的人类可读输出（只读）。
func printSourceImages(res SourceImages) {
	fmt.Println("")
	fmt.Printf("========== MinIO 镜像清单（只读）%s ==========\n", res.Server)
	if !res.Collected {
		fmt.Println("ERROR: " + res.Error)
		fmt.Println("（查不动时是「未知」，不是「这台机器没有镜像」）")
		return
	}
	fmt.Printf("docker 权限   ：%s\n",
		map[bool]string{true: "经免密 sudo 提权", false: "清单 user 直接可用"}[res.Elevated])
	if len(res.Images) == 0 {
		fmt.Println("本地没有名字里带 minio 的镜像")
		return
	}
	for _, img := range res.Images {
		fmt.Printf("  %-52s %-10s %s\n", img.Reference, img.Size, img.Created)
	}
	fmt.Println("")
	fmt.Println("复制到别的机器：ops component image-copy minio --server <目标> --from-server " + res.Server)
}
