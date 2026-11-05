import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

import { ServersPage } from './features/servers/index.ts'
import { ErrorBoundary } from './shared/ui/ErrorBoundary.tsx'

/**
 * 现在只有一个能力、一页，所以**没有 router/ 与顶层 pages/**。
 *
 * 判据（母本第三节）：删掉一个业务能不能只删一个目录 —— 能，所以页面在
 * `features/servers/pages/` 里。等出现第二个能力、且需要「刷新后停在那页」或
 * 「能把链接发给别人」，才建 `router/index.tsx`，用懒加载引各 feature 的 `router.tsx`。
 */
export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      {/* AntApp 提供 message/modal 的上下文，避免 antd 的静态方法在 React 19 下拿不到主题 */}
      <AntApp>
        <ErrorBoundary>
          <ServersPage />
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  )
}
