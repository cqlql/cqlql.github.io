import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Alert, Button, Checkbox, Input, Modal, Select, Tag } from 'antd'

import { componentsApi } from '../api.ts'
import {
  errText,
  fetchStatus,
  resumeComponentTask,
  startComponentInstall,
  startImageLoad,
} from '../service.ts'
import type { WatchHooks } from '../service.ts'
import type {
  ComponentTask,
  ComponentsStatusView,
  ServerOption,
} from '../types.ts'
import {
  canInstall,
  checkColor,
  confirmCopy,
  imageHint,
  installHint,
  installLabel,
  normalizeProxyInput,
  normalizeStatusView,
  preflightOf,
  stateColor,
  stateLabel,
} from '../utils/format.ts'

/**
 * 「环境组件」页：一个组件目录 + 选中组件详情。
 *
 * 目录由后端注册表渲染，新增组件只加一条后端声明，前端不用改结构。
 * 两个已接入组件：docker（官方 apt 仓库）、minio（离线镜像 + 运行时注入凭证）。
 * 双击落地页仍是服务器管理页；这一页默认只做只读体检，写动作要显式确认。
 */
const EMPTY_VIEW: ComponentsStatusView = normalizeStatusView(null)

// 代理地址只是普通网络偏好，不是凭据（访问令牌仍只在内存 + 地址栏，绝不落盘）。
// 记住它，换机/重装时不用每次手填；格式仍由前端 normalizeProxyInput 与服务端各卡一道。
const PROXY_STORAGE_KEY = 'passup.component.aptProxy'

type Notice = { kind: 'success' | 'error' | 'info' | 'warning'; text: string } | null

