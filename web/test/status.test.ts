import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  applySudoBlockReason,
  canApplySudo,
  needsCheckFirst,
  sshBadge,
  sudoBadge,
  sudoDetail,
} from '../src/features/servers/utils/status.ts'
import type { ServerInfo, ServerStatus } from '../src/features/servers/types.ts'

/** 造一台最小可用的服务器；只覆盖被测字段，其余给安全的默认值。 */
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

test('sshBadge：三种取值 + 缺省', () => {
  assert.deepEqual(sshBadge({ ssh: 'ok' }), { text: '可达', tone: 'ok' })
  assert.deepEqual(sshBadge({ ssh: 'fail' }), { text: '失败', tone: 'err' })
  assert.deepEqual(sshBadge({}), { text: '—', tone: 'muted' })
  assert.deepEqual(sshBadge(undefined), { text: '—', tone: 'muted' })
})

test('sudoBadge：五种取值逐一映射，未知值不猜', () => {
  const cases: Array<[ServerStatus['sudo'], string, string]> = [
    ['ok', '已免密', 'ok'],
    ['need', '需要配置', 'warn'],
    ['root', 'root 登录', 'muted'],
    ['disabled', '已跳过', 'muted'],
    ['error', '连接失败', 'err'],
  ]
  for (const [sudo, text, tone] of cases) {
    assert.deepEqual(sudoBadge({ sudo }), { text, tone }, `sudo=${sudo}`)
  }
  assert.deepEqual(sudoBadge({}), { text: '—', tone: 'muted' })
})

test('sudoDetail：成功时不摊 detail，失败/待配置时才显示', () => {
  assert.equal(sudoDetail({ sudo: 'ok', detail: 'sudo -n true 输出' }), '')
  assert.equal(sudoDetail({ sudo: 'root', detail: 'whoami' }), '')
  assert.equal(sudoDetail({ sudo: 'need', detail: '需要密码' }), '需要密码')
  assert.equal(sudoDetail({ sudo: 'error', detail: 'connection refused' }), 'connection refused')
  assert.equal(sudoDetail({}), '')
})

test('applySudoBlockReason：清单声明优先于缓存状态', () => {
  // sudo.mode 说不用做 → 即使没检查过也不给点
  assert.match(applySudoBlockReason(srv({ sudo_mode: 'root' })) ?? '', /root/)
  assert.match(applySudoBlockReason(srv({ sudo_mode: 'none' })) ?? '', /none/)

  // 已经配好 → 不给点
  assert.match(applySudoBlockReason(srv({ status: { sudo: 'ok' } })) ?? '', /已经配置过/)
  assert.match(applySudoBlockReason(srv({ status: { sudo: 'root' } })) ?? '', /root/)
})

test('applySudoBlockReason：需要配置 / 没检查过 → 可以点', () => {
  assert.equal(applySudoBlockReason(srv({ status: { sudo: 'need' } })), null)
  assert.equal(applySudoBlockReason(srv({ status: {} })), null)
  assert.equal(canApplySudo(srv({ status: { sudo: 'error' } })), true)
})

test('needsCheckFirst：只有「从没检查过」才要先检查', () => {
  assert.equal(needsCheckFirst(srv({ status: {} })), true)
  assert.equal(needsCheckFirst(srv({ status: { ssh: 'ok' } })), true)
  assert.equal(needsCheckFirst(srv({ status: { sudo: 'need' } })), false)
  // error 也算「检查过了」：再检查一次并不能自动变好，别把按钮变成死循环
  assert.equal(needsCheckFirst(srv({ status: { sudo: 'error' } })), false)
})
