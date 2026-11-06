import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Input, Modal, Segmented, Select, Tag, Typography } from 'antd'

import { backupApi } from '../api.ts'
import { BackupLog } from '../components/BackupLog.tsx'
import { errText, resumeBackupTask, startBackup } from '../service.ts'
import type { WatchHooks } from '../service.ts'
import type {
  BackupComponent,
  BackupMode,
  BackupRunRequest,
  BackupTask,
  ServerOption,
} from '../types.ts'
import {
  canStart,
  componentLabel,
  componentOptions,
  confirmHint,
  taskPhase,
} from '../utils/format.ts'

/**
 * 页面只做：取目标机列表、拼装请求、显示阶段与日志、管弹窗。
 * 「任务怎么追、日志怎么拼」在 service.ts，判定在 utils/format.ts。
 */
export function BackupPage() {
  const [targets, setTargets] = useState<ServerOption[]>([])
  const [name, setName] = useState('')
  const [component, setComponent] = useState<BackupComponent>('all')
  const [log, setLog] = useState('')
  const [task, setTask] = useState<BackupTask | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null)

  // 安装二次确认：yes + 一次性 sudo 密码。两个值都不缓存、不留历史。
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')

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
      setNotice({ kind: 'info', text: `${mode === 'deploy' ? '安装' : mode === 'verify' ? '自检' : '预检'}已提交，正在等后端输出…` })
      try {
        const t = await startBackup(backupApi, { mode, name, component, ...extra }, makeHooks(id))
        setTask(t)
        setNotice(
          t.exit_code === 0
            ? { kind: 'success', text: `${componentLabel(component)} 任务完成。` }
            : { kind: 'error', text: `任务结束，退出码 ${t.exit_code}。请看日志并跑一次「远端自检」复核。` },
        )
      } catch (e) {
        setNotice({ kind: 'error', text: errText(e) })
      } finally {
        setBusy(false)
      }
    },
    [name, component, makeHooks],
  )

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false)
    setConfirmText('')
    setPassword('')
  }, [])

  const submitConfirm = useCallback(() => {
    if (confirmText !== 'yes') return
    const pw = password
    closeConfirm()
    void run('deploy', { confirm: 'yes', ...(pw ? { password: pw } : {}) })
  }, [confirmText, password, closeConfirm, run])

  const phase = useMemo(() => taskPhase(task), [task])
  const enabled = !busy && canStart(task, name)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>备份能力部署</h1>
          <div className="page-meta">
            预检与自检只读；安装会写远端 crontab / logrotate / 目录，需输入 yes 确认
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
          <Button danger type="primary" disabled={!enabled} onClick={() => setConfirmOpen(true)}>
            安装 / 升级备份能力
          </Button>
        </div>
      </div>

      <div className="backup-status">
        <span>阶段：{phase.text}</span>
        {task?.server && <span>目标：{task.server}</span>}
        {task?.component && <span>组件：{componentLabel(task.component)}</span>}
        {task?.done && <span>退出码：{task.exit_code}</span>}
      </div>

      <div className="card">
        <BackupLog text={log} />
      </div>

      <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        安装由服务端先跑一遍 <code>--dry-run</code>，预检不过不会装；
        <code>yes</code> 与 sudo 密码都只在本次请求里使用（密码经子进程 stdin 交给 CLI，不落盘、不进日志）。
        界面不开放 <code>--force</code> / <code>--run-now</code> / <code>--install-deps</code>，
        需要时仍走命令行 <code>ops backup deploy</code> 或 <code>启动运维.cmd --menu</code>。
      </Typography.Paragraph>

      <Modal
        open={confirmOpen}
        title="确认安装 / 升级备份能力"
        okText="确认安装"
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: confirmText !== 'yes' }}
        onOk={submitConfirm}
        onCancel={closeConfirm}
        afterClose={() => {
          setConfirmText('')
          setPassword('')
        }}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="这是写操作"
          description={confirmHint('deploy', name, component)}
        />
        <p className="hint">请输入 <code>yes</code> 确认（与命令行菜单一致）：</p>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          onPressEnter={submitConfirm}
          autoFocus
          autoComplete="off"
          placeholder="yes"
        />
        <p className="hint" style={{ marginTop: 12 }}>
          初始 sudo 密码（清单已配 <code>sudo.password</code> 或已免密时留空）：
          只用于本次请求，不落盘、不写日志。
        </p>
        <Input.Password
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          placeholder="可留空"
        />
      </Modal>
    </div>
  )
}
