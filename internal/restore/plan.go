package restore

// 动作计划：只读预演阶段下发给界面（也打印给 CLI）。
//
// 🔴 判定全在 Go 侧：available / 全局 blockers / 候选行 row_blockers 一次下发，
//    前端只渲染；换选中行 = **重新请求一次计划**，不许前端重算（分册 §5.0 R3）。
// 🔴 首行必须是恢复目标回显：数据写到生产端，而 --server 选的是备份机 ——
//    方向写反是这条链路最贵的事故（R2）。
// 🔴 预演不是执行凭证：服务端每次写动作前自己再跑一遍 --dry-run（R4）。
// 🔴 报告只报脚本结果：Flyway / 应用健康是人工步骤，计划里不承诺「服务正常」（R5）。

import (
	"fmt"
	"path"
	"strings"
)

type PlanRequest struct {
	Server        string
	Component     string
	CandidateID   string
	DB            string
	CronConfirmed bool
	Busy          bool
}

const planNote = "界面「预演」只是给人看的只读结果，不是执行凭证；服务端每次写动作前都会自己再跑一遍 --dry-run，" +
	"前端拿不到也传不了「预演通过」令牌。恢复不提权、不收 sudo 密码、不读 crontab、不自动重试或清场。"

func BuildPlan(s Snapshot, req PlanRequest) Plan {
	p := Plan{
		Server:        req.Server,
		Component:     req.Component,
		CandidateID:   req.CandidateID,
		DB:            req.DB,
		Collected:     s.Collected,
		Busy:          req.Busy,
		CronConfirmed: req.CronConfirmed,
		Impact:        []string{},
		Blockers:      []string{},
		Warnings:      []string{},
		Commands:      []string{},
		RowBlockers:   []string{},
		Note:          planNote,
	}
	if p.DB == "" {
		p.DB = DefaultTestDB
	}
	if !ValidComponent(req.Component) {
		p.Blockers = append(p.Blockers, "未知组件（可选 pg / minio）")
		p.Target = NotCollected
		return p
	}

	// ---- 首行：恢复目标（哪台生产端 / 哪个库或桶）----
	if req.Component == CompPG {
		p.Target = fmt.Sprintf("恢复目标：主服务器 %s:%s 上 PG 容器 %s 的库 %s（由备份机 %s 的 backup.env 决定，不由清单另选）",
			s.PGHost, s.PGPort, s.PGContainer, p.DB, s.Server)
	} else {
		p.Target = fmt.Sprintf("恢复目标：生产端 MinIO %s 的桶 %s（由备份机 %s 的 backup.env 决定，不由清单另选）；来源是备份端 %s 的 %s<桶名>",
			s.SrcURL, s.SrcBuckets, s.Server, s.DestURL, s.DestPrefix)
	}
	p.Impact = append(p.Impact, p.Target)

	// ---- 全局阻塞：采集事实 + 人的前置声明，不含 crontab 探测 ----
	p.Blockers = append(p.Blockers, s.Blockers...)
	if !s.Collected {
		p.Blockers = append(p.Blockers, "候选 collected=false：数值一律显示 —，修好连接后点「刷新候选」，失败结果不缓存")
	}
	if !req.CronConfirmed {
		p.Blockers = append(p.Blockers, "尚未确认已停定时备份：这是人的前置声明（§3.0 第 5 条），工具不读 crontab、不自动停任务；在页面勾选后才放行")
	}
	if req.Busy {
		p.Blockers = append(p.Blockers, "已有备份任务在运行（409）：恢复与备份 / 部署 / 装依赖 / 重启共用一把任务锁，等它结束再试")
	}

	// ---- 选中行：查表，不接收任意路径 ----
	var cand Candidate
	found := false
	if req.CandidateID == "" {
		p.Blockers = append(p.Blockers, "请先选中一行恢复点（一次只恢复一个组件、一个候选）")
	} else if !ValidCandidateID(req.CandidateID) {
		p.Blockers = append(p.Blockers, "候选 ID 不合法：只认备份根目录下本次采集到的相对路径 / 桶名，不接收任意路径")
	} else {
		cand, found = s.CandidateByID(req.CandidateID)
		if !found {
			p.Blockers = append(p.Blockers, "选中的恢复点不在本次采集里（可能已被清理）：点「刷新候选」重新取一次，再重新取计划")
		} else {
			p.RowBlockers = append(p.RowBlockers, cand.RowBlockers...)
			if !cand.Selectable {
				p.Blockers = append(p.Blockers, "选中的恢复点不可用："+strings.Join(cand.RowBlockers, "；")+
					"。改选一行合格的恢复点会重新取一次计划，工具不把「脚本只警告跳过」当校验通过")
			}
		}
	}

	// 离线 / 没配好：不把空字段拼成「恢复源：备份机 bk 的 （，，校验和 、归档 ）」
	// 这种看不懂的影响清单。计划仍是一份**完整**响应，只是影响项说清「先修连接」。
	if !s.Collected {
		p.Impact = append(p.Impact,
			"没采到备份机快照（collected=false）：候选与恢复目标字段一律显示 —，不用 0 兜底；先修好连接 / 配置再点「刷新候选」",
			"恢复是「补齐 + 覆盖」，不是精确回滚；多余对象保留、由人比对",
			"不读 / 不改 crontab、不自动重试或清场；报告只报脚本结果，不承诺应用可用",
		)
		p.Commands = []string{
			fmt.Sprintf("ops restore list --server %s --component %s   # 只读候选（修好连接后重试）", req.Server, req.Component),
			"GET /api/restore/candidates → GET /api/restore/plan   # 换选中行重新取一次计划",
			"ops restore run ...   # 正式执行必须过门禁；服务端先跑 --dry-run（本次不执行）",
		}
		p.Warnings = append(p.Warnings, planNote)
		p.Available = false
		return p
	}

	if req.Component == CompPG {
		buildPGPlan(&p, s, cand, found)
	} else {
		buildMinioPlan(&p, s, cand, found)
	}

	p.Warnings = append(p.Warnings, s.Warnings...)
	p.Available = len(p.Blockers) == 0
	return p
}

