import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Input, Segmented, Select, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'

import type { BackupMode, BackupRunRequest, BackupTask } from '../../backup/types.ts'
import { BackupLog } from '../../backup/components/BackupLog.tsx'
import { WriteConfirmModal } from '../../backup/components/WriteConfirmModal.tsx'
import { restoreApi } from '../api.ts'
import {
  errText,
  fetchRestorePlan,
  fetchRestoreSnapshot,
  resumeBackupTask,
  startRestore,
} from '../service.ts'
import type { WatchHooks } from '../service.ts'
import type {
  RestoreCandidate,
  RestoreComponent,
  RestorePlan,
  RestoreSnapshot,
  ServerOption,
} from '../types.ts'
import {
  DEFAULT_TEST_DB,
  EMPTY_RESTORE_PLAN,
  EMPTY_RESTORE_SNAPSHOT,
  componentLabel,
  componentOptions,
  restoreGate,
  restorePhases,
  restoreRunEnabled,
} from '../utils/format.ts'

/**
 * 第 7 个导航项「备份恢复」：默认视图只读，执行是独立且显式的写动作。
 *
 * 🔴 `--server` / 界面下拉只认**备份机**（候选来源 / 采集地 / 脚本执行地）；
 *    数据写到生产端，由该机 backup.env 的 PG_SSH_HOST / SRC_URL 决定、不由清单另选。
 *    计划首行回显恢复目标，方向写反是这条链路最贵的事故（评审 R2）。
 * 🔴 「停定时备份」是本机表单状态（人的显式声明），不是采集事实：工具不读 crontab、
 *    不自动停 / 装定时任务（R1）。未确认时服务端下发全局阻塞。
 * 🔴 换选中行 = 重新请求一次 /api/restore/plan：服务端重采并自己算 available /
 *    全局 blockers / 行 blockers，前端只渲染，不重算（R3）。
 * 🔴 界面「预演」不是执行凭证：服务端每次写动作前自己再跑一遍 --dry-run（R4）；
 *    报告只报脚本结果，不写「恢复成功，服务正常」（R5）。
 * 交互基线见 docs/backup-restore-prototype.html（六个场景就是验收用例集）。
 */
