import type { ServerInfo, ServerStatus } from '../types.ts'

/**
 * 状态判定 —— **纯函数，不许 import antd / react**。
 *
 * 这是本目录存在的理由：判定（哪种状态叫什么、什么颜色、按钮能不能点）
 * 与渲染分开，于是 `node --test test/*.test.ts` 能直接覆盖它，
 * 不需要浏览器、不需要 jsdom。组件里只负责把 tone 映射成 Tag 的 color。
 */

/** 语义色，与 antd Tag 的 status 色一一对应（见 components/ServersTable.tsx 的 TONE_COLOR）。 */
export type Tone = 'ok' | 'warn' | 'err' | 'muted'

export interface Badge {
  text: string
  tone: Tone
}

export function sshBadge(st?: ServerStatus): Badge {
  switch (st?.ssh) {
    case 'ok':
      return { text: '可达', tone: 'ok' }
    case 'fail':
      return { text: '失败', tone: 'err' }
    default:
      return { text: '—', tone: 'muted' }
  }
}

export function sudoBadge(st?: ServerStatus): Badge {
  switch (st?.sudo) {
    case 'ok':
      return { text: '已免密', tone: 'ok' }
    case 'need':
      return { text: '需要配置', tone: 'warn' }
    case 'root':
      return { text: 'root 登录', tone: 'muted' }
    case 'disabled':
      return { text: '已跳过', tone: 'muted' }
    case 'error':
      return { text: '连接失败', tone: 'err' }
    default:
      return { text: '—', tone: 'muted' }
  }
}

/**
 * 要不要在「免密 sudo」这一格下面补一行 detail。
 *
 * 只在**没成功**时补：成功之后 detail 里通常是命令回显，摊在表格里只是噪声。
 */
export function sudoDetail(st?: ServerStatus): string {
  if (!st?.detail) return ''
  if (st.sudo === 'ok' || st.sudo === 'root') return ''
  return st.detail
}

/**
 * 「一键免密 sudo」为什么点不了。返回 null = 可以点。
 *
 * ⚠️ 与后端**不是**同一条判据（后端不管这些，它只会照做）：这里挡的是
 * 「点了必然没意义」的几种情况，让按钮直接灰掉并给出原因，而不是让人点了再读报错。
 */
export function applySudoBlockReason(s: ServerInfo): string | null {
  if (s.sudo_mode === 'root') return 'root 登录，本来就不需要 sudo'
  if (s.sudo_mode === 'none') return '清单里 sudo.mode=none，已声明不走 sudo'
  if (s.status?.sudo === 'ok') return '已经配置过免密 sudo'
  if (s.status?.sudo === 'root') return 'root 登录，本来就不需要 sudo'
  return null
}

export function canApplySudo(s: ServerInfo): boolean {
  return applySudoBlockReason(s) === null
}

/** 还没检查过（没有缓存状态）—— 点「配置」之前要先检查一次。 */
export function needsCheckFirst(s: ServerInfo): boolean {
  return !s.status?.sudo
}
