import { useCallback, useEffect, useState } from 'react'
import { AppstoreOutlined, CloudServerOutlined, DashboardOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons'
import { App as AntApp, ConfigProvider, Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import zhCN from 'antd/locale/zh_CN'

import { BackupPage } from './features/backup/index.ts'
import { ComponentsPage } from './features/components/index.ts'
import { ConfigPage } from './features/config/index.ts'
import { MonitorPage } from './features/monitor/index.ts'
import { ServersPage } from './features/servers/index.ts'
import { StoppedNotice, ToolbarActions } from './features/system/index.ts'
import { ErrorBoundary } from './shared/ui/ErrorBoundary.tsx'

type PageKey = 'servers' | 'backup' | 'monitor' | 'components' | 'config'

const NAV_ITEMS: MenuProps['items'] = [
  { key: 'servers', icon: <CloudServerOutlined />, label: '服务器管理' },
  { key: 'backup', icon: <DatabaseOutlined />, label: '备份能力部署' },
  // P2+：只读快照页，与「备份能力部署」相邻（一个是看、一个是装）。
  { key: 'monitor', icon: <DashboardOutlined />, label: '备份监控' },
  // 「环境组件」是一个可扩展的目录页：以后加组件只加注册表声明，不再加导航项。
  { key: 'components', icon: <AppstoreOutlined />, label: '环境组件' },
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
 * 五个 feature、五页，但**仍然没有 router/**。
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
 * 「重启 / 创建桌面快捷方式 / 关闭界面」放在**全局顶部工具栏**（宽屏在内容区顶部、
 * 窄屏与横向导航同一条），因为它们都是「对这个工具本身」的纯本机动作，与现在看
 * 哪一页无关：改完前端就该在当前页直接重启；后台模式的窗口是隐藏的，从配置页
 * 也得能关界面。工具栏不随页面卸载，重启轮询不会被切页打断。
 * 反过来「检查全部」只作用于服务器清单，留在那一页的 `page-head`。
 *
 * 顶栏**不放当前页标题**：每页的 `page-head` 已有 h1（还连着清单路径 / 操作按钮），
 * 侧栏选中项也已经指名了当前页，再来一份就是三重复。宽屏顶栏只留右侧那组全局动作。
 *
 * 关掉界面后整个外壳换成一张静态说明页：服务已经不在了，留一屏能点的按钮只会骗人。
 */
export default function App() {
  const [page, setPage] = useState<PageKey>('servers')
  const [visited, setVisited] = useState<PageKey[]>(['servers'])
  // 配置页改了 servers.json 后，服务器管理页要重新取数：它一直挂载着，
  // 切回来不会重新挂载，光靠「切页」刷新不到新加的那台机器。
  const [serversVersion, setServersVersion] = useState(0)
  // 从「备份监控」的报错引导跳来时 +1：配置页可能还停在之前滚动到的 env 区域，
  // 不定位的话人点过去仍看不到「服务器清单 → 只读监控账号」。
  const [configFocusServers, setConfigFocusServers] = useState(0)
  const [stopped, setStopped] = useState(false)
  const narrow = useNarrow()

  const openPage = useCallback((next: PageKey) => {
    setPage(next)
    setVisited((v) => (v.includes(next) ? v : [...v, next]))
  }, [])

  const onNav = useCallback<NonNullable<MenuProps['onClick']>>(({ key }) => {
    openPage(key as PageKey)
  }, [openPage])

  const bumpServers = useCallback(() => setServersVersion((v) => v + 1), [])
  const goConfigWithServers = useCallback(() => {
    setConfigFocusServers((v) => v + 1)
    openPage('config')
  }, [openPage])
  const onStopped = useCallback(() => setStopped(true), [])

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
      <ToolbarActions onStopped={onStopped} />
    </div>
  )

  const shell = stopped ? (
    <StoppedNotice />
  ) : (
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
              顶部工具栏（重启 / 关闭界面 / 快捷方式）和别的页还得留着，否则白屏后没法自救。
              外层那个 ErrorBoundary 是兜底，正常情况轮不到它。 */}
          <div className="app-pane" hidden={page !== 'servers'}>
            <ErrorBoundary>
              <ServersPage onGoConfig={() => openPage('config')} version={serversVersion} />
            </ErrorBoundary>
          </div>
          <div className="app-pane" hidden={page !== 'backup'}>
            {visited.includes('backup') && <ErrorBoundary><BackupPage /></ErrorBoundary>}
          </div>
          <div className="app-pane" hidden={page !== 'monitor'}>
            {visited.includes('monitor') && (
              <ErrorBoundary>
                <MonitorPage
                  onGoConfig={goConfigWithServers}
                  version={serversVersion}
                  active={page === 'monitor'}
                />
              </ErrorBoundary>
            )}
          </div>
          <div className="app-pane" hidden={page !== 'components'}>
            {visited.includes('components') && <ErrorBoundary><ComponentsPage /></ErrorBoundary>}
          </div>
          <div className="app-pane" hidden={page !== 'config'}>
            {visited.includes('config') && (
              <ErrorBoundary>
                <ConfigPage onServersChanged={bumpServers} focusServersToken={configFocusServers} />
              </ErrorBoundary>
            )}
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  )

  return (
    <ConfigProvider locale={zhCN}>
      {/* AntApp 提供 message/modal 的上下文，避免 antd 的静态方法在 React 19 下拿不到主题 */}
      <AntApp>
        <ErrorBoundary>{shell}</ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  )
}
