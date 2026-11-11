import { Steps, Tag, Typography } from 'antd'

import type { DeployGate, DeployStage } from '../types.ts'
import { antdStepStatus } from '../utils/format.ts'

/**
 * 六阶段条 + 六道门禁结果。
 * 🔴 阶段名与状态全部由 Go 侧下发（deploy.StageNames / deployViewState.snapshot），
 *    前端只做 status → antd status 的翻译，不自己推断「跑到哪一步」。
 */
export function DeployStages({ stages, gates }: { stages: DeployStage[]; gates: DeployGate[] }) {
  if (stages.length === 0) {
    return <p className="hint">还没有阶段状态。阶段名与进度由服务端下发，界面不硬编码。</p>
  }
  return (
    <>
      <Steps
        size="small"
        responsive={false}
        items={stages.map((s) => ({
          title: s.name,
          status: antdStepStatus(s.status),
          description: s.status === 'skip' ? '跳过（显式快路径）' : s.detail || undefined,
        }))}
      />
      {gates.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Typography.Text type="secondary">运行期门禁：</Typography.Text>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {gates.map((g, i) => (
              <Tag key={`${g.name}-${i}`} color={g.ok ? 'green' : 'red'}>
                {g.name || '门禁'}：{g.ok ? '通过' : '未过'}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
