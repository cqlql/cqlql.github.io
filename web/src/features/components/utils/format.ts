import type {
  CheckState,
  ComponentCheck,
  ComponentState,
  ComponentStatus,
  ComponentsStatusView,
  Preflight,
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
  const pre = (v.preflight && typeof v.preflight === 'object' ? v.preflight : {}) as Partial<Preflight>
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
    preflights: v.preflights && typeof v.preflights === 'object'
      ? (v.preflights as Record<string, Preflight>)
      : {},
    images: list<ComponentsStatusView['images'][number]>(v.images),
    local: v.local && typeof v.local === 'object' ? v.local : undefined,
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

/** 选中组件自己的预检；旧后端没有 preflights 时回退到全局（docker 的）预检。 */
export function preflightOf(view: ComponentsStatusView, comp?: ComponentStatus): Preflight {
  if (comp?.preflight) return comp.preflight
  if (comp && view.preflights?.[comp.id]) return view.preflights[comp.id]
  return view.preflight
}

/**
 * 安装按钮能不能点：
 * - 组件必须是已接入（phase=ready）且体检采到状态（collected）
 * - 只有 missing 才装；已装 / 状态未知都不装
 * - 上游依赖未就绪时不装（注册表 depends 推导）
 * - 服务端算好的组件预检不通过时不装（例：MinIO 没有离线镜像或缺凭证）
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
  if (!dependenciesReady) return false
  const pre = preflightOf(view, comp)
  return pre.ready && pre.blockers.length === 0
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
  const pre = preflightOf(view, comp)
  if (!pre.ready || pre.blockers.length > 0) {
    return '预检没过：' + (pre.blockers[0] ?? '服务端拒绝了写操作') + '。'
  }
  if (comp.id === 'minio') {
    return '用目标机已导入的离线镜像拉起 MinIO 容器；服务端会先跑一次 --dry-run 预检，不执行 docker pull。'
  }
  return '按 Docker 官方 apt 仓库安装引擎；服务端会先跑一次 --dry-run 预检。'
}

/** 目录行与按钮的文案由组件 id 推导，新增组件不用改页面骨架。 */
export function installLabel(id: string | undefined): string {
  switch (id) {
    case 'minio': return '安装 MinIO 服务'
    case 'docker': return '安装 Docker 引擎'
    default: return `安装 ${id ?? '组件'}`
  }
}

export interface ConfirmCopy {
  title: string
  description: string
  items: string[]
}

/** 二次确认弹窗的影响面按组件摊开，避免把 Docker 的 apt 说明贴到 MinIO 上。 */
export function confirmCopy(id: string | undefined): ConfirmCopy {
  if (id === 'minio') {
    return {
      title: '确认安装 MinIO 服务',
      description: '会用目标机已导入的离线镜像创建容器，写 /data/minio 并暴露 9000 / 9001 端口。',
      items: [
        '服务端先跑 --dry-run：Docker 引擎、离线镜像、端口与本机 root 凭证任一不满足就不安装。',
        'root 凭证取自本机 backup/minio.env 的 DEST_KEY / DEST_SECRET，运行时注入、日志脱敏，不回显。',
        '不执行 docker pull；不重建已有容器、不删 /data/minio、不动 Docker 引擎 / 镜像 / crontab。',
        '装完做 /minio/health/live 健康检查；不跑备份、不改 backup.env。',
        '备份脚本的 DEST_URL 要指向本机 9000（不是生产端 8007），请到「配置」页改并同步远端。',
      ],
    }
  }
  return {
    title: '确认安装 Docker 引擎',
    description: '会安装系统包、写 /etc/apt/sources.list.d/docker.sources、启用 docker.service，并把清单用户加入 docker 组。',
    items: [
      '服务端会先跑一次 --dry-run 预检，不通过就不安装、远端不改动。',
      '不跑 hello-world（会拉 Docker Hub 镜像），不动容器 / 镜像 / /var/lib/docker。',
      '不修改 crontab、backup.env；不改 DEST_URL（仍需在「配置」页把 8007 改成 9000）。',
      '组变更需重新登录才在当前会话生效。',
    ],
  }
}

/** 离线镜像区的说明文字：没有镜像时明确告诉人下一步做什么。 */
export function imageHint(view: ComponentsStatusView, dockerReady: boolean): string {
  if (!view.collected) return '只读体检没采到状态，先点「重新检查」。'
  if (!dockerReady) return '目标机 Docker 引擎还没就绪：先安装 Docker，再导入离线镜像。'
  if (view.images.length === 0) {
    return '目标机还没有离线镜像。选一个本机 docker save 导出的 .tar 导入后，MinIO 才能安装（本能力不会在线拉镜像）。'
  }
  return `目标机已有 ${view.images.length} 个 MinIO 镜像；导入新 tar 不会影响已有容器与 /data/minio。`
}
