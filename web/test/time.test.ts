import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatShortTime } from '../src/shared/utils/time.ts'

// ⚠️ 断言刻意不写死具体时分：格式化用的是**浏览器本地时区**，
// 写死会让测试在别的时区挂掉。这里只验「形状」与三条边界。

test('formatShortTime：空值与缺省一律 —', () => {
  assert.equal(formatShortTime(), '—')
  assert.equal(formatShortTime(''), '—')
})

test('formatShortTime：合法 RFC3339 → MM-DD HH:mm', () => {
  const got = formatShortTime('2026-11-05T14:05:11+08:00')
  assert.match(got, /^\d{2}-\d{2} \d{2}:\d{2}$/)
  // 月/日与时刻都是两位补零
  const [date, time] = got.split(' ')
  assert.equal(date.length, 5)
  assert.equal(time.length, 5)
})

test('formatShortTime：解析不了就原样返回，不猜一个时间', () => {
  assert.equal(formatShortTime('不是时间'), '不是时间')
  assert.equal(formatShortTime('2026-13-45'), '2026-13-45')
})

test('formatShortTime：带毫秒与 Z 后缀也能吃', () => {
  assert.match(formatShortTime('2026-11-05T06:05:11.123Z'), /^\d{2}-\d{2} \d{2}:\d{2}$/)
})
