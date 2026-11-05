import type { ApplySudoResult, CheckRow, ServerInfo, ServerStatus, ServersResponse } from './types.ts'
import { needsCheckFirst } from './utils/status.ts'

/**
 * 本能力的**编排**：多接口串起来 + 状态回填 + 失败兜底。
 *
 * 为什么不写在页面里：这三段流程都有「先判断再决定下一步」的分支
 * （先检查？要不要问密码？失败了要不要回查？），属于业务细节。
 * 页面只负责取数与拼装（见 pages/ServersPage.tsx）。
 *
 * 🔴 依赖是**注入**的（`ServersApi` / `FlowHooks`），所以 `node --test` 能塞假实现，
 *    不必 mock 模块、也不必起浏览器。
 */

/** 本 feature 用到的接口；测试时注入假实现。 */
export interface ServersApi {
  list: () => Promise<ServersResponse>
  check: (name?: string) => Promise<CheckRow[]>
  applySudo: (name: string, password: string) => Promise<ApplySudoResult>
}

export type NoticeKind = 'success' | 'error' | 'info' | 'warning'

export interface Notice {
  kind: NoticeKind
  text: string
}

/** 流程对外说话的唯一出口：提示、回填检查结果、回填单台状态、要一次密码。 */
export interface FlowHooks {
  notice: (n: Notice) => void
  /** 把一次检查的结果合并回列表。 */
  rows: (rows: CheckRow[]) => void
  /** 只更新一台机器的状态（apply 之后不需要整表重刷）。 */
  status: (name: string, st: ServerStatus) => void
  /** 等人输入初始 sudo 密码；取消返回 null。 */
  askPassword: (name: string) => Promise<string | null>
}

/** CheckRow 里去掉 name/role，剩下的就是一份 ServerStatus。 */
export function rowStatus(r: CheckRow): ServerStatus {
  return { ssh: r.ssh, sudo: r.sudo, detail: r.detail, checked_at: r.checked_at }
}

/** 把任意异常变成一句人话；ApiError 的 message 已经是后端给的中文。 */
export function errText(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

export async function checkOne(api: ServersApi, name: string, hooks: FlowHooks): Promise<void> {
  hooks.notice({ kind: 'info', text: `正在检查 ${name}…` })
  try {
    const rows = await api.check(name)
    hooks.rows(rows)
    hooks.notice({ kind: 'success', text: `${name} 检查完成。` })
  } catch (e) {
    hooks.notice({ kind: 'error', text: errText(e) })
  }
}

export async function checkAll(api: ServersApi, hooks: FlowHooks): Promise<void> {
  hooks.notice({ kind: 'info', text: '正在检查全部…' })
  try {
    const rows = await api.check()
    hooks.rows(rows)
    hooks.notice({ kind: 'success', text: `检查完成，共 ${rows.length} 台。` })
  } catch (e) {
    hooks.notice({ kind: 'error', text: errText(e) })
  }
}

/**
 * 一键免密 sudo 的完整流程：
 * 没检查过 → 先检查；已经好了 → 直接说；没存密码 → 问一次；然后 apply。
 *
 * ⚠️ 失败后**回查一次**状态：让人看见「现在到底是什么样」，
 *    而不是停在旧格子上继续按一个可能已经生效的按钮。
 */
export async function applySudo(
  api: ServersApi,
  server: ServerInfo,
  hooks: FlowHooks,
): Promise<void> {
  try {
    let cur = server
    // 不知道现状就弹密码框，等于让人猜。
    if (needsCheckFirst(cur)) {
      hooks.notice({ kind: 'info', text: `先检查 ${cur.name}…` })
      const rows = await api.check(cur.name)
      hooks.rows(rows)
      const row = rows.find((r) => r.name === cur.name)
      if (row) cur = { ...cur, status: rowStatus(row) }
    }
    if (cur.status?.sudo === 'ok' || cur.status?.sudo === 'root') {
      hooks.notice({ kind: 'success', text: `${cur.name} 已无需配置。` })
      return
    }

    let password = ''
    if (!cur.password_configured) {
      const pw = await hooks.askPassword(cur.name)
      if (pw === null) {
        hooks.notice({ kind: 'info', text: '已取消。' })
        return
      }
      password = pw
    }

    hooks.notice({ kind: 'info', text: `正在为 ${cur.name} 配置免密 sudo…` })
    const res = await api.applySudo(cur.name, password)
    hooks.status(cur.name, res.status)
    hooks.notice({
      kind: 'success',
      text: res.message + (res.backup_path ? `（已备份原片段：${res.backup_path}）` : ''),
    })
  } catch (e) {
    hooks.notice({ kind: 'error', text: errText(e) })
    try {
      hooks.rows(await api.check(server.name))
    } catch {
      /* 回查也失败就保留原始错误，别再覆盖一次 */
    }
  }
}
