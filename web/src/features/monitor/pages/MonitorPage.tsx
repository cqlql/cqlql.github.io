import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Select, Space, Switch, Tag } from 'antd'

import { monitorApi } from '../api.ts'
import {
  cacheLabel,
  collectedLabel,
  errText,
  fmtValue,
  normalizeStatus,
  normalizeView,
  pickDefaultServer,
  problemTone,
} from '../utils/format.ts'
import type { MonitorTargetsView, MonitorView } from '../types.ts'
import { formatShortTime } from '../../../shared/utils/time.ts'

interface MonitorPageProps {
  /** 配置缺失 / 只读账号没配好时，把人送到能补的那页。 */
  onGoConfig: () => void
  /** 配置页改了 servers.json 后 +1：本页一直挂着，得重新拉清单。 */
  version: number
  /** 只有当前页才自动刷新：切去别的页别再无谓打备份机的 SSH。 */
  active: boolean
}

interface Row {
  label: string
  value: string
  mono?: boolean
}

/** 四张卡只渲染 Go 侧下发的字段；`—` 是「没采到」，0.0 是真实值。 */
function MonitorCard({ title, ok, rows, bar }: {
  title: string
  ok: boolean
  rows: Row[]
  /** 磁盘已用率的展示条：只是把已有数值画成宽度，不产生任何新指标。 */
  bar?: number | null
}) {
  return (
    <section className="card monitor-card">
      <div className="monitor-card-head">
        <h3>{title}</h3>
        <Tag color={ok ? 'green' : 'red'}>{collectedLabel(ok)}</Tag>
      </div>
      <div className="monitor-rows">
        {rows.map((r) => (
          <div className="monitor-row" key={r.label}>
            <span>{r.label}</span>
            <strong className={r.mono ? 'mono' : undefined}>{r.value === '' ? '—' : r.value}</strong>
          </div>
        ))}
      </div>
      {typeof bar === 'number' && Number.isFinite(bar) && (
        <div className="monitor-bar" aria-hidden="true">
          <div className="monitor-bar-fill" style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </div>
      )}
    </section>
  )
}

/**
 * P2+「备份监控」页：只读。
 *
 * 🔴 与 `ops status --json` 同一份 `Status`，判定全在 Go 侧 `assess()`；
 *    这里只做取数 / 格式化 / UI 状态，不重跑备份、不恢复、不改任何配置。
 * 🔴 默认目标机与 CLI 的 Resolve 同序（清单 default > 唯一 role=backup），
 *    选不出来就让人显式选，不擅自挑第一台。
 * 🔴 连不上 / 没配好都是 200 + 完整快照：页面照常显示四张卡 + 问题清单，
 *    不把「备份服务器连不上」渲染成一页白屏或一句 HTTP 错误。
 */
