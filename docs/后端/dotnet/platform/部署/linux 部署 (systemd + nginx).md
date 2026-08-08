---
title: linux 部署 (systemd + nginx)
icon: mdi:server
---

整体流程：安装 SDK 开发 → `dotnet publish` 发布 FDD → 目标机装 runtime → systemd 托管 → nginx 反向代理。

## 安装

```sh
# 服务端环境只需安装 runtime
sudo apt install -y aspnetcore-runtime-8.0

# 开发环境安装 sdk，sdk 已包含 runtime
sudo apt install -y dotnet-sdk-8.0
```

检测是否安装（版本、安装位置、已安装的 SDK 与 runtime 列表）：

```sh
dotnet --info
```

[Ubuntu 安装参考](https://learn.microsoft.com/zh-cn/dotnet/core/install/linux-ubuntu)

## 创建与发布

```sh
# 创建 web 项目
dotnet new webapp -o aspnetcoreapp

# 发布 FDD（框架依赖部署，体积小，目标机需装 runtime）
dotnet publish -c Release -p:UseAppHost=false
```

三种发布模式：FDD（框架依赖）、SCD（自包含，含 runtime，体积大）、单文件。一般 FDD 即可。

[使用 .NET CLI 发布 .NET 应用](https://learn.microsoft.com/zh-cn/dotnet/core/deploying/deploy-with-cli)

## systemd 托管

创建服务定义文件：

```sh
sudo nano /etc/systemd/system/kestrel-helloapp.service
```

```ini
[Unit]
Description=Example .NET Web API App running on Ubuntu

[Service]
WorkingDirectory=/var/www/helloapp
ExecStart=/usr/bin/dotnet /var/www/helloapp/helloapp.dll
Restart=always
# 崩溃后 10 秒重启
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=dotnet-example
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false

[Install]
WantedBy=multi-user.target

TimeoutStopSec=90
```

```sh
sudo systemctl enable kestrel-helloapp.service   # 开机自启
sudo systemctl start kestrel-helloapp.service    # 运行
sudo systemctl status kestrel-helloapp.service   # 状态

# 查看日志
sudo journalctl -fu kestrel-helloapp.service
# 日志按时间过滤
sudo journalctl -fu kestrel-helloapp.service --since "2016-10-18" --until "2016-10-18 04:00"
```

## nginx 反向代理

确认配置文件位置，找关键字 `--conf-path`：

```sh
nginx -V
```

编辑 `nginx.conf`，将 `server {}` 替换如下：

```nginx
server {
    listen        80;
    server_name   example.com *.example.com;
    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

[官方部署文档](https://learn.microsoft.com/zh-cn/aspnet/core/host-and-deploy/linux-nginx)
