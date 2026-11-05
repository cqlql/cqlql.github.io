import { test } from 'node:test'
import assert from 'node:assert/strict'

import { connectionText, keyHint, passwordHint, roleText } from '../src/features/servers/utils/server.ts'
import type { ServerInfo } from '../src/features/servers/types.ts'

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

test('roleText：四个合法 role 都有中文，未知值原样返回', () => {
  assert.equal(roleText('backup'), '备份')
  assert.equal(roleText('app'), '应用')
  assert.equal(roleText('db'), '数据库')
  assert.equal(roleText('other'), '其它')
  assert.equal(roleText('weird'), 'weird')
})

test('connectionText：user@host:port', () => {
  assert.equal(connectionText(srv()), 'ops@10.0.0.11:22')
  assert.equal(connectionText(srv({ port: 2222 })), 'ops@10.0.0.11:2222')
})

test('keyHint：只说有没有，绝不说路径', () => {
  assert.equal(keyHint(srv({ has_key: true })), '私钥已配置')
  assert.equal(keyHint(srv({ has_key: false })), '使用 ssh config / agent')
})

test('passwordHint：存了就不再问', () => {
  assert.equal(
    passwordHint(srv({ password_configured: true })),
    '清单里已存 sudo.password，不会再问',
  )
  assert.equal(passwordHint(srv({ password_configured: false })), '需要输入一次初始密码')
})
