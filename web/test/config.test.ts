import { test } from 'node:test'
import assert from 'node:assert/strict'

import type {
  CompareField,
  CompareView,
  ConfigServer,
  ConfigView,
  EnvField,
} from '../src/features/config/types.ts'
import {
  changedFields,
  compareTag,
  confirmHint,
  confirmTitle,
  diffCount,
  envInitial,
  envInputPlaceholder,
  envPlaceholder,
  normalizeCompareView,
  normalizeConfigView,
  serverInitial,
  splitCompare,
} from '../src/features/config/utils/draft.ts'

const server: ConfigServer = {
  name: 'k1',
  role: 'backup',
  user: 'cql',
  host: '172.16.0.211',
  port: 22,
  sudo_mode: 'nopasswd',
  has_key: true,
  password_configured: false,
  exec_chain: 'cql 登录 → 免密 sudo 提权 → 脚本以 root 执行',
}

const fields: EnvField[] = [
  { key: 'PG_SSH_HOST', label: '主服务器地址', group: '连接', value: '127.0.0.1', secret: false, configured: true },
  { key: 'PG_SSH_KEY', label: '私钥路径', group: '连接', value: '', secret: true, configured: true },
  { key: 'SRC_SECRET', label: '密钥', group: '连接', value: '', secret: true, configured: false },
]

test('serverInitial 不把凭证带进表单', () => {
  const initial = serverInitial(server)
  assert.equal(initial.user, 'cql')
  assert.equal(initial.port, '22')
  assert.equal(initial.key, '')
  assert.equal(initial.sudo_password, '')
})

test('changedFields 只提交改动过、且非空的字段', () => {
  const initial = serverInitial(server)
  const draft = { ...initial, host: '10.0.0.9', user: '', key: '' }
  const changed = changedFields(initial, draft)
  assert.deepEqual(changed, { host: '10.0.0.9' })
})

test('凭证字段填了新值才会被提交，留空表示保持不变', () => {
  const base = envInitial(fields)
  assert.deepEqual(base, { PG_SSH_HOST: '127.0.0.1', PG_SSH_KEY: '', SRC_SECRET: '' })
  assert.deepEqual(changedFields(base, { ...base }), {})
  assert.deepEqual(
    changedFields(base, { ...base, PG_SSH_KEY: '/root/.ssh/new_key' }),
    { PG_SSH_KEY: '/root/.ssh/new_key' },
  )
})

test('secret 占位文案区分已配置与未配置', () => {
  assert.equal(envPlaceholder(fields[1]), '已配置，留空保持不变')
  assert.equal(envPlaceholder(fields[2]), '未配置，可在此填写')
  assert.equal(envPlaceholder(fields[0]), '')
})

test('PG_SSH_OPTS 未配置时提示脚本内置默认值（含 accept-new），但不写进表单', () => {
  const opts: EnvField = {
    key: 'PG_SSH_OPTS', label: 'SSH 额外选项', group: '连接',
    value: '', secret: false, configured: false,
  }
  const hint = envInputPlaceholder(opts)
  assert.match(hint, /BatchMode=yes/)
  assert.match(hint, /ConnectTimeout=10/)
  assert.match(hint, /StrictHostKeyChecking=accept-new/)
  assert.doesNotMatch(hint, /StrictHostKeyChecking=no/)
  // 提示只改变 placeholder：envInitial 依旧拿到空值，保存时不会被误写。
  assert.equal(envInitial([opts]).PG_SSH_OPTS, '')
  assert.equal(envInputPlaceholder({ ...opts, configured: true }), '')
  assert.equal(envInputPlaceholder({ ...opts, key: 'PG_SSH_HOST' }), '未配置')
})

test('确认文案点明「保存本机 ≠ 同步远端」', () => {
  assert.match(confirmTitle('env'), /本机/)
  assert.match(confirmHint('env', { component: 'pg', count: 2 }), /远端 backup.env 不会变/)
  assert.match(confirmHint('sync', { component: 'minio', server: 'k1' }), /远端写操作/)
  assert.match(confirmHint('servers', { server: 'k1', count: 1 }), /一键免密 sudo/)
})

