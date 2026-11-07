package monitor

// CLI（ops status）与网页（GET /api/monitor/status）共用的采集入口。
//
// 🔴 两处只走这一条链路：清单选机 → 强制专用只读 monitor 账号 → Collect。
//    否则界面很容易「为了省事」复用安装账号 user/key，把只读页变成有 sudo 的入口
//    （AGENTS.md 硬约束 9）。
// 🔴 配置 / 账号错也返回一份**完整快照**（connection.ok=false + danger），
//    err 只表示「本机没配好」：CLI 据此退出 2，界面据此给「去配置页」引导、不缓存。
// 🔴 错误文本统一过 connectionError 脱敏：私钥路径不进 JSON / 日志。

import (
	"pass-up/ops/internal/shared"
)

import (
	"context"
	"errors"
	"fmt"
)

// CollectForServer 做一次只读采集。name 为空时按 CLI 的 Resolve 顺序退化
// （ops.env 默认 > 清单 default > 唯一 role=backup）；界面必须显式给 name，
// 那道门在 internal/ui/monitor.go，不在这里。
func CollectForServer(ctx context.Context, cfg *shared.Config, list *shared.ServerList, name string) (Status, error) {
	srv, err := list.Resolve(name, cfg.DefaultServer)
	if err != nil {
		return configFailure(name, "选择目标机失败："+err.Error())
	}
	t, err := srv.MonitorSSHTarget()
	if err != nil {
		return configFailure(srv.Name, "只读监控账号未配好："+err.Error())
	}
	// host 只展示 user@host:port，不带私钥路径，也不带 sudo 密码。
	host := fmt.Sprintf("%s@%s:%d", t.User, t.Host, t.Port)
	return Collect(ctx, t, ConfigFrom(cfg), host), nil
}

// configFailure 把「没配好」做成一份完整快照 + 一个错误，供两个调用方各自呈现。
func configFailure(host, reason string) (Status, error) {
	msg := connectionError(errors.New(reason))
	return FailureStatus(host, msg), errors.New(msg)
}
