package restore

// 执行门禁：界面弹窗里做的每一件事，CLI（也就是服务端）都逐字再验一次。
//
// 🔴 三项前置是**人的声明，不是工具验证**：工具不因此去读 crontab 或探活应用（R4）。
// 🔴 PG 目标库名输两次并逐字比对；默认 restore_test，覆盖生产要额外勾。
// 🔴 MinIO 必须输入 YES（与 minio_restore.sh 一致）并勾覆盖生产。
// 🔴 恢复不提权：Password 非空直接拒绝，弹窗没有 sudo 密码框。
// 🔴 候选必须来自**本次采集**且 selectable；路径永远由服务端拼（R2 / R3）。

import (
	"errors"
	"fmt"
	"strings"
)

// ValidateGateLiterals 是不连远端的纯字面量校验，供界面 HTTP 层先挡一道；
// 完整校验（查表 / 计划可用）在 ValidateGate，正式执行前由 CLI 再跑一次。
func ValidateGateLiterals(g Gate) error {
	if !ValidComponent(g.Component) {
		return errors.New("未知组件（可选 pg / minio）")
	}
	if g.Password != "" {
		return errors.New("恢复不提权，不接受 sudo 密码")
	}
	if g.Confirm != "yes" {
		return errors.New("请输入 yes 确认（confirm=yes）")
	}
	if !ValidCandidateID(g.CandidateID) {
		return errors.New("候选 ID 不合法：只认备份根目录下本次采集到的相对路径 / 桶名")
	}
	if g.Component == CompPG {
		if !ValidDB(g.DB) || !ValidDB(g.DB2) {
			return errors.New("目标库名不合法（只认字母 / 数字 / 下划线，长度 1..63）")
		}
		if g.DB != g.DB2 {
			return errors.New("两次输入的目标库名不一致")
		}
	} else if g.MinioConfirm != "YES" {
		return errors.New("MinIO 恢复请输入 YES 确认覆盖生产端同名对象")
	}
	return nil
}

// ValidateGate 是正式执行的最后一道门：s 必须是**刚刚重新采集**的快照，
// plan 必须是由它算出来的计划。失败一律返回中文原因，不写生产端。
func ValidateGate(g Gate, s Snapshot, plan Plan) error {
	if err := ValidateGateLiterals(g); err != nil {
		return err
	}
	if g.Component == CompMinio && len(g.MinioConfirm) > 0 && g.MinioConfirm != "YES" {
		return errors.New("MinIO 确认串不是 YES")
	}
	for i, ok := range g.Checks {
		if !ok {
			names := []string{"已停写", "已停定时备份", "已留可反悔的现场"}
			return fmt.Errorf("三项前置确认没有勾全（缺「%s」）；这是人的声明，工具不会替你验证", names[i])
		}
	}
	if !g.CronConfirmed {
		return errors.New("未确认已停定时备份：工具不读 crontab、不自动停任务，请人在页面显式勾选")
	}
	if !s.Collected {
		return errors.New("没采到备份机快照（collected=false）：先修好连接 / 配置再执行，不使用缓存的候选")
	}
	if !plan.Available {
		return fmt.Errorf("动作计划尚有全局阻塞，拒绝执行：%s", strings.Join(plan.Blockers, "；"))
	}
	c, ok := s.CandidateByID(g.CandidateID)
	if !ok {
		return errors.New("候选不在本次采集里：点「刷新候选」重新取一次，接口不接受任意路径")
	}
	if !c.Selectable {
		return fmt.Errorf("候选行不可选：%s", strings.Join(c.RowBlockers, "；"))
	}
	if s.Component != g.Component {
		return errors.New("组件与本次采集不一致，请重新取计划")
	}
	if g.Component == CompPG {
		if (g.DB != DefaultTestDB || g.DB == s.PGDB) && !g.CoverProduction {
			return fmt.Errorf("目标库 %s 不是临时库（或与生产库同名）：必须额外勾「我确认覆盖生产」", g.DB)
		}
	} else if !g.CoverProduction {
		return errors.New("MinIO 恢复会覆盖生产端同名对象：必须额外勾「我确认覆盖生产」")
	}
	return nil
}
