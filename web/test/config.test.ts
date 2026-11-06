import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { CompareField, ConfigServer, EnvField } from '../src/features/config/types.ts'
import {
  changedFields,
  compareTag,
  confirmHint,
  confirmTitle,
  diffCount,
  envInitial,
  envPlaceholder,
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
