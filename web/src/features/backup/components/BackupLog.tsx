import { useEffect, useRef } from 'react'

/** 只渲染日志；追加与滚动都在这一层，页面不碰 DOM。 */
export function BackupLog({ text }: { text: string }) {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])

  return (
    <pre className="backup-log" ref={ref} aria-live="polite">
      {text || '还没有输出。先点「备份部署预检」，安装前会再自动预检一次。'}
    </pre>
  )
}
