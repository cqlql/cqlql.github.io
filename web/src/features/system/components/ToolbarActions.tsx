// 全局顶部工具栏：三个「对这个工具本身」的动作 —— 建快捷方式、重启、关闭界面。
//
// 🔴 判据见 docs/ui.md §7：它们与「现在看哪一页」无关，且都是纯本机动作
// （不碰远端、不依赖服务器清单是否配好）。挂在某一页的 page-head 会让人切到
// 别的页就找不到「关闭界面」—— 后台模式的窗口是隐藏的，那是唯一的停止入口。
// 反过来「检查全部」只作用于服务器清单，是页面动作，留在服务器管理页的页头。
//
// 反馈走 App 上下文里的 message：工具栏不属于任何一页，没有 Alert 容器；
// 静态 message 在 antd v6 + React 19 下拿不到主题（见 RestartPanel 里的坑）。

import { useState } from 'react'
import { CloseCircleOutlined, DesktopOutlined } from '@ant-design/icons'
import { Alert, App as AntApp, Button, Popconfirm, Tooltip } from 'antd'

import { systemApi } from '../api.ts'
import { RestartPanel } from './RestartPanel.tsx'

interface ToolbarActionsProps {
  /** 关掉之后由外壳换成一张静态说明页：服务已经没了，别再留一屏能点的按钮。 */
  onStopped: () => void
}

/** 把任意异常变成一句人话；ApiError 的 message 已经是后端给的中文。 */
function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function ToolbarActions({ onStopped }: ToolbarActionsProps) {
  const { message } = AntApp.useApp()
  const [shortcutting, setShortcutting] = useState(false)
  const [stopping, setStopping] = useState(false)

  // 建快捷方式只碰本机桌面，与配置齐不齐无关；失败原因原样显示
  // （非 Windows 时后端会回「只对 Windows 有意义」）。
  const onCreateShortcut = async () => {
    setShortcutting(true)
    try {
      const r = await systemApi.shortcut()
      void message.success(`已创建桌面快捷方式：${r.path}`)
    } catch (e) {
      void message.error(errText(e), 8)
    } finally {
      setShortcutting(false)
    }
  }

  // 服务端「先回 200、300ms 后退出」，所以正常路径拿得到响应；
  // 传输层真失败也不能当成已关闭——如实报错，按钮留在原地。
  const onShutdown = async () => {
    setStopping(true)
    try {
      await systemApi.shutdown()
      onStopped()
    } catch (e) {
      void message.error(errText(e), 8)
      setStopping(false)
    }
  }

  return (
    <>
      <Tooltip title="在桌面建一个指向启动器的快捷方式（只碰本机，不依赖配置是否齐全）">
        <Button
          size="small"
          icon={<DesktopOutlined />}
          loading={shortcutting}
          onClick={() => void onCreateShortcut()}
        >
          <span className="toolbar-label">创建桌面快捷方式</span>
        </Button>
      </Tooltip>
      <RestartPanel />
      <Popconfirm
        title="关闭本机网页面板？"
        description="只停掉这个本地界面，不改远端。重新双击 启动运维.cmd 可再打开。"
        okText="关闭"
        cancelText="取消"
        onConfirm={() => void onShutdown()}
      >
        <Button size="small" icon={<CloseCircleOutlined />} loading={stopping}>
          <span className="toolbar-label">关闭界面</span>
        </Button>
      </Popconfirm>
    </>
  )
}

/**
 * 关掉之后整页只剩一句「怎么再打开」。
 * 原来这段提示挂在服务器管理页里，从别的页关界面时其它页还留在屏幕上，
 * 看着像服务还活着；现在由外壳统一换掉整个内容区。
 */
export function StoppedNotice() {
  return (
    <div className="page">
      <Alert
        type="success"
        showIcon
        message="网页面板已关闭"
        description="本机界面进程已退出，可以关掉这个标签页。重新双击 启动运维.cmd 可再打开；这次操作没有改动任何远端服务器。"
      />
    </div>
  )
}
