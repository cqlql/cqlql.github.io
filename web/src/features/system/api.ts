import { request } from '../../shared/api/http.ts'
import type { HealthInfo, RestartInfo, RestartResult } from './types.ts'

/**
 * 「服务自己」这一能力的三个接口：健康实例标识、重启视图、执行重启。
 *
 * 只发请求，不写业务判断 —— 判定（boot_id 变没变、先重建默认勾不勾）在
 * `restartFlow.ts`，弹窗与计时在 `components/RestartPanel.tsx`。
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
}
