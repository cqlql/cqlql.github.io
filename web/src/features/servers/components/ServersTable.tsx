import { Button, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'

import type { ServerInfo } from '../types.ts'
import {
  applySudoBlockReason,
  canApplySudo,
  sshBadge,
  sudoBadge,
  sudoDetail,
} from '../utils/status.ts'
import type { Badge, Tone } from '../utils/status.ts'
import { formatShortTime } from '../../../shared/utils/time.ts'
import { connectionText, keyHint, roleText } from '../utils/server.ts'

/** 语义色 → antd Tag 的 status 色。判定在 utils/status.ts，这里只做映射。 */
const TONE_COLOR: Record<Tone, string> = {
  ok: 'success',
  warn: 'warning',
  err: 'error',
  muted: 'default',
}

function BadgeTag({ badge }: { badge: Badge }) {
  return <Tag color={TONE_COLOR[badge.tone]}>{badge.text}</Tag>
}

interface Props {
  servers: ServerInfo[]
  loading: boolean
  /** name → 该行正在执行某个动作（检查或配置），按钮转圈并禁用。 */
  busy: Record<string, boolean>
  onCheck: (name: string) => void
  onApply: (server: ServerInfo) => void
}

export function ServersTable({ servers, loading, busy, onCheck, onApply }: Props) {
  const columns: TableColumnsType<ServerInfo> = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 180,
      render: (_: unknown, s) => (
        <div>
          <Typography.Text strong>{s.name}</Typography.Text>
          {s.note && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {s.note}
              </Typography.Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 80,
      render: (role: string) => roleText(role),
    },
    {
      title: '连接',
      width: 230,
      render: (_: unknown, s) => (
        <div>
          <code>{connectionText(s)}</code>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {keyHint(s)}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: 'SSH',
      width: 90,
      render: (_: unknown, s) => <BadgeTag badge={sshBadge(s.status)} />,
    },
    {
      title: '免密 sudo',
      width: 200,
      render: (_: unknown, s) => {
        const detail = sudoDetail(s.status)
        return (
          <div>
            <BadgeTag badge={sudoBadge(s.status)} />
            {detail && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {detail}
                </Typography.Text>
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: '最近检查',
      width: 120,
      render: (_: unknown, s) => formatShortTime(s.status?.checked_at),
    },
    {
      title: '操作',
      width: 210,
      render: (_: unknown, s) => {
        const blocked = applySudoBlockReason(s)
        const apply = (
          <Button
            type="primary"
            size="small"
            loading={busy[s.name]}
            disabled={!canApplySudo(s)}
            onClick={() => onApply(s)}
          >
            一键免密 sudo
          </Button>
        )
        return (
          <Space size={6}>
            <Button size="small" loading={busy[s.name]} onClick={() => onCheck(s.name)}>
              检查
            </Button>
            {/* 点不了的按钮必须说明原因，否则人只会反复点它 */}
            {blocked ? <Tooltip title={blocked}>{apply}</Tooltip> : apply}
          </Space>
        )
      },
    },
  ]

  return (
    <Table<ServerInfo>
      rowKey="name"
      size="middle"
      loading={loading}
      dataSource={servers}
      columns={columns}
      pagination={false}
      scroll={{ x: 1110 }}
      locale={{
        emptyText: '清单为空。请按 docs/servers.md §3 添加服务器后刷新。',
      }}
    />
  )
}
