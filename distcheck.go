package main

import (
	"fmt"
	"io/fs"
	"os"
)

// __dist-check 是给 启动运维.cmd 用的内部自检：判断**这个二进制里**有没有前端页面。
//
// 为什么不能只看磁盘上的 web/dist：产物不进 Git（dist 里只有 .gitkeep），而一台新电脑
// 上的 ops.exe 可能是「前端构建之前」编出来的 —— 那时磁盘 dist 可能已经有了、
// exe 里却还是空的，界面只会回一页「前端未构建」。要判的是二进制，不是目录。
//
// 🔴 刻意不进 commandHandler：它不该出现在 usage / 菜单的能力探测里，也不该被人手敲。
// 只回一个退出码，不做任何写操作；启动器据此决定要不要重新 go build。
const distCheckCommand = "__dist-check"

func cmdDistCheck() int {
	if !embeddedWebOK(webDist) {
		// stderr 留给可见窗口：启动器把 stdout 丢掉了，但这条要让人看见。
		fmt.Fprintln(os.Stderr, "[ops] 这个 ops.exe 里没有前端页面，正在自动重新编译一次…")
		return 1
	}
	return 0
}

// embeddedWebOK 要求 index.html 与 assets/ 里至少一个文件都在。
// 只有 index.html 而没有 js 会渲染成一个空白页 —— 那比明确报错更难查。
func embeddedWebOK(fsys fs.FS) bool {
	if fsys == nil {
		return false
	}
	b, err := fs.ReadFile(fsys, "web/dist/index.html")
	if err != nil || len(b) == 0 {
		return false
	}
	entries, err := fs.ReadDir(fsys, "web/dist/assets")
	if err != nil {
		return false
	}
	for _, e := range entries {
		if !e.IsDir() {
			return true
		}
	}
	return false
}
