import type {
  BackupComponent,
  BackupDepsView,
  BackupMode,
  BackupTask,
  DepDoc,
  DepItem,
  DepsUninstallPlan,
  DepsUninstallTarget,
  OncePlan,
  OnceSourceItem,
  OnceSourceView,
} from '../types.ts'

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
    case 'deps':
      return '安装缺少依赖'
    case 'deps-uninstall':
      return '卸载备份依赖'
    case 'once':
      return '手动备份'
    case 'once-dry':
      return '手动备份预演'
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

/** 写模式需要输 yes；预检 / 自检 / 只读预演都是只读的。 */
export function needsConfirm(mode: BackupMode): boolean {
  return mode === 'deploy' || mode === 'deps' || mode === 'deps-uninstall' || mode === 'once'
}

export const componentOptions: { label: string; value: BackupComponent }[] = [
  { label: '全部', value: 'all' },
  { label: 'PostgreSQL', value: 'pg' },
  { label: 'MinIO', value: 'minio' },
]

/** 确认弹窗里那句提醒，随模式变，免得把只读操作也写得吓人。 */
export function confirmHint(mode: BackupMode, name: string, component: string): string {
  if (mode === 'deps-uninstall') {
    return `将在 ${name} 上卸载本次勾选的命令，供「安装缺少依赖」复测：只删工具装的 mc / PG 客户端，不动系统基础包、数据、镜像与定时任务。服务端会先跑一遍 --dry-run 预检。卸载后备份定时任务下一次执行会失败（预期结果）。`
  }
  if (mode === 'deps') {
    return `将在 ${name} 上安装 ${componentLabel(component)} 备份链路缺少的命令（典型是 mc / pg_restore）：只装包、不上传脚本、不写 crontab / logrotate / backup.env、不跑备份。服务端会先跑一遍 --dry-run 预检，预检不过不会安装。`
  }
  if (mode === 'once') {
    return `将在 ${name} 上立即跑一次 ${componentLabel(component)} 备份（不重装脚本、不写 crontab、不提权）：新增 dump / 对象，并附带分级清理与覆盖同名对象。服务端会先跑一遍 --dry-run 预检；手动成功不代表定时任务正常。`
  }
  if (mode !== 'deploy') return ''
  return `将向 ${name} 部署 ${componentLabel(component)} 的备份能力：写远端目录、crontab 与 logrotate。服务端会先跑一遍 --dry-run 预检，预检不过不会安装。`
}

/* ---------------- 手动备份（只读计划 / 门禁）---------------- */

export const EMPTY_ONCE_PLAN: OncePlan = {
  server: '', component: 'all', order: 'pg → minio', available: false,
  blockers: [], warnings: [], impact: [], commands: [],
  context: { cron_status: '不采集（工具不读 crontab）', cron_note: '', direction: '', identity: '' },
}

/** 后端是旧二进制 / 失败响应时也不能让页面 .map 白屏：数组一律 []。 */
export function normalizeOncePlan(raw: unknown): OncePlan {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_ONCE_PLAN }
  const v = raw as Record<string, unknown>
  const ctx = (v.context && typeof v.context === 'object' ? v.context : {}) as Record<string, unknown>
  return {
    server: str(v.server),
    component: str(v.component) || 'all',
    order: str(v.order) || 'pg → minio',
    available: v.available === true,
    blockers: arr<string>(v.blockers),
    warnings: arr<string>(v.warnings),
    impact: arr<string>(v.impact),
    commands: arr<string>(v.commands),
    context: {
      cron_status: str(ctx.cron_status) || EMPTY_ONCE_PLAN.context.cron_status,
      cron_note: str(ctx.cron_note),
      direction: str(ctx.direction),
      identity: str(ctx.identity),
    },
  }
}

/**
 * 执行入口四个条件：服务端计划说能跑 + 本页没任务在跑 + 选了机器 +
 * 最近一次预演没有失败。撞锁 / 组件失败 / 超时不在计划里预测（原型 O3），
 * 它们是运行期日志与报告的事。
 */
export function onceRunEnabled(plan: OncePlan, busy: boolean, name: string, dryFailed: boolean): boolean {
  return plan.available && !busy && name.trim() !== '' && !dryFailed
}

/** 确认弹窗：输 yes + 两项勾选（默认全不勾），另需服务端 confirm=yes。 */
export function onceConfirmEnabled(yes: string, checks: boolean[]): boolean {
  return yes.trim() === 'yes' && checks.length > 0 && checks.every(Boolean)
}

