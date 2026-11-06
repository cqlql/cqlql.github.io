// Package restart 管「让 ops ui 换掉自己、重新起来」的**机制**。
//
// 它服务的是开发时那条循环：改 Go / 改前端 / 改 deploy/backup → 重新构建 → 重启。
// 手工做是四步（cd web && npm test && npm run typecheck && npm run build、
// go build -o ops.exe .、关掉界面、重新双击），漏掉任何一步的症状都是
// 「我明明改了，界面怎么没变」——那正是本仓最忌讳的「看起来正常」。
//
// ⚠️ Windows 上没有 exec(2)。进程能做的只有「**自己退出，让另一个进程接手**」，
// 于是两件事必须显式做掉，否则重启就是假的：
//
//  1. **监听地址要先被让出来**（WaitPortFree）。新进程要绑同一个端口才能被浏览器
//     找到；判据是「这个地址能绑上了」，不是「某个 PID 消失了」。
//  2. **新进程不能还挂在原来的控制台上**（Spawn 的 DETACHED_PROCESS + 输出重定向）。
//     共享控制台的话，关掉那个窗口会把新服务一起带走；而 detached 之后没有控制台
//     可写，启动失败的原因会**静默丢掉**——所以输出必须接到 ops-ui.log。
//
// ⚠️ 构建产物落在 ops.next.exe，不能直接 `go build -o ops.exe`：正在运行的 exe
//
//	被 Windows 锁着，覆盖它会拿到一句毫无信息量的 sharing violation。
//	接手进程起来之后由 ReplaceBinary 把它换到正式名字上（本机实测：正在运行的
//	exe 是可以改名的）。「从哪个文件起来」与「换到哪个文件」是两个值，别混。
package restart

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	// Subcommand 是「接手进程」用的内部子命令名。
	// 刻意用下划线开头：它不该出现在 usage / README / 菜单里，也不该被人手工敲。
	Subcommand = "__restart"

	// NextExeSuffix 是重建产物相对正式 exe 的后缀。
	NextExeSuffix = ".next.exe"

	// TakeoverFlag 是接手进程交给 CmdUI 的内部标记：同端口、同 token、不新开浏览器。
	TakeoverFlag = "__takeover"

	// PortWaitTimeout 是「等旧进程把端口让出来」的上界。
	PortWaitTimeout = 60 * time.Second

	// BuildTimeout 是每一步构建命令的上界。卡住的构建不该把重启按钮永久锁死。
	BuildTimeout = 300 * time.Second
)

// WaitPortFree 等到 addr 能被绑上，返回「可以接手了」。
//
// 判据是**能绑上**，不是「某个进程没了」：我们要的是端口，不是那个进程的 PID。
// 超时有上界，否则接手进程会永远挂着，而界面上只看得到「页面连不上」。
func WaitPortFree(addr string, timeout time.Duration) error {
	if addr == "" {
		return fmt.Errorf("没给监听地址，无从判断旧进程是否已退出")
	}
	deadline := time.Now().Add(timeout)
	var last error
	for {
		ln, err := net.Listen("tcp", addr)
		if err == nil {
			// 立刻关掉：确认「空出来了」就够了，真正要绑它的是接手进程。
			_ = ln.Close()
			return nil
		}
		last = err
		if time.Now().After(deadline) {
			return fmt.Errorf("等了 %s，旧进程仍占着 %s：%v", timeout, addr, last)
		}
		time.Sleep(200 * time.Millisecond)
	}
}

// Replacement 是「换二进制」这一步的结论。
type Replacement struct {
	// Applied 表示新二进制真的换上去了。
	Applied bool
	// Error 非空表示没换上（**不是致命错误**，调用方应继续用旧二进制起服务）。
	Error error
}

