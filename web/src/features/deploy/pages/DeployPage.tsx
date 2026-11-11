import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Segmented, Select, Space, Tag, Typography } from 'antd'

import { deployApi } from '../api.ts'
import { DeployLog } from '../components/DeployLog.tsx'
import { DeployStages } from '../components/DeployStages.tsx'
import { ReleaseConfirmModal } from '../components/ReleaseConfirmModal.tsx'
import { ReleaseForm } from '../components/ReleaseForm.tsx'
import { ReleaseHistory } from '../components/ReleaseHistory.tsx'
import {
  errText, fetchDeployPlan, fetchReleaseHistory, resumeDeployTask, startDeploy,
} from '../service.ts'
import type { DeployWatchHooks } from '../service.ts'
import { EMPTY_DEPLOY_PLAN, SCOPE_OPTIONS } from '../types.ts'
import type {
  DeployBump, DeployPlan, DeployReleaseRequest, DeployScope, DeployTask,
  ReleaseEvent, ReleaseHistoryView, ServerOption,
} from '../types.ts'
import { releaseGate } from '../utils/format.ts'

/**
 * 第 8 个导航项「应用部署」（P3b-3）。
 *
 * 判据见 deploy.md §10 / §10.4 / §11、ui.md §17；交互基线见 deploy-prototype.html 十场景。
 *  - 默认视图只读；「只读预演」是 P3a 同源、零写入，预演**不是执行凭证**；
 *  - 正式发布按钮**默认不可用**：选了目标机 + 预演通过 + 发版信息合法 + 没任务在跑，
 *    再点二次确认（yes + 三项勾选），服务端还有六道门 + 一遍独立预检 + 409；
 *  - 六阶段 / 实时日志 / 报告全部由 Go 侧下发，前端不算指标、不推断成功；
 *  - 撞锁 / 构建失败 / 健康门失败是运行期结果，不是预演阻塞；失败不自动回滚（P4）。
 */
