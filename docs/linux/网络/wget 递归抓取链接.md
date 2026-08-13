---
title: wget 递归抓取链接
icon: mdi:network-outline
sort: 3
---

# wget 递归抓取链接

> 使用 `wget --spider` 递归抓取站点所有 URL 并保存到文件。

## 基本用法

```bash
wget -r -np -nH --spider http://192.168.1.222:8080/ 2>&1 | grep http > urls.txt
```

## 参数说明

| 参数 | 说明 |
|------|------|
| `-r` | 递归下载/爬取，跟随页面中的链接 |
| `-np` / `--no-parent` | 不追溯父级目录，仅爬取起始 URL 及其子目录 |
| `-nH` / `--no-host-directories` | 不创建主机名目录 |
| `--spider` | 蜘蛛模式：不下载文件内容，仅检查链接是否存在 |
| `2>&1` | 将 stderr 重定向到 stdout（wget 日志默认输出到 stderr） |
| `\| grep http > urls.txt` | 过滤出包含 `http` 的行，保存到文件 |

## 常用组合

```bash
# 只抓取指定域名的链接（不跟随外链）
wget -r -np -nH --spider -D 192.168.1.222 http://192.168.1.222:8080/ 2>&1 | grep http > urls.txt

# 限制递归深度
wget -r -np -nH --spider -l 2 http://192.168.1.222:8080/ 2>&1 | grep http > urls.txt

# 只抓取特定扩展名的链接
wget -r -np -nH --spider -A "*.html,*.htm" http://192.168.1.222:8080/ 2>&1 | grep http > urls.txt

# 排除特定模式
wget -r -np -nH --spider -R "*.jpg,*.png,*.css,*.js" http://192.168.1.222:8080/ 2>&1 | grep http > urls.txt

# 添加请求头（如 User-Agent）
wget -r -np -nH --spider --header="User-Agent: Mozilla/5.0" http://192.168.1.222:8080/ 2>&1 | grep http > urls.txt
```

## 参数速查

| 参数 | 说明 |
|------|------|
| `-l N` / `--level=N` | 递归深度，`0` 为无限（默认 5） |
| `-D domain` | 限定域名，逗号分隔 |
| `-A acclist` | 接受的文件扩展名，逗号分隔 |
| `-R rejlist` | 排除的文件扩展名，逗号分隔 |
| `-nc` | 不覆盖已存在文件（no-clobber） |
| `-w N` | 请求间隔秒数，避免过快请求 |
| `-e robots=off` | 忽略 robots.txt |
| `--header="Key: Value"` | 自定义请求头 |
