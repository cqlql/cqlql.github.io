import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Input, Modal, Select, Tag } from 'antd'

import { componentsApi } from '../api.ts'
import {
  errText,
  fetchStatus,
  resumeComponentTask,
  startComponentRun,
  startImageLoad,
} from '../service.ts'
import type { WatchHooks } from '../service.ts'
import type {
  ActionPlan,
  ComponentRunRequest,
  ComponentTask,
  ComponentsStatusView,
  ComponentVerb,
  ServerOption,
} from '../types.ts'
import {
  actionCopy,
  actionEnabled,
  actionHint,
  actionOf,
  actionPlans,
  checkColor,
  imageHint,
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
 * 目录与写动作都由后端注册表 / 体检结果渲染（新增组件只加一条后端声明）。
 * 🔴 能否执行、阻塞原因、影响清单、附加勾选项全在后端 ActionPlan 里，
 *    前端只渲染 + 加一个 busy 门，不在这里复算指标（docs/components.md §8.4）。
 * 双击落地页仍是服务器管理页；这一页默认只做只读体检，写动作要显式确认。
 */
const EMPTY_VIEW: ComponentsStatusView = normalizeStatusView(null)
const WRITE_VERBS: ComponentVerb[] = ['install', 'update', 'uninstall']

// 代理地址只是普通网络偏好，不是凭据（访问令牌仍只在内存 + 地址栏，绝不落盘）。
// 记住它，换机/重装时不用每次手填；格式仍由前端 normalizeProxyInput 与服务端各卡一道。
const PROXY_STORAGE_KEY = 'passup.component.aptProxy'

type Notice = { kind: 'success' | 'error' | 'info' | 'warning'; text: string } | null

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

  // 统一确认弹窗：yes + 一次性 sudo 密码 + 后端下发的附加勾选 / 目标镜像，用完即清。
  const [confirmVerb, setConfirmVerb] = useState<ComponentVerb | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [extraChecks, setExtraChecks] = useState<Record<string, boolean>>({})
  const [imageRef, setImageRef] = useState('')

  // install / update Docker 时可选的 apt 代理（勾选才生效；地址可记住，勾选状态不落盘）。
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
  const fileRef = useRef<HTMLInputElement>(null)

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

  // 依赖门由后端动作计划算好；这里只为「离线镜像导入」留一个 Docker 就绪判断
  // （update / degraded 也算已装），不参与任何写动作的能否执行判定。
  const dockerReady = useMemo(() => {
    const s = view.components.find((c) => c.id === 'docker')?.state
    return s === 'ok' || s === 'update' || s === 'degraded'
  }, [view.components])

  const pre = preflightOf(view, current)
  const plans = actionPlans(view, current)
  const planOf = (verb: ComponentVerb): ActionPlan | undefined => actionOf(view, current, verb)
  const activePlan = confirmVerb ? planOf(confirmVerb) : undefined
  const currentCopy = actionCopy(activePlan, current)
  const imageEnabled = !!current?.offline_image && !busy && !loading && view.collected && dockerReady

  // 代理只在 install / update Docker 的弹窗里出现；格式错了就禁用确认，不白跑一次预检。
  const proxyApplies = confirmVerb !== null && confirmVerb !== 'uninstall' && current?.id === 'docker'
  const proxyValue = proxyApplies && useProxy ? normalizeProxyInput(proxyUrl) : null
  const requiredChecksOk = (activePlan?.checks ?? []).every(
    (c) => !c.required || extraChecks[c.key] === true,
  )
  const imageRefOk = !activePlan?.images.length ||
    activePlan.images.some((i) => i.reference === imageRef)
  const confirmOk = confirmText === 'yes' && requiredChecksOk && imageRefOk &&
    (!proxyApplies || !useProxy || proxyValue !== null)

  const closeConfirm = () => {
    setConfirmVerb(null)
    setConfirmText('')
    setPassword('')
    setExtraChecks({})
    setImageRef('')
  }

  const openConfirm = (verb: ComponentVerb) => {
    const plan = planOf(verb)
    if (!plan || !actionEnabled(plan, busy || loading)) return
    setConfirmVerb(verb)
    setConfirmText('')
    setPassword('')
    // 🔴 附加勾选一律默认不勾（删数据尤其如此），目标镜像取后端候选里的第一个。
    setExtraChecks({})
    setImageRef(plan.images.find((i) => !i.current)?.reference ?? '')
  }

  const submitConfirm = () => {
    const verb = confirmVerb
    const plan = activePlan
    const comp = current
    if (!confirmOk || !name || !comp || !verb || !plan ||
      !actionEnabled(plan, busy || loading)) return
    const pw = password
    const proxy = comp.id === 'docker' && verb !== 'uninstall' && useProxy ? proxyValue : null
    const req: ComponentRunRequest = {
      verb, component: comp.id, name, confirm: 'yes',
      ...(pw ? { password: pw } : {}),
      ...(proxy ? { proxy } : {}),
      ...(verb === 'update' && imageRef ? { image_ref: imageRef } : {}),
      ...(verb === 'uninstall' && extraChecks['purge_data'] ? { purge_data: true } : {}),
      ...(verb === 'uninstall' && extraChecks['ack_downstream'] ? { ack_downstream: true } : {}),
    }
    const poll = ++pollId.current
    closeConfirm()
    try {
      if (proxy) localStorage.setItem(PROXY_STORAGE_KEY, proxy)
      else if (!useProxy) localStorage.removeItem(PROXY_STORAGE_KEY)
    } catch {
      // 存储不可用时只是记不住，不影响本次动作。
    }
    setBusy(true)
    setLog('')
    setTask(null)
    setNotice({ kind: 'info', text: `${plan.label}${comp.name}已提交，服务端正在跑 --dry-run 预检…` })
    void (async () => {
      try {
        const t = await startComponentRun(componentsApi, req, makeHooks(poll))
        setTask(t)
        setNotice(t.exit_code === 0
          ? { kind: 'success', text: `${plan.label}${comp.name}完成，请点「重新检查」复核状态。` }
          : { kind: 'error', text: `任务结束，退出码 ${t.exit_code}。请看日志并复核远端状态。` })
      } catch (e) {
        setNotice({ kind: 'error', text: errText(e) })
      } finally {
        setBusy(false)
        void refresh(name)
      }
    })()
  }

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
            默认只读体检；安装 / 更新 / 卸载 / 导入镜像会写远端，需输入 yes 二次确认并由服务端先跑预检
          </div>
        </div>
        <Tag color="blue">{view.components.length} 个组件</Tag>
      </header>

      {notice && (
        <Alert
          type={notice.kind}
          message={notice.text}
          showIcon
          closable
          onClose={() => setNotice(null)}
          style={{ marginBottom: 12 }}
        />
      )}

      <section className="card component-panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span className="component-hint">目标服务器</span>
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
          <span className="component-hint">
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

      <section className="card component-panel">
        <h2 className="component-title">
          组件目录 <span className="sub">（点一行切换详情；新增组件只加一条后端注册表声明）</span>
        </h2>
        <div className="component-table-wrap">
          <table className="component-table">
            <thead>
              <tr>
                <th>组件</th>
                <th>状态</th>
                <th>版本</th>
                <th>依赖</th>
                <th>接入</th>
              </tr>
            </thead>
            <tbody>
              {view.components.length === 0 && (
                <tr><td colSpan={5} className="empty">尚未采集到组件列表</td></tr>
              )}
              {view.components.map((c) => (
                <tr
                  key={c.id}
                  className={`selectable${selected === c.id ? ' selected' : ''}`}
                  tabIndex={0}
                  aria-current={selected === c.id ? 'true' : undefined}
                  title={`查看 ${c.name} 详情`}
                  onClick={() => setSelected(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelected(c.id)
                    }
                  }}
                >
                  <td>
                    <b>{c.name}</b>
                    <div className="sub">{c.kind}</div>
                  </td>
                  <td><Tag color={stateColor(c.state)}>{stateLabel(c.state)}</Tag></td>
                  <td className="mono">{c.version || '—'}</td>
                  <td>{c.depends || '—'}</td>
                  <td>{c.phase === 'ready' ? '已接入' : '待接入'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="component-note">
          依赖链：① Docker 引擎 → ② MinIO 服务 → ③ mc mirror 备份链路；上游没就绪时下游写动作一律禁用。
          「可更新」由只读体检判定（apt 候选版本 / 目标机已导入镜像），绝不在线查询版本。
        </div>
      </section>

      <section className="card component-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}>{current?.name ?? '组件详情'}</b>
          {current && <Tag color={stateColor(current.state)}>{stateLabel(current.state)}</Tag>}
        </div>
        {current?.version && (
          <div className="component-hint" style={{ marginBottom: 10 }}>
            当前版本：<code>{current.version}</code>
          </div>
        )}
        <Alert
          type={view.collected ? 'info' : 'warning'}
          showIcon
          message={actionHint(plans, current, view)}
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
            <div className="component-table-wrap">
              <table className="component-table">
                <thead>
                  <tr><th>体检项</th><th>实测值</th><th>状态</th></tr>
                </thead>
                <tbody>
                  {(current?.checks ?? []).length === 0 && (
                    <tr><td colSpan={3} className="empty">未采集到体检项</td></tr>
                  )}
                  {(current?.checks ?? []).map((it) => (
                    <tr key={it.key}>
                      <td className="muted">{it.label}</td>
                      <td>{it.value}</td>
                      <td><Tag color={checkColor(it.state)}>{it.state}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {WRITE_VERBS.map((verb) => {
                const plan = planOf(verb)
                const enabled = actionEnabled(plan, busy || loading)
                return (
                  <Button
                    key={verb}
                    type={verb === 'install' ? 'primary' : undefined}
                    danger={verb === 'uninstall'}
                    disabled={!enabled}
                    title={plan?.available
                      ? `${plan.label} ${current?.name ?? ''}`
                      : (plan?.reasons[0] ?? '后端尚未下发动作计划')}
                    onClick={() => openConfirm(verb)}
                  >
                    {verb === 'install' ? installLabel(current?.id) : (plan?.label ?? verb)}
                  </Button>
                )
              })}
              <span className="component-hint">
                能否执行、阻塞原因与影响清单均由后端按注册表和体检结果计算；卸载默认保留数据。
              </span>
            </div>
          </>
        )}
      </section>

      {current?.offline_image && (
        <section className="card component-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <b style={{ fontSize: 14 }}>MinIO 离线镜像</b>
            <Tag color="orange">不走外网</Tag>
            <span className="component-hint">只属于 MinIO；Docker 引擎走官方 apt 仓库，不需要 tar</span>
          </div>
          <div className="component-table-wrap">
            <table className="component-table">
              <thead>
                <tr>
                  <th>镜像 : 标签</th>
                  <th>镜像 ID</th>
                  <th>大小</th>
                  <th>导入时间</th>
                </tr>
              </thead>
              <tbody>
                {view.images.length === 0 && (
                  <tr><td colSpan={4} className="empty">目标机尚无已导入的 MinIO 镜像</td></tr>
                )}
                {view.images.map((img) => (
                  <tr key={`${img.reference}-${img.id}`}>
                    <td className="mono">{img.reference}</td>
                    <td>{img.id}</td>
                    <td>{img.size}</td>
                    <td>{img.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="component-note">{imageHint(view, dockerReady)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".tar"
              hidden
              disabled={busy}
              onChange={(e) => {
                setImageFile(e.target.files?.[0] ?? null)
                // 清空 value，允许重复选同一个文件（否则第二次不触发 change）。
                e.target.value = ''
              }}
            />
            <Button disabled={busy} onClick={() => fileRef.current?.click()}>
              选择 .tar 镜像包
            </Button>
            <span className="component-file-name">
              {imageFile ? `已选：${imageFile.name}` : '尚未选择文件'}
            </span>
            <Button
              type="primary"
              disabled={!imageEnabled || !imageFile}
              onClick={() => setImageOpen(true)}
            >
              导入到远端
            </Button>
          </div>
          <div className="component-note">
            选择本机 docker save 导出的 .tar；服务端校验后才上传，接口不接受任意本机路径。
            更新 MinIO 用的新镜像也必须从这里导入，工具绝不在线拉取。
          </div>
        </section>
      )}

      <section className="card component-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>任务日志</b>
          <span className="component-hint">
            {busy ? '运行中（与备份部署共用后台任务锁）' : task ? `结束 · 退出码 ${task.exit_code}` : '空闲'}
          </span>
        </div>
        <pre ref={logRef} className="component-log" aria-live="polite">
          {log || '（暂无日志）'}
        </pre>
        <div className="component-note" style={{ marginTop: 8 }}>
          增量轮询、日志按行脱敏、凭证显示为 ***；任务脱离 HTTP 请求，刷新页面不打断。
        </div>
      </section>

      <Modal
        title={currentCopy.title}
        open={confirmVerb !== null}
        onCancel={closeConfirm}
        onOk={submitConfirm}
        okText={currentCopy.submitLabel}
        cancelText="取消"
        okButtonProps={{ disabled: !confirmOk, danger: currentCopy.danger }}
        destroyOnClose
      >
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message="这是远端写操作"
          description={currentCopy.description}
        />
        <ul style={{ paddingLeft: 18, margin: '0 0 12px', fontSize: 13, lineHeight: 1.9 }}>
          {currentCopy.impacts.map((it) => <li key={it}>{it}</li>)}
        </ul>

        {currentCopy.images.length > 0 && (
          <div className="component-box">
            <div className="component-hint" style={{ marginBottom: 4 }}>
              目标镜像（只能选目标机已离线导入的，绝不 docker pull）：
            </div>
            <Select
              value={imageRef || undefined}
              onChange={(v) => setImageRef(v)}
              style={{ width: '100%' }}
              placeholder="选择更新用的离线镜像"
              options={currentCopy.images.map((i) => ({ value: i.reference, label: i.reference }))}
            />
            <div className="component-hint" style={{ marginTop: 6 }}>
              没看到新版本？先到下方「MinIO 离线镜像」区导入新的 .tar，再点「重新检查」。
            </div>
          </div>
        )}

        {currentCopy.checks.length > 0 && (
          <div className="component-box">
            {currentCopy.checks.map((c) => (
              <div key={c.key} style={{ marginBottom: 6 }}>
                <Checkbox
                  checked={extraChecks[c.key] === true}
                  onChange={(e) => setExtraChecks((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                >
                  {c.label}{c.required ? '（必勾）' : '（默认不勾）'}
                </Checkbox>
                {c.help && <div className="component-hint">{c.help}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="component-hint" style={{ marginBottom: 4 }}>请输入 yes 确认：</div>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="yes" autoComplete="off" />
        <div className="component-hint" style={{ margin: '10px 0 4px' }}>
          一次性 sudo 密码（目标机已配免密 sudo 可留空）：
        </div>
        <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} placeholder="留空则用免密 sudo" autoComplete="new-password" />
        {proxyApplies && (
          <div className="component-box">
            <Checkbox checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)}>
              本次走代理（目标机直连 download.docker.com 很慢 / 被重置时勾选）
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
            <div className="component-hint" style={{ marginTop: 6 }}>
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
        <div className="component-hint" style={{ marginBottom: 4 }}>
          已选：{imageFile?.name ?? '（未选择）'}。请输入 yes 确认：
        </div>
        <Input value={imageConfirmText} onChange={(e) => setImageConfirmText(e.target.value)} placeholder="yes" autoComplete="off" />
        <div className="component-hint" style={{ margin: '10px 0 4px' }}>
          一次性 sudo 密码（目标机已配免密 sudo 可留空）：
        </div>
        <Input.Password value={imagePassword} onChange={(e) => setImagePassword(e.target.value)} placeholder="留空则用免密 sudo" autoComplete="new-password" />
      </Modal>
    </div>
  )
}
