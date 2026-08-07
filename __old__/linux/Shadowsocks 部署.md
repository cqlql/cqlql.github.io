- [ubuntu 安装](#ubuntu-%e5%ae%89%e8%a3%85)
- [config.json](#configjson)
- [常用命令](#%e5%b8%b8%e7%94%a8%e5%91%bd%e4%bb%a4)
- [开机启动](#%e5%bc%80%e6%9c%ba%e5%90%af%e5%8a%a8)


http://blog.csdn.net/qq_34049853/article/details/76039550

## ubuntu 安装

**方式1**，使用 [teddysun](https://github.com/teddysun/shadowsocks_install/tree/master) 的一键安装脚本

这种方式还能安装 ssr

安装好后会默认执行 `ssserver -c /etc/shadowsocks-python/config.json -d start` 后台运行

```sh
# 下载脚本(到当前目录)
wget --no-check-certificate -O shadowsocks-all.sh https://raw.githubusercontent.com/teddysun/shadowsocks_install/master/shadowsocks-all.sh

# 加上执行权限
chmod +x shadowsocks-all.sh

# 执行
./shadowsocks-all.sh 2>&1 | tee shadowsocks-all.log

# 推荐选择443端口
```


**方式2**

```sh
# 先安装 pip(这种方式现在可能已经无法安装pip了)
apt install python-gevent python-pip python-m2crypto

# 安装 shadowsocks
pip install shadowsocks

```
## config.json

/etc/shadowsocks/config.json

```
{
  "server": "0.0.0.0", // 不在本机部署才需设置？
  "server_port":3389,
  "password":"xx",
  "timeout":300,
  "method":"xchacha20-ietf-poly1305",
  "fast_open":false,
  "workers":1
}

// 多端口密码

{
  "server": "0.0.0.0", // 不在本机部署才需设置？
  "server_port":3389,
  "port_password": {
    "400": "xx",
    "401": "xx",
    "402": "xx",
    "403": "xx",
    "404": "xx",
    "405": "xx"
  }
  "timeout":300,
  "method":"xchacha20-ietf-poly1305",
  "fast_open":false,
  "workers":1
}
```

## 常用命令

```sh
# 直接参数运行
ssserver -p 3389 -k NmVhMTMyNT -m aes-256-cfb start 

# 指定配置运行
ssserver -c /etc/shadowsocks/config.json start

# 加 -d 后台运行
ssserver -c /etc/shadowsocks/config.json -d start

# 重启
ssserver -c /etc/shadowsocks/config.json -d restart

# 终止
ssserver -d stop
```

## 开机启动

[涉及开机启动的文章](http://morning.work/page/2015-12/install-shadowsocks-on-centos-7.html)



[systemctl 命令](http://man.linuxde.net/systemctl)

**创建后台服务文件**

/etc/systemd/system/shadowsocks.service

```
[Unit]
Description=Shadowsocks

[Service]
TimeoutStartSec=0
ExecStart=/usr/local/bin/ssserver -c /etc/shadowsocks/config.json

[Install]
WantedBy=multi-user.target
```
**开机服务启动命令**

[systemctl 命令](http://man.linuxde.net/systemctl)

启动

``` bash
# 激活开机启动
systemctl enable shadowsocks
# 启动服务
systemctl start shadowsocks
# 重启服务
systemctl restart shadowsocks
# 停止服务
systemctl stop shadowsocks
```

查看状态

```bash
# 能看到部分日志
systemctl status shadowsocks -l
```

查看所有日志  
通过 journalctl + 进程id 查询 方式查询  
贴上一篇文章：[如何使用Journalctl查看并操作Systemd日志](https://blog.csdn.net/zstack_org/article/details/56274966)

```bash
# 搜索 ssserver 进程id
ps -aux | grep ssserver

# 查看 id 为 21779，今天的日志
journalctl _PID=21779 --since today
# 昨天
journalctl _PID=21779 --since yesterday
# 最近50条
journalctl _PID=21779 -n 50
```