const compareFields: CompareField[] = [
  { key: 'PG_SSH_HOST', label: '主服务器地址', group: '连接', remote: '127.0.0.1', local: '10.0.0.9', secret: false, remote_configured: true, local_configured: true, state: 'changed' },
  { key: 'PG_SSH_PORT', label: '端口', group: '连接', remote: '22', local: '22', secret: false, remote_configured: true, local_configured: true, state: 'consistent' },
  { key: 'PG_LOCAL_RETENTION_DAYS', label: '保留天数', group: '备份端', remote: '7', local: '', secret: false, remote_configured: true, local_configured: false, state: 'remote-only' },
  { key: 'PG_RESTORE_JOBS', label: '并发数', group: '备份端', remote: '', local: '4', secret: false, remote_configured: false, local_configured: true, state: 'local-only' },
]

test('compareTag 覆盖四种状态且不把凭证当普通值', () => {
  assert.equal(compareTag('consistent').text, '一致')
  assert.equal(compareTag('changed').tone, 'warning')
  assert.equal(compareTag('remote-only').text, '仅远端有')
  assert.equal(compareTag('local-only').tone, 'success')
})

test('splitCompare 把远端独有项拆出去（表单里没有输入框）', () => {
  const { form, extra } = splitCompare(compareFields)
  assert.deepEqual(form.map((f) => f.key), ['PG_SSH_HOST', 'PG_SSH_PORT', 'PG_RESTORE_JOBS'])
  assert.deepEqual(extra.map((f) => f.key), ['PG_LOCAL_RETENTION_DAYS'])
})

test('diffCount 不计一致项', () => {
  assert.equal(diffCount(compareFields), 3)
})

// 真机踩过：后端抓取失败时 components 是 nil slice → JSON null → 页面 .find 白屏。
test('远端值对照失败（components:null）不炸页面，失败原因要留着', () => {
  const raw = {
    components: null,
    error: 'ERROR: 启动 backup 子进程失败：找不到 ops.next.exe',
  } as unknown as CompareView
  const got = normalizeCompareView(raw)
  assert.deepEqual(got.components, [])
  assert.match(got.error ?? '', /找不到 ops\.next\.exe/)
  // 页面里就是这么取的：之前的 TypeError 出在这一行。
  assert.equal(got.components.find((c) => c.component === 'pg'), undefined)
})

test('对比结果里 fields:null 也要归一成空数组', () => {
  const raw = {
    components: [{ component: 'pg', fields: null }],
    fetched_at: '12:00:00',
  } as unknown as CompareView
  const got = normalizeCompareView(raw)
  assert.deepEqual(got.components[0].fields, [])
  assert.equal(got.fetched_at, '12:00:00')
  assert.deepEqual(splitCompare(got.components[0].fields), { form: [], extra: [] })
})

test('配置视图的 servers/envs/fields 为 null 时不炸，且能安全取数', () => {
  const raw = { servers: null, envs: [{ component: 'pg', fields: null }] } as unknown as ConfigView
  const got = normalizeConfigView(raw)
  assert.deepEqual(got.servers, [])
  assert.equal(got.servers.find((s) => s.name === 'k1'), undefined)
  assert.deepEqual(got.envs[0].fields, [])
  assert.equal(got.sync_enabled, false)
  assert.deepEqual(normalizeConfigView(null).envs, [])
  assert.deepEqual(normalizeCompareView(undefined).components, [])
})

test('正常响应归一化后字段不变', () => {
  const view: ConfigView = {
    servers_file: 'servers.json',
    sync_enabled: true,
    servers: [server],
    envs: [{ component: 'pg', path: 'pg.env', exists: true, fields }],
  }
  const got = normalizeConfigView(view)
  assert.equal(got.servers[0].name, 'k1')
  assert.equal(got.envs[0].fields.length, fields.length)
  assert.equal(got.sync_enabled, true)
})
