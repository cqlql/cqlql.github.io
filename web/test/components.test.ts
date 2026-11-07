import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  actionCopy,
  actionEnabled,
  actionHint,
  actionOf,
  actionPlans,
  canInstall,
  confirmCopy,
  copyReady,
  imageHint,
  installHint,
  installLabel,
  normalizeActions,
  normalizeProxyInput,
  normalizeSourceImages,
  normalizeStatusView,
  preflightOf,
  stateLabel,
} from '../src/features/components/utils/format.ts'
import {
  startComponentInstall,
  startComponentRun,
  startImageLoad,
  watchComponentTask,
} from '../src/features/components/service.ts'
import type { ImageUploadApi, TaskApi } from '../src/features/components/service.ts'
import type {
  ActionPlan,
  ComponentRunRequest,
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

test('normalizeProxyInput：只接受 http://host:port，服务端仍有第二道校验', () => {
  assert.equal(normalizeProxyInput('  http://192.168.1.221:7897  '), 'http://192.168.1.221:7897')
  assert.equal(normalizeProxyInput('http://localhost:8080'), 'http://localhost:8080')
  assert.equal(normalizeProxyInput('http://proxy.example:1'), 'http://proxy.example:1')
  for (const bad of [
    '', 'http://x;rm -rf /', 'http://u:p@x:7897', 'https://x:7897',
    'http://x:0', 'http://x:65536', 'http://x:7897/path', 'x:7897',
    'http://x:7897 && echo hi',
  ]) {
    assert.equal(normalizeProxyInput(bad), null, `不该放行：${bad}`)
  }
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

// ---- 2026-11-07：update / uninstall 的动作计划（判据在 Go 侧，前端只渲染） ----

const updatePlan: ActionPlan = {
  verb: 'update', label: '更新', available: true, reasons: [],
  title: '确认更新 MinIO 服务', description: '只重建容器换镜像',
  impacts: ['数据卷从头到尾不参与回滚'], checks: [],
  images: [{ reference: 'minio/minio:R2', current: false }],
  danger: true, submit_label: '确认更新',
}

const uninstallPlan: ActionPlan = {
  ...updatePlan, verb: 'uninstall', label: '卸载', title: '确认卸载 Docker 引擎',
  impacts: ['卸载引擎会连带停止下游 MinIO', '下一次备份会失败（预期结果）'],
  images: [], submit_label: '确认卸载',
  checks: [
    { key: 'purge_data', label: '同时删除 /data/minio 数据目录', required: false, help: '不可逆' },
    { key: 'ack_downstream', label: '已知晓会连带停止 MinIO', required: true },
  ],
}

test('normalizeActions：坏数据兜成空，后端计划原样透出', () => {
  assert.deepEqual(normalizeActions(null), {})
  assert.deepEqual(normalizeActions({ docker: null, minio: 'x' }), { docker: [], minio: [] })
  const v = normalizeStatusView(null)
  assert.deepEqual(v.actions, {})
  const m = normalizeActions({ minio: [updatePlan] })
  assert.equal(m.minio[0].title, '确认更新 MinIO 服务')
  assert.equal(m.minio[0].images[0].reference, 'minio/minio:R2')
  assert.equal(stateLabel('update'), '可更新')
})

test('actionPlans / actionOf / actionEnabled：只认后端 available + busy', () => {
  const c = comp({ id: 'minio' })
  const v = view({ components: [c], actions: { minio: [updatePlan, uninstallPlan] } })
  assert.equal(actionPlans(v, c).length, 2)
  assert.equal(actionOf(v, c, 'update')?.title, '确认更新 MinIO 服务')
  assert.equal(actionEnabled(actionOf(v, c, 'update'), false), true)
  assert.equal(actionEnabled(actionOf(v, c, 'update'), true), false, '任务在跑时不点')
  assert.equal(actionEnabled({ ...updatePlan, available: false }, false), false)
  assert.equal(actionEnabled(undefined, false), false)
  assert.equal(actionOf(view(), c, 'uninstall'), undefined, '后端没下发就不算可执行')
})

test('actionCopy：影响清单与附加勾选全用后端文案，旧后端才回退', () => {
  const c = actionCopy(uninstallPlan, comp({ id: 'docker' }))
  assert.equal(c.title, '确认卸载 Docker 引擎')
  assert.equal(c.submitLabel, '确认卸载')
  assert.match(c.impacts.join(' '), /预期结果/)
  assert.equal(c.checks[0].required, false, '删数据默认不勾')
  assert.equal(c.checks[1].required, true, '卸引擎的连带影响必勾')
  assert.match(actionCopy(undefined, comp()).title, /确认安装 Docker 引擎/)
})

test('actionHint：说清能做什么或为什么不能做', () => {
  assert.match(actionHint([updatePlan], comp(), view()), /可执行.*更新/)
  assert.match(
    actionHint([{ ...updatePlan, available: false, reasons: ['没有新镜像'] }], comp(), view()),
    /没有新镜像/,
  )
  assert.match(actionHint([], comp(), view({ collected: false })), /没采到状态/)
  assert.match(actionHint([], comp(), view()), /旧二进制|重新检查/)
})

test('startComponentRun：附加参数随请求发出，仍先 run 再从 0 轮询', async () => {
  const seen: string[] = []
  let sent: ComponentRunRequest | undefined
  const api = {
    status: async () => view(),
    run: async (req: ComponentRunRequest) => {
      sent = req
      seen.push(`run:${req.verb}`)
      return { started: true }
    },
    task: async (after: number) => {
      seen.push(`task:${after}`)
      return task({ mode: 'component.uninstall' })
    },
  }
  const t = await startComponentRun(api, {
    verb: 'uninstall', component: 'minio', name: 'k1', confirm: 'yes', purge_data: true,
  }, { onChunk: () => {}, onTask: () => {}, sleep: async () => {} })
  assert.deepEqual(seen, ['run:uninstall', 'task:0'])
  assert.equal(sent?.purge_data, true)
  assert.equal(t.mode, 'component.uninstall')
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

test('normalizeSourceImages：null 数组兜成 []，collected=false 不当成「没有镜像」', () => {
  const v = normalizeSourceImages({ server: 'prod', collected: false, error: 'ssh 连不上', images: null }, 'prod')
  assert.deepEqual(v.images, [])
  assert.equal(v.collected, false)
  assert.equal(v.server, 'prod')
  // 查不动 → 不放行，且提示里说的是「没采到」而不是「没有镜像」
  const gate = copyReady(v, false, true)
  assert.equal(gate.ok, false)
  assert.match(gate.hint, /没采到/)
})

test('copyReady：busy / 目标机无 docker / 源机无镜像都不放行', () => {
  const one = normalizeSourceImages({
    server: 'prod', collected: true, elevated: false,
    images: [{ reference: 'minio/minio:RELEASE.x', id: 'sha256:1', size: '180MB', created: '2026-11-01' }],
  }, 'prod')
  assert.equal(copyReady(one, true, true).ok, false, '任务在跑时不放行')
  assert.equal(copyReady(one, false, false).ok, false, '目标机没 docker 不放行')
  assert.equal(copyReady(null, false, true).ok, false, '还没选源机不放行')
  const empty = normalizeSourceImages({ server: 'prod', collected: true, images: [] }, 'prod')
  assert.equal(copyReady(empty, false, true).ok, false, '源机没有镜像不放行')
  const ok = copyReady(one, false, true)
  assert.equal(ok.ok, true)
  assert.match(ok.hint, /不落盘|中转/)
})

test('startComponentRun：image-copy 带 from_server 与源机镜像引用', async () => {
  let sent: ComponentRunRequest | undefined
  const api = {
    status: async () => view(),
    run: async (req: ComponentRunRequest) => { sent = req; return { started: true } },
    task: async () => task({ mode: 'component.image-copy' }),
  }
  const t = await startComponentRun(api, {
    verb: 'image-copy', component: 'minio', name: 'k4', confirm: 'yes',
    from_server: 'prod', image_ref: 'minio/minio:RELEASE.x',
  }, { onChunk: () => {}, onTask: () => {}, sleep: async () => {} })
  assert.equal(sent?.from_server, 'prod')
  assert.equal(sent?.image_ref, 'minio/minio:RELEASE.x')
  assert.equal(t.mode, 'component.image-copy')
})
