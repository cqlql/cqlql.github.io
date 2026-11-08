import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Input, Segmented, Select, Tag, Typography } from 'antd'

import { backupApi } from '../api.ts'
import { BackupLog } from '../components/BackupLog.tsx'
import { WriteConfirmModal } from '../components/WriteConfirmModal.tsx'
import { errText, fetchDeps, resumeBackupTask, startBackup } from '../service.ts'
import type { WatchHooks } from '../service.ts'
import type {
  BackupComponent,
  BackupDepsView,
  BackupMode,
  BackupRunRequest,
  BackupTask,
  ServerOption,
} from '../types.ts'
import {
  EMPTY_DEPS,
  canStart,
  componentLabel,
  componentOptions,
  confirmHint,
  depsHit,
  depsInstallEnabled,
  modeLabel,
  normalizePgMajorInput,
  pgMajorValue,
  taskPhase,
  uninstallButtonEnabled,
  uninstallSubmitEnabled,
} from '../utils/format.ts'

/** 确认弹窗只服务三个写模式；预检与自检永远只读。 */
type ConfirmMode = 'deploy' | 'deps' | 'deps-uninstall'

/**
 * 页面只做：取目标机列表、拼装请求、显示阶段与日志、管弹窗。
 * 「任务怎么追、日志怎么拼」在 service.ts，判定在 utils/format.ts。
 * 2026-11-07 追加「备份依赖」区：只读状态 + 显式「安装缺少依赖」（mode=deps），
 * 与「安装 / 升级备份能力」共用同一把后台任务锁和同一个服务端预检门。
 */
