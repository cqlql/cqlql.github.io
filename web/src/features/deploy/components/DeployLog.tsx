import { useEffect, useRef } from 'react'

/** 只渲染实时日志；追加与自动滚动都在这一层，页面不碰 DOM。 */
export function DeployLog({ text }: { text: string }) {
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])

  if (!text.trim()) {
    return (
      <div className="backup-log-empty" aria-live="polite">
        还没有输出。发布任务的日志会按增量实时追加到这里；刷新页面也能接回一个已在跑的任务。
      </div>
    )
  }
  return (
    <pre className="backup-log" ref={ref} aria-live="polite">
      {text}
    </pre>
  )
}
