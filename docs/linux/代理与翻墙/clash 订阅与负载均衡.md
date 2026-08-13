---
title: clash 订阅与负载均衡
icon: mdi:shield-lock-outline
sort: 3
---

## subconverter 介绍

订阅转换工具，可合并订阅、转换订阅格式、创建策略组等。[下载地址](https://github.com/tindy2013/subconverter/releases)

## 合并订阅链接

运行一次 `subconverter.exe` 后关闭，会生成 `pref.toml`。编辑该文件，找到 `default_url` 字段设置多个订阅链接：

```toml
default_url = ["https://1.txt","https://2.txt"]
```

再次运行 `subconverter.exe`，在 Clash 中填入合并后的订阅链接：

```
http://localhost:25500/clash
```

其中 `clash` 指定最终转换的订阅链接类型。

生成配置后即可关闭；若需自动更新订阅，可一直开着。

## 直接指定订阅链接

指定单个订阅链接（常用于借 subconverter 生成负载均衡策略组）：

```
http://127.0.0.1:25500/clash?url=https://example.com/link/xxxx?clash=1
```

## 负载均衡 —— subconverter 配置

`pref.toml` 中添加自定义策略组：

```toml
[[custom_groups]]
name = "🔰 节点选择"
type = "select"
rule = ["[]🔄 负载均衡--轮询","[]🔀 负载均衡--散列","[]♻️ 自动选择", "[]🎯 全球直连", ".*"]

[[custom_groups]]
name = "🔄 负载均衡--轮询"
type = "load-balance"
rule = ["[]♻️ 自动选择","[]🎯 全球直连",".*"]
interval = 300
timeout = 1
strategy = "round-robin"
url = "http://www.gstatic.com/generate_204"

[[custom_groups]]
name = "🔀 负载均衡--散列"
type = "load-balance"
rule = ["[]♻️ 自动选择","[]🎯 全球直连",".*"]
interval = 300
timeout = 1
strategy = "consistent-hashing"
url = "http://www.gstatic.com/generate_204"
```

## 负载均衡 —— Clash parsers 预处理

不改订阅源，通过 Clash 的 `parsers`（预处理）实现。需在订阅链接后加 `#slbable`：

```yaml
parsers:
  - reg: 'slbable$'
    yaml:
      append-proxy-groups:
        - name: 负载均衡-散列
          type: load-balance
          url: 'http://www.google.com/generate_204'
          interval: 300
          strategy: consistent-hashing
        - name: 负载均衡-轮询
          type: load-balance
          url: 'http://www.google.com/generate_204'
          interval: 300
          strategy: round-robin
      commands:
        - proxy-groups.负载均衡-散列.proxies=[]proxyNames
        - proxy-groups.0.proxies.0+负载均衡-散列
        - proxy-groups.负载均衡-轮询.proxies=[]proxyNames
        - proxy-groups.0.proxies.0+负载均衡-轮询
```

## 扩展脚本

```js
function main(config) {
  // 将服务器添加到代理组中
  config["proxy-groups"][0].proxies.unshift("xx2");
  return config;
}
```

## 手动添加节点（VMess-TCP）

```yaml
prepend:
  - name: "xdt-cloud"
    type: "vmess"
    server: "11.22.33.44"
    port: 1111
    cipher: "auto"
    uuid: "7924d666-918f-4e37-9073-2222222222"
    tls: false
    alterId: 0
    network: "tcp"
```

单行写法：

```yaml
prepend:
  - {name: 'xdt-cloud', type: 'vmess', server: '11.22.33.44', port: 1111, cipher: 'auto', uuid: '7924d666-918f-4e37-9073-2222222222', tls: false, alterId: 0, network: 'tcp'}
```
