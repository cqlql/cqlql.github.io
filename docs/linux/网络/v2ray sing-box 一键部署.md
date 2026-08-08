---
title: v2ray sing-box 一键部署
icon: mdi:server-network
---

## sing-box 一键脚本（推荐）

实测可用，使用简单。[介绍文档](https://233boy.com/sing-box/sing-box-script)

```sh
bash <(wget -qO- -o- https://github.com/233boy/sing-box/raw/main/install.sh)
```

推荐使用 VMess-TCP 配置，客户端配置见 [clash 订阅与负载均衡](./clash%20订阅与负载均衡.md)。

## v2ray-agent 一键脚本

```sh
wget -P /home -N --no-check-certificate "https://raw.githubusercontent.com/mack-a/v2ray-agent/master/install.sh" && chmod 700 /home/install.sh && /root/install.sh
```

- 安装 / 账号管理：`/home/install.sh`
- 重启：`systemctl restart v2ray`
- [官方仓库](https://github.com/mack-a/v2ray-agent)

## 各协议对比

| 组合 | 说明 |
| --- | --- |
| VMESS | 最普通的 V2Ray 服务器，无伪装 |
| VMESS+KCP | 传输协议使用 mKCP，VPS 线路不好时可能有奇效 |
| VMESS+TCP+TLS | 带伪装，不能过 CDN 中转 |
| VMESS+WS+TLS | 最通用的伪装方式，能过 CDN 中转，推荐 |
| VLESS+KCP | 传输协议使用 mKCP |
| VLESS+TCP+TLS | 通用 VLESS 版本，不能过 CDN，性能优于 VMESS+TCP+TLS |
| VLESS+WS+TLS | 基于 websocket 的伪装，能过 CDN，有 CDN 时推荐 |
| VLESS+TCP+XTLS | 性能最强的组合，但支持的客户端较少 |
| trojan | 轻量级伪装协议 |
| trojan+XTLS | trojan 加强版，用 XTLS 提升性能 |

注意：部分客户端不支持 VLESS 或 XTLS，按自身情况选择。

## 相关运维操作

### 切换 root 用户 / 修改 root 密码

不知道 root 密码时可用此方式修改：

```sh
sudo -i
passwd
```

### 关闭系统防火墙（Ubuntu）

开放所有端口：

```sh
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT
iptables -F
```

删除防火墙：

```sh
apt-get purge netfilter-persistent && reboot
# 或
rm -rf /etc/iptables && reboot
```

### 测试公网端口

<https://tcp.ping.pe/>

## 相关文档

- [一键脚本、VPS 教程](https://hijk.art/)
- [V2ray 多合一脚本](https://tizi.blog/27.html)
- [Oracle Cloud VPS 开放所有端口并关闭防火墙](https://blog.csdn.net/austin1000/article/details/125840927)
