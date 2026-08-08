---
title: webpack 代理 devServer 问题
sort: 71
---

> 场景：联调 easy-mock 等接口时，本地 `localhost:8080` 请求 `localhost:7300` 出现跨域，用 `devServer.proxy` 解决。

## 问题

webpack 启动在 `localhost:8080`（`webpack-dev-server` 提供），接口在 `localhost:7300`，同源策略拦截。

## 解决：devServer.proxy

```js
module.exports = {
  devServer: {
    proxy: {
      "/api": {
        target: "http://localhost:7300", // 真实接口地址
        changeOrigin: true,
        pathRewrite: { "^/api": "" },
      },
    },
  },
};
```

- `target`：要代理到的后端地址。
- `changeOrigin: true`：修改请求头 `Host` 为目标域名，避免被后端拒绝。
- `pathRewrite`：去掉本地前缀（如 `/api`）再转发。

## 关键点

1. **只能在开发环境用**：`devServer` 只在 `webpack-dev-server` 启动时生效，打包后的产物无此代理。
2. **Proxy 错误不一定是跨域**：`proxy` 报错很多时候不是跨域，而是目标服务没起 / 路径不对。
3. **请求 URL 要写本地前缀**：如请求写 `http://localhost:8080/api/xxx`，才会命中代理；直接写 `7300` 仍跨域。

> 更完整的跨域处理（CORS、Nginx）见 `浏览器跨域解决.md`。
