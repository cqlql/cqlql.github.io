import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { adoptTokenFromUrl } from './shared/api/http.ts'
import './index.css'

// 先接令牌，再挂载：首次请求就在挂载那一刻发出 ——
// 顺序反了的话，第一次请求会因为「还没有令牌」而 401，
// 界面上会先闪一下「令牌无效」，然后才正常。
adoptTokenFromUrl()

const el = document.getElementById('root')
if (!el) throw new Error('#root 不存在：index.html 被改坏了')

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
