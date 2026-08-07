---
title: 备份脚本与 Crontab 自动化（Makefile 封装）
icon: shell
sort: 7
---

# 备份脚本与 Crontab 自动化

将 Crontab 的配置封装到 `Makefile` 中，不仅能让团队成员用统一的指令（如 `make backup-cron-install`）快速完成部署，还可以避免手动编辑 `crontab -e` 时出现的拼写错误。

在 `Makefile` 中编写 Crontab 任务时，核心原则是**使用幂等性逻辑（避免重复添加）**。

---

## 推荐的 Makefile 配置

在项目根目录下的 `Makefile` 中添加以下 Target：

```makefile
# 定义变量
SCRIPT_PATH := $(shell pwd)/deploy/scripts/pg_backup.sh
LOG_PATH := /var/log/pg_backup.log
# Crontab 表达式：每天凌晨 2:00 执行
CRON_SCHEDULE := 0 2 * * *
CRON_JOB := $(CRON_SCHEDULE) /bin/bash $(SCRIPT_PATH) >> $(LOG_PATH) 2>&1

.PHONY: backup-cron-install backup-cron-status backup-cron-uninstall

## 安装或更新 Crontab 定时任务
backup-cron-install:
	@chmod +x $(SCRIPT_PATH)
	@mkdir -p /var/log
	@# 读取现有 crontab，过滤掉旧的该脚本任务，追加新任务后重新写入（实现幂等更新）
	@(crontab -l 2>/dev/null | grep -v "$(SCRIPT_PATH)"; echo "$(CRON_JOB)") | crontab -
	@echo "✅ Crontab 备份任务已成功配置/更新！"
	@echo "当前任务列表："
	@crontab -l | grep "$(SCRIPT_PATH)"

## 查看当前的备份 Crontab 状态
backup-cron-status:
	@echo "🔍 检查备份定时任务状态："
	@crontab -l 2>/dev/null | grep "$(SCRIPT_PATH)" || echo "⚠️ 未找到相关备份任务！"

## 卸载 Crontab 定时任务
backup-cron-uninstall:
	@(crontab -l 2>/dev/null | grep -v "$(SCRIPT_PATH)") | crontab -
	@echo "🗑️  Crontab 备份任务已移除！"
```

---

## 常用 Make 指令说明

定义好 Makefile 后，运维或部署时只需运行以下命令：

| 命令 | 作用描述 |
| --- | --- |
| **`make backup-cron-install`** | 自动赋予脚本执行权限，并在宿主机 Crontab 中写入定时任务（自动去重）。 |
| **`make backup-cron-status`** | 查看当前系统是否已成功挂载该备份任务。 |
| **`make backup-cron-uninstall`** | 从系统 Crontab 中精准移除该备份任务，不影响其他 Cron。 |

---

## 避坑指南

1. **语法细节（缩进必须为 Tab）**：Makefile 中的命令行开头必须使用 **Tab 键**缩进，不能使用空格，否则运行 `make` 时会报 `missing separator` 错误。

2. **环境变量路径（`$(shell pwd)`）**：在 `make backup-cron-install` 时，`$(shell pwd)` 会自动将脚本路径解析为**绝对路径**（例如 `/home/ubuntu/your-project/deploy/scripts/pg_backup.sh`），保证了 Crontab 运行时不会因为找不到相对路径而失败。

> 相关阅读：
> - [单机 Docker PostgreSQL 备份与恢复](./单机Docker备份与恢复.md) — 备份脚本 `pg_backup.sh` 的完整内容
> - [项目目录结构规范](../架构设计/项目目录结构规范.md) — `deploy/` 目录与 Makefile 在项目中的位置
