package monitor

// CLI（ops status）与网页（GET /api/monitor/status）共用的采集入口。
//
// 🔴 两处只走这一条链路：清单选机 → StatusSSHTarget（清单里的 user/key）→ Collect。
//    2026-11-08 起不再单设只读账号：账号只有 servers.json 一个事实源。
//    「只读」由远端脚本保证（不写文件、不提权），target 不带 sudo 密码。
// 🔴 配置错也返回一份**完整快照**（connection.ok=false + danger），
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
	t := srv.StatusSSHTarget()
	// host 只展示 user@host:port，不带私钥路径，也不带 sudo 密码。
	host := fmt.Sprintf("%s@%s:%d", t.User, t.Host, t.Port)
	return Collect(ctx, t, ConfigFrom(cfg), host), nil
}

// configFailure 把「没配好」做成一份完整快照 + 一个错误，供两个调用方各自呈现。
func configFailure(host, reason string) (Status, error) {
	msg := connectionError(errors.New(reason))
	return FailureStatus(host, msg), errors.New(msg)
}
