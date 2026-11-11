import { Alert, Button, Collapse, Select, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'

import type { ReleaseEvent, ReleaseHistoryView, ServerOption } from '../types.ts'
import { bumpLabel, historyKindLabel } from '../utils/format.ts'

/**
 * 只读发版历史（deploy.md §10.4.2）。
 * 🔴 没有编辑 / 删除 / 重发 / 上送远端按钮，行不触发任何动作；默认折叠。
 * 🔴 接口失败恒回 items: [] + error，这里如实提示「读不到」而不是「没有记录」。
 */
export interface ReleaseHistoryProps {
  server: string
  view: ReleaseHistoryView
  loading: boolean
  serverOptions: ServerOption[]
  onServer: (s: string) => void
  onRefresh: () => void
}

const resultColor = (ev: ReleaseEvent): string => {
  if (ev.kind === 'rollback') return 'purple'
  if (ev.result === 'success') return 'green'
  if (ev.result === 'failed') return 'red'
  return 'default'
}

export function ReleaseHistory({
  server, view, loading, serverOptions, onServer, onRefresh,
}: ReleaseHistoryProps) {
  const columns: TableProps<ReleaseEvent>['columns'] = [
    { title: '时间', dataIndex: 'ts', key: 'ts', width: 190 },
    { title: '目标机', dataIndex: 'server', key: 'server', width: 90 },
    {
      title: '发版号（线上 → 本次）', key: 'version', width: 190,
      render: (_, ev) => `${ev.online_version || '未采集'} → ${ev.release_version}`,
    },
    { title: '更新类型', key: 'bump', width: 100, render: (_, ev) => bumpLabel(ev.bump) },
    { title: '镜像 tag', dataIndex: 'image_tag', key: 'image_tag', width: 110 },
    {
      title: '结果', key: 'result', width: 90,
      render: (_, ev) => <Tag color={resultColor(ev)}>{historyKindLabel(ev)}</Tag>,
    },
    { title: '失败阶段', dataIndex: 'failed_stage', key: 'failed_stage', width: 100 },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
    { title: '任务 id', dataIndex: 'task_id', key: 'task_id', width: 200, ellipsis: true },
  ]

  const header = (
    <Space size="small" wrap onClick={(e) => e.stopPropagation()}>
      <Typography.Text type="secondary">按目标机筛选：</Typography.Text>
      <Select
        size="small"
        value={server}
        onChange={onServer}
        style={{ minWidth: 130 }}
        options={[
          { value: '', label: '全部' },
          ...serverOptions.map((s) => ({ value: s.name, label: s.name })),
        ]}
      />
      <Button size="small" onClick={onRefresh} loading={loading}>刷新</Button>
    </Space>
  )

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <Collapse
        defaultActiveKey={[]}
        items={[{
          key: 'history',
          label: `发版历史（只读 · 本机台账 · ${view.items.length} 条）`,
          extra: header,
          children: (
            <>
              {view.error && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="台账读不到（已按空数组展示，不是「没有记录」）"
                  description={view.error}
                />
              )}
              <Table<ReleaseEvent>
                rowKey={(ev) => `${ev.ts}-${ev.task_id}-${ev.release_version}`}
                columns={columns}
                dataSource={view.items}
                loading={loading}
                size="small"
                pagination={false}
                scroll={{ x: 1200 }}
                locale={{ emptyText: 'items = []：还没有正式发布记录（预演 / 门禁阻塞不入账）' }}
              />
              <p className="hint" style={{ marginTop: 10 }}>
                台账 append-only：成功 / 失败都留痕、回滚另记一条不改旧记录；只读、不自动清理、不接备份能力、不上送远端。
                换机 / 重装系统会丢，工具不假装「已备份」。失败行只显示停在哪一阶段，不写「服务已恢复正常」。
              </p>
            </>
          ),
        }]}
      />
    </div>
  )
}
