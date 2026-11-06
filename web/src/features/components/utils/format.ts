import type {
  CheckState,
  ComponentCheck,
  ComponentState,
  ComponentStatus,
  ComponentsStatusView,
} from '../types.ts'

/**
 * 🔴 Go 的 nil slice 编成 JSON 是 null，前端 .find / .map 会整页白屏
 *    （docs/ui.md §11.4）。所有数组在这里统一兜成 []，后端也有一层。
 */
export function list<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

export function normalizeStatusView(raw: unknown): ComponentsStatusView {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<ComponentsStatusView>
  const pre = (v.preflight && typeof v.preflight === 'object' ? v.preflight : {}) as Partial<ComponentsStatusView['preflight']>
  return {
    server: typeof v.server === 'string' ? v.server : '',
    collected: v.collected === true,
    error: typeof v.error === 'string' ? v.error : '',
    components: list<ComponentStatus>(v.components),
    checks: list<ComponentCheck>(v.checks),
    raw: v.raw && typeof v.raw === 'object' ? (v.raw as Record<string, string>) : {},
    preflight: {
      ready: pre.ready === true,
      blockers: list<string>(pre.blockers),
      warnings: list<string>(pre.warnings),
    },
  }
}

const STATE_LABELS: Record<ComponentState, string> = {
  missing: '未安装',
  ok: '正常',
  degraded: '需修复',
  unknown: '未知',
  planned: '待接入',
}

export function stateLabel(s: string): string {
  return STATE_LABELS[s as ComponentState] ?? s
}

/** antd Tag 的 color；浅色主题下与项目既有语义一致。 */
export function stateColor(s: string): string {
  switch (s) {
    case 'ok': return 'green'
    case 'missing': return 'default'
    case 'degraded': return 'orange'
    case 'unknown': return 'red'
    case 'planned': return 'blue'
    default: return 'default'
  }
}

export function checkColor(s: string): string {
  switch (s as CheckState) {
    case 'ok': return 'green'
    case 'warn': return 'orange'
    case 'err': return 'red'
    default: return 'default'
  }
}

/**
 * 安装按钮能不能点：
 * - 组件必须是已接入（phase=ready）且体检采到状态（collected）
 * - 只有 missing 才装；已装 / 状态未知都不装
 * - 上游依赖未就绪时不装（目前 docker 无依赖）
 */
export function canInstall(
  comp: ComponentStatus | undefined,
  view: ComponentsStatusView,
  busy: boolean,
  dependenciesReady: boolean,
): boolean {
  if (busy || !comp || comp.phase !== 'ready') return false
  if (!view.collected || !comp.collected) return false
  if (comp.state !== 'missing') return false
  return dependenciesReady
}

export function installHint(
  comp: ComponentStatus | undefined,
  view: ComponentsStatusView,
  dependenciesReady: boolean,
): string {
  if (!view.collected) return '只读体检没采到状态（可能是 ssh 连不上）；状态未知时不放行写操作。'
  if (!comp || comp.phase !== 'ready') return '该组件尚未接入，暂不允许写操作。'
  if (!dependenciesReady) return '上游依赖组件还没就绪，请先在目录里安装上游组件。'
  if (comp.state === 'ok') return '已安装且运行正常；重复安装会被跳过，无需再点。'
  if (comp.state === 'degraded') return '已安装但服务或插件异常；本轮不开放修复，请手工复核。'
  if (comp.state !== 'missing') return '状态未知，不放行写操作。'
  return '按 Docker 官方 apt 仓库安装引擎；服务端会先跑一次 --dry-run 预检。'
}
