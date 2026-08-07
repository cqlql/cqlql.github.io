## 配置环境变量

vue.config.js

```js
export default {
  chainWebpack: (config) => {
    config.plugin('define').tap((args) => {
      args[0]['process.env'].UNIH5PLUS = JSON.stringify(process.env.UNIH5PLUS)
      return args
    })
  },
}
```
