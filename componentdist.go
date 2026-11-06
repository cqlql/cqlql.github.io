package main

import "embed"

// componentScripts 是环境组件脚本树（deploy/component）。
//
// 与 backupdist.go 同理：`//go:embed` 的路径不能出现 `..`，所以嵌 deploy/component
// 的 Go 文件必须放在仓库根（package main），再由 main 注入给 internal/component。
//
// 🔴 这里同样**不许出现任何真实凭证**：整目录会编进 exe。
// Docker 安装不需要凭证；MinIO 的 root 凭证只从本机 backup/minio.env
// 运行时注入到上传脚本头部，绝不落到 deploy/component 里（见 docs/components.md §4）。
//
// 🔴 改了 deploy/component/** 必须重新 `go build`：脚本是编进二进制的。
//
//go:embed all:deploy/component
var componentScripts embed.FS
