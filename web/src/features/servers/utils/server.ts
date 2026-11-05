import type { ServerInfo } from '../types.ts'

/** 展示用的纯文本拼装 —— 纯函数，可直接被 node --test 覆盖。 */

const ROLE_TEXT: Record<string, string> = {
  backup: '备份',
  app: '应用',
  db: '数据库',
  other: '其它',
}

/** 清单里的 role 是英文枚举，界面上给人看中文；未知值原样显示，不猜。 */
export function roleText(role: string): string {
  return ROLE_TEXT[role] ?? role
}

/** `user@host:port` —— 复制给别人排障时最常用的一行。 */
export function connectionText(s: ServerInfo): string {
  return `${s.user}@${s.host}:${s.port}`
}

/** 🔴 只说「有没有配私钥」，绝不说路径（私钥路径不进任何输出）。 */
export function keyHint(s: ServerInfo): string {
  return s.has_key ? '私钥已配置' : '使用 ssh config / agent'
}

/** 清单里存了 sudo.password 就不用再问一次。 */
export function passwordHint(s: ServerInfo): string {
  return s.password_configured ? '清单里已存 sudo.password，不会再问' : '需要输入一次初始密码'
}
