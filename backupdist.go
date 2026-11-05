package main

import "embed"

// backupScripts 是备份脚本树（deploy/backup）。
//
// 为什么在仓库根的 package main 里：`//go:embed` 的路径**不能出现 `..`**，
// 所以嵌 `deploy/backup` 的 Go 文件必须与 `deploy/` 同级。与 webdist.go 同一套路，
// `backup.CmdBackup(args, scripts fs.FS)` 接收它 —— internal/backup 只认 fs.FS，
// 测试可以塞 fstest.MapFS，不必依赖仓库里到底有什么文件。
//
// 🔴 deploy/backup 里**不许出现任何真实凭证**（backup.env / sync.env / *.log）。
// 本机已填好的配置放在配置目录的 backup/{postgres,minio}.env（见 docs/config.md），
// 由 ops 在打包时以 0600 单独注入，绝不进二进制。
// internal/backup 的 TestEmbeddedScriptsHaveNoCredentials 就是这条红线的守门人。
//
// 🔴 改了 deploy/backup/** 必须重新 `go build` 才生效：脚本是编进二进制的，
// 只跑旧 exe 部署出去的还是旧脚本（与「改了 web/ 必须 npm run build」同理）。
//
//go:embed all:deploy/backup
var backupScripts embed.FS
