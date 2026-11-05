import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Input, Modal, Typography } from 'antd'

import { serversApi } from '../api.ts'
import { ServersTable } from '../components/ServersTable.tsx'
import { applySudo, checkAll, checkOne, errText } from '../service.ts'
import type { FlowHooks, Notice } from '../service.ts'
import type { CheckRow, ServerInfo, ServersResponse, ServerStatus } from '../types.ts'

/**
 * 页面只做三件事：**取数、拼装、UI 状态**（loading / busy / 弹窗）。
 * 「先检查再配置」这类分支在 `service.ts`，判定在 `utils/`。
 */
export function ServersPage() {
  const [data, setData] = useState<ServersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [checkingAll, setCheckingAll] = useState(false)

  // 密码弹窗：用 Promise 把「等人输入」接到流程里，
  // 免得把 apply 拆成两个回调、状态散在四处。
  const [pwFor, setPwFor] = useState<string | null>(null)
  const [pwValue, setPwValue] = useState('')
  const pwResolve = useRef<((v: string | null) => void) | null>(null)

  const servers = data?.servers ?? []

  const mergeRows = useCallback((rows: CheckRow[]) => {
    const byName = new Map(rows.map((r) => [r.name, r]))
    setData((prev) =>
      prev
        ? {
            ...prev,
            servers: prev.servers.map((s) => {
              const r = byName.get(s.name)
              return r
                ? {
                    ...s,
                    status: { ssh: r.ssh, sudo: r.sudo, detail: r.detail, checked_at: r.checked_at },
                  }
                : s
            }),
          }
        : prev,
    )
  }, [])

  const patchStatus = useCallback((name: string, status: ServerStatus) => {
    setData((prev) =>
      prev
        ? { ...prev, servers: prev.servers.map((s) => (s.name === name ? { ...s, status } : s)) }
        : prev,
    )
  }, [])

  const askPassword = useCallback((name: string) => {
    setPwFor(name)
    setPwValue('')
    return new Promise<string | null>((resolve) => {
      pwResolve.current = resolve
    })
  }, [])

  const hooks = useMemo<FlowHooks>(
    () => ({ notice: setNotice, rows: mergeRows, status: patchStatus, askPassword }),
    [mergeRows, patchStatus, askPassword],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await serversApi.list())
    } catch (e) {
      setNotice({ kind: 'error', text: errText(e) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const withBusy = useCallback(async (name: string, fn: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [name]: true }))
    try {
      await fn()
    } finally {
      setBusy((b) => {
        const next = { ...b }
        delete next[name]
        return next
      })
    }
  }, [])

  const settlePassword = useCallback((value: string | null) => {
    const resolve = pwResolve.current
    pwResolve.current = null
    setPwFor(null)
    setPwValue('')
    resolve?.(value)
  }, [])

  const onCheck = (name: string) => {
    void withBusy(name, () => checkOne(serversApi, name, hooks))
  }

  const onCheckAll = () => {
    setCheckingAll(true)
    void checkAll(serversApi, hooks).finally(() => setCheckingAll(false))
  }

  const onApply = (server: ServerInfo) => {
    void withBusy(server.name, () => applySudo(serversApi, server, hooks))
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Pass-up 服务器管理</h1>
          <div className="page-meta">
            清单：<span>{data?.servers_file ?? (loading ? '加载中…' : '加载失败')}</span>
          </div>
        </div>
        <Button type="primary" loading={checkingAll} onClick={onCheckAll}>
          检查全部
        </Button>
      </header>

      {notice && (
        <Alert
          style={{ marginBottom: 12 }}
          type={notice.kind}
          showIcon
          closable
          message={notice.text}
          onClose={() => setNotice(null)}
        />
      )}

      <div className="card">
        <ServersTable
          servers={servers}
          loading={loading}
          busy={busy}
          onCheck={onCheck}
          onApply={onApply}
        />
      </div>

      <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        检查是只读的；「一键免密 sudo」会写 <code>/etc/sudoers.d/90-&lt;user&gt;-nopasswd</code>，
        先备份原片段再替换。见 docs/servers.md §6。
      </Typography.Paragraph>

      <Modal
        open={pwFor !== null}
        title="输入初始 sudo 密码"
        okText="确定"
        cancelText="取消"
        onOk={() => settlePassword(pwValue)}
        onCancel={() => settlePassword(null)}
        afterClose={() => setPwValue('')}
      >
        <p className="hint">
          {pwFor} 需要初始 sudo 密码；密码只在本次请求的内存中使用，不落盘、不写日志。
        </p>
        <Input.Password
          value={pwValue}
          onChange={(e) => setPwValue(e.target.value)}
          onPressEnter={() => settlePassword(pwValue)}
          autoFocus
          autoComplete="off"
          placeholder="只用于本次请求"
        />
      </Modal>
    </div>
  )
}
