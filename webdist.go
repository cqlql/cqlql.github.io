package main

import "embed"

// webDist 是前端构建产物（web/dist）。
//
// 为什么放在仓库根的 package main 里，而不是 internal/ui/：`//go:embed` 的路径
// **不能出现 `..`**，所以嵌 `web/dist` 的 Go 文件必须位于 `web/` 的同级或上级。
// 放在这里还有一个好处：ui 包只接收一个 fs.FS（见 ui.CmdUI），测试可以塞
// fstest.MapFS，不必依赖「前端到底构建了没有」。
//
// 🔴 web/dist 里的真实产物不进 Git，仓库里只有 dist/.gitkeep 保证目录存在 ——
// 目录不存在时 embed 会直接编译失败（pattern all:web/dist: no matching files found）。
// 未构建时二进制仍能编出来，页面会明确说「前端还没构建」，不会白屏。
//
//go:embed all:web/dist
var webDist embed.FS
