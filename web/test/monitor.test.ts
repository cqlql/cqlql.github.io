import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  cacheLabel,
  collectedLabel,
  errText,
  fmtValue,
  normalizeProblems,
  normalizeStatus,
  normalizeView,
  pickDefaultServer,
  problemTone,
} from '../src/features/monitor/utils/format.ts'
import type { MonitorTargetsView } from '../src/features/monitor/types.ts'

/**
 * 备份监控页的判定全在 Go 侧；这里钉死的是「展示层不许自己编数据」：
 * null = 没采到（—），0 = 真的 0，数组恒为数组，默认机与 CLI 同序。
 */

test('normalizeView 把缺字段 / nil slice 兜成可直接渲染的结构', () => {
  const v = normalizeView(null)
  assert.equal(v.cached, false)
  assert.equal(v.age_seconds, 0)
  assert.deepEqual(v.status.problems, [])
  assert.equal(v.status.connection.ok, false)
  assert.equal(v.status.pg.collected, false)
  assert.equal(v.status.pg.latest_size_mb, null)
  assert.deepEqual(v.thresholds, { pg_stale_hours: 0, minio_stale_hours: 0, disk_warn_pct: 0 })

  const withNulls = normalizeView({ status: { problems: null, pg: { latest_size_mb: null } }, thresholds: null })
  assert.deepEqual(withNulls.status.problems, [])
  assert.equal(withNulls.status.pg.latest_size_mb, null)
})

test('normalizeStatus 不用 0 兜没采到，也不把真实的 0 弄丢', () => {
  const s = normalizeStatus({
    pg: { collected: true, latest_size_mb: 0, total_mb: 0 },
    disk: { collected: true, free_mb: 0, used_pct: 100 },
    minio: { collected: true },
  })
  assert.equal(s.pg.latest_size_mb, 0)
  assert.equal(s.pg.total_mb, 0)
  assert.equal(s.disk.free_mb, 0)
  assert.equal(s.disk.used_pct, 100)
  assert.equal(s.pg.last_success_age_hours, null)
  assert.equal(s.minio.data_size_mb, null)
})

test('fmtValue：— 只给没采到，0 老实显示', () => {
  assert.equal(fmtValue(null, 'MB'), '—')
  assert.equal(fmtValue(undefined, 'h'), '—')
  assert.equal(fmtValue(Number.NaN, 'MB'), '—')
  assert.equal(fmtValue(0, 'MB'), '0.0 MB')
  assert.equal(fmtValue(123.44, 'MB'), '123.4 MB')
  assert.equal(fmtValue(80, '%', 0), '80%')
  assert.equal(fmtValue(180, 'ms', 0), '180 ms')
  assert.equal(fmtValue(7), '7.0')
})

test('normalizeProblems 兜住 null / 脏元素', () => {
  assert.deepEqual(normalizeProblems(null), [])
  assert.deepEqual(normalizeProblems([{ level: 'danger', text: '连不上' }, null, {}]), [
    { level: 'danger', text: '连不上' },
    { level: 'warn', text: '' },
    { level: 'warn', text: '' },
  ])
})

test('问题颜色与采集标签只用后端给的 level / collected', () => {
  assert.equal(problemTone('danger'), 'error')
  assert.equal(problemTone('warn'), 'warning')
  assert.equal(problemTone('unknown'), 'info')
  assert.equal(collectedLabel(true), '已采集')
  assert.equal(collectedLabel(false), '没采到')
})

test('默认目标机与 CLI 的 Resolve 同序，选不出来就留空', () => {
  const twoBackups: MonitorTargetsView = {
    servers: [
      { name: 'bk1', role: 'backup' },
      { name: 'bk2', role: 'backup' },
      { name: 'app', role: 'app' },
    ],
  }
  assert.equal(pickDefaultServer(null), '')
  assert.equal(pickDefaultServer(twoBackups), '')
  assert.equal(pickDefaultServer({ ...twoBackups, default: 'bk2' }), 'bk2')
  assert.equal(pickDefaultServer({ ...twoBackups, default: '不存在' }), '')
  assert.equal(
    pickDefaultServer({ servers: [{ name: 'bk', role: 'backup' }, { name: 'app', role: 'app' }] }),
    'bk',
  )
  assert.equal(pickDefaultServer({ servers: [{ name: 'app', role: 'app' }] }), '')
})

test('缓存与错误文案只是展示，不改快照', () => {
  const v = normalizeView({ cached: true, age_seconds: 12 })
  assert.equal(cacheLabel(v), '命中服务端缓存 · 12 秒前采集')
  assert.equal(cacheLabel(normalizeView({ cached: false })), '刚刚采集')
  assert.equal(errText(new Error('断网')), '断网')
  assert.equal(errText('xxx'), 'xxx')
})