export function RestorePage({ onGoMonitor, onGoConfig }: { onGoMonitor: () => void; onGoConfig: () => void }) {
  const [targets, setTargets] = useState<ServerOption[]>([])
  const [name, setName] = useState('')
  const [component, setComponent] = useState<RestoreComponent>('pg')
  const [snapshot, setSnapshot] = useState<RestoreSnapshot>(EMPTY_RESTORE_SNAPSHOT)
  const [candLoading, setCandLoading] = useState(false)
  const [candError, setCandError] = useState('')
  const [selected, setSelected] = useState('')
  const [db, setDb] = useState(DEFAULT_TEST_DB)
  const [cronConfirmed, setCronConfirmed] = useState(false)
  const [plan, setPlan] = useState<RestorePlan>(EMPTY_RESTORE_PLAN)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const [log, setLog] = useState('')
  const [task, setTask] = useState<BackupTask | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null)
  const [dryFailed, setDryFailed] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [yes, setYes] = useState('')
  const [dbInput, setDbInput] = useState('')
  const [dbInput2, setDbInput2] = useState('')
  const [minioConfirm, setMinioConfirm] = useState('')
  const [checks, setChecks] = useState<[boolean, boolean, boolean]>([false, false, false])
  const [coverProduction, setCoverProduction] = useState(false)

  // StrictMode 会把 effect 跑两遍：每次新轮询领一个 id，旧轮询发现 id 变了就自己退出。
  const alive = useRef(true)
  const pollId = useRef(0)
  const planSeq = useRef(0)

  const makeHooks = useCallback((id: number): WatchHooks => ({
    onChunk: (chunk) => setLog((prev) => prev + chunk),
    onTask: setTask,
    shouldStop: () => !alive.current || pollId.current !== id,
  }), [])

  const refreshCandidates = useCallback(async (target: string, comp: RestoreComponent) => {
    if (!target) {
      setSnapshot(EMPTY_RESTORE_SNAPSHOT)
      setSelected('')
      return
    }
    setCandLoading(true)
    try {
      const s = await fetchRestoreSnapshot(restoreApi, target, comp)
      if (alive.current) {
        setSnapshot(s)
        setCandError('')
        setSelected((prev) => {
          if (prev && s.candidates.some((c) => c.id === prev && c.selectable)) return prev
          return s.candidates.find((c) => c.selectable)?.id ?? ''
        })
      }
    } catch (e) {
      if (alive.current) {
        setSnapshot({ ...EMPTY_RESTORE_SNAPSHOT, server: target, component: comp, error: errText(e) })
        setSelected('')
        setCandError(errText(e))
      }
    } finally {
      if (alive.current) setCandLoading(false)
    }
  }, [])

  const refreshPlan = useCallback(async (
    target: string, comp: RestoreComponent, candidate: string, targetDb: string, cron: boolean,
  ) => {
    const seq = ++planSeq.current
    if (!target) {
      setPlan(EMPTY_RESTORE_PLAN)
      return
    }
    setPlanLoading(true)
    try {
      const p = await fetchRestorePlan(restoreApi, {
        name: target, component: comp, candidate, db: targetDb, cronConfirmed: cron,
      })
      if (alive.current && planSeq.current === seq) {
        setPlan(p)
        setPlanError('')
      }
    } catch (e) {
      if (alive.current && planSeq.current === seq) {
        setPlan(EMPTY_RESTORE_PLAN)
        setPlanError(errText(e))
      }
    } finally {
      if (alive.current && planSeq.current === seq) setPlanLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    let cancelled = false
    void (async () => {
      try {
        const res = await restoreApi.targets()
        if (!cancelled) {
          setTargets(res.servers)
          setName((prev) => prev || res.default || res.servers[0]?.name || '')
        }
      } catch (e) {
        if (!cancelled) setNotice({ kind: 'error', text: errText(e) })
      }
    })()
    void (async () => {
      const id = ++pollId.current
      try {
        const t = await resumeBackupTask(restoreApi, makeHooks(id))
        if (!cancelled && t) {
          setTask(t)
          setBusy(t.running)
        }
      } catch {
        // 后端还没有任务状态时 resume 返回 null，不必打扰用户。
      }
    })()
    return () => { cancelled = true; alive.current = false }
  }, [makeHooks])

  useEffect(() => {
    setDryFailed(false)
    void refreshCandidates(name, component)
  }, [name, component, refreshCandidates])

  // 换选中行 / 组件 / 库名 / cron 声明 → 重新取一次计划（服务端重采，不在前端重算）。
  useEffect(() => {
    void refreshPlan(name, component, selected, db, cronConfirmed)
  }, [name, component, selected, db, cronConfirmed, refreshPlan])

  const run = useCallback(async (mode: BackupMode, extra: Partial<BackupRunRequest> = {}) => {
    if (!name || !selected) {
      setNotice({ kind: 'error', text: '请先选择备份机，并选中一行可用的恢复点。' })
      return
    }
    const id = ++pollId.current
    setBusy(true)
    setLog('')
    setTask(null)
    setNotice({ kind: 'info', text: mode === 'restore' ? '恢复任务已提交，正在等后端输出…' : '只读预演已提交…' })
    try {
      const req: BackupRunRequest = {
        mode, name, component,
        restore_candidate: selected,
        restore_db: db,
        restore_cron_confirmed: cronConfirmed,
        ...extra,
      }
      const t = await startRestore(restoreApi, req, makeHooks(id))
      setTask(t)
      if (mode === 'restore-dry') {
        setDryFailed(t.exit_code !== 0)
        setNotice(t.exit_code === 0
          ? { kind: 'success', text: '只读预演完成，生产端没有被修改；预演不是执行凭证。' }
          : { kind: 'error', text: `预演没过（退出码 ${t.exit_code}），执行入口已禁用；请看日志里的阻塞原因。` })
      } else {
        setNotice(t.exit_code === 0
          ? { kind: 'success', text: '恢复脚本已退出 0。报告只报脚本结果，应用可用性需人工确认。' }
          : { kind: 'error', text: `任务结束，退出码 ${t.exit_code}。停在当前阶段，没有自动重试 / 清场，请看日志。` })
      }
    } catch (e) {
      setNotice({ kind: 'error', text: errText(e) })
    } finally {
      setBusy(false)
      void refreshPlan(name, component, selected, db, cronConfirmed)
    }
  }, [name, component, selected, db, cronConfirmed, makeHooks, refreshPlan])

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false)
    setYes(''); setDbInput(''); setDbInput2(''); setMinioConfirm('')
    setChecks([false, false, false]); setCoverProduction(false)
  }, [])

  const openConfirm = useCallback(() => {
    setYes(''); setDbInput(''); setDbInput2(''); setMinioConfirm('')
    setChecks([false, false, false]); setCoverProduction(false)
    setConfirmOpen(true)
  }, [])

  const gate = restoreGate({
    component, yes, planDb: db, db: dbInput, db2: dbInput2,
    minioConfirm, checks, coverProduction, busy,
  })

  const submitConfirm = useCallback(() => {
    if (!gate.ok) return
    closeConfirm()
    void run('restore', {
      confirm: 'yes',
      restore_db: dbInput.trim(),
      restore_db2: dbInput2.trim(),
      restore_minio_confirm: minioConfirm.trim(),
      restore_checks: [true, true, true],
      restore_cron_confirmed: cronConfirmed,
      restore_cover_production: coverProduction,
    })
  }, [gate.ok, closeConfirm, run, dbInput, dbInput2, minioConfirm, cronConfirmed, coverProduction])

  const canRun = restoreRunEnabled(plan, snapshot, selected, busy, dryFailed)
  const canReadOnly = !busy && name.trim() !== '' && selected !== ''
  const phases = useMemo(() => restorePhases(log, task?.done === true, task?.exit_code ?? 0), [log, task])
  const gateHint = canRun
    ? '点「执行恢复…」还要过确认弹窗（库名两次 / YES + yes + 三项前置 + 覆盖生产）。'
    : dryFailed
      ? '最近一次预演没过，执行入口已禁用；先按日志排查，不要绕过门禁。'
      : plan.blockers[0] ?? '等当前任务结束，或先选中一行可用的恢复点。'

  const columns: TableProps<RestoreCandidate>['columns'] = component === 'pg'
    ? [
        { title: '', width: 40, render: (_: unknown, r) => (
          <input type="radio" name="restore-candidate" checked={selected === r.id}
            onChange={() => setSelected(r.id)} aria-label={`选择 ${r.id}`} />
        ) },
        { title: '恢复点（文件名）', dataIndex: 'id', render: (v: string) => <code>{v}</code> },
        { title: '时间', dataIndex: 'time', width: 110 },
        { title: '大小', dataIndex: 'size', width: 100 },
        { title: '分级', dataIndex: 'grade', width: 80 },
        { title: '校验和', dataIndex: 'checksum', width: 90,
          render: (v: string) => <Tag color={v === '通过' ? 'green' : 'orange'}>{v}</Tag> },
        { title: '归档', dataIndex: 'archive', width: 100 },
        { title: '新鲜度', dataIndex: 'freshness', width: 100 },
        { title: '状态', width: 200, render: (_: unknown, r: RestoreCandidate) => r.selectable
          ? <Tag color="green">可用</Tag>
          : <span style={{ color: '#a8071a' }}>{r.row_blockers.join('；')}</span> },
      ]
    : [
        { title: '', width: 40, render: (_: unknown, r) => (
          <input type="radio" name="restore-candidate" checked={selected === r.id}
            onChange={() => setSelected(r.id)} aria-label={`选择 ${r.id}`} />
        ) },
        { title: '备份端桶（来源）', dataIndex: 'label', render: (v: string) => <code>{v}</code> },
        { title: '生产端桶（目标）', dataIndex: 'target', render: (v: string) => <code>{v}</code> },
        { title: '对象数', dataIndex: 'objects', width: 100 },
        { title: '最近同步', dataIndex: 'synced', width: 120 },
        { title: '状态', width: 200, render: (_: unknown, r: RestoreCandidate) => r.selectable
          ? <Tag color="green">可用</Tag>
          : <span style={{ color: '#a8071a' }}>{r.row_blockers.join('；')}</span> },
      ]

  const usable = snapshot.candidates.filter((c) => c.selectable).length
  const phaseTone: Record<string, string | undefined> = { done: 'green', run: 'blue', fail: 'red', wait: undefined }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>备份恢复</h1>
          <div className="page-meta">
            目标机 = <b>备份机</b>（候选 / 脚本 / 采集都在这台）；数据写回<b>生产端</b>，
            由这台机上的 <code>backup.env</code> 决定、不能在这里另选。默认只读，执行必须有人值守。
          </div>
        </div>
        <Tag color={snapshot.collected ? 'green' : 'orange'}>
          {snapshot.collected ? 'collected=true' : 'collected=false'}
        </Tag>
      </header>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="恢复是「补齐 + 覆盖」，不是精确回滚；工具不读 crontab，也不自动停 / 装定时任务"
        description="PG 的 --clean 只清 dump 里有的对象，MinIO 的 mc mirror 不带 --remove；多余对象一律保留、由人比对。停写 / 停定时备份 / 留现场是人的前置声明。恢复脚本禁止入 Crontab，失败不自动重试或清场。报告只报脚本结果，不承诺应用可用。"
        action={<Button size="small" onClick={onGoMonitor}>备份监控</Button>}
      />

      {notice && (
        <Alert style={{ marginBottom: 12 }} type={notice.kind} showIcon closable
          message={notice.text} onClose={() => setNotice(null)} />
      )}
      {(candError || planError || snapshot.error) && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message={`只读采集 / 计划：${candError || planError || snapshot.error}`} />
      )}

      {/* ---- 前置状态：采集事实 + 人的显式声明 ---- */}
      <section className="card component-panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>恢复前置状态</b>
          <span className="component-hint">来自只读采集；连不上也回完整快照，不白屏</span>
          <Button size="small" loading={candLoading} disabled={!name}
            onClick={() => void refreshCandidates(name, component)}>刷新候选（只读）</Button>
          <Button size="small" onClick={onGoConfig}>去配置页核对生产端</Button>
        </div>
        <div className="once-source-grid">
          <div className="component-box">
            <div className="component-hint" style={{ marginBottom: 4 }}>目标机 / 执行身份</div>
            <div className="once-source-list">
              <div><span className="k">备份机（--server）</span><span className="v"><code>{name || '（未选）'}</code></span></div>
              <div><span className="k">执行身份</span><span className="v"><code>{snapshot.identity}</code></span></div>
              <div><span className="k">上次成功心跳</span><span className="v"><code>{snapshot.heartbeat}</code></span></div>
              <div><span className="k">备份盘余量</span><span className="v"><code>{snapshot.disk_free}</code></span></div>
            </div>
          </div>
          <div className="component-box">
            <div className="component-hint" style={{ marginBottom: 4 }}>恢复目标（由 backup.env 决定，只回显）</div>
            <div className="once-source-list">
              <div><span className="k">PG 生产端</span><span className="v"><code>{snapshot.pg_host}:{snapshot.pg_port} · 库 {snapshot.pg_db}</code></span></div>
              <div><span className="k">PG 容器 / 并发</span><span className="v"><code>{snapshot.pg_container} · -j {snapshot.pg_jobs}</code></span></div>
              <div><span className="k">MinIO 生产端</span><span className="v"><code>{snapshot.src_url}</code></span></div>
              <div><span className="k">桶 / 前缀</span><span className="v"><code>{snapshot.src_buckets} · {snapshot.dest_prefix}</code></span></div>
            </div>
          </div>
        </div>
        <div className="once-dir" style={{ marginTop: 10 }}>
          <Tag color="blue">备份机 {name || '（未选）'}</Tag>
          <span>→</span>
          <Tag color="red">生产端（backup.env）</Tag>
          <span className="component-hint">{snapshot.direction}</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <Checkbox checked={cronConfirmed} onChange={(e) => setCronConfirmed(e.target.checked)}>
            我已按 §3.0 第 5 条人工停定时备份，并确认不会与恢复并发
            <div className="component-hint">
              本机表单状态，不写远端；工具<b>不读 crontab</b>、不自动停 / 装定时任务。未确认时服务端下发全局阻塞。
            </div>
          </Checkbox>
        </div>
        <div className="component-hint" style={{ marginTop: 6 }}>
          停定时备份：{snapshot.cron_status}（{cronConfirmed ? '已人工确认' : '未确认，阻塞执行'}）。{snapshot.cron_note}
        </div>
      </section>

      {/* ---- 候选清单 ---- */}
      <section className="card component-panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>恢复点候选（只读）</b>
          <Tag>{snapshot.collected ? `候选 ${snapshot.candidates.length} · 可用 ${usable}` : '候选 — · 可用 —'}</Tag>
          <span className="component-hint">采不到标 collected=false，显示 —，不用 0 兜底</span>
        </div>
        <div className="backup-form">
          <label className="backup-field">
            <span>备份机（只认清单 name）</span>
            <Select style={{ minWidth: 220 }} value={name || undefined} placeholder="从 servers.json 选择"
              options={targets.map((s) => ({
                label: s.role ? `${s.name}（${s.role}）` : s.name, value: s.name,
              }))}
              onChange={(v: string) => { setName(v); setSelected('') }} />
          </label>
          <label className="backup-field">
            <span>组件</span>
            <Segmented options={componentOptions} value={component}
              onChange={(v) => { setComponent(String(v) as RestoreComponent); setSelected('') }} />
          </label>
          <label className="backup-field">
            <span>目标库（计划回显，默认 restore_test）</span>
            <Input style={{ width: 200 }} value={db} onChange={(e) => setDb(e.target.value)}
              placeholder="restore_test" autoComplete="off" />
          </label>
        </div>
        <Table<RestoreCandidate>
          style={{ marginTop: 10 }}
          size="small"
          rowKey="id"
          loading={candLoading}
          dataSource={snapshot.candidates}
          columns={columns}
          pagination={false}
          locale={{ emptyText: snapshot.collected ? '备份根目录下没有符合白名单的恢复点' : '没采到（collected=false）· 数值一律显示 —，禁止用 0 兜底' }}
          rowClassName={(r) => (selected === r.id ? 'restore-row-selected' : '')}
          onRow={(r) => ({ onClick: () => r.selectable && setSelected(r.id) })}
        />
        <div className="component-hint" style={{ marginTop: 8 }}>
          选一行才能预演 / 执行；候选路径由服务端按快照拼，接口不接受任意路径。
          {component === 'minio' && ' 🔴 minio_restore.sh 固定按 SRC_BUCKETS 恢复全部桶；选中行用于核对目标与预演范围，工具不按单个桶筛选。'}
        </div>
      </section>

      {/* ---- 预演与执行计划 ---- */}
      <section className="card component-panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>预演与执行计划</b>
          <Tag color={plan.available ? 'green' : 'orange'}>{plan.available ? '可提交执行' : '执行入口禁用'}</Tag>
          <span className="component-hint">服务端下发，前端只渲染 · 换选中行会重新取计划</span>
          <Button size="small" loading={planLoading} disabled={!name}
            onClick={() => void refreshPlan(name, component, selected, db, cronConfirmed)}>重新读取计划（只读）</Button>
        </div>
        <div className="component-box" style={{ marginBottom: 10 }}>
          <b>{plan.target}</b>
        </div>
        <div className="once-plan-grid">
          <div className="component-box">
            <div className="component-hint" style={{ marginBottom: 4 }}>影响清单（首行是恢复目标）</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.9 }}>
              {plan.impact.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
          <div className="component-box">
            <div className="component-hint" style={{ marginBottom: 4 }}>全局 / 候选行阻塞</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.9 }}>
              {plan.blockers.length === 0
                ? <li>无全局阻塞：候选可用、任务锁空闲、前置已确认</li>
                : plan.blockers.map((b) => <li key={b} style={{ color: '#a8071a' }}>{b}</li>)}
              {plan.row_blockers.map((b) => <li key={b} style={{ color: '#a8071a' }}>选中行：{b}</li>)}
            </ul>
          </div>
          <div className="component-box">
            <div className="component-hint" style={{ marginBottom: 4 }}>警告</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.9 }}>
              {plan.warnings.slice(0, 2).map((w) => <li key={w}>{w}</li>)}
            </ul>
            {plan.warnings.length > 2 && (
              <details style={{ marginTop: 6 }}>
                <summary className="component-hint">另 {plan.warnings.length - 2} 条</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }}>
                  {plan.warnings.slice(2).map((w) => <li key={w}>{w}</li>)}
                </ul>
              </details>
            )}
          </div>
        </div>
        <div className="component-box" style={{ marginTop: 10 }}>
          <div className="component-hint" style={{ marginBottom: 4 }}>将执行 / 只读预演的命令（服务端拼，不接收任意路径）</div>
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
        <div className="backup-actions" style={{ marginTop: 10 }}>
          <Button disabled={!canReadOnly} loading={busy} onClick={() => void run('restore-dry')}>
            预演（--dry-run，只读）
          </Button>
          <Button danger type="primary" disabled={!canRun} onClick={openConfirm}>
            执行恢复…
          </Button>
        </div>
        <div className="component-hint" style={{ marginTop: 8 }}>
          门禁：{gateHint} <b>预演不是执行凭证</b>，服务端写动作前会自己再跑一遍 --dry-run；{plan.note}
        </div>
      </section>

      {/* ---- 任务日志与报告 ---- */}
      <section className="card component-panel" style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>任务日志与报告</b>
          <div className="component-hint">任务脱离 HTTP 请求；恢复与备份 / 部署 / 装依赖 / 重启共用一把锁；日志逐行脱敏、上限 256 KB</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {phases.map((p) => <Tag key={p.name} color={phaseTone[p.state]}>{p.name}{p.state === 'fail' ? ' · 失败' : ''}</Tag>)}
        </div>
        <div className="backup-status">
          <span>备份机：{task?.server || name || '—'}</span>
          {task?.component && <span>组件：{componentLabel(task.component)}</span>}
          {task?.done && <span>退出码：{task.exit_code}</span>}
        </div>
        <BackupLog text={log} compact emptyText="还没有输出。先点「预演（--dry-run，只读）」；执行前服务端会自己再预检一次。" />
        {task?.done && (task.mode === 'restore' || task.mode === 'restore-dry') && (
          <Alert
            style={{ marginTop: 12 }}
            type={task.exit_code === 0 ? 'success' : 'error'}
            showIcon
            message={task.mode === 'restore-dry' ? '只读预演结束（不是执行凭证）'
              : task.exit_code === 0 ? '恢复脚本已退出 0（只报脚本结果）' : '任务结束：停在当前失败阶段'}
            description="报告只报脚本结果，不承诺应用可用。应用可用性 / Flyway schema 兼容性 / 关键表与对象核对是人工步骤；旧 dump 落后时需前向修复。失败不自动重试 / 清场、不改心跳；恢复是补齐 + 覆盖，多余对象保留。工具不读 / 不改 crontab，按 §3.3 人工收尾后再看只读的备份监控页。"
          />
        )}
      </section>

      <details className="card" style={{ marginTop: 12, padding: 12 }}>
        <summary>设计注记 · 与 docs/backup-restore.md 的对照</summary>
        <ul style={{ fontSize: 12, lineHeight: 1.9 }}>
          <li>三段式（§5.2）：只读候选 → 预演 → 显式执行；一次只恢复一个组件、一个候选，不塞进监控页。</li>
          <li>R1：安全条里的「停定时备份」是本机勾选，不是采集事实；工具不读 crontab。</li>
          <li>R2：--server 只认备份机，计划首行回显生产端；R3：换选中行重新取计划，前端不算 available。</li>
          <li>R4 / R5：预演不是执行凭证；报告只报脚本结果，失败停在当前阶段、不自动重试或清场。</li>
          <li>门禁（§5.3）：confirm=yes、库名两次 / YES、三项前置全勾、覆盖生产额外勾、无 sudo 密码框。</li>
        </ul>
      </details>

      <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        CLI 等价入口：<code>ops restore list/plan/run --server &lt;备份机&gt; --component pg|minio</code>。
        界面不开放任意主机 / 任意路径 / <code>--force</code>，也不收 sudo 密码；恢复脚本禁止入 Crontab。
      </Typography.Paragraph>

      {/* 复用备份域的确认弹窗：showPassword 默认 false，恢复不提权。 */}
      <WriteConfirmModal
        open={confirmOpen}
        title={`确认恢复 ${componentLabel(component)}（会覆盖生产端数据）`}
        okText="确定恢复"
        alertDescription={`将把 ${selected || '—'} 恢复到由 ${name} 的 backup.env 指定的生产端（见上方计划首行）。恢复是「补齐 + 覆盖」，不是精确回滚；不自动停 / 装定时任务、不自动删多余对象、失败不自动重试或清场。服务端先跑 --dry-run，预检不过不会执行。`}
        yes={yes}
        onYes={setYes}
        okDisabled={!gate.ok}
        onSubmit={submitConfirm}
        onCancel={closeConfirm}
        onAfterClose={() => {
          setYes(''); setDbInput(''); setDbInput2(''); setMinioConfirm('')
          setChecks([false, false, false]); setCoverProduction(false)
        }}
        footerNote="🔴 以清单 user 运行、不提权，弹窗没有 sudo 密码框；三项前置是人的声明，工具不替你验证。服务端每次写动作前自己再跑 --dry-run；报告只报脚本结果。"
      >
        <div className="component-box" style={{ marginBottom: 12 }}>
          <div className="component-hint" style={{ marginBottom: 6 }}>影响清单（服务端下发）：</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }}>
            {plan.impact.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
        {component === 'pg' ? (
          <>
            <div className="component-hint">计划里回显的目标库：<code>{db}</code>（输入要逐字一致；生产库要额外勾覆盖生产）</div>
            <Input style={{ marginTop: 6 }} value={dbInput} onChange={(e) => setDbInput(e.target.value)}
              placeholder="目标库名" autoComplete="off" />
            <Input style={{ marginTop: 6 }} value={dbInput2} onChange={(e) => setDbInput2(e.target.value)}
              placeholder="再输一次目标库名" autoComplete="off" />
          </>
        ) : (
          <>
            <div className="component-hint">确认覆盖生产端同名对象，请输入 <code>YES</code>：</div>
            <Input style={{ marginTop: 6 }} value={minioConfirm} onChange={(e) => setMinioConfirm(e.target.value)}
              placeholder="YES" autoComplete="off" />
          </>
        )}
        <div style={{ marginTop: 10 }}>
          {([
            '已停写：应用或写入方已停，不会边写边恢复',
            '已停定时备份：按 §3.0 第 5 条人工确认（不是恢复的副作用）',
            '已留现场：恢复前另存了一份可反悔的当前数据',
          ] as const).map((label, i) => (
            <div key={label} style={{ marginTop: 4 }}>
              <Checkbox checked={checks[i]}
                onChange={(e) => setChecks((prev) => {
                  const next: [boolean, boolean, boolean] = [...prev]
                  next[i] = e.target.checked
                  return next
                })}>
                {label}
                <div className="component-hint">人的声明，不是工具校验</div>
              </Checkbox>
            </div>
          ))}
        </div>
        {gate.needProd && (
          <div style={{ marginTop: 8 }}>
            <Checkbox checked={coverProduction} onChange={(e) => setCoverProduction(e.target.checked)}>
              <span style={{ color: '#a8071a' }}>我确认覆盖生产</span>
              <div className="component-hint">这会覆盖现网数据；默认应恢复到临时库验证后再决定</div>
            </Checkbox>
          </div>
        )}
        {!gate.ok && <div className="component-hint" style={{ marginTop: 8 }}>还差：{gate.reason}</div>}
      </WriteConfirmModal>
    </div>
  )
}
