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
Restart=always
User=myuser          # 以哪个用户运行，可选

[Install]
WantedBy=multi-user.target
```

## 删除服务

```bash
sudo rm /etc/systemd/system/<服务名>.service
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

使用 grep 过滤特定服务

```bash
systemctl | grep nginx
```

查看具体服务状态

```bash
systemctl status <service_name>
```

## 启动服务

```bash
systemctl start <service_name>
```

## 停止服务

```bash
systemctl stop <service_name>
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

设置后需要重新加载 systemd 管理器配置才会生效

```bash
systemctl daemon-reload
```

## 日志

使用 journalctl 命令查看 systemd 日志。

比如，查看 Filebeat 服务的最新50条日志，`--no-pager`表示不分页

```bash
journalctl -u filebeat --no-pager -n 50
```

实时更新最新日志

```bash
journalctl -u filebeat -f
```

查看某时间段的日志

```bash
journalctl -u filebeat --since "2025-04-07 21:00:00" --until "2025-04-07 22:00:00"
```

只显示错误日志

```bash
journalctl -u filebeat -p err
```

## 可视化与监控工具

| 工具                                         | 特点                                   |
| ------------------------------------------ | ------------------------------------ |
| [**cockpit**](https://cockpit-project.org) | 官方的 Web 界面，支持 systemd 服务管理、日志查看、资源监控 |
| **glances**                                | 命令行系统监控，显示服务进程资源情况                   |
| **prometheus + node_exporter + grafana**   | 专业级监控方案，适合服务器集群监控                    |
| **systemd-analyze**                        | 分析启动性能、依赖关系等                         |
