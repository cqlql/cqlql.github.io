import { request } from '../../shared/api/http.ts'
import type { HealthInfo, RestartInfo, RestartResult, ShortcutInfo } from './types.ts'

/**
 * 「服务自己」这一能力的接口：健康实例标识、重启、桌面快捷方式、关闭界面。
 *
 * 🔴 后两个也是**对工具本身**的动作，不是服务器清单的资源：以前放在
 * `features/servers/api.ts` 只是因为按钮当时挂在服务器管理页。按钮挪到全局
 * 工具栏后接口跟着归位，免得「看代码以为建快捷方式要连服务器」。
 *
 * 只发请求，不写业务判断 —— 判定（boot_id 变没变、先重建默认勾不勾）在
 * `restartFlow.ts`，弹窗与计时在 `components/RestartPanel.tsx`，
 * 快捷方式 / 关闭界面的点击与反馈在 `components/ToolbarActions.tsx`。
 */
export const systemApi = {
  /** 轮询用：boot_id 变了才算真的换了进程。 */
  health: () => request<HealthInfo>('/api/health'),

  /** 打开确认弹窗前取事实。 */
  restartView: () => request<RestartInfo>('/api/restart'),

  /**
   * 执行重启。
   *
   * ⚠️ 服务端是「先回 200、再让本进程退出」，所以这个请求的传输层失败
   * （Failed to fetch / 连接被重置）是**预期形态**，不是失败判据。
   * 只有 ApiError（服务端明确回了 JSON 错误）才说明它压根没动手。
   */
  restart: (rebuild: boolean, confirm: string) =>
    request<RestartResult>('/api/restart', {
      method: 'POST',
      body: JSON.stringify({ rebuild, confirm }),
    }),

  /**
   * 在桌面建一个指向启动器的快捷方式。与 `ops shortcut` 是**同一份实现**
   * （后端注入 launcher），界面不自己拼路径；配置不全时也能用。
   */
  shortcut: () => request<ShortcutInfo>('/api/shortcut', { method: 'POST' }),

  /**
   * 关闭**本机**的 ops ui 进程（退出码 0）。不改远端、不写配置。
   * 后台模式下启动器窗口是隐藏的，这个按钮就是唯一的停止方式。
   */
  shutdown: () => request<{ stopping: boolean }>('/api/shutdown', { method: 'POST' }),
}
