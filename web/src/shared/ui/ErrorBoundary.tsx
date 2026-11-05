import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Alert, Button } from 'antd'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 兜住渲染期异常 —— **跨能力**的通用兜底，所以放 `shared/ui/`。
 *
 * 没有它的话，任何一处抛错都会让 React 卸载整棵树 —— 症状是**整页白屏**，
 * 而界面上没有任何线索（控制台在别人的机器上，用户不会打开）。
 * 这里至少把错误原文摊在页面上，并给一个「重新加载」。
 *
 * ⚠️ 事件处理器里的异常**不会**走到这里（React 不接管它们）：
 * 那些必须由调用方 catch 后变成 Alert，见 `features/servers/service.ts`。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 本工具没有远程日志，控制台是唯一能留下堆栈的地方。
    console.error('[ops ui] 渲染失败', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="page">
        <Alert
          type="error"
          showIcon
          message="界面渲染失败"
          description={
            <div>
              <p style={{ margin: '0 0 8px' }}>{this.state.error.message}</p>
              <p style={{ margin: 0, color: 'var(--ops-muted)' }}>
                这是前端的问题，后端数据没有受影响。按 F12 看控制台能拿到完整堆栈。
              </p>
            </div>
          }
        />
        <Button style={{ marginTop: 12 }} onClick={() => location.reload()}>
          重新加载
        </Button>
      </div>
    )
  }
}
