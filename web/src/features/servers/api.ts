import { request } from '../../shared/api/http.ts'
import type {
  ApplySudoResult,
  CheckRow,
  OpenServersFileResult,
  ServersResponse,
  ShortcutInfo,
} from './types.ts'

/**
 * 本能力的三个接口 —— 只发请求，不写业务判断、不弹提示。
 * 编排（先检查再配置、失败回查）在 `service.ts`。
 *
 * 三个接口都打在同一个资源（服务器清单）上，所以是单文件 `api.ts`；
 * 出现第二个资源（比如 P2 的备份状态）才升级成 `api/<resource>.ts`。
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
   * 在桌面建一个指向启动器的快捷方式。
   * 与 `ops shortcut` 是**同一份实现**（后端注入），界面不自己拼路径。
   */
  shortcut: () => request<ShortcutInfo>('/api/shortcut', { method: 'POST' }),

  /**
   * 本机动作：用 VSCode（找不到则系统默认程序）打开 servers.json。
   *
   * 🔴 不带任何路径参数 —— 目标由服务端从 ops.env 解析，接口不能被当成
   * 「打开任意本机文件」的代理；人点了路径才会发这个 POST。
   */
  openServersFile: () =>
    request<OpenServersFileResult>('/api/open-servers-file', { method: 'POST' }),

  /**
   * 关闭**本机**的 ops ui 进程（退出码 0）。不改远端、不写配置。
   * 后台模式下启动器窗口是隐藏的，这个按钮就是唯一的停止方式。
   */
  shutdown: () => request<{ stopping: boolean }>('/api/shutdown', { method: 'POST' }),
}
