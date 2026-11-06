import type { BackupComponent, BackupMode, BackupTask } from '../types.ts'

/**
 * 纯函数：状态码 → 文案 + 语义色。不 import react / antd、不碰 DOM，
 * 所以 `node --test` 能直接跑（与 servers/utils 同一条规矩）。
 */

export type PhaseTone = 'default' | 'processing' | 'success' | 'error' | 'warning'

export interface Phase {
  text: string
  tone: PhaseTone
}

export function modeLabel(mode: BackupMode | ''): string {
  switch (mode) {
    case 'preflight':
      return '备份部署预检'
    case 'deploy':
      return '安装 / 升级备份能力'
    case 'verify':
      return '远端自检'
    default:
      return '尚未运行'
  }
}

export function componentLabel(c: string): string {
  switch (c) {
    case 'pg':
      return 'PostgreSQL'
    case 'minio':
      return 'MinIO'
    default:
      return '全部（pg + minio）'
  }
}

export function taskPhase(t: BackupTask | null): Phase {
  if (!t || (!t.running && !t.done)) return { text: '尚未运行', tone: 'default' }
  if (t.running) return { text: `${modeLabel(t.mode)}进行中…`, tone: 'processing' }
  if (t.exit_code === 0) return { text: `${modeLabel(t.mode)}完成`, tone: 'success' }
  return { text: `${modeLabel(t.mode)}失败（退出码 ${t.exit_code}）`, tone: 'error' }
}

/** 任务没跑完、且选了目标机，才允许再发一个任务。 */
export function canStart(t: BackupTask | null, name: string): boolean {
  return name.trim() !== '' && !t?.running
}

/** 只有安装需要输 yes；预检与自检都是只读的。 */
export function needsConfirm(mode: BackupMode): boolean {
  return mode === 'deploy'
}

export const componentOptions: { label: string; value: BackupComponent }[] = [
  { label: '全部', value: 'all' },
  { label: 'PostgreSQL', value: 'pg' },
  { label: 'MinIO', value: 'minio' },
]

/** 确认弹窗里那句提醒，随模式变，免得把只读操作也写得吓人。 */
export function confirmHint(mode: BackupMode, name: string, component: string): string {
  if (mode !== 'deploy') return ''
  return `将向 ${name} 部署 ${componentLabel(component)} 的备份能力：写远端目录、crontab 与 logrotate。服务端会先跑一遍 --dry-run 预检，预检不过不会安装。`
}