export function MonitorPage({ onGoConfig, version, active }: MonitorPageProps) {
  const [targets, setTargets] = useState<MonitorTargetsView | null>(null)
  const [name, setName] = useState('')
  const [view, setView] = useState<MonitorView | null>(null)
  const [setupError, setSetupError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [auto, setAuto] = useState(true)

  const alive = useRef(true)
  const reqId = useRef(0)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const loadTargets = useCallback(async () => {
    try {
      const v = await monitorApi.targets()
      if (!alive.current) return
      setTargets(v)
      setSetupError(v.setup_error ?? '')
      setName((prev) =>
        v.servers.some((s) => s.name === prev) ? prev : pickDefaultServer(v),
      )
    } catch (e) {
      if (alive.current) setError(errText(e))
    }
  }, [])

  useEffect(() => { void loadTargets() }, [loadTargets, version])

  const load = useCallback(async (target: string, force = false) => {
    if (!target) return
    const id = ++reqId.current
    setLoading(true)
    try {
      const v = normalizeView(await monitorApi.status(target, force))
      if (!alive.current || id !== reqId.current) return
      setView(v)
      setError('')
    } catch (e) {
      if (!alive.current || id !== reqId.current) return
      setError(errText(e))
    } finally {
      if (alive.current && id === reqId.current) setLoading(false)
    }
  }, [])

  // 换目标机就重新取一次（服务端有 30s 缓存，普通请求命中就复用）。
  useEffect(() => { if (name) void load(name) }, [name, load])

  // 60s 自动刷新；只在当前页、且开关打开时跑，切走不留定时器。
  useEffect(() => {
    if (!active || !auto || !name) return
    const id = window.setInterval(() => { void load(name) }, 60_000)
    return () => window.clearInterval(id)
  }, [active, auto, name, load])

  const st = view ? view.status : normalizeStatus(null)
  const cfgBroken = Boolean(view?.config_error)
  const problems = cfgBroken ? [] : st.problems
  const t = view?.thresholds

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>备份监控</h1>
          <div className="page-meta">
            只读查看 PG / MinIO 心跳、最新 dump 与磁盘余量 · 每 60 秒自动刷新（服务端缓存 30 秒）· 不触发备份或恢复
          </div>
        </div>
        <Space wrap className="monitor-head-actions">
          <Select
            aria-label="目标服务器"
            placeholder="选择目标服务器"
            style={{ minWidth: 200 }}
            value={name || undefined}
            onChange={(v) => setName(v)}
            options={(targets?.servers ?? []).map((s) => ({
              value: s.name,
              label: s.role === 'backup' ? `${s.name}（备份机）` : s.name,
            }))}
          />
          <label className="monitor-auto">
            <Switch checked={auto} onChange={setAuto} size="small" aria-label="自动刷新" />
            <span>自动刷新</span>
          </label>
          <Button type="primary" loading={loading} disabled={!name} onClick={() => void load(name, true)}>
            立即刷新
          </Button>
        </Space>
      </div>

      <div className="monitor-problems">
        {setupError && (
          <Alert
            type="info"
            showIcon
            message="服务器清单还没准备好"
            description={
              <div className="monitor-alert-body">
                <span>{setupError}</span>
                <Button size="small" onClick={onGoConfig}>去配置页</Button>
              </div>
            }
          />
        )}
        {view?.config_error && (
          <Alert
            type="warning"
            showIcon
            message="本机配置 / 只读账号没配好"
            description={
              <div className="monitor-alert-body">
                <span>
                  {view.config_error}　缺只读账号时，在「配置 → 服务器清单 → 只读监控账号」
                  填用户名与本机私钥路径（不能等于登录账号、不能是 root），保存后回来点「立即刷新」。
                </span>
                <Button size="small" onClick={onGoConfig}>去配置页</Button>
              </div>
            }
          />
        )}
        {error && <Alert type="error" showIcon message="读取备份状态失败" description={error} />}
        {view?.notice && <Alert type="info" showIcon message={view.notice} />}
        {view && !cfgBroken && problems.length === 0 && (
          <Alert type="success" showIcon message="未发现 danger / warn 级问题" />
        )}
        {problems.map((p, i) => (
          <Alert key={`${p.level}-${i}`} type={problemTone(p.level)} showIcon message={p.text} />
        ))}
      </div>

      <div className="monitor-grid">
        <MonitorCard
          title="连接"
          ok={st.connection.ok}
          rows={[
            { label: '只读目标', value: st.host, mono: true },
            { label: '可达', value: view ? (st.connection.ok ? '是' : '否') : '' },
            { label: '耗时', value: fmtValue(st.connection.latency_ms, 'ms', 0) },
            { label: '错误', value: st.connection.error },
          ]}
        />
        <MonitorCard
          title="PostgreSQL 备份"
          ok={st.pg.collected}
          rows={[
            { label: '上次成功', value: st.pg.last_success_raw },
            { label: '距今', value: fmtValue(st.pg.last_success_age_hours, 'h') },
            { label: '最新 dump', value: st.pg.latest_path, mono: true },
            { label: '大小', value: fmtValue(st.pg.latest_size_mb, 'MB') },
            { label: 'dump 距今', value: fmtValue(st.pg.latest_age_hours, 'h') },
            { label: '备份占用', value: fmtValue(st.pg.total_mb, 'MB') },
          ]}
        />
        <MonitorCard
          title="MinIO 备份"
          ok={st.minio.collected}
          rows={[
            { label: '上次成功', value: st.minio.last_success_raw },
            { label: '距今', value: fmtValue(st.minio.last_success_age_hours, 'h') },
            { label: '日志占用', value: fmtValue(st.minio.log_size_mb, 'MB') },
            { label: '数据目录占用', value: fmtValue(st.minio.data_size_mb, 'MB') },
          ]}
        />
        <MonitorCard
          title="磁盘"
          ok={st.disk.collected}
          bar={st.disk.used_pct}
          rows={[
            { label: '总量', value: fmtValue(st.disk.total_mb, 'MB', 0) },
            { label: '剩余', value: fmtValue(st.disk.free_mb, 'MB', 0) },
            { label: '已用', value: fmtValue(st.disk.used_pct, '%', 0) },
          ]}
        />
      </div>

      <div className="card monitor-foot">
        <span>远端主机：{st.remote_host || '—'}</span>
        <span title={st.checked_at}>采集时间：{st.checked_at ? formatShortTime(st.checked_at) : '—'}</span>
        <span>{view ? cacheLabel(view) : '尚未采集'}</span>
        <span>本机配置：<code>{view?.config_path || '—'}</code></span>
        <span>服务器清单：<code>{view?.servers_file || '—'}</code></span>
        <span>
          判定阈值（只读）：PG {fmtValue(t?.pg_stale_hours, 'h')} · MinIO {fmtValue(t?.minio_stale_hours, 'h')} · 磁盘 {fmtValue(t?.disk_warn_pct, '%', 0)}
        </span>
      </div>
    </div>
  )
}
