import { Alert, Button, Input, Radio, Space, Tag, Typography } from 'antd'

import { BUMP_OPTIONS } from '../types.ts'
import type { DeployBump, ReleaseEvent } from '../types.ts'
import { bumpLabel, bumpVersion, releaseFormatValid, releaseNoteValid } from '../utils/format.ts'

/**
 * 发版信息（借鉴小程序「上传代码」，deploy.md §10）。
 *
 * 🔴 这里的校验与版本推算只是**前端格式提示**，唯一判据是服务端 ValidateRelease；
 *    线上版本未采集不猜 0 / 1.0.0，也不自动推算（硬约束 3）。
 * 🔴 发版号**不是镜像 tag**（IMAGE_TAG 仍是 git 短 commit）；备注不写远端、
 *    不拼进命令；「上次填写」不自动再 +1。
 */
export interface ReleaseFormProps {
  onlineVersion: string
  version: string
  note: string
  bump: DeployBump
  lastSuccess: ReleaseEvent | null
  disabled: boolean
  onVersion: (v: string) => void
  onNote: (v: string) => void
  onBump: (b: DeployBump) => void
}

export function ReleaseForm({
  onlineVersion, version, note, bump, lastSuccess, disabled,
  onVersion, onNote, onBump,
}: ReleaseFormProps) {
  const online = onlineVersion.trim() || '未采集'
  const collected = releaseFormatValid(online)
  const versionOK = releaseFormatValid(version)
  const noteOK = releaseNoteValid(note)

  const chooseBump = (b: DeployBump) => {
    onBump(b)
    const next = bumpVersion(online, b)
    if (next) onVersion(next)
  }

  const useLast = () => {
    if (!lastSuccess) return
    onVersion(lastSuccess.release_version)
    onNote(lastSuccess.note)
    onBump('manual')
  }

  return (
    <div className="deploy-release-form">
      <div className="deploy-field">
        <span>线上版本号（只读）</span>
        <Space>
          <Tag color={collected ? 'blue' : 'default'}>{collected ? online : '未采集 / 首次发版'}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            远端 state.env 本刀不写；没采到就如实显示，不猜 0
          </Typography.Text>
        </Space>
      </div>

      <div className="deploy-field">
        <span>更新类型</span>
        <Radio.Group
          value={bump || undefined}
          onChange={(e) => chooseBump(e.target.value as DeployBump)}
          disabled={disabled}
          options={BUMP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </div>

      <div className="deploy-field">
        <span>版本号</span>
        <Input
          value={version}
          onChange={(e) => onVersion(e.target.value)}
          disabled={disabled}
          placeholder="1.16.1"
          status={version && !versionOK ? 'error' : undefined}
          style={{ maxWidth: 260 }}
        />
      </div>

      <div className="deploy-field">
        <span>项目备注</span>
        <Input
          value={note}
          onChange={(e) => onNote(e.target.value)}
          disabled={disabled}
          placeholder="修复若干问题（单行、≤200 字）"
          status={note && !noteOK ? 'error' : undefined}
        />
      </div>

      <div className="deploy-field">
        <span>上次填写</span>
        <Space>
          <Button size="small" onClick={useLast} disabled={disabled || !lastSuccess}>
            填入上一次成功发版
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {lastSuccess
              ? `${lastSuccess.release_version} · ${lastSuccess.note || '无备注'}（不自动 +1）`
              : '暂无历史发版'}
          </Typography.Text>
        </Space>
      </div>

      {!collected && bump && bump !== 'manual' && (
        <Alert
          type="info"
          showIcon
          message="线上版本未采集，不自动推算版本号；请手动填三段式版本号。服务端仍会逐字再验。"
          style={{ marginTop: 4 }}
        />
      )}
      {!versionOK && version && (
        <Alert type="warning" showIcon message="发版号必须是三段式（如 1.16.1）；它不是镜像 tag。" style={{ marginTop: 4 }} />
      )}
      {!noteOK && note && (
        <Alert type="warning" showIcon message="备注必须单行、≤200 字、无控制字符；不写远端、不拼进命令。" style={{ marginTop: 4 }} />
      )}
      <p className="hint" style={{ marginTop: 8 }}>
        当前更新类型：{bumpLabel(bump)}。预演不落台账；正式发布才在任务结束时 append 一条。
      </p>
    </div>
  )
}
