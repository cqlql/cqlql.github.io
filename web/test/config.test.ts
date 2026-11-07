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
  envSavePayload,
  fillableDefaults,
  newServerInitial,
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
  { key: 'PG_SSH_HOST', label: '主服务器地址', group: '连接', value: '127.0.0.1', secret: false, configured: true, default: '' },
  { key: 'PG_SSH_KEY', label: '私钥路径', group: '连接', value: '', secret: true, configured: true, default: '' },
  { key: 'SRC_SECRET', label: '密钥', group: '连接', value: '', secret: true, configured: false, default: '' },
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

test('显式清空走 clear，不与「留空保持不变」混淆', () => {
  const base = envInitial(fields)
  // 只把输入框删空：仍然什么都不提交，凭证不会被误清。
  assert.deepEqual(envSavePayload(base, base, []), { fields: {}, clear: [] })
  // 勾了「清空」才产生一次明确写入；重复勾选去重。
  assert.deepEqual(envSavePayload(base, base, ['PG_SSH_KEY', 'PG_SSH_KEY']), {
    fields: {}, clear: ['PG_SSH_KEY'],
  })
  // 同一键又填了新值：覆盖优先，清空自动让位。
  const draft = { ...base, PG_SSH_HOST: '10.0.0.9', PG_SSH_KEY: '/home/cql/.ssh/id_ed25519' }
  assert.deepEqual(envSavePayload(base, draft, ['PG_SSH_KEY', 'SRC_SECRET']), {
    fields: { PG_SSH_HOST: '10.0.0.9', PG_SSH_KEY: '/home/cql/.ssh/id_ed25519' },
    clear: ['SRC_SECRET'],
  })
})

test('确认文案点明有几项被显式清空', () => {
  const hint = confirmHint('env', { component: 'pg', count: 2, clearCount: 1 })
  assert.match(hint, /1 项是你显式勾选的「清空」/)
  assert.match(hint, /写成空值/)
  assert.doesNotMatch(confirmHint('env', { component: 'pg', count: 2 }), /显式勾选/)
})

test('secret 占位文案区分已配置与未配置', () => {
  assert.equal(envPlaceholder(fields[1]), '已配置，留空保持不变')
  assert.equal(envPlaceholder(fields[2]), '未配置，可在此填写')
  assert.equal(envPlaceholder(fields[0]), '')
})

test('PG_SSH_OPTS 未配置时提示脚本内置默认值（含 accept-new），但不写进表单', () => {
  const opts: EnvField = {
    key: 'PG_SSH_OPTS', label: 'SSH 额外选项', group: '连接',
    value: '', secret: false, configured: false, default: '',
  }
  const hint = envInputPlaceholder(opts)
  assert.match(hint, /BatchMode=yes/)
  assert.match(hint, /ConnectTimeout=10/)
  assert.match(hint, /StrictHostKeyChecking=accept-new/)
  assert.doesNotMatch(hint, /StrictHostKeyChecking=no/)
  // 提示只改变 placeholder：envInitial 依旧拿到空值，保存时不会被误写。
  assert.equal(envInitial([opts]).PG_SSH_OPTS, '')
  assert.equal(envInputPlaceholder({ ...opts, configured: true }), '')
  assert.equal(envInputPlaceholder({ ...opts, key: 'PG_SSH_HOST' }), '未配置，需手工填写')
})

test('灰字只说「未写入配置」+ 建议值，不承诺留空即可用', () => {
  const root: EnvField = {
    key: 'PG_BACKUP_ROOT', label: '备份根目录', group: '备份端',
    value: '', secret: false, configured: false, default: '/data/backups/postgres',
  }
  assert.equal(envInputPlaceholder(root), '未写入配置（默认值：/data/backups/postgres）')
  assert.equal(envInputPlaceholder({ ...root, configured: true }), '')
  // 🔴 2026-11-07 真机踩坑：原文案「留空即用默认 / 留空即可生效」让人以为不填也能过
  // 部署预检，实际 preflight 按「backup.env 有没有显式这一行」判定。见 docs/ui.md §12.7。
  assert.doesNotMatch(envInputPlaceholder(root), /留空即用|即可生效|不必.*填写/)
  // 提示只改 placeholder：表单初值仍是空的，保存时不会被误写。
  assert.equal(envInitial([root]).PG_BACKUP_ROOT, '')
})

test('凭证、必填项与「留空即关闭」的开关都不显示默认值', () => {
  const base: EnvField = {
    key: 'MINIO_CONTAINER_NAME', label: 'MinIO 容器名', group: '备份端',
    value: '', secret: false, configured: false, default: '',
  }
  assert.equal(envInputPlaceholder(base), '未配置，需手工填写')
  assert.equal(envInputPlaceholder({ ...base, key: 'PG_SSH_HOST' }), '未配置，需手工填写')
  // 就算旧数据/误配给凭证塞了 default，也不许显示或填入。
  assert.equal(envInputPlaceholder({ ...base, key: 'SRC_SECRET', secret: true, default: 'leak' }), '未配置，需手工填写')
})

