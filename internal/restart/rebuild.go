package restart

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// ---------------------------------------------------------------------------
// 重建：npm test → typecheck → build → go build -o ops.next.exe .
// ---------------------------------------------------------------------------
//
// ⚠️ 顺序是「前端 → Go」，因为 Go 把 web/dist 与 deploy/backup 一起 embed 进二进制；
// 反过来做等于编出一个嵌着旧页面的二进制 —— 最难自己发现的一种过期。
//
// ⚠️ npm 只在**前端真的过期**（或 node_modules 不在）时才跑。每次都跑会白等
// 30~40 秒，而那种代价会让人干脆不点重启；所以让事实（Check 的结论）决定。
// 但一旦判定前端过期，`npm test` / `npm run typecheck` 两步一个都不能少：
// `test/` 故意不在 tsconfig 的 include 里，类型错误只能靠跑一遍发现。

// Result 是「重建做了什么」的结论。
type Result struct {
	// NewExe 是构建产物（= <root>/ops.next.exe）；由接手进程换到正式 exe 上。
	NewExe string
	// WebBuilt / GoBuilt 记录**实际跑了哪几步**，不是「应该跑哪几步」。
	WebBuilt bool
	GoBuilt  bool
	// Output 是合并后的构建输出（进 HTTP 响应与日志）。
	Output string
}

// 三个包级变量**只为可测**：真实构建要几十秒，而单测要守的是
// 「顺序对不对、失败时停没停」，不是「vite 能不能构建成功」。
var (
	runBuild = run
	findNpm  = lookNpm
	findGo   = lookGo
)

// Rebuild 重新构建本程序，返回新二进制的位置。
// 失败时 **调用方必须就地停下、不交接** —— 构建可能产出一个起不来的二进制，
// 而那时已经没有回头路了。
func Rebuild(ctx context.Context, root, targetExe string, logf func(string)) (Result, error) {
	res := Result{NewExe: NextExeFor(targetExe)}

	// 源码必须与 exe 同目录（本仓约定 ops.exe 就在仓根）。拿不到就如实失败：
	// 在一个只有 exe 的目录里「构建成功」是最坏的一种假话。
	for _, f := range []string{"go.mod", filepath.Join("web", "package.json")} {
		if _, err := os.Stat(filepath.Join(root, f)); err != nil {
			return res, fmt.Errorf("源码不在 %s（找不到 %s），没法重建；"+
				"请回到仓库根目录再启动 ops.exe", root, f)
		}
	}

	stale := Check(root, targetExe)
	var out strings.Builder
	step := func(line string) {
		fmt.Fprintln(&out, line)
		if logf != nil {
			logf(line)
		}
	}

	webDir := filepath.Join(root, "web")
	if stale.Web || !dirExists(filepath.Join(webDir, "node_modules")) {
		npm, err := findNpm()
		if err != nil {
			res.Output = tail(out.String())
			return res, err
		}
		if !dirExists(filepath.Join(webDir, "node_modules")) {
			step("[1/5] 装前端依赖：npm install")
			o, err := npmRun(ctx, webDir, npm, "install") // 不是 npm run install
			res.Output = tail(out.String() + o)
			if err != nil {
				return res, fmt.Errorf("npm install 失败：%w\n%s", err, res.Output)
			}
		}
		for _, s := range []struct {
			label, script string
		}{
			{"[2/5] 前端单测：npm test", "test"},
			{"[3/5] 前端类型检查：npm run typecheck", "typecheck"},
			{"[4/5] 构建前端：npm run build（慢机器上 30~40 秒）", "build"},
		} {
			step(s.label)
			o, err := npmRun(ctx, webDir, npm, "run", s.script)
			res.Output = tail(out.String() + o)
			if err != nil {
				return res, fmt.Errorf("npm run %s 失败：%w\n%s", s.script, err, res.Output)
			}
		}
		res.WebBuilt = true
	} else {
		step("前端产物不比源码旧 —— 跳过 npm test / typecheck / build")
	}

	goBin, err := findGo()
	if err != nil {
		res.Output = tail(out.String())
		return res, err
	}
	step(fmt.Sprintf("[5/5] 构建 Go：go build -o %s .", filepath.Base(res.NewExe)))
	// ⚠️ go 这条**直接 exec**，不经 cmd.exe：Go 的 exec 按 CommandLineToArgvW
	// 组装参数，而 cmd.exe 不按那套规则解析，含空格的 go.exe 路径必然坏掉
	// （症状是一句 `'C:\Program' 不是内部或外部命令`，看起来像「go 没装」）。
	o, err := runBuild(ctx, root, goBin, "build", "-o", res.NewExe, ".")
	res.Output = tail(out.String() + o)
	if err != nil {
		return res, fmt.Errorf("go build 失败：%w\n%s", err, res.Output)
	}
	// 回读确认产物：不信转述（「命令没报错」≠「真的产出了新二进制」）。
	if _, err := os.Stat(res.NewExe); err != nil {
		return res, fmt.Errorf("go build 没报错，但产物不在 %s：%w", res.NewExe, err)
	}
	res.GoBuilt = true
	return res, nil
}

// npmRun 只在 Windows 上经 cmd.exe（npm 是 npm.cmd，直接 exec 在各版本 Go 上不稳）。
// `/d` 是「不要执行 AutoRun 命令」——那台机器上注册过的 AutoRun 不该进到一次构建里。
// args 分开传：install 是 `npm install`，其余是 `npm run <script>`，别混成一条。
func npmRun(ctx context.Context, dir, npm string, args ...string) (string, error) {
	if runtime.GOOS == "windows" {
		return runBuild(ctx, dir, "cmd.exe", "/d", "/c", npm+" "+strings.Join(args, " "))
	}
	return runBuild(ctx, dir, npm, args...)
}

// run 跑一条构建命令并合并输出。
// ⚠️ name 与 args 分开传，绝不自己拼命令行字符串（理由见上面的 go 那条）。
func run(ctx context.Context, dir, name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, BuildTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	Hide(cmd) // 构建那几十秒里不该有个黑窗口一直闪
	out, err := cmd.CombinedOutput()
	if ctx.Err() == context.DeadlineExceeded {
		return string(out), fmt.Errorf("超时（%s）", BuildTimeout)
	}
	return string(out), err
}

func lookGo() (string, error) {
	for _, name := range []string{"go.exe", "go"} {
		if p, err := exec.LookPath(name); err == nil {
			return p, nil
		}
	}
	return "", fmt.Errorf("PATH 里找不到 go —— 没法重建。装好 Go 并确保 go.exe 在 PATH 里，" +
		"或者不勾「先重建」，自己在命令行里 go build")
}

func lookNpm() (string, error) {
	if runtime.GOOS == "windows" {
		if _, err := exec.LookPath("npm.cmd"); err == nil {
			return "npm.cmd", nil
		}
	}
	if _, err := exec.LookPath("npm"); err == nil {
		return "npm", nil
	}
	return "", fmt.Errorf("PATH 里找不到 npm —— 没法重建前端。装好 Node.js 后重试，" +
		"或者不勾「先重建」，自己在命令行里 cd web && npm install && npm run build")
}

func tail(s string) string { return TailLines(s, 60) }
