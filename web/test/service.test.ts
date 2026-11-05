import { test } from 'node:test'
import assert from 'node:assert/strict'

import { applySudo, checkAll, checkOne } from '../src/features/servers/service.ts'
import type { FlowHooks, Notice, ServersApi } from '../src/features/servers/service.ts'
import type {
  CheckRow,
  ServerInfo,
  ServerStatus,
} from '../src/features/servers/types.ts'

/**
 * 流程测试：**注入假 api + 记录型 hooks**，不 mock 模块、不起浏览器。
 * 这是把「先检查 / 问密码 / 失败回查」从页面搬进 service.ts 换来的直接好处。
 */

function srv(patch: Partial<ServerInfo> = {}): ServerInfo {
  return {
    name: 'bk-1',
    role: 'backup',
    user: 'ops',
    host: '10.0.0.11',
    port: 22,
    sudo_mode: 'nopasswd',
    has_key: true,
    password_configured: false,
    status: {},
    ...patch,
  }
}

function row(name: string, patch: Partial<CheckRow> = {}): CheckRow {
  return { name, role: 'backup', ...patch }
}

interface FakeApi extends ServersApi {
  calls: string[]
}

/** 记录每一次调用，便于断言「顺序」与「有没有多调一次」。 */
function fakeApi(over: Partial<ServersApi> = {}): FakeApi {
  const calls: string[] = []
  const base: ServersApi = {
    list: async () => ({ servers_file: 'servers.json', servers: [] }),
    check: async () => [row('bk-1', { sudo: 'need' })],
    applySudo: async () => ({
      message: '已配置免密 sudo',
      already_ok: false,
      changed: true,
      status: { sudo: 'ok' },
    }),
    ...over,
  }
  const api = {
    list: () => {
      calls.push('list')
      return base.list()
    },
    check: (name?: string) => {
      calls.push(`check:${name ?? 'all'}`)
      return base.check(name)
    },
    applySudo: (name: string, password: string) => {
      calls.push(`apply:${name}:${password}`)
      return base.applySudo(name, password)
    },
  }
  return Object.assign(api, { calls })
}

function recorder(pw: string | null = 'secret') {
  const notices: Notice[] = []
  const statuses: Array<{ name: string; st: ServerStatus }> = []
  const rowBatches: CheckRow[][] = []
  const asked: string[] = []
  const hooks: FlowHooks = {
    notice: (n) => notices.push(n),
    rows: (r) => rowBatches.push(r),
    status: (name, st) => statuses.push({ name, st }),
    askPassword: async (n) => {
      asked.push(n)
      return pw
    },
  }
  return { hooks, notices, statuses, rowBatches, asked }
}

test('applySudo：没检查过 → 先检查、问密码、再 apply', async () => {
  const api = fakeApi()
  const h = recorder('secret')

  await applySudo(api, srv({ status: {} }), h.hooks)

  assert.deepEqual(api.calls, ['check:bk-1', 'apply:bk-1:secret'])
  assert.deepEqual(h.asked, ['bk-1'])
  assert.deepEqual(h.statuses, [{ name: 'bk-1', st: { sudo: 'ok' } }])
  assert.equal(h.notices.at(-1)?.kind, 'success')
})

test('applySudo：已经配好 → 不检查、不问密码、不 apply', async () => {
  const api = fakeApi()
  const h = recorder()

  await applySudo(api, srv({ status: { sudo: 'ok' } }), h.hooks)

  assert.deepEqual(api.calls, [])
  assert.deepEqual(h.asked, [])
  assert.match(h.notices.at(-1)?.text ?? '', /已无需配置/)
})

test('applySudo：清单里存了密码 → 不问，用空串发出去', async () => {
  const api = fakeApi()
  const h = recorder()

  await applySudo(api, srv({ status: { sudo: 'need' }, password_configured: true }), h.hooks)

  assert.deepEqual(api.calls, ['apply:bk-1:'])
  assert.deepEqual(h.asked, [])
})

test('applySudo：密码弹窗取消 → 一个请求都不发', async () => {
  const api = fakeApi()
  const h = recorder(null)

  await applySudo(api, srv({ status: { sudo: 'need' } }), h.hooks)

  assert.deepEqual(api.calls, [])
  assert.match(h.notices.at(-1)?.text ?? '', /已取消/)
})

test('applySudo：失败要报错，并回查一次现状', async () => {
  const api = fakeApi({
    applySudo: async () => {
      throw new Error('sudo 失败')
    },
  })
  const h = recorder()

  await applySudo(api, srv({ status: { sudo: 'need' } }), h.hooks)

  assert.deepEqual(api.calls, ['apply:bk-1:secret', 'check:bk-1'])
  assert.equal(
    h.notices.some((n) => n.kind === 'error' && n.text === 'sudo 失败'),
    true,
  )
})

test('checkAll：回填一批结果并报告台数', async () => {
  const api = fakeApi({ check: async () => [row('a'), row('b')] })
  const h = recorder()

  await checkAll(api, h.hooks)

  assert.deepEqual(api.calls, ['check:all'])
  assert.equal(h.rowBatches.length, 1)
  assert.match(h.notices.at(-1)?.text ?? '', /共 2 台/)
})

test('checkOne：失败只报错，不回填半批数据', async () => {
  const api = fakeApi({
    check: async () => {
      throw new Error('连不上')
    },
  })
  const h = recorder()

  await checkOne(api, 'bk-1', h.hooks)

  assert.equal(h.rowBatches.length, 0)
  assert.equal(h.notices.at(-1)?.text, '连不上')
})
