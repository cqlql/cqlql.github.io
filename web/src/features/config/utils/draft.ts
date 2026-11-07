import type {
  BackupComponent,
  CompareComponent,
  CompareField,
  CompareState,
  CompareView,
  ConfigServer,
  ConfigView,
  EnvField,
  EnvView,
} from '../types.ts'

/**
 * 判定层 + 响应归一化：不碰 React / DOM，便于 node --test 直接跑。
 *
 * 🔴 空值一律表示「保持不变」——凭证字段在页面上不回显明文，
 * 留空才不会把已配好的密码/私钥清空。想清空请直接改文件。
 */

export type ConfirmKind = 'servers' | 'add' | 'env' | 'sync'

// ---- 后端响应归一化 ----

/**
 * 🔴 Go 的 encoding/json 把 **nil slice 编成 `null`**，不是 `[]`。
 * 「远端值对照」抓取失败时后端只填 error、components 是 nil，页面直接
 * `compare.components.find(...)` 会抛 "Cannot read properties of null (reading 'find')"，
 * 整个界面被 ErrorBoundary 接成白屏（2026-11-06 真机）。
 *
 * 后端已改成恒回 `[]`；这里在**请求边界**再挡一层：浏览器可能还挂着旧 dist、
 * 服务端可能是旧 exe，两边版本不一致时同样不许白屏。失败原因（error / fetched_at）
 * 必须原样保留，页面要拿它显示「远端值暂不可用」。
 */
function list<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

export function normalizeConfigView(v: ConfigView | null | undefined): ConfigView {
  const raw = (v ?? {}) as Partial<ConfigView>
  return {
    servers_file: raw.servers_file ?? '',
    sync_enabled: raw.sync_enabled ?? false,
    setup_error: raw.setup_error,
    servers: list<ConfigServer>(raw.servers),
    envs: list<EnvView>(raw.envs).map((e) => ({
      ...e,
      // 旧 exe 还没下发 default：浏览器可能挂着旧 dist、服务端也可能是旧二进制。
      // 缺字段时补空串，凭证一律强制清空，不让「未定义」流到输入框或一键填入里。
      fields: list<EnvField>(e.fields).map((f) => ({
        ...f,
        default: f.secret ? '' : (f.default ?? ''),
      })),
    })),
  }
}

export function normalizeCompareView(v: CompareView | null | undefined): CompareView {
  const raw = (v ?? {}) as Partial<CompareView>
  return {
    ...raw,
    components: list<CompareComponent>(raw.components).map((c) => ({
      ...c,
      fields: list<CompareField>(c.fields),
    })),
  }
}

export function serverInitial(s: ConfigServer): Record<string, string> {
  return {
    host: s.host,
    port: String(s.port),
    user: s.user,
    role: s.role,
    note: s.note ?? '',
    sudo_mode: s.sudo_mode,
    key: '',
    sudo_password: '',
  }
}

/**
 * 新增一台服务器时的表单初值：只给能过后端全量校验的默认值，
 * name / host / user 仍要人填。与编辑模式共用同一张表单和同一套字段白名单。
 */
export function newServerInitial(): Record<string, string> {
  return {
    host: '',
    port: '22',
    user: '',
    role: 'backup',
    note: '',
    sudo_mode: 'nopasswd',
    key: '',
    sudo_password: '',
  }
}

export function envInitial(fields: EnvField[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) out[f.key] = f.value
  return out
}

/** 只提交真正改过且非空的字段，避免把凭证字段误清空。 */
export function changedFields(
  initial: Record<string, string>,
  draft: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(draft)) {
    if (value === '' || value === (initial[key] ?? '')) continue
    out[key] = value
  }
  return out
}

export function envPlaceholder(f: EnvField): string {
  if (!f.secret) return ''
  return f.configured ? '已配置，留空保持不变' : '未配置，可在此填写'
}

/**
 * 非凭证输入框的占位文案。
 *
 * 🔴 只提示、不自动写文件：本机 env 里没写这一项时，备份脚本会用 env-schema.json 的
 * 默认值，页面留空**不等于**「没有值」。default 由 GET /api/config 下发，唯一事实源是
 * internal/shared/env-schema.json，前端不再手抄第二份。
 *
 * PG_SSH_OPTS 是旧 exe（还没下发 default）唯一的兼容兜底：这串必须与
 * deploy/backup/postgres/{pg_backup.sh,pg_restore.sh,backup.env.example} 的兜底默认值
 * 逐字一致，backupdist_test.go 会挡住脚本侧漂移，改默认值时两边一起改。
 */
