import { request, requestForm } from '../../shared/api/http.ts'
import type {
  ComponentRunRequest,
  ComponentTask,
  ComponentsStatusView,
  ServersListResponse,
  SourceImagesView,
} from './types.ts'

/** 只发请求，不做业务判断；判定在 utils/format.ts，编排在 service.ts。 */
export const componentsApi = {
  targets: () => request<ServersListResponse>('/api/servers'),

  /** 只读体检。失败时后端回 ok=true + data.error，这里照原样交给页面集中提示。 */
  status: (name: string) =>
    request<ComponentsStatusView>(`/api/components/status?name=${encodeURIComponent(name)}`),

  /** 只读：某台服务器的本地 MinIO 镜像清单（「从服务器复制」的来源候选）。 */
  sourceImages: (name: string) =>
    request<SourceImagesView>(`/api/components/images?name=${encodeURIComponent(name)}`),

  /** 写操作：后端校验 confirm=="yes"、组件白名单、name 白名单，并先跑 --dry-run。 */
  run: (req: ComponentRunRequest) =>
    request<{ started: boolean }>('/api/components/run', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** 与备份部署共用后台任务锁；这里只读增量日志。 */
  task: (after: number) => request<ComponentTask>(`/api/components/task?after=${after}`),

  /** 离线镜像 tar：服务端自己生成临时路径，接口不接收任何本机路径。 */
  uploadImage: (form: FormData) =>
    requestForm<{ started: boolean }>('/api/components/image', form),
}
