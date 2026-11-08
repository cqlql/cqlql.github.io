import { useEffect, useRef } from 'react'

/** 只渲染日志；追加与滚动都在这一层，页面不碰 DOM。 */
export function BackupLog({ text, emptyText, compact = false }: { text: string; emptyText?: string; compact?: boolean }) {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])

  // 🔴 没有输出时**不要**渲染一个固定高度的 <pre>：那会在卡片里留下一大片
  //    看似坏掉的空白（2026-11-08 界面反馈）。改成一行浅色提示，等真的有日志
  //    再显示带边框、随内容伸缩的日志框。
  if (!text.trim()) {
    return (
      <div className="backup-log-empty" aria-live="polite">
        {emptyText || '还没有输出。先点「备份部署预检」，安装前会再自动预检一次。'}
      </div>
    )
  }

  return (
    <pre className={compact ? 'backup-log compact' : 'backup-log'} ref={ref} aria-live="polite">
      {text}
    </pre>
  )
}