export const EMPTY_ONCE_SOURCE: OnceSourceView = {
  server: '', component: 'all', collected: false, pg: [], minio: [],
  note: '备份对象（生产端）由这台备份机上的 backup.env 决定，不在本页指定。',
}

/** 旧二进制 / 连不上 / 缺字段一律回完整空快照：不白屏、不猜生产端主机。 */
export function normalizeOnceSource(raw: unknown): OnceSourceView {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_ONCE_SOURCE }
  const v = raw as Record<string, unknown>
  const items = (x: unknown): OnceSourceItem[] =>
    arr<OnceSourceItem>(x).filter((i) => i && typeof i.key === 'string' && typeof i.value === 'string')
  return {
    server: str(v.server),
    component: str(v.component) || 'all',
    collected: v.collected === true,
    fetched_at: str(v.fetched_at) || undefined,
    error: str(v.error) || undefined,
    pg: items(v.pg),
    minio: items(v.minio),
    note: str(v.note) || EMPTY_ONCE_SOURCE.note,
  }
}

/* ---------------- 备份依赖（只读状态 / 安装参数）---------------- */

/** 输入框只留数字，最长 2 位；空串表示走发行版仓库。 */
export function normalizePgMajorInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 2)
}

/** 只有 1..99 才真的带上 --pg-major；其它一律当作「不指定」。 */
export function pgMajorValue(raw: string): number | undefined {
  const n = Number(normalizePgMajorInput(raw))
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : undefined
}

/** 预检/安装日志里出现「缺少依赖」时，页面给一个可直接点的修复入口。 */
export function depsHit(log: string): boolean {
  return /缺少依赖/.test(log)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? v as T[] : []
}

export const EMPTY_UNINSTALL: DepsUninstallPlan = {
  title: '确认卸载备份依赖', description: '', targets: [], impacts: [], submit_label: '确认卸载',
}

export const EMPTY_DEPS: BackupDepsView = {
  server: '', component: '', collected: false,
  items: [], missing: [], optional: [], plan: [], docs: [],
  uninstall: EMPTY_UNINSTALL,
}

/** 卸载计划也走防空数组归一化：旧二进制 / 失败响应都没有这个字段。 */
export function normalizeUninstallPlan(raw: unknown): DepsUninstallPlan {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    title: str(v.title) || EMPTY_UNINSTALL.title,
    description: str(v.description),
    targets: arr<DepsUninstallTarget>(v.targets).filter((t) => t && typeof t.key === 'string'),
    impacts: arr<string>(v.impacts),
    submit_label: str(v.submit_label) || EMPTY_UNINSTALL.submit_label,
  }
}

/**
 * 后端失败时回的是 ok=true + data.error，甚至可能是残缺对象：
 * 所有数组兜成 []，否则页面 .map 会整页白屏（与组件体检同一条规矩）。
 */
export function normalizeDepsView(raw: unknown): BackupDepsView {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_DEPS, error: '依赖状态没有返回可解析的内容' }
  }
  const v = raw as Record<string, unknown>
  const items = arr<DepItem>(v.items).filter((i) => i && typeof i.name === 'string')
  const docs = arr<DepDoc>(v.docs).filter((d) => d && typeof d.url === 'string')
  return {
    server: str(v.server),
    component: str(v.component),
    collected: v.collected === true,
    error: str(v.error) || undefined,
    items,
    missing: arr<string>(v.missing),
    optional: arr<string>(v.optional),
    plan: arr<string>(v.plan),
    docs,
    pg_major: typeof v.pg_major === 'number' ? v.pg_major : undefined,
    uninstall: normalizeUninstallPlan(v.uninstall),
  }
}

/** 能否点「安装缺少依赖」：采到状态 + 确实有缺 + 没在跑 + 选了机器。 */
export function depsInstallEnabled(view: BackupDepsView, busy: boolean, name: string): boolean {
  return view.collected && view.missing.length > 0 && !busy && name.trim() !== ''
}

/** 能否点「卸载依赖」：采到状态 + 有可卸项 + 没在跑 + 选了机器（勾选在弹窗里做）。 */
export function uninstallButtonEnabled(view: BackupDepsView, busy: boolean, name: string): boolean {
  return view.collected && view.uninstall.targets.length > 0 && !busy && name.trim() !== ''
}

/** 卸载弹窗能否提交：输 yes + 至少勾一个 + 勾的选项都在服务端下发的计划里。 */
export function uninstallSubmitEnabled(plan: DepsUninstallPlan, selected: string[], yes: string): boolean {
  return yes === 'yes' && selected.length > 0 &&
    selected.every((k) => plan.targets.some((t) => t.key === k))
}
