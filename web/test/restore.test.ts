import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  fetchRestorePlan,
  fetchRestoreSnapshot,
} from '../src/features/restore/service.ts'
import type { RestoreCandidate, RestorePlan, RestoreSnapshot } from '../src/features/restore/types.ts'
import {
  EMPTY_RESTORE_PLAN,
  EMPTY_RESTORE_SNAPSHOT,
  normalizeRestorePlan,
  normalizeRestoreSnapshot,
  restoreGate,
  restorePhases,
  restoreRunEnabled,
} from '../src/features/restore/utils/format.ts'

/** 备份恢复页的判定层：原型六个场景里能用纯函数表达的那几条红线。 */

const candidate = (patch: Partial<RestoreCandidate> = {}): RestoreCandidate => ({
  id: 'daily/pass_up_20261108.dump', label: 'pass_up_20261108.dump', target: '',
  time: '11-08 03:00', size: '128 MB', size_bytes: 128 << 20, grade: 'daily',
  checksum: '通过', archive: '可解析', freshness: '11.6 小时前',
  objects: '—', synced: '—', selectable: true, row_blockers: [],
  ...patch,
})

const snapshot = (patch: Partial<RestoreSnapshot> = {}): RestoreSnapshot => ({
  ...EMPTY_RESTORE_SNAPSHOT, server: 'k4', component: 'pg', collected: true,
  candidates: [candidate()], blockers: [], warnings: [], ...patch,
})

const plan = (patch: Partial<RestorePlan> = {}): RestorePlan => ({
  ...EMPTY_RESTORE_PLAN, server: 'k4', component: 'pg', candidate_id: 'daily/pass_up_20261108.dump',
  db: 'restore_test', collected: true, available: true, cron_confirmed: true,
  target: '恢复目标：主服务器 prod 的库 restore_test',
  ...patch,
})

test('离线 / 空响应：完整快照，collected=false + —，不用 0 兜底', () => {
  const s = normalizeRestoreSnapshot(null)
  assert.equal(s.collected, false)
  assert.equal(s.heartbeat, '—')
  assert.equal(s.disk_free, '—')
  assert.equal(s.src_url, '—')
  assert.deepEqual(s.candidates, [])
  assert.deepEqual(s.blockers, [])
  assert.equal(s.cron_status, '不采集（工具不读 crontab）')
  const p = normalizeRestorePlan(null)
  assert.equal(p.available, false)
  assert.deepEqual(p.impact, [])
  assert.deepEqual(p.commands, [])
})

test('候选行归一化：缺校验和 / 归档不可解析的行不可选，理由跟着行走', () => {
  const s = normalizeRestoreSnapshot({
    collected: true,
    candidates: [
      { id: 'daily/a.dump', checksum: '缺失', archive: '可解析', selectable: false, row_blockers: ['缺 .sha256'] },
      { id: 'weekly/b.dump', checksum: '通过', archive: '不可解析', selectable: false, row_blockers: ['归档不可解析'] },
    ],
  })
  assert.equal(s.candidates.length, 2)
  assert.equal(s.candidates[0].selectable, false)
  assert.deepEqual(s.candidates[0].row_blockers, ['缺 .sha256'])
  assert.equal(s.candidates[1].size, '—')
})

