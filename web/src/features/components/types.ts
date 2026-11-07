/** 本 feature 用到的最小投影；不 import 别的 feature 的类型。 */

export interface ServerOption {
  name: string
  host?: string
  role?: string
  note?: string
}

export interface ServersListResponse {
  servers: ServerOption[]
  default?: string
}

export type ComponentState = 'missing' | 'ok' | 'update' | 'degraded' | 'unknown' | 'planned'
export type CheckState = 'ok' | 'warn' | 'err' | 'off'
export type ComponentVerb = 'install' | 'update' | 'uninstall' | 'image-copy'

export interface ComponentCheck {
  key: string
  label: string
  value: string
  state: CheckState
}

export interface Preflight {
  ready: boolean
  blockers: string[]
  warnings: string[]
}

/** 目标机上已导入的离线镜像（只读体检采集）。 */
export interface ImageInfo {
  reference: string
  id: string
  size: string
  created: string
}

/**
 * 「从服务器复制」的来源机镜像清单（只读）。
 * 🔴 collected=false 表示「查不动」，不是「源机没有镜像」，此时不许放行复制。
 */
export interface SourceImagesView {
  server: string
  collected: boolean
  elevated: boolean
  error?: string
  images: ImageInfo[]
}

/** 本机 backup/minio.env 的事实：只回布尔标记与非凭证的 URL，绝不回显凭证值。 */
export interface LocalFacts {
  minio_root_user_set: boolean
  minio_root_secret_set: boolean
  dest_url?: string
  dest_url_port?: string
}

export interface ComponentStatus {
  id: string
  name: string
  kind: string
  depends?: string
  phase: 'ready' | 'planned'
  /** 只有声明了离线镜像的组件（minio）才显示导入区与导入按钮。 */
  offline_image?: boolean
  state: ComponentState
  version: string
  checks: ComponentCheck[]
  collected: boolean
  error?: string
  /** 后端按组件算好的安装预检结论，前端不再自己拼一套判据。 */
  preflight?: Preflight
}

/** 确认弹窗里的附加勾选项：required=true 必须勾，其余默认不勾。 */
export interface ActionCheck {
  key: string
  label: string
  required: boolean
  help?: string
}

/** MinIO 更新的候选镜像，全部来自目标机已离线导入的镜像清单。 */
export interface ImageChoice {
  reference: string
  current: boolean
}

/**
 * 「这个动词 + 这个组件」的一整套判据与文案，全部由 Go 侧 BuildActions 算好。
 * 🔴 前端只渲染并据此禁用按钮，不在这里复算能否执行 / 影响清单。
 */
export interface ActionPlan {
  verb: ComponentVerb
  label: string
  available: boolean
  reasons: string[]
  title: string
  description: string
  impacts: string[]
  checks: ActionCheck[]
  images: ImageChoice[]
  danger: boolean
  submit_label: string
}

/** GET /api/components/status 的数据。失败时 ok=true + data.error，不抛 HTTP 错误。 */
export interface ComponentsStatusView {
  server: string
  collected: boolean
  error?: string
  components: ComponentStatus[]
  checks: ComponentCheck[]
  raw: Record<string, string>
  preflight: Preflight
  /** 按组件 id 的预检；旧后端没有这个字段时回退到上面的 preflight。 */
  preflights?: Record<string, Preflight>
  images: ImageInfo[]
  local?: LocalFacts
  /** 按组件 id 的写动作计划；旧二进制没有时 normalizeStatusView 兜成 {}。 */
  actions: Record<string, ActionPlan[]>
}

/** 写动作：组件 / 动词与附加参数都还要由服务端按注册表白名单再验一次。 */
export interface ComponentRunRequest {
  verb: ComponentVerb
  component: string
  name: string
  confirm: 'yes'
  password?: string
  /** 仅 install / update docker：本次 apt / curl 临时走代理，不写远端配置。 */
  proxy?: string
  /** 仅 update minio：目标机已离线导入的镜像引用。 */
  image_ref?: string
  /** 仅 image-copy：镜像从这台已登记服务器 docker save 出来（源机，源 ≠ 目标）。 */
  from_server?: string
  /** 仅 uninstall minio，默认不勾：勾了才永久删除 /data/minio。 */
  purge_data?: boolean
  /** 仅 uninstall docker，必勾：已知晓会连带停止下游 MinIO。 */
  ack_downstream?: boolean
}

export interface ComponentTask {
  running: boolean
  done: boolean
  mode: string
  server: string
  component: string
  exit_code: number
  log: string
  next: number
  started_at?: string
  ended_at?: string
}
