---
title: curl 速查
icon: mdi:console
sort: 10
---

# curl 速查

## 基础语法

```sh
curl [options] <url>
```

## 常用选项速览

| 选项 | 简写 | 说明 |
|------|------|------|
| `--request` | `-X` | 指定请求方法 (GET/POST/PUT/DELETE) |
| `--header` | `-H` | 添加请求头 |
| `--data` | `-d` | 发送 POST 请求体 |
| `--include` | `-i` | 响应中包含 HTTP 头 |
| `--head` | `-I` | 仅获取响应头 |
| `--output` | `-o` | 输出到文件 |
| `--silent` | `-s` | 静默模式（不显示进度） |
| `--show-error` | `-S` | 配合 `-s` 使用时显示错误 |
| `--verbose` | `-v` | 显示详细请求/响应信息 |
| `--location` | `-L` | 跟随重定向 |
| `--no-buffer` | `-N` | 禁用缓冲（用于流式输出） |
| `--form` | `-F` | 发送 multipart/form-data |
| `--user` | `-u` | 基础认证 `user:password` |
| `--connect-timeout` | | 连接超时（秒） |
| `--max-time` | `-m` | 整体超时（秒） |
| `--insecure` | `-k` | 忽略 SSL 证书校验 |
| `--compressed` | | 请求压缩响应 |
| `--proxy` | `-x` | 指定代理地址 |

## GET 请求

```sh
# 基本 GET
curl https://api.example.com/users

# 带查询参数
curl "https://api.example.com/users?page=1&size=10"

# 带请求头
curl -H "Accept: application/json" https://api.example.com/users
```

## POST 请求

```sh
# JSON 请求体
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "value": 123}' \
  https://api.example.com/submit

# 从文件读取请求体
curl -X POST \
  -H "Content-Type: application/json" \
  -d @payload.json \
  https://api.example.com/submit

# 表单提交（x-www-form-urlencoded）
curl -X POST -d "username=admin&password=123" https://example.com/login

# 文件上传（multipart）
curl -F "file=@/path/to/file.png" \
  -F "description=my image" \
  https://example.com/upload
```

## 认证

```sh
# Bearer Token
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.example.com/data

# 基础认证
curl -u username:password https://api.example.com/data

# API Key 自定义头
curl -H "X-API-Key: your-api-key" https://api.example.com/data
```

## 代理

```sh
# 通过代理访问（-x 指定代理地址）
curl -x http://127.0.0.1:7897 https://www.google.com
curl -x socks5://127.0.0.1:7897 https://www.google.com   # SOCKS5
curl -x http://user:pass@127.0.0.1:7897 https://...      # 带认证
```

**测试代理是否正常：**

```sh
# 返回 HTTP/2 200 即代理正常
curl -I -x http://127.0.0.1:7897 https://www.google.com

# 环境变量方式（curl 自动读取）
export http_proxy=http://127.0.0.1:7897
export https_proxy=http://127.0.0.1:7897
curl -I https://www.google.com
```

> 更多代理配置（环境变量持久化、APT/Git/Docker 代理）见 [代理配置](../../linux/代理与翻墙/代理配置.md)

## 流式请求 (SSE / 流式输出)

```sh
# 流式 POST（AI API 常见用法）
curl -N -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"prompt": "Hello", "stream": true}' \
  http://example.com/api/generate
```

`-N` 禁用输出缓冲，确保每条流式数据立即打印。

## 调试

```sh
# 显示完整请求和响应头
curl -v https://api.example.com

# 显示响应时间等详细信息
curl -w "\ntime_total: %{time_total}s\n" https://api.example.com

# 仅显示 HTTP 状态码
curl -s -o /dev/null -w "%{http_code}" https://api.example.com

# 静默 + 显示错误 + 跟随重定向（常用组合）
curl -sSL https://example.com
```

### `-w` 可用变量

| 变量 | 说明 |
|------|------|
| `%{http_code}` | HTTP 状态码 |
| `%{time_namelookup}` | DNS 解析时间 |
| `%{time_connect}` | TCP 连接时间 |
| `%{time_total}` | 总耗时 |
| `%{size_download}` | 下载字节数 |
| `%{url_effective}` | 最终请求 URL |

## PUT / PATCH / DELETE

```sh
# PUT
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{"name": "updated"}' \
  https://api.example.com/users/1

# DELETE
curl -X DELETE https://api.example.com/users/1

# PATCH
curl -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"name": "patched"}' \
  https://api.example.com/users/1
```

## 下载文件

```sh
# 下载并保存为指定文件名
curl -o myfile.zip https://example.com/file.zip

# 按服务器文件名保存
curl -O https://example.com/file.zip

# 断点续传
curl -C - -O https://example.com/large-file.zip
```

## 其他实用场景

```sh
# 获取公网 IP
curl -s ip.sb

# 测试端口连通性
curl -v telnet://host:port

# 忽略 SSL 证书校验（仅测试用）
curl -k https://self-signed.example.com

# 指定 HTTP 版本
curl --http2 https://example.com

# 设置连接超时和总超时
curl --connect-timeout 5 --max-time 30 https://example.com

# 发送 Cookie
curl -b "session=abc123" https://example.com

# 保存并发送 Cookie
curl -c cookies.txt -b cookies.txt https://example.com
```

## 常用组合

```sh
# 静默 + 显示错误 + 跟随重定向（最常用组合）
curl -sSL https://example.com

# 只看状态码和耗时
curl -sSL -o /dev/null -w "HTTP %{http_code}  %{time_total}s\n" https://example.com
```
