import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Segmented, Select, Tag, Typography } from 'antd'

import { backupApi } from '../api.ts'
import { BackupLog } from '../components/BackupLog.tsx'
import { WriteConfirmModal } from '../components/WriteConfirmModal.tsx'
import { errText, fetchOncePlan, fetchOnceSource, resumeBackupTask, startBackup } from '../service.ts'
import type { WatchHooks } from '../service.ts'
import type {
  BackupComponent,
  BackupMode,
  BackupRunRequest,
  BackupTask,
  OncePlan,
  OnceSourceItem,
  OnceSourceView,
  ServerOption,
} from '../types.ts'
import {
  EMPTY_ONCE_PLAN,
  EMPTY_ONCE_SOURCE,
  componentLabel,
  componentOptions,
  modeLabel,
  onceConfirmEnabled,
  onceRunEnabled,
  taskPhase,
} from '../utils/format.ts'

/**
 * 第 6 个导航项「手动备份」：默认视图只读，执行是独立且显式的写动作。
 *
 * 🔴 语义（用户最容易误解的一点）：界面的「目标服务器」是**备份机** —— 脚本在这台跑、
 *    dump / 桶 / 心跳都落在它上面；被备份的**生产端**由这台机器上的 backup.env 决定，
 *    不能也不该在本页另选（方案 §3 / 硬约束 12）。所以这里用只读接口把生产端回显出来，
 *    让人在触发前看清「到底备份谁」，而不是留一句含糊的说明。
 *
 * 判据见 docs/backup-once.md §2.2 / §2.4，交互基线见 docs/backup-once-prototype.html：
 *  - 动作计划（能否执行 / 阻塞 / 影响清单 / 将执行的命令）由 Go 侧下发，前端只渲染；
 *  - 「定时任务状态」恒为「不采集」，工具不读 crontab；
 *  - 预演是只读展示、不是执行凭证，服务端每次写动作前自己再跑 --dry-run；
 *  - 撞锁 / 组件失败 / 超时是运行期结果，不在计划里预测；
 *  - 每份报告固定带「手动触发不代表定时任务正常」；弹窗没有 sudo 密码框。
 */
