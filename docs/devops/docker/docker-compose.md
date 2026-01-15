## restart

用于定义容器退出后的自动重启策略

- `no`：不重启
- `always`：永远重启
- `unless-stopped`：除非手动 stop，否则重启（推荐用于数据库）
- `on-failure`：仅失败时重启，适合任务型容器
  - `on-failure:N` 最多重试 N 次