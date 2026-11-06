import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  canInstall,
  confirmCopy,
  imageHint,
  installHint,
  installLabel,
  normalizeStatusView,
  preflightOf,
} from '../src/features/components/utils/format.ts'
import {
  startComponentInstall,
  startImageLoad,
  watchComponentTask,
} from '../src/features/components/service.ts'
import type { ImageUploadApi, TaskApi } from '../src/features/components/service.ts'
import type {
  ComponentStatus,
  ComponentsStatusView,
  ComponentTask,
  Preflight,
} from '../src/features/components/types.ts'

/**
 * 组件页的判定全在 utils / service 里，页面只渲染。
 * 这组用例钉死：新组件（minio）的依赖门、离线镜像门与凭证门，
 * 以及「上传镜像 → 轮询同一个任务」这条新链路。
 */

const readyPre: Preflight = { ready: true, blockers: [], warnings: [] }

function comp(patch: Partial<ComponentStatus> = {}): ComponentStatus {
  return {
    id: 'docker', name: 'Docker 引擎', kind: '基础设施', phase: 'ready',
    state: 'missing', version: '', checks: [], collected: true,
    ...patch,
  }
}

function view(patch: Partial<ComponentsStatusView> = {}): ComponentsStatusView {
  return {
    ...normalizeStatusView(null),
    server: 'k1', collected: true,
    preflight: readyPre,
    components: [comp()],
    ...patch,
  }
}

function task(patch: Partial<ComponentTask> = {}): ComponentTask {
  return {
    running: false, done: true, mode: 'component.install', server: 'k1',
    component: 'docker', exit_code: 0, log: '', next: 0,
    ...patch,
  }
}

test('normalizeStatusView：null / 缺失数组一律兜成空，绝不白屏', () => {
  const v = normalizeStatusView(null)
  assert.deepEqual(v.components, [])
  assert.deepEqual(v.checks, [])
  assert.deepEqual(v.images, [])
  assert.deepEqual(v.preflights, {})
  assert.equal(v.collected, false)
  assert.equal(v.local, undefined)
  const withData = normalizeStatusView({
    collected: true,
    images: [{ reference: 'minio/minio:RELEASE', id: 'sha256:abc', size: '218 MB', created: 'today' }],
    preflights: { minio: { ready: false, blockers: ['缺镜像'], warnings: [] } },
    local: { minio_root_user_set: true, minio_root_secret_set: false },
  })
  assert.equal(withData.images.length, 1)
  assert.equal(withData.preflights?.minio.blockers[0], '缺镜像')
  assert.equal(withData.local?.minio_root_secret_set, false)
})

test('preflightOf：按组件优先，旧后端回退全局预检', () => {
  const globalPre: Preflight = { ready: false, blockers: ['全局'], warnings: [] }
  const ownPre: Preflight = { ready: false, blockers: ['组件自己的'], warnings: [] }
  const c = comp({ id: 'minio', preflight: ownPre })
  assert.equal(preflightOf(view({ preflight: globalPre }), c).blockers[0], '组件自己的')
  assert.equal(
    preflightOf(view({ preflight: globalPre, preflights: { minio: ownPre } }), comp({ id: 'minio' })).blockers[0],
    '组件自己的',
  )
  assert.equal(preflightOf(view({ preflight: globalPre }), comp({ id: 'redis' })).blockers[0], '全局')
})

test('canInstall：依赖门 + 组件预检门 + 状态门', () => {
  const minio = comp({ id: 'minio', depends: 'docker', preflight: readyPre })
  const v = view({ components: [comp({ state: 'ok' }), minio] })
  assert.equal(canInstall(minio, v, false, true), true)
  assert.equal(canInstall(minio, v, true, true), false, '任务在跑时不装')
  assert.equal(canInstall(minio, v, false, false), false, '依赖没就绪时不装')
  assert.equal(
    canInstall(comp({ id: 'minio', preflight: { ready: false, blockers: ['缺离线镜像'], warnings: [] } }), v, false, true),
    false,
    '服务端预检不通过时不装',
  )
  assert.equal(canInstall(comp({ state: 'ok' }), v, false, true), false, '已装好不需要重装')
  assert.equal(canInstall(comp({ state: 'unknown' }), v, false, true), false, '状态未知不装')
  assert.equal(canInstall(comp({ phase: 'planned' }), v, false, true), false, '未接入组件不装')
  assert.equal(canInstall(minio, view({ collected: false }), false, true), false, '没采到不装')
})