export const PG_SSH_OPTS_DEFAULT =
  '-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new'

/** 取「留空时会生效」的默认值；凭证与 schema 里 default 为空的键一律返回空串。 */
export function envDefaultOf(f: EnvField): string {
  if (f.secret) return ''
  if (f.default) return f.default
  // 旧 exe 还没下发 default 时，至少这一个键仍能给出脚本内置默认值。
  if (f.key === 'PG_SSH_OPTS') return PG_SSH_OPTS_DEFAULT
  return ''
}

export function envInputPlaceholder(f: EnvField): string {
  if (f.configured) return ''
  const def = envDefaultOf(f)
  return def ? `留空即用默认：${def}` : '未配置'
}

/**
 * 「填入推荐默认值」：只改表单，不写文件、不碰远端；后续仍要人点保存 + 输入 yes。
 *
 * 只填「非凭证 + 未配置 + 当前为空 + schema 有默认值」的字段：
 *   - 凭证 / 机器相关（PG_SSH_HOST、私钥、各种 KEY/SECRET）schema default 为空，不填；
 *   - 空值有语义的开关（MINIO_CONTAINER_NAME 跳过检查、UPLOAD_LIMIT 不限速、
 *     ALERT_WEBHOOK 不推送）同样 default 为空，不填，绝不改脚本的 `[ -z ]` 判定；
 *   - 人已经填过或本机文件里已配的值一律保留。
 * 没有可填项时返回 null，页面把按钮置灰。
 */
export function fillableDefaults(
  fields: EnvField[],
  draft: Record<string, string>,
): Record<string, string> | null {
  const out = { ...draft }
  let n = 0
  for (const f of fields) {
    if (f.secret || f.configured || (draft[f.key] ?? '') !== '') continue
    const def = envDefaultOf(f)
    if (!def) continue
    out[f.key] = def
    n++
  }
  return n > 0 ? out : null
}

// ---- 远端值对照 ----

export type CompareTone = 'muted' | 'warning' | 'info' | 'success'

export function compareTag(state: CompareState): { text: string; tone: CompareTone } {
  switch (state) {
    case 'consistent':
      return { text: '一致', tone: 'muted' }
    case 'changed':
      return { text: '不同于本机', tone: 'warning' }
    case 'remote-only':
      return { text: '仅远端有', tone: 'info' }
    default:
      return { text: '仅本机有', tone: 'success' }
  }
}

/** 表单里只放「本机有值」的键；远端独有的键没有输入框，收进折叠区。 */
export function splitCompare(fields: CompareField[]): {
  form: CompareField[]
  extra: CompareField[]
} {
  return {
    form: fields.filter((f) => f.state !== 'remote-only'),
    extra: fields.filter((f) => f.state === 'remote-only'),
  }
}

export function diffCount(fields: CompareField[]): number {
  return fields.filter((f) => f.state !== 'consistent').length
}

export function confirmTitle(kind: ConfirmKind): string {
  switch (kind) {
    case 'servers':
      return '确认保存服务器清单'
    case 'add':
      return '确认新增一台服务器'
    case 'env':
      return '确认保存备份配置（本机）'
    default:
      return '确认同步配置到远端'
  }
}

export function confirmHint(
  kind: ConfirmKind,
  detail: { server?: string; component?: BackupComponent; count?: number },
): string {
  const c = detail.component === 'minio' ? 'MinIO' : 'PostgreSQL'
  switch (kind) {
    case 'servers':
      return `将把 ${detail.count ?? 0} 项修改写入 ${detail.server ?? ''} 的 servers.json（本机文件，先留 .bak）。改了登录账号或 sudo 模式后，需要重新执行「一键免密 sudo」。`
    case 'add':
      return `将把这台服务器追加到 servers.json（本机文件，先留 .bak），并做一次全量校验；校验不通过原文件一字不动。新增只写本机，不会连任何远端。`
    case 'env':
      return `将把 ${detail.count ?? 0} 项修改写入本机的 ${c} 配置（0600，先留 .bak）。这只是本机文件，远端 backup.env 不会变。`
    default:
      return `将把本机 ${c} 配置推送到 ${detail.server ?? ''} 的 backup.env（远端写操作）。定时任务会立刻按新配置运行，请确认地址与私钥在目标机上可用。`
  }
}
