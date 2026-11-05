module pass-up/ops

// 独立 module，只依赖标准库。
// 与后端无关：所有动作都发生在本机，经 ssh 到备份服务器只读查询。
go 1.24