test('旧 exe 未下发 default 时归一化补空串，凭证强制清空', () => {
  const raw = {
    servers_file: 'servers.json',
    envs: [{ component: 'pg', path: 'pg.env', exists: false, fields: [
      { key: 'PG_BACKUP_ROOT', label: '备份根目录', group: '备份端', value: '', secret: false, configured: false },
      { key: 'PG_SSH_KEY', label: '私钥', group: '连接', value: '', secret: true, configured: false, default: 'leak' },
    ] }],
  } as unknown as ConfigView
  const got = normalizeConfigView(raw)
  assert.equal(got.envs[0].fields[0].default, '')
  assert.equal(got.envs[0].fields[1].default, '')
  assert.equal(envInputPlaceholder(got.envs[0].fields[1]), '未配置，需手工填写')
})

test('一键填入只动「有默认值的非凭证空字段」，不覆盖人填的值', () => {
  const list: EnvField[] = [
    { key: 'PG_BACKUP_ROOT', label: '备份根目录', group: '备份端', value: '', secret: false, configured: false, default: '/data/backups/postgres' },
    { key: 'PG_BACKUP_LOG_DIR', label: '日志目录', group: '备份端', value: '', secret: false, configured: false, default: '/var/log/pg-backup' },
    { key: 'PG_SSH_HOST', label: '主服务器地址', group: '连接', value: '', secret: false, configured: false, default: '' },
    { key: 'PG_SSH_KEY', label: '私钥', group: '连接', value: '', secret: true, configured: false, default: '' },
    { key: 'ALERT_WEBHOOK', label: '告警', group: '巡检', value: '', secret: true, configured: false, default: '' },
    { key: 'PG_DB_NAME', label: '业务库名', group: '主服务器', value: 'pass_up_dev', secret: false, configured: true, default: 'pass_up' },
  ]
  const draft = envInitial(list)
  const filled = fillableDefaults(list, draft)
  assert.ok(filled)
  assert.equal(filled.PG_BACKUP_ROOT, '/data/backups/postgres')
  assert.equal(filled.PG_BACKUP_LOG_DIR, '/var/log/pg-backup')
  assert.equal(filled.PG_SSH_HOST, '')
  assert.equal(filled.PG_SSH_KEY, '')
  assert.equal(filled.ALERT_WEBHOOK, '')
  assert.equal(filled.PG_DB_NAME, 'pass_up_dev')
  // 只改表单：落盘仍走 changedFields + 保存 + yes 确认。
  assert.deepEqual(changedFields(draft, filled), {
    PG_BACKUP_ROOT: '/data/backups/postgres',
    PG_BACKUP_LOG_DIR: '/var/log/pg-backup',
  })
  // 全填完后没有可填项，按钮置灰。
  assert.equal(fillableDefaults(list, filled), null)
  // 人自己填过的值不被默认值覆盖。
  const typed = fillableDefaults(list, { ...draft, PG_BACKUP_ROOT: '/mnt/big' })
  assert.equal(typed?.PG_BACKUP_ROOT, '/mnt/big')
  assert.equal(typed?.PG_BACKUP_LOG_DIR, '/var/log/pg-backup')
})

test('确认文案点明「保存本机 ≠ 同步远端」，并提醒留空过不了预检', () => {
  const hint = confirmHint('env', { component: 'pg', count: 2 })
  assert.match(confirmTitle('env'), /本机/)
  assert.match(hint, /远端 backup.env 不会变/)
  assert.match(hint, /留空的字段不会写入文件/)
  assert.match(hint, /预检/)
  assert.match(confirmHint('sync', { component: 'minio', server: 'k1' }), /远端写操作/)
  assert.match(confirmHint('servers', { server: 'k1', count: 1 }), /一键免密 sudo/)
})

test('新增服务器的确认文案与表单初值', () => {
  assert.match(confirmTitle('add'), /新增/)
  assert.match(confirmHint('add', { count: 3 }), /不会连任何远端/)
  const initial = newServerInitial()
  assert.equal(initial.port, '22')
  assert.equal(initial.role, 'backup')
  assert.equal(initial.sudo_mode, 'nopasswd')
  assert.equal(initial.host, '')
  assert.equal(initial.key, '')
  // 新增模式的 base 是空对象：默认值也要一起提交，后端才好按同一套规则全量校验。
  assert.deepEqual(changedFields({}, initial), {
    port: '22', role: 'backup', sudo_mode: 'nopasswd',
  })
})

test('配置视图保留 setup_error：配置缺失时页面要能给出可操作的引导', () => {
  const raw = {
    servers_file: 'C:/cfg/servers.json',
    servers: null,
    envs: null,
    setup_error: '服务器清单为空',
  } as unknown as ConfigView
  const got = normalizeConfigView(raw)
  assert.equal(got.setup_error, '服务器清单为空')
  assert.deepEqual(got.servers, [])
  assert.deepEqual(got.envs, [])
  assert.equal(normalizeConfigView({} as ConfigView).setup_error, undefined)
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