export function BackupPage() {
  const [targets, setTargets] = useState<ServerOption[]>([])
  const [name, setName] = useState('')
  const [component, setComponent] = useState<BackupComponent>('all')
  const [log, setLog] = useState('')
  const [task, setTask] = useState<BackupTask | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null)

  // 备份依赖：只读状态、可选 PG 主版本（走 PGDG 官方仓库）、安装确认模式。
  const [deps, setDeps] = useState<BackupDepsView>(EMPTY_DEPS)
  const [depsLoading, setDepsLoading] = useState(false)
  const [pgMajor, setPgMajor] = useState('')
  const pgMajorNum = pgMajorValue(pgMajor)

  // 二次确认：yes + 一次性 sudo 密码。两个值都不缓存、不留历史。
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>('deploy')
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  // 卸载勾选项一律默认不勾（与组件卸载「删数据默认不勾」同一条规矩）。
  const [uninstallSelected, setUninstallSelected] = useState<string[]>([])

  // StrictMode 会把 effect 跑两遍；每次新轮询领一个 id，旧轮询发现 id 变了就自己退出。
  const alive = useRef(true)
  const pollId = useRef(0)

  const makeHooks = useCallback((id: number): WatchHooks => {
    return {
      onChunk: (chunk) => setLog((prev) => prev + chunk),
      onTask: setTask,
      shouldStop: () => !alive.current || pollId.current !== id,
    }
  }, [])

  const refreshDeps = useCallback(async (target: string, comp: BackupComponent, major?: number) => {
    if (!target) return
    setDepsLoading(true)
    try {
      const v = await fetchDeps(backupApi, target, comp, major)
      if (alive.current) setDeps(v)
    } catch (e) {
      if (alive.current) setDeps({ ...EMPTY_DEPS, error: errText(e) })
    } finally {
      if (alive.current) setDepsLoading(false)
    }
  }, [])

  // 挂载时接回一个可能已经在跑的任务：刷新 / 切走标签页都**不会**打断远端安装，
  // 回来之后还能继续看到日志（见 service.ts 的 resumeBackupTask）。
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

  // 目标机 / 组件 / PG 主版本一变就重拉只读依赖状态；不占任务锁、不要 confirm。
  useEffect(() => {
    if (name) void refreshDeps(name, component, pgMajorNum)
  }, [name, component, pgMajorNum, refreshDeps])

  const run = useCallback(
    async (mode: BackupMode, extra: Partial<BackupRunRequest> = {}) => {
      if (!name) {
        setNotice({ kind: 'error', text: '请先选择目标服务器。' })
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
        setNotice(
          t.exit_code === 0
            ? { kind: 'success', text: `${modeLabel(mode)}完成。` }
            : { kind: 'error', text: `任务结束，退出码 ${t.exit_code}。请看日志并跑一次「远端自检」复核。` },
        )
      } catch (e) {
        setNotice({ kind: 'error', text: errText(e) })
      } finally {
        setBusy(false)
        void refreshDeps(name, component, pgMajorNum)
      }
    },
    [name, component, pgMajorNum, makeHooks, refreshDeps],
  )

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false)
    setConfirmText('')
    setPassword('')
    setUninstallSelected([])
  }, [])

  const openConfirm = useCallback((mode: ConfirmMode) => {
    setConfirmMode(mode)
    setConfirmText('')
    setPassword('')
    setUninstallSelected([])
    setConfirmOpen(true)
  }, [])

  const submitConfirm = useCallback(() => {
    if (confirmText !== 'yes') return
    if (confirmMode === 'deps-uninstall' &&
      !uninstallSubmitEnabled(deps.uninstall, uninstallSelected, confirmText)) return
    const pw = password
    const mode = confirmMode
    const targets = uninstallSelected
    closeConfirm()
    void run(mode, {
      confirm: 'yes',
      ...(pw ? { password: pw } : {}),
      ...(mode === 'deps' && pgMajorNum ? { pg_major: pgMajorNum } : {}),
      ...(mode === 'deps-uninstall' ? { targets } : {}),
    })
  }, [confirmText, password, confirmMode, pgMajorNum, uninstallSelected, deps.uninstall, closeConfirm, run])

  const phase = useMemo(() => taskPhase(task), [task])
  const enabled = !busy && canStart(task, name)
  const depsEnabled = depsInstallEnabled(deps, busy, name)
  const uninstallEnabled = uninstallButtonEnabled(deps, busy, name)
  const confirmOk = confirmMode === 'deps-uninstall'
    ? uninstallSubmitEnabled(deps.uninstall, uninstallSelected, confirmText)
    : confirmText === 'yes'
  const depsTag = !deps.collected
    ? { color: 'default', text: '未采集到状态' }
    : deps.missing.length > 0
      ? { color: 'orange', text: `缺 ${deps.missing.length} 项` }
      : { color: 'green', text: '已齐全' }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>备份能力部署</h1>
          <div className="page-meta">
            预检与自检只读；安装 / 安装缺少依赖会写远端，需输入 yes 确认
          </div>
        </div>
        <Tag color={phase.tone === 'default' ? undefined : phase.tone}>{phase.text}</Tag>
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

      <div className="card backup-panel">
        <div className="backup-form">
          <label className="backup-field">
            <span>目标服务器</span>
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
          <Button disabled={!enabled} loading={busy} onClick={() => void run('preflight')}>
            备份部署预检（只读）
          </Button>
          <Button disabled={!enabled} loading={busy} onClick={() => void run('verify')}>
            远端自检
          </Button>
          <Button danger type="primary" disabled={!enabled} onClick={() => openConfirm('deploy')}>
            安装 / 升级备份能力
          </Button>
        </div>
      </div>

      <section className="card component-panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>备份依赖</b>
          <Tag color={depsTag.color}>{depsTag.text}</Tag>
          <span className="component-hint">
            {deps.collected ? `已采集 · ${deps.server}` : '未采集到状态（连不上时是「未知」，不是「已安装」）'}
          </span>
          <Button
            size="small"
            loading={depsLoading}
            disabled={!name || busy}
            onClick={() => void refreshDeps(name, component, pgMajorNum)}
          >
            重新检查（只读）
          </Button>
          <Button
            size="small"
            type="primary"
            danger
            disabled={!depsEnabled}
            title={depsEnabled ? '安装缺失命令' : (deps.error ?? '没有缺少的依赖，或状态还没采到')}
            onClick={() => openConfirm('deps')}
          >
            安装缺少依赖
          </Button>
          <Button
            size="small"
            danger
            disabled={!uninstallEnabled}
            title={uninstallEnabled ? '卸载工具装的命令，供复测' : (deps.error ?? '状态还没采到，或没有可卸项')}
            onClick={() => openConfirm('deps-uninstall')}
          >
            卸载依赖（复测用）
          </Button>
        </div>

        {deps.error && <Alert type="warning" showIcon message={deps.error} style={{ marginBottom: 10 }} />}
        {depsHit(log) && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 10 }}
            message="日志提示缺少依赖"
            description="预检 / 安装报缺 mc、pg_restore 等命令时，可直接点本区「安装缺少依赖」；只装命令，不会顺带重部署备份脚本。"
          />
        )}

        <div className="component-table-wrap">
          <table className="component-table">
            <thead>
              <tr>
                <th>命令</th>
                <th>用途</th>
                <th>状态</th>
                <th>版本 / 安装来源</th>
              </tr>
            </thead>
            <tbody>
              {deps.items.length === 0 && (
                <tr><td colSpan={4} className="empty">尚未采集到依赖状态</td></tr>
              )}
              {deps.items.map((it) => (
                <tr key={it.name}>
                  <td className="mono">{it.name}</td>
                  <td className="muted">{it.label}{it.optional ? '（可选）' : ''}</td>
                  <td><Tag color={it.installed ? 'green' : it.optional ? 'default' : 'orange'}>{it.installed ? '已安装' : it.optional ? '缺失（可选）' : '缺失'}</Tag></td>
                  <td>{it.version || it.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {deps.plan.length > 0 && (
          <div className="component-box" style={{ marginTop: 10 }}>
            <div className="component-hint" style={{ marginBottom: 4 }}>这次会装什么（由服务端按缺失项算好）：</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
              {deps.plan.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <label className="backup-field">
            <span>PG 主版本（可选）</span>
            <Input
              value={pgMajor}
              onChange={(e) => setPgMajor(normalizePgMajorInput(e.target.value))}
              placeholder="留空"
              style={{ width: 90 }}
              autoComplete="off"
            />
          </label>
          <span className="component-hint">
            留空装发行版仓库的 postgresql-client；填 16 则按 PostgreSQL 官方 PGDG 仓库装 postgresql-client-16（服务端再校验一次）。
          </span>
        </div>
        <div className="component-note">
          官方文档：
          {deps.docs.map((d) => (
            <a key={d.url} href={d.url} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>{d.label}</a>
          ))}
          {deps.docs.length === 0 && ' PostgreSQL PGDG / MinIO mc（优先目标机离线镜像，再按官方地址下载；每步有硬超时与进度输出）'}
        </div>
      </section>

      <div className="backup-status">
        <span>阶段：{phase.text}</span>
        {task?.server && <span>目标：{task.server}</span>}
        {task?.component && <span>组件：{componentLabel(task.component)}</span>}
        {task?.done && <span>退出码：{task.exit_code}</span>}
      </div>

      {/* `.card` 本身没有内边距：日志空态改成一行提示后，这里要补上，
          否则虚线提示框会紧贴卡片边框（与手动备份页同口径）。 */}
      <div className="card" style={{ padding: 16 }}>
        <BackupLog text={log} />
      </div>

      <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        安装 /「安装缺少依赖」/「卸载依赖」都由服务端先跑一遍 <code>--dry-run</code>，预检不过不会执行；
        <code>yes</code> 与 sudo 密码都只在本次请求里使用（密码经子进程 stdin 交给 CLI，不落盘、不进日志）。
        依赖安装是独立的 <code>ops backup deps</code>，只装命令；卸载是 <code>ops backup deps-uninstall</code>，
        只删工具装的 mc / PG 客户端，不卸系统基础包、不 autoremove、不碰数据与定时任务。
        界面仍不开放 <code>--force</code> / <code>--run-now</code> / <code>--install-deps</code>，
        需要时走命令行 <code>ops backup deploy</code> 或 <code>启动运维.cmd --menu</code>。
      </Typography.Paragraph>

      {/* 与「手动备份」页共用同一个门禁组件；安装期显式打开密码框（要提权），
          手动备份页传 showPassword=false，弹窗里根本没有这个输入框。 */}
      <WriteConfirmModal
        open={confirmOpen}
        title={confirmMode === 'deps' ? '确认安装缺少依赖'
          : confirmMode === 'deps-uninstall' ? deps.uninstall.title : '确认安装 / 升级备份能力'}
        okText={confirmMode === 'deps' ? '确认安装依赖'
          : confirmMode === 'deps-uninstall' ? deps.uninstall.submit_label : '确认安装'}
        alertDescription={confirmHint(confirmMode, name, component)}
        yes={confirmText}
        onYes={setConfirmText}
        okDisabled={!confirmOk}
        onSubmit={submitConfirm}
        onCancel={closeConfirm}
        onAfterClose={() => {
          setConfirmText('')
          setPassword('')
          setUninstallSelected([])
        }}
        showPassword
        password={password}
        onPassword={setPassword}
      >
        {confirmMode === 'deps' && deps.missing.length > 0 && (
          <div className="component-box" style={{ marginBottom: 12 }}>
            <div className="component-hint">本次要补的命令：{deps.missing.join('、')}</div>
            {pgMajorNum && <div className="component-hint">PG 主版本：{pgMajorNum}（PGDG 官方仓库）</div>}
          </div>
        )}
        {confirmMode === 'deps-uninstall' && (
          <div className="component-box" style={{ marginBottom: 12 }}>
            <div className="component-hint" style={{ marginBottom: 6 }}>选择要卸载的命令（默认都不勾，至少选一个）：</div>
            {deps.uninstall.targets.map((t) => (
              <div key={t.key} style={{ marginBottom: 6 }}>
                <Checkbox
                  checked={uninstallSelected.includes(t.key)}
                  onChange={(e) => setUninstallSelected((prev) => e.target.checked
                    ? [...prev, t.key]
                    : prev.filter((k) => k !== t.key))}
                >
                  {t.label}
                </Checkbox>
                <div className="component-hint">{t.help}</div>
              </div>
            ))}
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }}>
              {deps.uninstall.impacts.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        )}
      </WriteConfirmModal>
    </div>
  )
}
