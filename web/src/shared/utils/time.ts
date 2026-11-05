/**
 * 时间格式化 —— 纯函数，无 DOM、无 antd，可直接被 node --test 覆盖。
 *
 * 放在 `shared/utils/` 而不是 feature 内：它只回答「把一个时刻显示成什么」，
 * 不含任何业务词汇（谁的时间、什么时间都不影响结果）。
 */

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * 把 RFC3339 时刻格式化成 `MM-DD HH:mm`。
 *
 * ⚠️ 用的是**浏览器本地时区**，而后端存的是带时区的 RFC3339
 * （`time.Now().Format(time.RFC3339)`），所以跨时区看也不会差。
 * 与备份监控那条「时间差只在远端算」是两回事：那条说的是**求差**，
 * 这里只是**显示一个时刻**，不参与任何判定。
 *
 * 解析不了就原样返回 —— 猜一个时间比显示原始串更容易误导人。
 */
export function formatShortTime(v?: string): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
