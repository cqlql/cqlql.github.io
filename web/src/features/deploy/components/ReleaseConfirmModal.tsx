import { Alert, Checkbox, Input, Modal, Space, Tag, Typography } from 'antd'

import { CONFIRM_ITEMS } from '../types.ts'
import type { DeployBump, DeployPlan } from '../types.ts'
import { bumpLabel, confirmEnabled, scopeLabel } from '../utils/format.ts'

/**
 * 正式发布的二次确认（门 2）。
 * 🔴 弹窗里**没有 sudo 密码框**：沿用 P0 清单 user/key + 免密 sudo -n，
 *    确需一次性密码也只经 stdin（deploy.md §10.3）。
 * 🔴 yes + 三项勾选只是前端提示，服务端逐字再验；授权只对当次任务有效，
 *    不落盘、不缓存（§11.10 结论 1）。
 */
export interface ReleaseConfirmModalProps {
  open: boolean
  plan: DeployPlan
  online: string
  version: string
  note: string
  bump: DeployBump
  yes: string
  checks: boolean[]
  submitting: boolean
  onYes: (v: string) => void
  onChecks: (i: number, v: boolean) => void
  onCancel: () => void
  onSubmit: () => void
}

export function ReleaseConfirmModal({
  open, plan, online, version, note, bump, yes, checks, submitting,
  onYes, onChecks, onCancel, onSubmit,
}: ReleaseConfirmModalProps) {
  const canSubmit = confirmEnabled(yes, checks) && !submitting
  return (
    <Modal
      open={open}
      title="确认正式发布（会直接改现网）"
      okText="确认发布"
      cancelText="取消"
      okButtonProps={{ danger: true, disabled: !canSubmit, loading: submitting }}
      onOk={onSubmit}
      onCancel={onCancel}
      maskClosable={false}
      width={640}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="点确认就是改现网，不是上传到平台等审核"
        description={
          <Space direction="vertical" size={2}>
            <span>目标机：<b>{plan.server || '—'}</b>（{plan.host}） · 范围：{scopeLabel(plan.scope)}</span>
            <span>线上 <b>{online || '未采集'}</b> → 本次 <b>{version}</b>（{bumpLabel(bump)}）</span>
            <span>项目备注：{note || '（无）'}</span>
            <span>发版号只是人读元信息，不是镜像 tag；备注不写远端、不拼进命令。</span>
          </Space>
        }
      />
      <Typography.Text type="secondary">将影响：</Typography.Text>
      <ul className="once-command-list" style={{ marginTop: 6 }}>
        {plan.impact.length === 0
          ? <li>只读预演没下发影响清单；请重新预演。</li>
          : plan.impact.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '12px 0' }}>
        {CONFIRM_ITEMS.map((text, i) => (
          <Checkbox
            key={text}
            checked={checks[i] === true}
            onChange={(e) => onChecks(i, e.target.checked)}
            disabled={submitting}
          >
            {text}
          </Checkbox>
        ))}
      </div>
      <p className="hint">请输入 <code>yes</code> 确认（与 CLI 的 --confirm yes 同源，服务端还会再验一次）：</p>
      <Input
        value={yes}
        onChange={(e) => onYes(e.target.value)}
        onPressEnter={canSubmit ? onSubmit : undefined}
        disabled={submitting}
        autoFocus
        autoComplete="off"
        placeholder="yes"
      />
      <p className="hint" style={{ marginTop: 12 }}>
        🔴 服务端会在每次写动作前自己再跑一遍只读预检；预演通过 ≠ 可以发布。
        发布失败停在当前阶段、如实报告、保留现场，<b>健康门失败不自动回滚</b>（rollback 属 P4）。
        台账只在任务结束时 append 一条；进程被 kill / 断电会丢一次尝试，不猜、不补写。
      </p>
      <Tag color="default" style={{ marginTop: 6 }}>本次授权只在当次任务有效</Tag>
    </Modal>
  )
}
