import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  defaultRebuild,
  judgeHandover,
  shouldRefreshView,
  timeoutMessage,
} from '../src/features/system/restartFlow.ts'
import type { RestartInfo } from '../src/features/system/types.ts'

function info(patch: Partial<RestartInfo> = {}): RestartInfo {
  return {
    confirm_token: 'sha256:abc',
    impact: [],
    build_command: [],
    binary_stale: false,
    log_path: 'C:/Users/test/AppData/Roaming/pass-up/ops-ui.log',
    port: 7788,
    exe: 'D:/_work/pass-up/pass-up.ops/ops.exe',
    exe_exists: true,
    task_running: false,
    ...patch,
  }
}

test('先重建的默认勾选由「二进制是否过期」决定', () => {
  assert.equal(defaultRebuild(null), false)
  assert.equal(defaultRebuild(info()), false)
  assert.equal(defaultRebuild(info({ binary_stale: true, stale_reason: 'web/src/App.tsx' })), true)
})

test('只有 boot_id 变了才算重启成功', () => {
  assert.equal(judgeHandover('aaa', 'bbb'), 'restarted')
  assert.equal(judgeHandover('aaa', 'aaa'), 'unchanged')
  // 重启期间连接断几秒：那是「还没到」，不是失败。
  assert.equal(judgeHandover('aaa', null), 'unknown')
  assert.equal(judgeHandover('aaa', ''), 'unknown')
  // 拿不到重启前的实例：新进程起来了也无法证明它换过。
  assert.equal(judgeHandover('', 'bbb'), 'unknown')
  assert.equal(judgeHandover('', null), 'unknown')
})

test('超时文案必须指出日志路径', () => {
  const msg = timeoutMessage(info(), 120)
  assert.match(msg, /120 秒/)
  assert.match(msg, /ops-ui\.log/)
  assert.match(msg, /没有重启成功/)
  const fallback = timeoutMessage(info({ log_path: '' }), 30)
  assert.match(fallback, /ops-ui\.log/)
  assert.match(timeoutMessage(null, 10), /10 秒/)
})

test('服务端明确拒绝后要重新拉一次视图', () => {
  assert.equal(shouldRefreshView(409), true)
  assert.equal(shouldRefreshView(500), true)
  assert.equal(shouldRefreshView(200), false)
  assert.equal(shouldRefreshView(401), false)
  assert.equal(shouldRefreshView(403), false)
})