func buildPGPlan(p *Plan, s Snapshot, c Candidate, found bool) {
	if !ValidDB(p.DB) {
		p.Blockers = append(p.Blockers, "目标库名不合法：只认 [A-Za-z_][A-Za-z0-9_]{0,62}；默认建议 restore_test")
	}
	if p.DB != DefaultTestDB || p.DB == s.PGDB {
		p.Warnings = append(p.Warnings, fmt.Sprintf("目标库 %s 不是临时库 restore_test：执行弹窗必须额外勾「我确认覆盖生产」。先恢复到临时库验证，再考虑生产库。", p.DB))
	}
	if found && c.SizeBytes > 0 && s.DiskFreeKB != nil && *s.DiskFreeKB > 0 &&
		c.SizeBytes*3 > *s.DiskFreeKB*1024 {
		p.Blockers = append(p.Blockers, fmt.Sprintf("备份端磁盘不足：.dump 会同时占备份端、主服务器 /tmp、容器内 /tmp 三份，需要约 %s，当前可用 %s；工具不自动清理空间",
			humanBytes(c.SizeBytes*3), humanBytes(*s.DiskFreeKB*1024)))
	}
	p.Impact = append(p.Impact,
		fmt.Sprintf("恢复源：备份机 %s 的 %s（%s，%s，校验和 %s、归档 %s）", s.Server, c.Label, c.Grade, c.Size, c.Checksum, c.Archive),
		"先恢复同目录最新的 globals_*.sql（stdin → psql -d postgres），再恢复业务库（--clean --if-exists --no-owner -j "+orDash(s.PGJobs)+"）",
		"生产端多出来的表 / 对象保留：--clean 只清 dump 里存在的对象，不是精确回滚；工具不自动删除",
		"失败不自动重试、不自动清场（可能留下宿主机 / 容器 /tmp 的 dump）、不改 last_success.txt 心跳",
	)
	p.Warnings = append(p.Warnings,
		"Flyway 单向：旧 dump 的 schema 落后于当前镜像时应用可能起不来，需前向修复；工具不判断应用是否可用（硬约束 7）",
		"pg_restore.sh 内二次确认（输入目标库名）由工具按已通过的门禁喂 stdin；工具不改写脚本逻辑",
	)
	remote := path.Join(s.PGRoot, c.ID)
	if !safeRemotePath(s.PGRoot) {
		remote = "<备份根目录未配好，拒绝拼接>"
	}
	p.Commands = []string{
		fmt.Sprintf("ops restore list --server %s --component pg   # 只读候选（本次已实现）", p.Server),
		fmt.Sprintf("ops restore plan --server %s --component pg --candidate %s --db %s --dry-run   # 只读预演：pg_restore -l", p.Server, c.ID, p.DB),
		fmt.Sprintf("远端：pg_restore -l %s | head -n 12   # 只读归档检查，不写生产端", remote),
		fmt.Sprintf("远端：bash <部署目录>/postgres/pg_restore.sh --file %s --db %s   # 复用已部署脚本", remote, p.DB),
	}
}

func buildMinioPlan(p *Plan, s Snapshot, c Candidate, found bool) {
	buckets := strings.Fields(s.SrcBuckets)
	p.Impact = append(p.Impact,
		fmt.Sprintf("选中桶对：备份端 %s → 生产端 %s（核对用；执行范围见下一条）", c.Label, c.Target),
		fmt.Sprintf("🔴 minio_restore.sh 固定按 backup.env 的 SRC_BUCKETS 逐桶恢复全部 %d 个桶；工具不改写脚本、不按单个桶筛选。选中行用于核对目标与预演范围", len(buckets)),
		"方向：备份端 DEST_* → 生产端 SRC_*；逐桶 mc mirror --overwrite，同名对象被覆盖、多余对象保留（不带 --remove）",
		"生产端桶不存在会创建；失败桶逐项汇总；不自动重试、不自动清场",
	)
	p.Warnings = append(p.Warnings,
		"工具不连生产端 / 备份端 MinIO、不写 ~/.mc：对象数与最近同步不采集（显示 —），也不在只读预演里跑 mc mirror --dry-run（那需要持有生产端凭证并写 alias）",
		"恢复脚本里「已暂停定时备份」只是提示、不校验 crontab；这一步由人在 §3.0 前置清单里确认",
		"恢复不是精确回滚：生产端在恢复点之后新建的对象会原样保留，需人工比对处理",
	)
	p.Commands = []string{
		fmt.Sprintf("ops restore list --server %s --component minio   # 只读桶对（本次已实现）", p.Server),
		fmt.Sprintf("ops restore plan --server %s --component minio --candidate %s --dry-run   # 只读预演：脚本 / 桶对 / 方向核对", p.Server, c.ID),
		"只读预演只检查脚本、mc 命令与桶对清单，不连生产端、不调用 mc mirror --dry-run",
		"远端：bash <部署目录>/minio/minio_restore.sh   # 复用已部署脚本，由工具喂 YES + 定时备份提示的回车",
	}
}
