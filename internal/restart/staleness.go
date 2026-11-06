package restart

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// 「二进制 / 前端产物是不是过期了」
// ---------------------------------------------------------------------------
//
// 只服务两件事：「先重建」默认勾不勾，以及这次重建要不要跑 npm。
// 让人记住「改了代码要勾」是不可靠的——忘了的症状是「重启了，怎么还是旧代码」，
// 而那时人已经在怀疑别的东西了。
//
// ⚠️ 本仓比一般 Vite 项目多两处构建输入，漏掉任何一处都是「看起来正常」的过期：
//
//	web/dist/index.html —— 它被 //go:embed 编进 ops.exe，前端重建了但没重编 Go，
//	                       界面看着变了、其实跑的还是旧 Go；
//	deploy/backup/**    —— 备份脚本整目录 embed 进二进制，改了 .sh / .example /
//	                       .logrotate 不重新 go build，部署出去的还是旧脚本。
//
// ⚠️ 判定只有这一份（Rebuild 与 GET /api/restart 共用），不能长出第二套
// 「重启时说要重建、手工构建时说不用」的分叉。

// Stale 是「过期了没有」的结论。
type Stale struct {
	// Web 为真 = 前端需要重建（npm test / typecheck / build）。
	Web bool
	// WebReason 是第一条过期项的相对路径（界面上说「改了：xxx」用）。
	WebReason string
	// Go 为真 = 需要 go build。
	Go bool
	GoReason string
}

func (s Stale) Any() bool { return s.Web || s.Go }

func (s Stale) Reason() string {
	switch {
	case s.Web:
		return s.WebReason
	case s.Go:
		return s.GoReason
	default:
		return ""
	}
}

// Check 判「源码是不是比 exe 新」。
//
// ⚠️ 拿不到基线文件（dist 不存在、exe 不存在）**不是**「不知道」，就是「过期」：
// 没有产物可谈，谈不上新鲜；理由里写明是哪个文件不存在，界面才说得清要重建什么。
func Check(root, exe string) Stale {
	var out Stale
	dist := filepath.Join(root, "web", "dist", "index.html")

	distInfo, err := os.Stat(dist)
	if err != nil {
		out.Web, out.WebReason = true, "web/dist/index.html（不存在）"
	} else if newer, reason := newerThan(root, filepath.Join(root, "web"), distInfo.ModTime(),
		map[string]bool{"node_modules": true, "dist": true, ".git": true},
		func(string, fs.DirEntry) bool { return true }); newer {
		out.Web, out.WebReason = true, reason
	}

	exeInfo, err := os.Stat(exe)
	if err != nil {
		out.Go, out.GoReason = true, filepath.Base(exe)+"（不存在）"
		return out
	}
	if newer, reason := newerThan(root, root, exeInfo.ModTime(),
		map[string]bool{
			"web": true, "node_modules": true, ".git": true,
			".workbuddy-ai": true, ".shots": true, "docs": true,
		}, isGoInput); newer {
		out.Go, out.GoReason = true, reason
	}
	// dist/index.html 与 *.go 一起算「Go 侧的源码」：它被 embed 进二进制。
	if info, err := os.Stat(dist); err == nil && info.ModTime().After(exeInfo.ModTime()) {
		out.Go, out.GoReason = true, "web/dist/index.html"
	}
	return out
}

// isGoInput 回答「这个文件是不是 go build 的输入」。
//
// 白名单而不是黑名单：ops.exe / ops.next.exe / servers.json / 日志这些运行态文件
// 随时会变，把它们算进来的话「先重建」会永远勾着 —— 一个永远为真的告警等于没有告警。
func isGoInput(rel string, d fs.DirEntry) bool {
	if d.IsDir() {
		return false
	}
	name := d.Name()
	switch filepath.Ext(name) {
	case ".go", ".mod", ".sum":
		return true
	}
	// deploy/backup 整目录 embed，脚本与配置模板都算输入；运行态产物不算。
	clean := filepath.ToSlash(rel)
	if strings.HasPrefix(clean, "deploy/backup/") {
		switch name {
		case "backup.env", "sync.env", "last_success.txt":
			return false
		}
		if strings.HasSuffix(name, ".log") {
			return false
		}
		return true
	}
	return false
}

// newerThan 在 base 下找第一个比 t 新的文件。
// prune 掉的目录必须是**构建输入之外**的东西，否则结论永远为真。
func newerThan(root, base string, t time.Time, prune map[string]bool, isInput func(string, fs.DirEntry) bool) (bool, string) {
	found := ""
	_ = filepath.WalkDir(base, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // 读不到就当没有，不让一次权限问题把整个判定变成「不知道」
		}
		if d.IsDir() {
			if path != base && prune[d.Name()] {
				return fs.SkipDir
			}
			return nil
		}
		rel, relErr := filepath.Rel(root, path)
		if relErr != nil {
			rel = path
		}
		rel = filepath.ToSlash(rel)
		if !isInput(rel, d) {
			return nil
		}
		info, err := d.Info()
		if err != nil || !info.ModTime().After(t) {
			return nil
		}
		found = rel
		return fs.SkipAll // 有一条就够了，理由只需要第一条
	})
	return found != "", found
}

func dirExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}

// BuildCommands 是「先重建」实际会跑的命令（给人看的，不是给人执行的）。
// 它与 Rebuild 的顺序一一对应，界面拿它说清「会跑什么」。
func BuildCommands(root string, s Stale) []string {
	out := []string{"go build -o ops.next.exe ."}
	if s.Web || !dirExists(filepath.Join(root, "web", "node_modules")) {
		pre := []string{}
		if !dirExists(filepath.Join(root, "web", "node_modules")) {
			pre = append(pre, "cd web && npm install")
		}
		pre = append(pre, "cd web && npm test", "npm run typecheck", "npm run build")
		out = append(pre, out...)
	}
	return out
}