test('确认弹窗门禁：yes / 库名两次且等于计划库 / YES / 三项前置 / 覆盖生产', () => {
  const base = {
    component: 'pg' as const, yes: 'yes', planDb: 'restore_test',
    db: 'restore_test', db2: 'restore_test', minioConfirm: '',
    checks: [true, true, true] as [boolean, boolean, boolean],
    coverProduction: false, busy: false,
  }
  assert.equal(restoreGate(base).ok, true)
  assert.equal(restoreGate(base).needProd, false)
  assert.equal(restoreGate({ ...base, yes: 'no' }).ok, false)
  assert.equal(restoreGate({ ...base, db2: 'restore_tes' }).ok, false)
  // 计划回显的是 restore_test，弹窗却输生产库：必须重新取计划，不能拿旧计划当凭证。
  assert.equal(restoreGate({ ...base, db: 'pass_up', db2: 'pass_up' }).ok, false)
  assert.equal(restoreGate({ ...base, checks: [true, false, true] }).ok, false)
  assert.equal(restoreGate({ ...base, busy: true }).ok, false)

  const prod = { ...base, planDb: 'pass_up', db: 'pass_up', db2: 'pass_up' }
  assert.equal(restoreGate(prod).needProd, true)
  assert.equal(restoreGate(prod).ok, false)
  assert.equal(restoreGate({ ...prod, coverProduction: true }).ok, true)

  const minio = { ...base, component: 'minio' as const, minioConfirm: 'YES' }
  assert.equal(restoreGate(minio).needProd, true)
  assert.equal(restoreGate(minio).ok, false)
  assert.equal(restoreGate({ ...minio, coverProduction: true }).ok, true)
  assert.equal(restoreGate({ ...minio, minioConfirm: 'yes', coverProduction: true }).ok, false)
})

test('阶段条：失败停在当前阶段，不许五格全绿', () => {
  const ok = restorePhases('==> PHASE 1/5 预检\n==> PHASE 2/5 预演\n==> PHASE 3/5 传输\n==> PHASE 4/5 验证\n==> PHASE 5/5 报告\n', true, 0)
  assert.deepEqual(ok.map((p) => p.state), ['done', 'done', 'done', 'done', 'done'])
  const failed = restorePhases('==> PHASE 1/5 预检\n==> PHASE 2/5 预演\n==> PHASE 3/5 传输\n==> PHASE_FAILED 3\n', true, 1)
  assert.deepEqual(failed.map((p) => p.state), ['done', 'done', 'fail', 'wait', 'wait'])
  const noMark = restorePhases('没有任何阶段标记', true, 1)
  assert.equal(noMark.filter((p) => p.state === 'fail').length, 1)
  assert.equal(noMark[2].state, 'fail')
})

test('执行门：服务端 available + 选中行可用 + 没任务 + 预演没失败', () => {
  const p = plan(), s = snapshot(), id = candidate().id
  assert.equal(restoreRunEnabled(p, s, id, false, false), true)
  assert.equal(restoreRunEnabled(plan({ available: false }), s, id, false, false), false)
  assert.equal(restoreRunEnabled(p, snapshot({ candidates: [candidate({ selectable: false })] }), id, false, false), false)
  assert.equal(restoreRunEnabled(p, s, '', false, false), false)
  assert.equal(restoreRunEnabled(p, s, id, true, false), false)
  assert.equal(restoreRunEnabled(p, s, id, false, true), false)
})

test('只读接口透传：cron_confirmed 是本机表单状态，计划由服务端下发', async () => {
  let seen = ''
  const candidatesApi = {
    candidates: async (name: string, component: string) => {
      seen = `${name}/${component}`
      return snapshot({ collected: false, candidates: [], heartbeat: '—' })
    },
  }
  const got = await fetchRestoreSnapshot(candidatesApi, 'k4', 'pg')
  assert.equal(seen, 'k4/pg')
  assert.equal(got.collected, false)
  assert.deepEqual(got.candidates, [])

  let query = ''
  const planApi = {
    plan: async (p: { name: string; component: 'pg' | 'minio'; candidate: string; db: string; cronConfirmed: boolean }) => {
      query = `${p.candidate}|${p.cronConfirmed}`
      return plan({ available: false, blockers: ['尚未确认已停定时备份'] })
    },
  }
  const p = await fetchRestorePlan(planApi, {
    name: 'k4', component: 'pg', candidate: 'daily/a.dump', db: 'restore_test', cronConfirmed: false,
  })
  assert.equal(query, 'daily/a.dump|false')
  assert.equal(p.available, false)
  assert.match(p.blockers[0], /定时备份/)
})
