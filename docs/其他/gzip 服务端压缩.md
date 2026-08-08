---
title: gzip 服务端压缩
sort: 53
---

参考：[How To Optimize Your Site With Gzip Compression](https://betterexplained.com/articles/how-to-optimize-your-site-with-gzip-compression/)

- 浏览器发送请求时带 `Accept-Encoding: gzip`，服务端返回 gzip 压缩内容，**浏览器自动解压缩**。
- 通常 `js`、`css` 会被压缩；`html` 是否压缩取决于服务端配置。
- Nginx 开启示例：

```nginx
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
gzip_min_length 1k;
```

> 注：Nginx 配置细节见 `linux/nginx` 相关笔记。