const thStyle: CSSProperties = {
  textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e9f0',
  fontSize: 12, color: '#6b7280', fontWeight: 500, background: '#fafbfc',
}
const tdStyle: CSSProperties = {
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

  // 安装 Docker 时可选的 apt 代理（勾选才生效；地址可记住，勾选状态不落盘）。
  const [useProxy, setUseProxy] = useState(false)
  const [proxyUrl, setProxyUrl] = useState('')

  // 离线镜像导入：另一个写动作，也走 yes + 服务端 dry-run 门 + 同一个任务锁。
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageOpen, setImageOpen] = useState(false)
  const [imageConfirmText, setImageConfirmText] = useState('')
  const [imagePassword, setImagePassword] = useState('')

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
    try {
      const saved = localStorage.getItem(PROXY_STORAGE_KEY)
      if (saved) {
        setUseProxy(true)
        setProxyUrl(saved)
      }
    } catch {
      // 隐私模式 / 禁用存储：当作没记住即可，不影响安装。
    }
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

  // 依赖由后端注册表的 depends 声明推导（minio → docker）。
  const dependenciesReady = useMemo(() => {
    const dep = current?.depends
    if (!dep) return true
    const s = view.components.find((c) => c.id === dep)?.state
    return s === 'ok' || s === 'degraded'
  }, [current, view.components])

  const dockerReady = useMemo(() => {
    const s = view.components.find((c) => c.id === 'docker')?.state
    return s === 'ok' || s === 'degraded'
  }, [view.components])

  const pre = preflightOf(view, current)
  const installable = canInstall(current, view, busy || loading, dependenciesReady)
  const copy = confirmCopy(current?.id)
  const imageEnabled = !!current?.offline_image && !busy && !loading && view.collected && dockerReady

  // 代理只在 Docker 安装弹窗里出现；格式错了就禁用确认，不让用户白跑一次预检。
  const proxyApplies = current?.id === 'docker'
  const proxyValue = proxyApplies && useProxy ? normalizeProxyInput(proxyUrl) : null
  const confirmOk = confirmText === 'yes' && (!proxyApplies || !useProxy || proxyValue !== null)

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false)
    setConfirmText('')
    setPassword('')
  }, [])

  const submitConfirm = useCallback(() => {
    const id = current?.id
    if (!confirmOk || !name || !id || !installable) return
    const pw = password
    const proxy = id === 'docker' && useProxy ? proxyValue : null
    const poll = ++pollId.current
    closeConfirm()
    try {
      if (proxy) localStorage.setItem(PROXY_STORAGE_KEY, proxy)
      else if (!useProxy) localStorage.removeItem(PROXY_STORAGE_KEY)
    } catch {
      // 存储不可用时只是记不住，不影响本次安装。
    }
    setBusy(true)
    setLog('')
    setTask(null)
    setNotice({ kind: 'info', text: `${installLabel(id)}已提交，服务端正在跑 --dry-run 预检…` })
    void (async () => {
      try {
        const t = await startComponentInstall(
          componentsApi,
          {
            verb: 'install', component: id, name, confirm: 'yes',
            ...(pw ? { password: pw } : {}),
            ...(proxy ? { proxy } : {}),
          },
          makeHooks(poll),
        )
        setTask(t)
        setNotice(t.exit_code === 0
          ? { kind: 'success', text: `${installLabel(id)}完成，请点「重新检查」复核状态。` }
          : { kind: 'error', text: `任务结束，退出码 ${t.exit_code}。请看日志并复核远端状态。` })
      } catch (e) {
        setNotice({ kind: 'error', text: errText(e) })
      } finally {
        setBusy(false)
        void refresh(name)
      }
    })()
  }, [confirmOk, password, name, current, installable, useProxy, proxyValue, closeConfirm, makeHooks, refresh])

  const closeImage = useCallback(() => {
    setImageOpen(false)
    setImageConfirmText('')
    setImagePassword('')
  }, [])

  const submitImage = useCallback(() => {
    if (imageConfirmText !== 'yes' || !name || !imageFile || !imageEnabled) return
    const form = new FormData()
    form.append('verb', 'image-load')
    form.append('component', 'minio')
    form.append('name', name)
    form.append('confirm', 'yes')
    if (imagePassword) form.append('password', imagePassword)
    form.append('image', imageFile, imageFile.name)
    const poll = ++pollId.current
    closeImage()
    setBusy(true)
    setLog('')
    setTask(null)
    setNotice({ kind: 'info', text: '镜像包已提交，服务端正在做 --dry-run 校验…' })
    void (async () => {
      try {
        const t = await startImageLoad(componentsApi, form, makeHooks(poll))
        setTask(t)
        setNotice(t.exit_code === 0
          ? { kind: 'success', text: '离线镜像已导入，请点「重新检查」复核镜像清单。' }
          : { kind: 'error', text: `导入结束，退出码 ${t.exit_code}。请看日志并复核远端状态。` })
      } catch (e) {
        setNotice({ kind: 'error', text: errText(e) })
      } finally {
        setBusy(false)
        setImageFile(null)
        void refresh(name)
      }
    })()
  }, [imageConfirmText, imagePassword, name, imageFile, imageEnabled, closeImage, makeHooks, refresh])

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>环境组件</h1>
          <div className="page-meta">
            默认只读体检；安装 / 导入镜像会写远端，需输入 yes 二次确认并由服务端先跑预检
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
            message="远端任务运行中：新的写请求会被服务端以 409 拒绝；刷新页面不会打断已开始的任务。"
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
          依赖链：① Docker 引擎 → ② MinIO 服务 → ③ mc mirror 备份链路；上游没就绪时下游写动作一律禁用。
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
          type={pre.ready ? 'info' : 'warning'}
          showIcon
          message={installHint(current, view, dependenciesReady)}
          style={{ marginBottom: 10 }}
        />
        {pre.blockers.length > 0 && (
          <Alert type="error" showIcon style={{ marginBottom: 10 }}
            message="预检阻塞项" description={<ul style={{ margin: 0, paddingLeft: 18 }}>{pre.blockers.map((b) => <li key={b}>{b}</li>)}</ul>} />
        )}
        {pre.warnings.length > 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 10 }}
            message="预检提示" description={<ul style={{ margin: 0, paddingLeft: 18 }}>{pre.warnings.map((w) => <li key={w}>{w}</li>)}</ul>} />
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
                {installLabel(current?.id)}
              </Button>
              <Button disabled title="后续接入">更新</Button>
              <Button disabled danger title="后续接入">卸载</Button>
              <span className="hint">更新 / 卸载尚未接入；安装不会删数据、不动引擎与已有镜像。</span>
            </div>
          </>
        )}
      </section>

      {current?.offline_image && (
        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <b style={{ fontSize: 14 }}>MinIO 离线镜像</b>
            <Tag color="orange">不走外网</Tag>
            <span className="hint">只属于 MinIO；Docker 引擎走官方 apt 仓库，不需要 tar</span>
          </div>
          <div style={{ border: '1px solid #e5e9f0', borderRadius: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>镜像 : 标签</th>
                  <th style={thStyle}>镜像 ID</th>
                  <th style={thStyle}>大小</th>
                  <th style={thStyle}>导入时间</th>
                </tr>
              </thead>
              <tbody>
                {view.images.length === 0 && (
                  <tr><td colSpan={4} style={{ ...tdStyle, color: '#9aa3af' }}>目标机尚无已导入的 MinIO 镜像</td></tr>
                )}
                {view.images.map((img) => (
                  <tr key={`${img.reference}-${img.id}`}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{img.reference}</td>
                    <td style={tdStyle}>{img.id}</td>
                    <td style={tdStyle}>{img.size}</td>
                    <td style={tdStyle}>{img.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hint" style={{ marginTop: 10 }}>{imageHint(view, dockerReady)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <input
              type="file"
              accept=".tar"
              disabled={busy}
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            <Button
              disabled={!imageEnabled || !imageFile}
              onClick={() => setImageOpen(true)}
            >
              导入到远端
            </Button>
            <span className="hint">
              选择本机 docker save 导出的 .tar；服务端校验后才上传，接口不接受任意本机路径。
            </span>
          </div>
        </section>
      )}

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
        title={copy.title}
        open={confirmOpen}
        onCancel={closeConfirm}
        onOk={submitConfirm}
        okText="确认安装"
        cancelText="取消"
        okButtonProps={{ disabled: !confirmOk, danger: true }}
        destroyOnClose
      >
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message="这是远端写操作"
          description={copy.description}
        />
        <ul style={{ paddingLeft: 18, margin: '0 0 12px', fontSize: 13, lineHeight: 1.9 }}>
          {copy.items.map((it) => <li key={it}>{it}</li>)}
        </ul>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>请输入 yes 确认：</div>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="yes" autoComplete="off" />
        <div style={{ fontSize: 12, color: '#6b7280', margin: '10px 0 4px' }}>
          一次性 sudo 密码（目标机已配免密 sudo 可留空）：
        </div>
        <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} placeholder="留空则用免密 sudo" autoComplete="new-password" />
        {current?.id === 'docker' && (
          <div style={{
            marginTop: 12, padding: 10, background: '#fafbfc',
            border: '1px solid #e5e9f0', borderRadius: 8,
          }}>
            <Checkbox checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)}>
              本次安装走代理（目标机直连 download.docker.com 很慢 / 被重置时勾选）
            </Checkbox>
            {useProxy && (
              <Input
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="http://proxy.example:7890"
                status={proxyValue === null ? 'warning' : undefined}
                autoComplete="off"
                style={{ marginTop: 8 }}
              />
            )}
            <div className="hint" style={{ marginTop: 6 }}>
              格式 http://host:port；只作用于本次 apt / curl，不写远端 /etc/apt/apt.conf.d/ 配置。
              服务端会再校验一次，留空则直连。
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="确认导入 MinIO 离线镜像"
        open={imageOpen}
        onCancel={closeImage}
        onOk={submitImage}
        okText="确认导入"
        cancelText="取消"
        okButtonProps={{ disabled: imageConfirmText !== 'yes', danger: true }}
        destroyOnClose
      >
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message="这是远端写操作"
          description="会把本机镜像包上传到目标机并执行 docker load；不启动容器、不改数据目录、不改 backup.env。"
        />
        <ul style={{ paddingLeft: 18, margin: '0 0 12px', fontSize: 13, lineHeight: 1.9 }}>
          <li>服务端先跑 --dry-run 校验 tar，不通过就不上传、远端不改动。</li>
          <li>绝不执行 docker pull（目标机拉不到 Docker Hub / quay.io / dl.min.io）。</li>
          <li>临时镜像包由服务端生成路径、任务结束即删；接口不接受任意本机路径。</li>
        </ul>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
          已选：{imageFile?.name ?? '（未选择）'}。请输入 yes 确认：
        </div>
        <Input value={imageConfirmText} onChange={(e) => setImageConfirmText(e.target.value)} placeholder="yes" autoComplete="off" />
        <div style={{ fontSize: 12, color: '#6b7280', margin: '10px 0 4px' }}>
          一次性 sudo 密码（目标机已配免密 sudo 可留空）：
        </div>
        <Input.Password value={imagePassword} onChange={(e) => setImagePassword(e.target.value)} placeholder="留空则用免密 sudo" autoComplete="new-password" />
      </Modal>
    </div>
  )
}
