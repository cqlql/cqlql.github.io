---
title: systemctl
sort: 9
---

# systemctl

## 新建服务

```bash
sudo nano /etc/systemd/system/myservice.service
```

建议使用 `/etc/systemd/system/`，系统自带服务在 `/lib/systemd/system/`，不要直接改系统文件。

myservice.service 内容

```bash
[Unit]
Description=我的自定义服务

[Service]
WorkingDirectory=/home/cql/movie-platform # 先进入此目录，再执行 server
ExecStart=/home/cql/movie-platform/server # 服务启动命令
Restart=always          # always=总是重启；on-failure=仅在非 0 退出时重启
User=myuser             # 以哪个用户运行，可选

[Install]
WantedBy=multi-user.target
```

## 删除服务

建议先停止并取消开机启动，再删除文件并重新加载配置，避免残留：

```bash
sudo systemctl stop myservice
sudo systemctl disable myservice
sudo rm /etc/systemd/system/myservice.service
sudo systemctl daemon-reload
```

## 查看服务

查看正在运行的服务

```bash
systemctl list-units --type=service --state=running
```

查看所有服务（包括未运行的）

```bash
systemctl list-unit-files --type=service
```

> `list-unit-files` 状态含义：`enabled`（开机启动）、`disabled`（不开机）、`static`（只能被依赖拉起，不能独立 enable）、`masked`（被彻底屏蔽）。

使用 grep 过滤特定服务

```bash
systemctl | grep nginx
```

查看具体服务状态，`-n 50` 显示最近 50 行日志、`-l` 不截断、`--no-pager` 不分页

```bash
systemctl status <service_name> -n 50 -l --no-pager
```

查看启动失败的服务（排错第一反应）

```bash
systemctl --failed
```

## 启停与重启

启动、停止

```bash
systemctl start <service_name>
systemctl stop <service_name>
```

重启

```bash
systemctl restart <service_name>     # 先停后启，会短暂中断
```

平滑重载配置（不重启进程，仅让服务重新读取配置，支持的服务才有效）

```bash
systemctl reload <service_name>
systemctl reload-or-restart <service_name>   # 不支持 reload 时自动改为 restart
```

## 开机启动

查看是否开机启动

```bash
systemctl is-enabled nginx
```

设置开机启动

```bash
systemctl enable nginx
```

设置开机启动并立即启动，相当于同时执行了 `systemctl start`

```bash
systemctl enable --now nginx
```

禁止开机启动

```bash
systemctl disable nginx
```

彻底屏蔽（比 disable 更彻底，防止被其他服务依赖拉起；如需恢复用 `unmask`）

```bash
systemctl mask nginx
systemctl unmask nginx
```

修改 unit 文件后需要重新加载 systemd 管理器配置才会生效

```bash
systemctl daemon-reload
```

## 安全编辑服务

不要直接手改 `/etc/systemd/system/` 下的文件，用 `edit` 生成 drop-in 覆盖片段，改完自动 `daemon-reload`：

```bash
systemctl edit <service_name>        # 编辑 /etc/systemd/system/<name>.service.d/override.conf
sudo systemctl daemon-reload && sudo systemctl restart <service_name>
```

## 日志

日志查看独立成篇，详见 [journalctl](./journalctl.md)。

## 可视化与监控工具

| 工具                                       | 特点                                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| [**cockpit**](https://cockpit-project.org) | 官方的 Web 界面，支持 systemd 服务管理、日志查看、资源监控 |
| **glances**                                | 命令行系统监控，显示服务进程资源情况                       |
| **prometheus + node_exporter + grafana**   | 专业级监控方案，适合服务器集群监控                         |
| **systemd-analyze**                        | 分析启动性能、依赖关系等                                   |
