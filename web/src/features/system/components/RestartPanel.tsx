// 「重启自己」按钮 —— 放在全局顶部工具栏，任何页面都能点。
//
// 判据只有一个：**/api/health 里的 boot_id 变了**才算重启成功。
//
// ⚠️ 为什么不能按「服务还在」判：交接失败时旧进程会**原地活着**
// （刻意的 —— 用一次看不见的失败换掉整个服务更糟），
// 那时「服务还在」与「重启成功」在界面上完全一样。
//
// ⚠️ 为什么不能按「请求成功」判：服务端是「先回 200、再退出本进程」，
//    响应很可能在连接被切断的那一刻丢掉。传输层异常一律当成「预期内」，
//    转去等 boot_id。

import { useCallback, useEffect, useRef, useState } from 'react'
import { PoweroffOutlined } from '@ant-design/icons'
import { Alert, App as AntApp, Button, Checkbox, Space, Tooltip, Typography } from 'antd'

import { ApiError } from '../../../shared/api/http.ts'
import { systemApi } from '../api.ts'
import { defaultRebuild, judgeHandover, shouldRefreshView, timeoutMessage } from '../restartFlow.ts'
import type { RestartInfo } from '../types.ts'

const { Text } = Typography

/** 等新进程起来的上界。超过就如实报「没重启成功」，并指出去哪看日志。 */
const WAIT_MS = 120_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function RestartPanel() {
  // ⚠️ 必须走 App 上下文：静态的 Modal.confirm / message 在 antd v6 + React 19 下
  // 会渲染到独立的 React root，拿不到主题，真机上表现为「点了按钮，什么都没发生」。
  const { message, modal } = AntApp.useApp()
  const [info, setInfo] = useState<RestartInfo | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [rebuild, setRebuild] = useState(false)
  const [busy, setBusy] = useState(false)
  const rebuildAutoSet = useRef(false)

  const load = useCallback(async () => {
    try {
      setInfo(await systemApi.restartView())
      setNote(null)
    } catch (e) {
      // ⚠️ 读不到就说读不到：不能退化成「不支持」——
      // 那会把「令牌不对 / 后端没起来」说成「这个版本没有这个功能」。
      setNote(e instanceof ApiError ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 只在第一次拿到事实时设一次；之后用户手动改过，就不该再被覆盖。
  useEffect(() => {
    if (rebuildAutoSet.current || !info) return
    rebuildAutoSet.current = true
    setRebuild(defaultRebuild(info))
  }, [info])

  const run = async () => {
    if (!info) return
    setBusy(true)

    // 先记下「现在这个进程」是谁。读不到就如实退化成「没法确认」，不猜。
    let before = ''
    try {
      before = (await systemApi.health()).boot_id
    } catch {
      before = ''
    }

    let buildOutput = ''
    try {
      const res = await systemApi.restart(rebuild, info.confirm_token)
      buildOutput = res.build_output ?? ''
    } catch (e) {
      // 只有 ApiError（服务端明确回了 JSON 错误）才说明它**没有**交接：
      // 409 确认过期 / 409 任务在跑 / 500 重建失败 —— 那些都还没动手。
      // 传输层失败反而是重启时的预期形态，转去等 boot_id。
      if (e instanceof ApiError) {
        setBusy(false)
        void message.error(e.message, 8)
        if (shouldRefreshView(e.status)) void load()
        return
      }
    }

    if (before === '') {
      setBusy(false)
      void message.warning('拿不到重启前的 boot_id，没法确认重启到底成没成 —— 请手动刷新页面看服务是不是连得上。')
      return
    }

    void message.info('已受理，正在等新进程接管；页面会断连几秒，属正常。')
    const deadline = Date.now() + WAIT_MS
    while (Date.now() < deadline) {
      await sleep(1000)
      try {
        const after = (await systemApi.health()).boot_id
        if (judgeHandover(before, after) === 'restarted') {
          // 真的换了进程实例 —— 刷新页面，让所有页面显示新的事实。
          window.location.reload()
          return
        }
      } catch {
        // 重启期间连接会断几秒，继续等。
      }
    }
    setBusy(false)
    void message.error(timeoutMessage(info, WAIT_MS / 1000), 10)
    if (buildOutput) console.info('构建输出：\n' + buildOutput)
  }

  const ask = () => {
    if (!info) return
    modal.confirm({
      title: rebuild ? '重建并重启 ops ui？' : '重启 ops ui？',
      width: 660,
      okText: '执行',
      okButtonProps: { danger: true },
      cancelText: '取消',
      content: (
        <Space direction="vertical" size={8} style={{ display: 'flex' }}>
          <Text style={{ fontSize: 12 }}>
            重启后会用<b>当前端口 127.0.0.1:{info.port} 与原访问令牌</b>重新起来，
            页面自动回来，不用重新复制地址。
          </Text>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {info.impact.map((line, i) => (
              <li key={i}>
                <Text style={{ fontSize: 12 }}>{line}</Text>
              </li>
            ))}
          </ul>
          <Space direction="vertical" size={4} style={{ display: 'flex' }}>
            <Checkbox checked={rebuild} onChange={(e) => setRebuild(e.target.checked)}>
              先重建（Go 几秒；前端代码改了要 30~40 秒）
            </Checkbox>
            {info.binary_stale ? (
              <Alert
                type="warning"
                showIcon
                message="二进制比源码旧 —— 已自动勾上「先重建」"
                description={
                  <Text style={{ fontSize: 12 }}>
                    改了：<Text code>{info.stale_reason}</Text>。
                    不重建的话，重启后跑的还是旧代码 —— 而界面上完全看不出来。
                  </Text>
                }
              />
            ) : null}
            {info.task_running ? (
              <Alert
                type="error"
                showIcon
                message="现在有备份任务在跑，服务端会拒绝重启"
                description={<Text style={{ fontSize: 12 }}>等它结束再点；它正在写远端，拦腰截断会留下半状态。</Text>}
              />
            ) : null}
            {info.build_command.length > 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                会跑：{info.build_command.join('  →  ')}
              </Text>
            ) : null}
            {info.log_path ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                新进程的输出写到 <Text code>{info.log_path}</Text>。
              </Text>
            ) : null}
          </Space>
        </Space>
      ),
      onOk: () => {
        void run()
      },
    })
  }

  // 读不到事实 / 服务端说现在不能重启：不给一个「点了没反应」的按钮，改为一句说明。
  const blocked = note ?? info?.note
  if (blocked) {
    return (
      <Tooltip title={blocked}>
        <Button size="small" icon={<PoweroffOutlined />} disabled>
          重启
        </Button>
      </Tooltip>
    )
  }

  return (
    <Tooltip title="开发时改完代码：重建 + 重启这一个服务（需要显式二次确认）">
      <Button
        size="small"
        icon={<PoweroffOutlined />}
        loading={busy}
        disabled={!info || busy}
        onClick={ask}
      >
        重启
      </Button>
    </Tooltip>
  )
}