test('installHint / installLabel / confirmCopy 按组件分开', () => {
  const minio = comp({ id: 'minio', depends: 'docker', preflight: readyPre })
  const v = view({ components: [comp({ state: 'ok' }), minio] })
  assert.match(installHint(minio, v, true), /离线镜像/)
  assert.match(installHint(comp(), v, true), /apt 仓库/)
  assert.match(installHint(minio, v, false), /上游依赖/)
  assert.match(
    installHint(comp({ id: 'minio', preflight: { ready: false, blockers: ['没有离线镜像'], warnings: [] } }), v, true),
    /没有离线镜像/,
  )
  assert.equal(installLabel('minio'), '安装 MinIO 服务')
  assert.equal(installLabel('docker'), '安装 Docker 引擎')
  assert.match(confirmCopy('minio').title, /MinIO/)
  assert.ok(confirmCopy('minio').items.some((s) => s.includes('DEST_KEY')))
  assert.match(confirmCopy('docker').description, /apt/)
})

test('imageHint：没 Docker / 没镜像 / 已有镜像三种说法', () => {
  assert.match(imageHint(view(), false), /先安装 Docker/)
  assert.match(imageHint(view(), true), /还没有离线镜像/)
  const v = view({ images: [{ reference: 'minio/minio:R1', id: 'sha256:a', size: '218 MB', created: 'today' }] })
  assert.match(imageHint(v, true), /已有 1 个/)
  assert.match(imageHint(view({ collected: false }), true), /重新检查/)
})

test('watchComponentTask：增量日志 + 游标推进，任务结束即停', async () => {
  const calls: number[] = []
  const api: TaskApi = {
    task: async (after) => {
      calls.push(after)
      if (after === 0) return task({ running: true, done: false, log: '第一步\n', next: 10 })
      return task({ log: '完成\n', next: 20 })
    },
  }
  const chunks: string[] = []
  const t = await watchComponentTask(api, {
    onChunk: (c) => chunks.push(c),
    onTask: () => {},
    sleep: async () => {},
  })
  assert.deepEqual(calls, [0, 10])
  assert.deepEqual(chunks, ['第一步\n', '完成\n'])
  assert.equal(t.exit_code, 0)
})

test('startComponentInstall：先发 install 再从 0 轮询', async () => {
  const seen: string[] = []
  const api = {
    status: async () => view(),
    run: async (req: { component: string }) => { seen.push(`run:${req.component}`); return { started: true } },
    task: async (after: number) => { seen.push(`task:${after}`); return task() },
  }
  const t = await startComponentInstall(api, {
    verb: 'install', component: 'minio', name: 'k1', confirm: 'yes',
  }, { onChunk: () => {}, onTask: () => {}, sleep: async () => {} })
  assert.deepEqual(seen, ['run:minio', 'task:0'])
  assert.equal(t.done, true)
})

test('startImageLoad：上传 FormData 后接同一个任务端点', async () => {
  const seen: string[] = []
  const api: ImageUploadApi = {
    uploadImage: async (form) => {
      seen.push(`upload:${form.get('component')}:${form.get('confirm')}`)
      return { started: true }
    },
    task: async (after) => { seen.push(`task:${after}`); return task({ mode: 'component.image-load' }) },
  }
  const form = new FormData()
  form.append('component', 'minio')
  form.append('confirm', 'yes')
  const t = await startImageLoad(api, form, {
    onChunk: () => {}, onTask: () => {}, sleep: async () => {},
  })
  assert.deepEqual(seen, ['upload:minio:yes', 'task:0'])
  assert.equal(t.mode, 'component.image-load')
})
