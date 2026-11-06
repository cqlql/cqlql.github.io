/**
 * 全平台唯一的请求底座：令牌、信封、401、错误类型。
 *
 * 🔴 业务接口**不放这里** —— 按能力放 `features/<能力>/api.ts`。
 * 这一层只回答「怎么发一个请求」，不回答「有哪些接口」。
 * 依据：`cqlql-notes/docs/工程/目录结构规范.md` §2（单一 `shared/api/`）与
 * `前端/前端目录结构规划.md` §二「`src/lib/` 不要和 `shared/api/` 并存」。
 */

const TOKEN_PARAM = 'token'

/**
 * 访问令牌。
 *
 * 🔴 只放在**内存 + 地址栏**里，不写 localStorage：令牌是「本次进程的一次性凭据」，
 * 落盘之后它就变成一个长期有效的凭据，而 `ops ui` 每次启动都会换一个新的 ——
 * 存下来只会让人分不清「当前这个后端」和「上一个后端」。
 *
 * 地址栏里的 `?token=` 是 CLI 打印出来的那个，刷新时仍然在，所以刷新不会掉线。
 */
let token = ''

/** 从当前地址取一次令牌。必须在第一次请求之前调用（见 main.tsx 的说明）。 */
export function adoptTokenFromUrl(): void {
  const t = new URLSearchParams(location.search).get(TOKEN_PARAM) ?? ''
  if (t) token = t
}

export function getToken(): string {
  return token
}

export class ApiError extends Error {
  readonly kind: 'unauthorized' | 'network' | 'api' | 'http'
  readonly status: number

  constructor(kind: ApiError['kind'], status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

/**
 * 统一请求入口。
 *
 * 信封固定是 `{ok, data?, error?}`（Go 侧 apiResponse）：
 * - `ok=false` 或非 2xx 一律抛 ApiError，调用方只处理异常，不判两套；
 * - 401 单独给一句「该去哪儿拿令牌」的提示 —— 这是本机回环服务最常见的失败。
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (token) headers.set('X-Ops-Token', token)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  return send<T>(path, { ...init, headers })
}

/**
 * multipart 上传（离线镜像 tar）。**不要**手动设 Content-Type：
 * 浏览器要自己带 boundary，手工设了服务端就解析不出 part。
 * 令牌、信封、401 与错误处理仍走同一个 send，不复制第二套判定。
 */
export async function requestForm<T>(path: string, form: FormData): Promise<T> {
  const headers = new Headers()
  if (token) headers.set('X-Ops-Token', token)
  return send<T>(path, { method: 'POST', headers, body: form })
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch (cause) {
    throw new ApiError('network', 0, '连不上 ops ui 后端（进程退出了？）：' + String(cause))
  }

  const text = await res.text()
  let body: { ok?: boolean; data?: unknown; error?: string } | undefined
  if (text) {
    try {
      body = JSON.parse(text) as typeof body
    } catch {
      // 非 JSON（例如 Go 的 http.Error 纯文本）：交给下面的状态码分支。
      body = undefined
    }
  }

  if (res.status === 401) {
    throw new ApiError(
      'unauthorized',
      401,
      '访问令牌无效或缺失：请用 CLI 打印的、带 ?token= 的地址打开界面',
    )
  }
  if (!res.ok || body?.ok === false) {
    const msg =
      typeof body?.error === 'string' && body.error !== ''
        ? body.error
        : `HTTP ${res.status} ${res.statusText}`
    throw new ApiError(res.ok ? 'api' : 'http', res.status, msg)
  }
  if (!body) {
    throw new ApiError('http', res.status, '响应不是 JSON：界面与后端版本可能不一致')
  }
  return body.data as T
}
