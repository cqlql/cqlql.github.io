import { request } from '../../shared/api/http.ts'
import type {
  ApplySudoResult,
  CheckRow,
  OpenServersFileResult,
  ServersResponse,
} from './types.ts'

/**
 * 本能力的接口 —— 只发请求，不写业务判断、不弹提示。
 * 编排（先检查再配置、失败回查）在 `service.ts`。
 *
 * 四个接口都围着服务器清单这一个资源（连「用编辑器打开清单」也是），
 * 所以是单文件 `api.ts`；出现第二个资源（比如 P2 的备份状态）才升级成
 * `api/<resource>.ts`。桌面快捷方式 / 关闭界面已归到 `features/system/api.ts`。
 */
export const serversApi = {
  /** 只读：清单 + 最近一次检查缓存。 */
  list: () => request<ServersResponse>('/api/servers'),

  /** 写：真的去 ssh 探活。`name` 留空 = 检查全部。 */
  check: (name?: string) =>
    request<CheckRow[]>('/api/check', {
      method: 'POST',
      body: JSON.stringify(name ? { name } : {}),
    }),

  /**
   * 写：给一台机器配免密 sudo。
   *
   * ⚠️ `password` 只在这一次请求的请求体里出现，用完即弃 ——
   * 服务端不落盘、不写日志；前端也不缓存（弹窗关掉就清空）。
   */
  applySudo: (name: string, password: string) =>
    request<ApplySudoResult>('/api/apply-sudo', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    }),

  /**
   * 本机动作：用 VSCode（找不到则系统默认程序）打开 servers.json。
   *
   * 🔴 不带任何路径参数 —— 目标由服务端从 ops.env 解析，接口不能被当成
   * 「打开任意本机文件」的代理；人点了路径才会发这个 POST。
   */
  openServersFile: () =>
    request<OpenServersFileResult>('/api/open-servers-file', { method: 'POST' }),
}
