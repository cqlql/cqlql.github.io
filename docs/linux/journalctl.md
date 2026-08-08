---
title: journalctl
sort: 10
---

# journalctl

systemd 的日志查看命令。不指定 `-u` 时查看全部日志，加 `-u <服务名>` 只看某服务。

## 常用选项简写对照表

| 功能              | 长选项                  | 短选项 | 备注 / 坑点               |
| ----------------- | ----------------------- | ------ | ------------------------- |
| 指定 systemd 单元 | `--unit=`               | `-u`   | ✅ 最常用                  |
| 显示最近 N 行     | `--lines=`              | `-n`   | 后面必须跟数字            |
| 跳到日志末尾      | `--pager-end`           | `-e`   | 打开后直接到底            |
| 追加错误解释      | `--catalog`             | `-x`   | 排错神器                  |
| 实时追踪          | `--follow`              | `-f`   | 类似 `tail -f`            |
| 按优先级过滤      | `--priority=`           | `-p`   | ⚠️ 常被误当成 `--no-pager` |
| 不进入分页器      | `--no-pager`            | ❌ 无   | **唯一重点**              |
| 反向显示（新→旧） | `--reverse`             | `-r`   |                           |
| 指定输出格式      | `--output=`             | `-o`   | json / short / cat 等     |
| 按时间过滤        | `--since=` / `--until=` | ❌ 无   |                           |
| 显示内核日志      | `--dmesg`               | `-k`   |                           |
| 显示当前启动日志  | `--boot`                | `-b`   |                           |

## 基础查看

```bash
journalctl                       # 全部日志（按时间翻页）
journalctl -b                    # 本次启动以来的日志
journalctl -k                    # 内核日志
journalctl --no-pager -n 50 -u filebeat   # 某服务最新 50 条，不分页
journalctl -u filebeat -f        # 实时跟踪
```

## 按时间 / 优先级过滤

```bash
journalctl -u filebeat --since "2025-04-07 21:00:00" --until "2025-04-07 22:00:00"
journalctl -u filebeat -p err    # 仅错误（及更严重）级别
```

优先级由高到低：`emerg` > `crit` > `err` > `warning` > `notice` > `info` > `debug`，`-p err` 会包含其以上所有级别。

## 日志占用与清理

```bash
journalctl --disk-usage
journalctl --vacuum-size=500M
journalctl --vacuum-time=2weeks
```

> 默认日志可能只存内存（重启丢失）。需持久化请改 `/etc/systemd/journald.conf` 的 `Storage=persistent`，再 `sudo systemctl restart systemd-journald`。
