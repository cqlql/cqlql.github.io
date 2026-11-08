import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fetchOncePlan, fetchOnceSource } from '../src/features/backup/service.ts'
import type { OncePlan, OnceSourceView } from '../src/features/backup/types.ts'
import {
  EMPTY_ONCE_PLAN,
  EMPTY_ONCE_SOURCE,
  confirmHint,
  modeLabel,
  needsConfirm,
  normalizeOncePlan,
  normalizeOnceSource,
  onceConfirmEnabled,
  onceRunEnabled,
} from '../src/features/backup/utils/format.ts'

/** 手动备份页的判定层：四条口径 + 执行门 + 确认门，全是不碰 DOM 的纯函数。 */

const plan = (patch: Partial<OncePlan> = {}): OncePlan => ({
  ...EMPTY_ONCE_PLAN,
  server: 'bk',
  component: 'all',
  order: 'pg → minio',
  available: true,
  blockers: [],
  warnings: ['本次为手动触发，不代表定时任务正常'],
  impact: ['新增 dump', '清理旧备份'],
  commands: ['ops backup once all --server bk'],
  ...patch,
})

test('手动备份模式：写模式要 yes，只读预演不要', () => {
  assert.equal(modeLabel('once'), '手动备份')
  assert.equal(modeLabel('once-dry'), '手动备份预演')
  assert.equal(needsConfirm('once'), true)
  assert.equal(needsConfirm('once-dry'), false)
  const hint = confirmHint('once', 'bk-1', 'pg')
  assert.match(hint, /bk-1/)
  assert.match(hint, /PostgreSQL/)
  assert.match(hint, /不提权/)
  assert.match(hint, /crontab/)
  assert.match(hint, /不代表定时任务正常/)
})

test('动作计划归一化：数组防空、定时任务状态恒不采集', () => {
  assert.deepEqual(normalizeOncePlan(null).impact, [])
  assert.deepEqual(normalizeOncePlan({}).blockers, [])
  assert.equal(normalizeOncePlan(null).context.cron_status, '不采集（工具不读 crontab）')
  const p = normalizeOncePlan({
    server: 'bk', component: 'pg', order: 'pg', available: true,
    blockers: null, warnings: null, impact: ['新增 dump'], commands: null,
    context: { cron_status: '' },
  })
  assert.deepEqual(p.impact, ['新增 dump'])
  assert.deepEqual(p.commands, [])
  assert.equal(p.context.cron_status, '不采集（工具不读 crontab）')
})

test('执行门：计划可用 + 没任务 + 选了机器 + 预演没失败', () => {
  assert.equal(onceRunEnabled(plan(), false, 'bk', false), true)
  assert.equal(onceRunEnabled(plan({ available: false, blockers: ['409'] }), false, 'bk', false), false)
  assert.equal(onceRunEnabled(plan(), true, 'bk', false), false, '任务在跑不放行')
  assert.equal(onceRunEnabled(plan(), false, '', false), false, '没选机器不放行')
  assert.equal(onceRunEnabled(plan(), false, 'bk', true), false, '预演没过不放行')
})

test('确认门：yes + 两项勾选，默认全不勾', () => {
  assert.equal(onceConfirmEnabled('yes', [false, false]), false)
  assert.equal(onceConfirmEnabled('yes', [true, false]), false)
  assert.equal(onceConfirmEnabled('YES', [true, true]), false)
  assert.equal(onceConfirmEnabled('yes', [true, true]), true)
  assert.equal(onceConfirmEnabled('yes', []), false)
})

test('备份来源归一化：没采到也回完整空快照', () => {
  const empty = normalizeOnceSource(null)
  assert.equal(empty.collected, false)
  assert.deepEqual(empty.pg, [])
  assert.deepEqual(empty.minio, [])
  assert.match(empty.note, /backup.env/)
  const view = normalizeOnceSource({
    server: 'bk', component: 'all', collected: true, fetched_at: '12:00:00',
    pg: [{ key: 'PG_SSH_HOST', label: '生产端主机', value: '10.0.0.5' }, { key: 'bad', label: 'x' }],
    minio: null,
  })
  assert.equal(view.collected, true)
  assert.deepEqual(view.pg, [{ key: 'PG_SSH_HOST', label: '生产端主机', value: '10.0.0.5' }])
  assert.deepEqual(view.minio, [])
  assert.equal(view.fetched_at, '12:00:00')
  assert.equal(EMPTY_ONCE_SOURCE.collected, false)
})

test('fetchOnceSource：固定抓 all，失败也不白屏', async () => {
  let got: { name: string; component: string } | null = null
  const view: OnceSourceView = {
    ...EMPTY_ONCE_SOURCE, server: 'bk', collected: true,
    pg: [{ key: 'PG_SSH_HOST', label: '生产端主机', value: '10.0.0.5' }],
  }
  const api = {
    onceSource: async (name: string, component: string) => {
      got = { name, component }
      return view
    },
  }
  const s = await fetchOnceSource(api, 'bk', 'all')
  assert.deepEqual(got, { name: 'bk', component: 'all' })
  assert.equal(s.pg[0].value, '10.0.0.5')
  const broken = await fetchOnceSource({ onceSource: async () => null as unknown as OnceSourceView }, 'bk', 'all')
  assert.equal(broken.collected, false)
  assert.deepEqual(broken.minio, [])
})

test('fetchOncePlan：只读接口，失败/残响也不白屏', async () => {
  let got: { name: string; component: string } | null = null
  const api = {
    oncePlan: async (name: string, component: string) => {
      got = { name, component }
      return plan({ impact: null as unknown as string[] })
    },
  }
  const p = await fetchOncePlan(api, 'bk', 'minio')
  assert.deepEqual(got, { name: 'bk', component: 'minio' })
  assert.deepEqual(p.impact, [])
})