export function OncePage({ onGoMonitor, onGoConfig }: { onGoMonitor: () => void; onGoConfig: () => void }) {
  const [targets, setTargets] = useState<ServerOption[]>([])
  const [name, setName] = useState('')
  const [component, setComponent] = useState<BackupComponent>('all')
  const [plan, setPlan] = useState<OncePlan>(EMPTY_ONCE_PLAN)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const [source, setSource] = useState<OnceSourceView>(EMPTY_ONCE_SOURCE)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [log, setLog] = useState('')
  const [task, setTask] = useState<BackupTask | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null)
  // 最近一次预演没过就禁用执行入口（运行期的结论，不是计划里的全局阻塞）。
  const [dryFailed, setDryFailed] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [checks, setChecks] = useState<[boolean, boolean]>([false, false])

  // StrictMode 会把 effect 跑两遍；每次新轮询领一个 id，旧轮询发现 id 变了就自己退出。
  const alive = useRef(true)
  const pollId = useRef(0)

  const makeHooks = useCallback((id: number): WatchHooks => ({
    onChunk: (chunk) => setLog((prev) => prev + chunk),
    onTask: setTask,
    shouldStop: () => !alive.current || pollId.current !== id,
  }), [])

  const refreshPlan = useCallback(async (target: string, comp: BackupComponent) => {
    if (!target) {
      setPlan(EMPTY_ONCE_PLAN)
      return
    }
    setPlanLoading(true)
    try {
      const p = await fetchOncePlan(backupApi, target, comp)
      if (alive.current) {
        setPlan(p)
        setPlanError('')
      }
    } catch (e) {
      if (alive.current) {
        setPlan(EMPTY_ONCE_PLAN)
        setPlanError(errText(e))
      }
    } finally {
      if (alive.current) setPlanLoading(false)
    }
  }, [])

  // 固定抓 all：切组件只改前端显示哪一份，不必再连一次远端。
  const refreshSource = useCallback(async (target: string) => {
    if (!target) {
      setSource(EMPTY_ONCE_SOURCE)
      return
    }
    setSourceLoading(true)
    try {
      const s = await fetchOnceSource(backupApi, target, 'all')
      if (alive.current) setSource(s)
    } catch (e) {
      if (alive.current) setSource({ ...EMPTY_ONCE_SOURCE, error: errText(e) })
    } finally {
      if (alive.current) setSourceLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    let cancelled = false

    void (async () => {
      try {
        const res = await backupApi.targets()
        if (cancelled) return
        setTargets(res.servers)
        setName((prev) => prev || res.default || res.servers[0]?.name || '')
      } catch (e) {
        if (!cancelled) setNotice({ kind: 'error', text: errText(e) })
      }
    })()

    void (async () => {
      const id = ++pollId.current
      try {
        const t = await resumeBackupTask(backupApi, makeHooks(id))
        if (cancelled) return
        if (t) {
          setTask(t)
          setBusy(t.running)
        }
      } catch {
        // 后端还没有任务状态时 resume 会返回 null；这里不必打扰用户。
      }
    })()

    return () => {
      cancelled = true
      alive.current = false
    }
  }, [makeHooks])

  // 目标机 / 组件变了就重拉只读计划；换机或换组件后上一次预演结论作废。
  useEffect(() => {
    setDryFailed(false)
    void refreshPlan(name, component)
  }, [name, component, refreshPlan])

  useEffect(() => {
    void refreshSource(name)
  }, [name, refreshSource])

  const run = useCallback(async (mode: BackupMode, extra: Partial<BackupRunRequest> = {}) => {
    if (!name) {
      setNotice({ kind: 'error', text: '请先选择备份机。' })
      return
    }
    const id = ++pollId.current
    setBusy(true)
    setLog('')
    setTask(null)
    setNotice({ kind: 'info', text: `${modeLabel(mode)}已提交，正在等后端输出…` })
    try {
      const t = await startBackup(backupApi, { mode, name, component, ...extra }, makeHooks(id))
      setTask(t)
      if (mode === 'once-dry') setDryFailed(t.exit_code !== 0)
      if (mode === 'once') {
        setNotice(t.exit_code === 0
          ? { kind: 'success', text: '备份脚本已退出 0。本次为手动触发，不代表定时任务正常。' }
          : { kind: 'error', text: `任务结束，退出码 ${t.exit_code}。请看日志里的分组件结果；没有自动重试，也不要立刻重跑。` })
      } else if (mode === 'once-dry') {
        setNotice(t.exit_code === 0
          ? { kind: 'success', text: '预演完成，远端没有被修改；预演不是执行凭证。' }
          : { kind: 'error', text: `预演没过（退出码 ${t.exit_code}），执行入口已禁用；远端没有被修改。` })
      } else {
        setNotice(t.exit_code === 0
          ? { kind: 'success', text: `${modeLabel(mode)}完成。` }
          : { kind: 'error', text: `任务结束，退出码 ${t.exit_code}。请看日志。` })
      }
    } catch (e) {
      setNotice({ kind: 'error', text: errText(e) })
    } finally {
      setBusy(false)
      void refreshPlan(name, component)
    }
  }, [name, component, makeHooks, refreshPlan])

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false)
    setConfirmText('')
    setChecks([false, false])
  }, [])

  const openConfirm = useCallback(() => {
    setConfirmText('')
    setChecks([false, false])
    setConfirmOpen(true)
  }, [])

  const submitConfirm = useCallback(() => {
    if (!onceConfirmEnabled(confirmText, checks)) return
    closeConfirm()
    void run('once', { confirm: 'yes' })
  }, [confirmText, checks, closeConfirm, run])

  const phase = useMemo(() => taskPhase(task), [task])
  const canRun = onceRunEnabled(plan, busy, name, dryFailed)
  const canReadOnly = !busy && name.trim() !== ''
  const confirmOk = onceConfirmEnabled(confirmText, checks)
  const gateHint = canRun
    ? '点「立即备份…」还要过确认弹窗（输 yes + 两项勾选）。'
    : dryFailed
      ? '最近一次预演没过，执行入口已禁用；先按日志排查，不要绕过门禁。'
      : plan.blockers[0] ?? '等当前任务结束，或先选择备份机。'

  const sourceColumns: { title: string; items: OnceSourceItem[] }[] = component === 'pg'
    ? [{ title: 'PostgreSQL（生产端）', items: source.pg }]
    : component === 'minio'
      ? [{ title: 'MinIO（生产端）', items: source.minio }]
      : [
        { title: 'PostgreSQL（生产端）', items: source.pg },
        { title: 'MinIO（生产端）', items: source.minio },
      ]

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>手动备份</h1>
          <div className="page-meta">
            目标服务器 = <b>备份机</b>（脚本在这台跑、备份存这台）；备份对象是<b>生产端</b>，
            由这台备份机上的 <code>backup.env</code> 决定，不能在这里另选。预演只读，执行要输 yes 确认。
          </div>
        </div>
        <Tag color={phase.tone === 'default' ? undefined : phase.tone}>{phase.text}</Tag>
      </header>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="定时任务状态：不采集（工具不读 crontab）"
        description="手动成功也会写 last_success.txt，不代表定时任务正常；要看心跳请去只读的「备份监控」页。"
        action={<Button size="small" onClick={onGoMonitor}>备份监控</Button>}
      />

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
      {planError && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={`读取动作计划失败：${planError}`} />}

      <section className="card component-panel">
        <div className="once-dir">
          <Tag color="blue">生产端 PG / MinIO（由 backup.env 指定）</Tag>
          <span>→</span>
          <Tag color="green">备份机 {name || '（未选）'}</Tag>
          <span className="component-hint">两个备份脚本在这台机器上 pull 数据，dump / 桶 / 心跳都落在它上面。</span>
        </div>

        <div className="backup-form" style={{ marginTop: 12 }}>
          <label className="backup-field">
            <span>备份机（目标服务器，只认清单 name）</span>
            <Select
              style={{ minWidth: 220 }}
              value={name || undefined}
              placeholder="从 servers.json 选择"
              options={targets.map((s) => ({
                label: s.role ? `${s.name}（${s.role}）` : s.name,
                value: s.name,
              }))}
              onChange={(v: string) => setName(v)}
            />
          </label>
          <label className="backup-field">
            <span>组件</span>
            <Segmented
              options={componentOptions}
              value={component}
              onChange={(v) => setComponent(String(v) as BackupComponent)}
            />
          </label>
        </div>

        <div className="backup-actions">
          <Button disabled={!canReadOnly} loading={busy} onClick={() => void run('verify')}>
            只读预检（verify）
          </Button>
          <Button disabled={!canReadOnly} loading={busy} onClick={() => void run('once-dry')}>
            预演（--dry-run，只读）
          </Button>
          <Button danger type="primary" disabled={!canRun} onClick={openConfirm}>
            立即备份…
          </Button>
        </div>
        <div className="component-hint" style={{ marginTop: 8 }}>
          组件顺序：{plan.order}（串行）。预演只跑 preflight + 打印计划、不改远端；
          <b>预演不是执行凭证</b>，服务端写动作前会自己再跑一遍 --dry-run。
        </div>
      </section>

      <section className="card component-panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}>备份对象（生产端，只读）</b>
          <Tag color={source.collected ? 'green' : 'default'}>
            {source.collected ? `已采集 · ${source.fetched_at ?? '远端 backup.env'}` : '未采集到'}
          </Tag>
          <Button size="small" loading={sourceLoading} disabled={!name} onClick={() => void refreshSource(name)}>
            重新读取（只读）
          </Button>
          <Button size="small" onClick={onGoConfig}>去配置页改生产端</Button>
        </div>
        <div className="component-hint" style={{ marginBottom: 8 }}>{source.note}</div>
        {source.error && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message={source.error} />}
        {source.collected ? (
          <div className="once-source-grid">
            {sourceColumns.map((col) => (
              <div className="component-box" key={col.title}>
                <div className="component-hint" style={{ marginBottom: 4 }}>{col.title}</div>
                <div className="once-source-list">
                  {col.items.map((it) => (
                    <div key={it.key}>
                      <span className="k">{it.label}</span>
                      <span className="v"><code>{it.value}</code></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="component-hint">
            没读到远端 <code>backup.env</code>（可能还没部署、连不上或没权限）：这里显示「未采集到」，
            <b>不猜生产端主机、也不用 0 兜底</b>。
          </div>
        )}
      </section>

      <section className="card component-panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>预演与执行计划</b>
          <Tag color={plan.available ? 'green' : 'orange'}>{plan.available ? '可提交执行' : '执行入口禁用'}</Tag>
          <span className="component-hint">服务端下发，前端只渲染</span>
          <Button size="small" loading={planLoading} disabled={!name} onClick={() => void refreshPlan(name, component)}>
            重新读取计划（只读）
          </Button>
        </div>
        <div className="once-plan-grid">
          <div className="component-box">
            <div className="component-hint" style={{ marginBottom: 4 }}>将执行（命令由服务端按组件拼）</div>
            <ul className="once-command-list">
              {plan.commands.map((line) => {
                const i = line.indexOf('#')
                return (
                  <li key={line}>
                    <code>{i < 0 ? line.trim() : line.slice(0, i).trim()}</code>
                    {i >= 0 && <div className="component-hint">{line.slice(i + 1).trim()}</div>}
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="component-box">
            <div className="component-hint" style={{ marginBottom: 4 }}>影响清单（一次备份不只是多一个 dump）</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.9 }}>
              {plan.impact.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
          <div className="component-box">
            <div className="component-hint" style={{ marginBottom: 4 }}>阻塞与警告（服务端下发）</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.9 }}>
              {plan.blockers.length === 0
                ? <li>无全局阻塞：计划可用、任务锁空闲</li>
                : plan.blockers.map((b) => <li key={b} style={{ color: '#a8071a' }}>{b}</li>)}
              {plan.warnings.slice(0, 1).map((w) => <li key={w}>{w}</li>)}
            </ul>
            {plan.warnings.length > 1 && (
              <details style={{ marginTop: 6 }}>
                <summary className="component-hint">另 {plan.warnings.length - 1} 条警告</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }}>
                  {plan.warnings.slice(1).map((w) => <li key={w}>{w}</li>)}
                </ul>
              </details>
            )}
          </div>
        </div>
        <div className="component-hint" style={{ marginTop: 10 }}>
          门禁：{gateHint} 撞锁 / 组件失败 / 超时都是运行期结果，差异体现在任务日志与报告里。
        </div>
      </section>

      {/* 🔴 别漏 component-panel：`.card` 本身没有内边距，少了它整卡内容会贴边。 */}
      <section className="card component-panel" style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>任务日志与报告</b>
          <div className="component-hint">任务脱离 HTTP 请求；刷新页面不打断；日志按行脱敏、上限 256 KB</div>
        </div>
        <div className="backup-status">
          <span>阶段：{phase.text}</span>
          {task?.server && <span>备份机：{task.server}</span>}
          {task?.component && <span>组件：{componentLabel(task.component)}</span>}
          {task?.done && <span>退出码：{task.exit_code}</span>}
        </div>
        <BackupLog text={log} compact emptyText="还没有输出。先点「预演（--dry-run，只读）」，执行前服务端会自己再预检一次。" />
        {task?.done && (
          <Alert
            style={{ marginTop: 12 }}
            type={task.exit_code === 0 ? 'success' : 'error'}
            showIcon
            message={task.mode === 'once-dry'
              ? '预演结束（不是执行凭证）'
              : task.exit_code === 0 ? '备份脚本已退出 0' : '任务结束：请看日志里的分组件结果'}
            description="报告只报脚本结果，不写「备份体系正常 / 定时任务正常」。⚠️ 本次为手动触发，不代表定时任务正常；工具不读 crontab。超时只结束本机等待，远端可能仍在执行；不自动重试、不自动清场。要看心跳请去「备份监控」页（只读）。"
          />
        )}
      </section>

      <details className="card" style={{ marginTop: 12, padding: 12 }}>
        <summary>设计注记 · 与 docs/backup-once.md 的对照</summary>
        <ul style={{ fontSize: 12, lineHeight: 1.9 }}>
          <li>独立页（§2.2）：监控页纯只读，手动成功会改心跳，读与写混屏最易误读；部署页是一次性装机动作。</li>
          <li>六道门（§3）：confirm=yes、name 只认清单、组件白名单、不收 sudo 密码、服务端预检门、单任务锁 + 日志脱敏。</li>
          <li>生产端由备份机 backup.env 决定（§3）：本页只回显非凭证白名单字段，凭证不进响应与任务日志。</li>
          <li>脚本内 flock -n 防与定时窗口撞车；工具不读 crontab、不改 crontab 行（§4.1）。</li>
        </ul>
      </details>

      <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        CLI 等价入口：<code>ops backup once [pg|minio|all] --server &lt;name&gt; [--dry-run]</code>。
        界面不开放 <code>--force</code> / <code>--run-now</code> / <code>--install-deps</code>，
        也不接收任意脚本路径；确认弹窗没有 sudo 密码框。
      </Typography.Paragraph>

      <WriteConfirmModal
        open={confirmOpen}
        title={`确认在备份机 ${name} 上执行一次备份`}
        okText="确定备份"
        alertDescription={`将备份 ${componentLabel(component)} 对应的生产端数据（来源见上方「备份对象」）：不重装脚本、不写 crontab、不提权。会新增 dump / 对象，并附带分级清理与覆盖同名对象。服务端先跑 --dry-run 预检，预检不过不会执行。`}
        yes={confirmText}
        onYes={setConfirmText}
        okDisabled={!confirmOk}
        onSubmit={submitConfirm}
        onCancel={closeConfirm}
        onAfterClose={() => {
          setConfirmText('')
          setChecks([false, false])
        }}
        footerNote="🔴 本动作以清单 user 运行、不提权，弹窗没有 sudo 密码框；服务端先跑 --dry-run，预演通过不是执行凭证。"
      >
        <div className="component-box" style={{ marginBottom: 12 }}>
          <div className="component-hint" style={{ marginBottom: 6 }}>影响清单（服务端下发）：</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }}>
            {plan.impact.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
        <div>
          <Checkbox
            checked={checks[0]}
            onChange={(e) => setChecks((prev) => [e.target.checked, prev[1]])}
          >
            我已看清影响清单（新增 dump / 清理旧备份 / 覆盖同名对象）
            <div className="component-hint">这是人的确认，不是工具校验</div>
          </Checkbox>
        </div>
        <div style={{ marginTop: 6 }}>
          <Checkbox
            checked={checks[1]}
            onChange={(e) => setChecks((prev) => [prev[0], e.target.checked])}
          >
            我明白本次为手动触发，不代表定时任务正常
            <div className="component-hint">工具不读 crontab；定时任务是否正常由人判断</div>
          </Checkbox>
        </div>
      </WriteConfirmModal>
    </div>
  )
}
