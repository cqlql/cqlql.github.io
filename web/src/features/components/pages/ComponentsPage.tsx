import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Input, Modal, Select, Tag } from 'antd'

import { componentsApi } from '../api.ts'
import {
  errText,
  fetchStatus,
  resumeComponentTask,
  startComponentInstall,
} from '../service.ts'
import type { WatchHooks } from '../service.ts'
import type {
  ComponentStatus,
  ComponentTask,
  ComponentsStatusView,
  ServerOption,
} from '../types.ts'
import {
  canInstall,
  checkColor,
  installHint,
  normalizeStatusView,
  stateColor,
  stateLabel,
} from '../utils/format.ts'

/**
 * 「环境组件」页：组件目录 + 选中组件详情。
 *
 * 目录由后端注册表渲染，新增组件只加一条后端声明，前端不用改结构。
 * 本轮只接入 docker 的安装；minio 以 planned 占位，更新 / 卸载按钮明确置灰。
 * 双击落地页仍是服务器管理页，这一页默认只做只读体检。
 */
const EMPTY_VIEW: ComponentsStatusView = normalizeStatusView(null)

type Notice = { kind: 'success' | 'error' | 'info' | 'warning'; text: string } | null

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e9f0',
  fontSize: 12, color: '#6b7280', fontWeight: 500, background: '#fafbfc',
}
const tdStyle: React.CSSProperties = {
  padding: '8px 10px', borderBottom: '1px solid #e5e9f0', verticalAlign: 'middle',
}

