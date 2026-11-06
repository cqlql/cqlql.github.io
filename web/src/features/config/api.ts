import { request } from '../../shared/api/http.ts'
import { normalizeCompareView, normalizeConfigView } from './utils/draft.ts'
import type {
  BackupComponent,
  CompareView,
  ConfigView,
  EnvSaveResult,
  ServerSaveResult,
  SyncResult,
} from './types.ts'

/**
 * 只发请求 + 在边界归一化响应，不写业务判断（判定都在 utils/draft.ts）。
 *
 * 🔴 四个接口都不带路径参数：目标文件由服务端从 ops.env / 配置目录解析。
 * 三个写接口都必须带 confirm="yes"，服务端会拒掉没确认的请求。
 * 🔴 两个读接口过 normalize*：后端 nil slice 会编成 null，直接 .find 会白屏。
 */
export const configApi = {
  /** 只读：清单字段（凭证只给标记）+ 两份备份配置字段 + 执行身份链。 */
  view: async () => normalizeConfigView(await request<ConfigView>('/api/config')),

  saveServers: (name: string, fields: Record<string, string>) =>
    request<ServerSaveResult>('/api/config/servers', {
      method: 'POST',
      body: JSON.stringify({ name, fields, confirm: 'yes' }),
    }),

  saveEnv: (component: BackupComponent, fields: Record<string, string>) =>
    request<EnvSaveResult>('/api/config/backup-env', {
      method: 'POST',
      body: JSON.stringify({ component, fields, confirm: 'yes' }),
    }),

  /** 显式远端写：把本机 env 推到目标机的 <组件>/backup.env，不重装脚本。 */
  syncEnv: (name: string, component: BackupComponent) =>
    request<SyncResult>('/api/config/sync-env', {
      method: 'POST',
      body: JSON.stringify({ name, component, confirm: 'yes' }),
    }),

  /**
   * 只读抓取远端 backup.env 并与本机逐键对比。
   * 不写任何文件；凭证只回掩码，失败原因放在 `error` 字段。
   */
  compare: async (name: string, component: BackupComponent | 'all' = 'all') =>
    normalizeCompareView(
      await request<CompareView>(
        `/api/config/compare?component=${component}&name=${encodeURIComponent(name)}`,
      ),
    ),
}
