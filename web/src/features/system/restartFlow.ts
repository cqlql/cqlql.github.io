/**
 * 「重启自己」的**判定**（不含渲染与计时）。
 *
 * ⚠️ 抽出来的唯一理由：这段判定必须在没有浏览器的情况下也能测
 * （`web/test/restartFlow.test.ts` 用 `node --test` 直接 import 源码）。
 *
 * 它守的是一个具体的不一致：服务端是「先回 200、再让本进程退出」，所以
 * 「响应拿不到」在重启时是**预期内**的形态；而交接失败时旧进程会原地活着
 * （刻意的 —— 用一次看不见的失败换掉整个服务更糟）。于是有两种失败长得很像：
 *
 *   - 交接成功 → 响应可能丢掉，boot_id 会变；
 *   - 交接失败 → 响应同样可能丢掉，boot_id 永远不变。
 *
 * 只按「请求有没有报错」判，会把前者报成失败 —— 那是真机上最容易踩的假话。
 * 规则：boot_id 变了才算成功；传输层失败不是失败，它只说明「该去等 boot_id 了」。
 */
import type { RestartInfo } from './types.ts'

export type HandoverVerdict = 'restarted' | 'unchanged' | 'unknown'

/**
 * 「先重建」的默认值**由事实决定**，不写死。
 *
 * 写死 true → 每次重启都白等几秒到 40 秒；
 * 写死 false → 改了代码忘了勾就用旧二进制起来，症状是
 * 「我明明改了，界面怎么没变」—— 那正是这一页最忌讳的假象。
 */
export function defaultRebuild(info: RestartInfo | null): boolean {
  return info?.binary_stale === true
}

/**
 * 比对两次 boot_id，给出「重启成没成」的结论。
 *
 * ⚠️ 'unknown' 不许显示成成功或失败：那是在替一个我们并不知道的事实下断言。
 * 重启期间连接会断几秒（after === null），那是「还没到」，不是结论。
 */
export function judgeHandover(before: string, after: string | null): HandoverVerdict {
  if (before === '') return 'unknown'
  if (after === null || after === '') return 'unknown'
  return after === before ? 'unchanged' : 'restarted'
}

/** 超时后的文案。日志路径必须写出来 —— 失败原因只在那里。 */
export function timeoutMessage(info: RestartInfo | null, waitSeconds: number): string {
  const log = info?.log_path
  return (
    `等了 ${waitSeconds} 秒，boot_id 没有变化 —— 看起来没有重启成功（进程还在跑旧的）。` +
    (log ? `新进程的输出在：${log}` : '拿不到日志路径，去配置目录的 ops-ui.log 看。')
  )
}

/**
 * 服务端明确拒绝后，要不要重新拉一次视图。
 *
 * 409（确认过期 / 备份任务在跑）与 500（重建失败）都意味着刚才那份对照
 * 已经不成立了：不刷新的话，下一次点「执行」还会拿着旧的 confirm_token 再撞一次。
 */
export function shouldRefreshView(status: number): boolean {
  return status === 409 || status === 500
}