export function DeployPage() {
  const [targets, setTargets] = useState<ServerOption[]>([])
  const [name, setName] = useState('')
  const [scope, setScope] = useState<DeployScope>('all')
  const [plan, setPlan] = useState<DeployPlan>(EMPTY_DEPLOY_PLAN)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')

  const [history, setHistory] = useState<ReleaseHistoryView>({ items: [] })
  const [historyServer, setHistoryServer] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [lastSuccess, setLastSuccess] = useState<ReleaseEvent | null>(null)

  const [onlineVersion, setOnlineVersion] = useState('未采集')
  const [version, setVersion] = useState('')
  const [note, setNote] = useState('')
  const [bump, setBump] = useState<DeployBump>('')

  const [log, setLog] = useState('')
  const [task, setTask] = useState<DeployTask | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [checks, setChecks] = useState<boolean[]>([false, false, false])

  // StrictMode 会把 effect 跑两遍；每次新轮询领一个 id，旧轮询发现 id 变了就自己退出。
  const alive = useRef(true)
  const pollId = useRef(0)

  const makeHooks = useCallback((id: number): DeployWatchHooks => ({
    onChunk: (chunk) => setLog((prev) => prev + chunk),
    onTask: setTask,
    shouldStop: () => !alive.current || pollId.current !== id,
  }), [])

  const refreshPlan = useCallback(async (server: string, s: DeployScope) => {
    if (!server) {
      setPlan(EMPTY_DEPLOY_PLAN)
      setPlanError('请先选择目标机。')
      return
    }
    setPlanLoading(true)
    try {
      const p = await fetchDeployPlan(deployApi, server, s)
      if (alive.current) {
        setPlan(p)
        setPlanError('')
      }
    } catch (e) {
      if (alive.current) {
        setPlan(EMPTY_DEPLOY_PLAN)
        setPlanError(errText(e))
      }
    } finally {
      if (alive.current) setPlanLoading(false)
    }
  }, [])

  const refreshHistory = useCallback(async (server: string) => {
    setHistoryLoading(true)
    try {
      // 表格按筛选取一份；「上次填写」按全量台账取，不受当前筛选影响。
      const [view, all] = await Promise.all([
        fetchReleaseHistory(deployApi, server),
        fetchReleaseHistory(deployApi, ''),
      ])
      if (!alive.current) return
      setHistory(view)
      setLastSuccess(all.items.find((ev) => ev.kind === 'release' && ev.result === 'success') ?? null)
    } catch (e) {
      if (alive.current) setHistory({ items: [], error: errText(e) })
    } finally {
      if (alive.current) setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    let cancelled = false
    void (async () => {
      try {
        const res = await deployApi.targets()
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
        const t = await resumeDeployTask(deployApi, makeHooks(id))
        if (cancelled || !t) return
        setTask(t)
        setBusy(t.running)
        if (t.report?.online_version && t.report.online_version !== '未采集') {
          setOnlineVersion(t.report.online_version)
        }
      } catch {
        // 后端还没有任务状态时 resume 返回 null；这里不必打扰用户。
      }
    })()
    return () => {
      cancelled = true
      alive.current = false
    }
  }, [makeHooks])

  useEffect(() => {
    void refreshHistory(historyServer)
  }, [historyServer, refreshHistory])

  // 换目标机 / 范围后，上一次预演结论作废，必须重新预演才能解锁发布按钮。
  useEffect(() => {
    setPlan(EMPTY_DEPLOY_PLAN)
    setPlanError('')
    setHistoryServer(name)
  }, [name, scope])

  const gate = useMemo(
    () => releaseGate(plan, version, note, busy, name),
    [plan, version, note, busy, name],
  )

  const openConfirm = () => {
    setConfirmText('')
    setChecks([false, false, false])
    setConfirmOpen(true)
  }

  const onCheck = (i: number, v: boolean) => {
    setChecks((prev) => prev.map((x, idx) => (idx === i ? v : x)))
  }

  const submit = useCallback(async () => {
    if (!gate.ok) return
    const req: DeployReleaseRequest = {
      confirm: 'yes', server: name, scope,
      release_version: version.trim(), release_note: note,
      bump: bump || 'manual', checks: [checks[0] === true, checks[1] === true, checks[2] === true],
    }
    setConfirmOpen(false)
    const id = ++pollId.current
    setBusy(true)
    setLog('')
    setTask(null)
    setNotice({ kind: 'info', text: '发布请求已提交，服务端正在逐字校验门禁…' })
    try {
      const t = await startDeploy(deployApi, req, makeHooks(id))
      if (!alive.current) return
      setTask(t)
      if (t.report?.online_version && t.report.online_version !== '未采集') {
        setOnlineVersion(t.report.online_version)
      }
      setNotice(t.report?.completed
        ? { kind: 'success', text: '发布链路执行完成；报告只报脚本结果，是否可用请看三个健康门。' }
        : { kind: 'error', text: `任务结束（退出码 ${t.exit_code}）：停在失败阶段、保留现场，不自动回滚。` })
      void refreshHistory(historyServer)
    } catch (e) {
      if (alive.current) setNotice({ kind: 'error', text: errText(e) })
    } finally {
      if (alive.current) setBusy(false)
    }
  }, [gate.ok, name, scope, version, note, bump, checks, makeHooks, refreshHistory, historyServer])

  const report = task?.report
  const stages = task?.stages ?? []
  const gates = task?.gates ?? []

  return (
    <div className="page">
      <div className="page-head">
        <h1>应用部署</h1>
        <div className="page-meta">
          只读预演 + 显式正式发布 · 目标机只来自 <code>servers.json</code> 的 name · 0 新键、不写 state.env
        </div>
      </div>

      {notice && (
        <Alert type={notice.kind} showIcon closable message={notice.text}
          onClose={() => setNotice(null)} style={{ marginBottom: 12 }} />
      )}

      <div className="card">
        <h3>目标机与发布范围</h3>
        <Space wrap style={{ marginBottom: 8 }}>
          <Select
            value={name || undefined}
            onChange={setName}
            placeholder="选择目标机"
            style={{ minWidth: 200 }}
            options={targets.map((s) => ({ value: s.name, label: `${s.name}${s.role ? `（${s.role}）` : ''}` }))}
          />
          <Segmented
            value={scope}
            onChange={(v) => setScope(v as DeployScope)}
            options={SCOPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
          />
          <Button onClick={() => void refreshPlan(name, scope)} loading={planLoading} disabled={!name || busy}>
            只读预演
          </Button>
        </Space>
        <p className="hint">
          只读预演走真实 ssh 的只读预检，不改远端、不拿锁、不落台账；<b>预演通过 ≠ 可以发布</b>。
          换目标机 / 范围后要重新预演。正式发布的服务端还会自己再跑一遍预检。
        </p>
        {planError && <Alert type="error" showIcon message={planError} style={{ marginTop: 8 }} />}
      </div>

      <div className="card">
        <h3>只读预演结果</h3>
        {!plan.preflight.collected && !planLoading && (
          <p className="hint">还没有采到远端快照。点上面的「只读预演」；连不上 / 配置错也回完整空视图，不猜 0。</p>
        )}
        {plan.preflight.checks.length > 0 && (
          <div className="once-plan-grid">
            {plan.preflight.checks.map((c, i) => (
              <div key={`${c.name}-${i}`} className="once-source-list">
                <div>
                  <span className="k">{c.name}</span>
                  <span className="v">{c.ok ? '✓' : '·'} {c.value || '—'}</span>
                </div>
                {c.detail && <div><span className="k" /><span className="v">{c.detail}</span></div>}
              </div>
            ))}
          </div>
        )}
        {plan.blockers.length > 0 && (
          <Alert type="error" showIcon style={{ marginTop: 10 }} message="全局阻塞"
            description={<ul>{plan.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>} />
        )}
        {plan.warnings.length > 0 && (
          <Alert type="warning" showIcon style={{ marginTop: 10 }} message="警告（不是阻塞）"
            description={<ul>{plan.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>} />
        )}
        <Typography.Title level={5} style={{ marginTop: 16 }}>将执行的命令（草案 · 只打印不执行）</Typography.Title>
        <ul className="once-command-list">
          {plan.commands.length === 0
            ? <li>还没有命令草案。</li>
            : plan.commands.map((c, i) => (
              <li key={i}><Tag>{c.phase}</Tag><code>{c.cmd}</code>{c.note ? ` — ${c.note}` : ''}</li>
            ))}
        </ul>
        <Typography.Title level={5} style={{ marginTop: 12 }}>影响清单</Typography.Title>
        <ul className="once-command-list">
          {plan.impact.length === 0 ? <li>还没有影响清单。</li> : plan.impact.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
        <p className="hint">
          available=<b>{plan.available ? 'true' : 'false'}</b> · {plan.note}
          {plan.error ? ` · 🔴 ${plan.error}` : ''}
        </p>
      </div>

      <div className="card">
        <h3>发版信息</h3>
        <ReleaseForm
          onlineVersion={onlineVersion}
          version={version}
          note={note}
          bump={bump}
          lastSuccess={lastSuccess}
          disabled={busy}
          onVersion={setVersion}
          onNote={setNote}
          onBump={setBump}
        />
        <Space wrap style={{ marginTop: 12 }}>
          <Button type="primary" danger disabled={!gate.ok} onClick={openConfirm}>
            正式发布…
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {gate.ok ? '预演与门禁已过；点开后仍要 yes + 三项勾选。' : `默认不可用：${gate.reasons.join('；')}`}
          </Typography.Text>
        </Space>
      </div>

      <div className="card">
        <h3>执行进度与实时日志</h3>
        <DeployStages stages={stages} gates={gates} />
        <div style={{ marginTop: 14 }}>
          <DeployLog text={log} />
        </div>
        {task?.error && !report && (
          <Alert type="error" showIcon style={{ marginTop: 10 }} message={task.error} />
        )}
        {report && (
          <Alert
            type={report.completed ? 'success' : 'error'}
            showIcon
            style={{ marginTop: 12 }}
            message={report.completed
              ? '发布链路执行完成（报告只报脚本结果）'
              : `停在「${report.failed_stage || '未知'}」阶段；不写「发布成功」、不自动回滚`}
            description={
              <Space direction="vertical" size={2}>
                <span>{report.note || '（报告没有附注）'}</span>
                {report.error && <span>🔴 {report.error}</span>}
                <span>
                  台账：{report.ledger_recorded ? '已 append 一条' : '本次没有记录（预演 / 门禁阻塞 / 撞锁不入账）'}
                  {report.ledger_error ? ` · ${report.ledger_error}` : ''}
                  {typeof report.duration_ms === 'number' ? ` · 耗时 ${report.duration_ms} ms` : ''}
                </span>
                <span>🔴 不写「服务已恢复正常」；Flyway 单向，镜像可回滚、数据库不回滚。</span>
              </Space>
            }
          />
        )}
      </div>

      <ReleaseHistory
        server={historyServer}
        view={history}
        loading={historyLoading}
        serverOptions={targets}
        onServer={setHistoryServer}
        onRefresh={() => void refreshHistory(historyServer)}
      />

      <ReleaseConfirmModal
        open={confirmOpen}
        plan={plan}
        online={onlineVersion}
        version={version}
        note={note}
        bump={bump}
        yes={confirmText}
        checks={checks}
        submitting={busy}
        onYes={setConfirmText}
        onChecks={onCheck}
        onCancel={() => setConfirmOpen(false)}
        onSubmit={() => void submit()}
      />
    </div>
  )
}