// ReplaceBinary 用 newExe 换掉 targetExe。
//
// ⚠️ 前提是旧进程已经退出（见 WaitPortFree）。
// ⚠️ os.Rename 在 Windows 上是 MoveFileEx(REPLACE_EXISTING)，能覆盖已存在的目标；
// 而**正在运行的 exe 可以改名**，所以接手进程即使正跑在 next.exe 上也能完成这一步。
//
// 换不上**不返回致命错误**：与服务彻底消失相比，「跑的是旧代码」轻得多。
// 但必须如实把错误交给调用方记进日志，不能假装换过了。
func ReplaceBinary(newExe, targetExe string) Replacement {
	if newExe == "" {
		return Replacement{}
	}
	// 同路径必须拒绝：否则 os.Rename 做一次空操作却报成功，正式 exe 永远是旧的。
	if sameFile(newExe, targetExe) {
		return Replacement{Error: fmt.Errorf("新二进制与正式 exe 是同一个文件（%s），换不了 —— "+
			"重建没有生效，服务仍按现有二进制跑", filepath.Base(newExe))}
	}
	if _, err := os.Stat(newExe); err != nil {
		return Replacement{Error: fmt.Errorf("找不到刚构建出来的 %s：%w", newExe, err)}
	}
	if err := os.Rename(newExe, targetExe); err != nil {
		return Replacement{Error: fmt.Errorf("把 %s 换到 %s 失败：%w", filepath.Base(newExe), targetExe, err)}
	}
	return Replacement{Applied: true}
}

func sameFile(a, b string) bool {
	if a == "" || b == "" {
		return false
	}
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

// TargetExe 是**正式** exe 的绝对路径（「下次手工启动该跑的那个」）。
//
// ⚠️ 必须走 NormalizeExePath：Windows 上 os.Executable() 返回的是**进程映像加载时**
// 的路径。一个「从 ops.next.exe 起来、之后被改名成 ops.exe」的进程，它仍然返回
// ops.next.exe —— 而那个路径已经不存在了。直接用它的后果是：下一次不重建的重启
// 从一个不存在的文件起（报错看起来像「文件被删了」）；带重建的重启则因为
// targetExe == newExe 被 ReplaceBinary 拒绝，正式 exe 永远停在旧版本。
func TargetExe() (string, error) {
	p, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("拿不到本进程的可执行文件路径：%w", err)
	}
	return NormalizeExePath(p), nil
}

// NormalizeExePath 把 ops.next.exe 规范成 ops.exe（其它路径原样返回）。
// 判据是**文件名后缀**，不是「文件在不在」：改名之后两个路径都可能不存在，
// 靠探测文件只会得到时好时坏的结果。
func NormalizeExePath(p string) string {
	if p == "" {
		return ""
	}
	base := filepath.Base(p)
	if !strings.HasSuffix(strings.ToLower(base), NextExeSuffix) {
		return p
	}
	return filepath.Join(filepath.Dir(p), base[:len(base)-len(NextExeSuffix)]+".exe")
}

// NextExeFor 返回「重建产物」的路径：与正式 exe 同目录、同名字干。
func NextExeFor(targetExe string) string {
	dir := filepath.Dir(targetExe)
	base := filepath.Base(targetExe)
	stem := strings.TrimSuffix(base, filepath.Ext(base))
	return filepath.Join(dir, stem+NextExeSuffix)
}

// SourceRoot 是源码目录。本仓约定 ops.exe 就在仓根（启动运维.cmd 按 %~dp0 定位），
// 所以 exe 所在目录就是源码根；拿不到时重建必须如实失败，不去猜一个位置。
func SourceRoot(targetExe string) string { return filepath.Dir(targetExe) }

// TailLines 只留最后 n 行。构建输出可能几百行，而它要进 HTTP 响应与日志；
// 保留末尾是因为失败原因总在最后。
func TailLines(s string, n int) string {
	lines := strings.Split(strings.TrimRight(s, "\n"), "\n")
	if len(lines) > n {
		lines = append([]string{fmt.Sprintf("…（省略前 %d 行）", len(lines)-n)}, lines[len(lines)-n:]...)
	}
	return strings.Join(lines, "\n")
}
