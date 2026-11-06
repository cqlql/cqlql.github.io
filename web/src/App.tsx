import { useCallback, useEffect, useState } from 'react'
import { CloudServerOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons'
import { App as AntApp, ConfigProvider, Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import zhCN from 'antd/locale/zh_CN'

import { BackupPage } from './features/backup/index.ts'
import { ConfigPage } from './features/config/index.ts'
import { ServersPage } from './features/servers/index.ts'
import { RestartPanel } from './features/system/index.ts'
import { ErrorBoundary } from './shared/ui/ErrorBoundary.tsx'

type PageKey = 'servers' | 'backup' | 'config'

const NAV_ITEMS: MenuProps['items'] = [
  { key: 'servers', icon: <CloudServerOutlined />, label: '服务器管理' },
  { key: 'backup', icon: <DatabaseOutlined />, label: '备份能力部署' },
  // 低频入口：放最后，不给主路径（服务器管理 / 备份部署）多一次点击。
  { key: 'config', icon: <SettingOutlined />, label: '配置' },
]

// 窄窗口放不下 200px 侧栏，退化成顶部横向菜单；只是布局变化，不增加一次点击。
const NARROW_QUERY = '(max-width: 860px)'

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

/**
 * 两个能力、两页，但**仍然没有 router/**。
 *
 * 判据见 docs/ui.md §7：路由的价值是「刷新后停在那页 / 能把链接发给别人」，
 * 而这个界面是本机回环、地址里带着一次性 token 的单机工具，链接发出去也没用；
 * 用选中态切换还顺带躲开了「刷新时 URL 丢了 token」那个坑。
 * 等真需要深链接时再建 router/，Go 侧的单页回退不用改。
 *
 * 导航是左侧 `Sider + Menu`（窄窗口为顶部横向 Menu）。访问过的页面保持挂载、
 * 非当前页用 hidden 藏起来，语义与原先的 Tabs 一致：切回来不重新取数，
 * 检查结果和备份任务日志都还在。
 *
 * 「重启」放在**全局顶部工具栏**（宽屏在内容区顶部、窄屏与横向导航同一条），
 * 因为它是「对服务本身」的动作，与现在看哪一页无关；改完前端就该在当前页
 * 直接重启，不必先切走。工具栏不随页面卸载，重启轮询不会被切页打断。
 *
 * 顶栏**不放当前页标题**：每页的 `page-head` 已有 h1（还连着清单路径 / 操作按钮），
 * 侧栏选中项也已经指名了当前页，再来一份就是三重复。宽屏顶栏只留右侧的「重启」。
 */
export default function App() {
  const [page, setPage] = useState<PageKey>('servers')
  const [visited, setVisited] = useState<PageKey[]>(['servers'])
  const narrow = useNarrow()

  const onNav = useCallback<NonNullable<MenuProps['onClick']>>(({ key }) => {
    const next = key as PageKey
    setPage(next)
    setVisited((v) => (v.includes(next) ? v : [...v, next]))
  }, [])

  const nav = (
    <Menu
      className="app-menu"
      mode={narrow ? 'horizontal' : 'inline'}
      items={NAV_ITEMS}
      selectedKeys={[page]}
      onClick={onNav}
    />
  )

  const actions = (
    <div className="app-toolbar-actions">
      <RestartPanel />
    </div>
  )

  return (
    <ConfigProvider locale={zhCN}>
      {/* AntApp 提供 message/modal 的上下文，避免 antd 的静态方法在 React 19 下拿不到主题 */}
      <AntApp>
        <ErrorBoundary>
          <Layout className="app-shell">
            {!narrow && (
              <Layout.Sider className="app-sider" width={200} theme="light">
                <div className="app-brand">PassUp 运维</div>
                {nav}
              </Layout.Sider>
            )}
            <Layout className="app-main">
              <Layout.Header className={narrow ? 'app-header' : 'app-toolbar'}>
                {narrow && (
                  <>
                    <span className="app-brand">PassUp 运维</span>
                    {nav}
                  </>
                )}
                {actions}
              </Layout.Header>
              <Layout.Content className="app-content">
                {/* 每页一个错误边界：某一页渲染炸了只换掉那一页，
                    顶部工具栏（尤其「重启」）和另外两页还得留着，否则白屏后没法自救。
                    外层那个 ErrorBoundary 是兜底，正常情况轮不到它。 */}
                <div className="app-pane" hidden={page !== 'servers'}>
                  <ErrorBoundary><ServersPage /></ErrorBoundary>
                </div>
                <div className="app-pane" hidden={page !== 'backup'}>
                  {visited.includes('backup') && <ErrorBoundary><BackupPage /></ErrorBoundary>}
                </div>
                <div className="app-pane" hidden={page !== 'config'}>
                  {visited.includes('config') && <ErrorBoundary><ConfigPage /></ErrorBoundary>}
                </div>
              </Layout.Content>
            </Layout>
          </Layout>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  )
}