export function ComponentsPage() {
  const [targets, setTargets] = useState<ServerOption[]>([])
  const [name, setName] = useState('')
  const [view, setView] = useState<ComponentsStatusView>(EMPTY_VIEW)
  const [selected, setSelected] = useState('docker')
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState('')
  const [task, setTask] = useState<ComponentTask | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  // 安装二次确认：yes + 一次性 sudo 密码，用完即清，不缓存。
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')

  const alive = useRef(true)
  const pollId = useRef(0)
  const logRef = useRef<HTMLPreElement>(null)

  const makeHooks = useCallback((id: number): WatchHooks => ({
    onChunk: (chunk) => setLog((prev) => prev + chunk),
    onTask: setTask,
    shouldStop: () => !alive.current || pollId.current !== id,
  }), [])

  const refresh = useCallback(async (target: string) => {
    if (!target) return
    setLoading(true)
    try {
      const v = await fetchStatus(componentsApi, target)
      if (alive.current) setView(v)
    } catch (e) {
      if (alive.current) {
        setView(EMPTY_VIEW)
        setNotice({ kind: 'error', text: errText(e) })
      }
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    let cancelled = false
    void (async () => {
      try {
        const res = await componentsApi.targets()
        if (cancelled) return
        setTargets(res.servers ?? [])
        setName((prev) => prev || res.default || res.servers?.[0]?.name || '')
      } catch (e) {
        if (!cancelled) setNotice({ kind: 'error', text: errText(e) })
      }
    })()
    void (async () => {
      const id = ++pollId.current
      try {
        const t = await resumeComponentTask(componentsApi, makeHooks(id))
        if (cancelled) return
        if (t) {
          setTask(t)
          setBusy(t.running)
        }
      } catch {
        // 后端还没有任务状态，忽略。
      }
    })()
    return () => { cancelled = true; alive.current = false }
  }, [makeHooks])

  useEffect(() => { if (name) void refresh(name) }, [name, refresh])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [log])

  const current = useMemo(
    () => view.components.find((c) => c.id === selected),
    [view.components, selected],
  )

  // 依赖由后端注册表的 depends 声明推导；目前 docker 无上游依赖。
  const dependenciesReady = useMemo(() => {
    const dep = current?.depends
    if (!dep) return true
    const s = view.components.find((c) => c.id === dep)?.state
    return s === 'ok' || s === 'degraded'
  }, [current, view.components])

  const installable = canInstall(current, view, busy || loading, dependenciesReady)

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false)
    setConfirmText('')
    setPassword('')
  }, [])

  const submitConfirm = useCallback(() => {
    if (confirmText !== 'yes' || !name) return
    const pw = password
    const id = ++pollId.current
    closeConfirm()
    setBusy(true)
    setLog('')
    setTask(null)
    setNotice({ kind: 'info', text: '安装已提交，服务端正在跑 --dry-run 预检…' })
    void (async () => {
      try {
        const t = await startComponentInstall(
          componentsApi,
          { verb: 'install', component: 'docker', name, confirm: 'yes', ...(pw ? { password: pw } : {}) },
          makeHooks(id),
        )
        setTask(t)
        setNotice(t.exit_code === 0
          ? { kind: 'success', text: 'Docker 引擎安装完成，请点「重新检查」复核状态。' }
          : { kind: 'error', text: `任务结束，退出码 ${t.exit_code}。请看日志并复核远端状态。` })
      } catch (e) {
        setNotice({ kind: 'error', text: errText(e) })
      } finally {
        setBusy(false)
        void refresh(name)
      }
    })()
  }, [confirmText, password, name, closeConfirm, makeHooks, refresh])

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>环境组件</h1>
          <div className="page-meta">
            默认只读体检；安装会写远端 apt 源 / 系统包 / 服务，需输入 yes 二次确认并由服务端先跑预检
          </div>
        </div>
        <Tag color="blue">一个导航项 · 可扩展目录</Tag>
      </header>

      {notice && <Alert type={notice.kind} message={notice.text} showIcon style={{ marginBottom: 14 }} />}

      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>目标服务器</span>
          <Select
            value={name || undefined}
            onChange={(v) => setName(v)}
            style={{ width: 300 }}
            placeholder="只接受 servers.json 里的 name"
            options={targets.map((t) => ({
              value: t.name,
              label: t.host ? `${t.name} · ${t.host}` : t.name,
            }))}
          />
          <Button onClick={() => void refresh(name)} loading={loading} disabled={!name || busy}>
            重新检查（只读）
          </Button>
          <span className="hint">
            {view.collected ? `已采集 · ${view.server}` : '未采集到状态（连不上时是「未知」，不是「未安装」）'}
          </span>
        </div>
        {view.error && <Alert type="warning" message={view.error} showIcon style={{ marginTop: 12 }} />}
        {busy && (
          <Alert
            type="error" showIcon style={{ marginTop: 12 }}
            message="远端任务运行中：新的写请求会被服务端以 409 拒绝；刷新页面不会打断已开始的安装。"
          />
        )}
      </section>

      <section className="card">
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>
          组件目录 <span style={{ fontWeight: 400, fontSize: 12, color: '#6b7280' }}>
            （点一行切换详情；新增组件只加一条后端注册表声明）
          </span>
        </h2>
        <div style={{ border: '1px solid #e5e9f0', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>组件</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>版本</th>
                <th style={thStyle}>依赖</th>
                <th style={thStyle}>接入</th>
              </tr>
            </thead>
            <tbody>
              {view.components.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, color: '#9aa3af' }}>尚未采集到组件列表</td></tr>
              )}
              {view.components.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  style={{ cursor: 'pointer', background: selected === c.id ? '#e6f4ff' : undefined }}
                >
                  <td style={tdStyle}>
                    <b>{c.name}</b>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{c.kind}</div>
                  </td>
                  <td style={tdStyle}><Tag color={stateColor(c.state)}>{stateLabel(c.state)}</Tag></td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{c.version || '—'}</td>
                  <td style={tdStyle}>{c.depends || '—'}</td>
                  <td style={tdStyle}>{c.phase === 'ready' ? '已接入' : '待接入'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hint" style={{ marginTop: 10 }}>
          minio 目前是目录里的占位项（尚未接入），任何写操作都会被后端白名单拒绝。
        </div>
      </section>

      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}>{current?.name ?? '组件详情'}</b>
          {current && <Tag color={stateColor(current.state)}>{stateLabel(current.state)}</Tag>}
        </div>
        <div className="hint" style={{ marginBottom: 10 }}>
          {current?.version || installHint(current, view, dependenciesReady)}
        </div>
        <Alert
          type={view.preflight.ready ? 'info' : 'warning'}
          showIcon
          message={installHint(current, view, dependenciesReady)}
          style={{ marginBottom: 10 }}
        />
        {view.preflight.blockers.length > 0 && (
          <Alert type="error" showIcon style={{ marginBottom: 10 }}
            message="预检阻塞项" description={<ul style={{ margin: 0, paddingLeft: 18 }}>{view.preflight.blockers.map((b) => <li key={b}>{b}</li>)}</ul>} />
        )}
        {view.preflight.warnings.length > 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 10 }}
            message="预检提示" description={<ul style={{ margin: 0, paddingLeft: 18 }}>{view.preflight.warnings.map((w) => <li key={w}>{w}</li>)}</ul>} />
        )}

        {current?.phase === 'planned' ? (
          <Alert type="info" showIcon message="该组件尚未接入，本轮只做目录占位；后续按同一注册表加脚本与动作即可。" />
        ) : (
          <>
            <div style={{ border: '1px solid #e5e9f0', borderRadius: 8, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr><th style={thStyle}>体检项</th><th style={thStyle}>实测值</th><th style={thStyle}>状态</th></tr>
                </thead>
                <tbody>
                  {(current?.checks ?? []).length === 0 && (
                    <tr><td colSpan={3} style={{ ...tdStyle, color: '#9aa3af' }}>未采集到体检项</td></tr>
                  )}
                  {(current?.checks ?? []).map((it) => (
                    <tr key={it.key}>
                      <td style={{ ...tdStyle, color: '#6b7280' }}>{it.label}</td>
                      <td style={tdStyle}>{it.value}</td>
                      <td style={tdStyle}><Tag color={checkColor(it.state)}>{it.state}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <Button type="primary" disabled={!installable} onClick={() => setConfirmOpen(true)}>
                安装 Docker 引擎
              </Button>
              <Button disabled title="后续接入">更新</Button>
              <Button disabled danger title="后续接入">卸载</Button>
              <span className="hint">更新 / 卸载尚未接入；安装不会动容器、镜像与 /var/lib/docker。</span>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>任务日志</b>
          <span className="hint">
            {busy ? '运行中（与备份部署共用后台任务锁）' : task ? `结束 · 退出码 ${task.exit_code}` : '空闲'}
          </span>
        </div>
        <pre ref={logRef} style={{
          margin: 0, background: '#1f2329', color: '#d7dce5', borderRadius: 8,
          padding: 12, height: 190, overflow: 'auto', whiteSpace: 'pre-wrap',
          wordBreak: 'break-all', font: '12px/1.7 ui-monospace, Consolas, monospace',
        }}>
          {log || '（暂无日志）'}
        </pre>
        <div className="hint" style={{ marginTop: 8 }}>
          增量轮询、日志按行脱敏、凭证显示为 ***；任务脱离 HTTP 请求，刷新页面不打断。
        </div>
      </section>

      <Modal
        title="确认安装 Docker 引擎"
        open={confirmOpen}
        onCancel={closeConfirm}
        onOk={submitConfirm}
        okText="确认安装"
        cancelText="取消"
        okButtonProps={{ disabled: confirmText !== 'yes', danger: true }}
        destroyOnClose
      >
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message="这是远端写操作"
          description="会安装系统包、写 /etc/apt/sources.list.d/docker.sources、启用 docker.service，并把清单用户加入 docker 组。"
        />
        <ul style={{ paddingLeft: 18, margin: '0 0 12px', fontSize: 13, lineHeight: 1.9 }}>
          <li>服务端会先跑一次 --dry-run 预检，不通过就不安装、远端不改动。</li>
          <li>不跑 hello-world（会拉 Docker Hub 镜像），不动容器 / 镜像 / /var/lib/docker。</li>
          <li>不修改 crontab、backup.env；不改 DEST_URL（仍需在「配置」页把 8007 改成 9000）。</li>
          <li>组变更需重新登录才在当前会话生效。</li>
        </ul>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>请输入 yes 确认：</div>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="yes" autoComplete="off" />
        <div style={{ fontSize: 12, color: '#6b7280', margin: '10px 0 4px' }}>
          一次性 sudo 密码（目标机已配免密 sudo 可留空）：
        </div>
        <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} placeholder="留空则用免密 sudo" autoComplete="new-password" />
      </Modal>
    </div>
  )
}
