
webpack 常用配置

babel.config.js

```js
module.exports = {
  "presets": [
    ["@babel/preset-env", {

      // 不处理 es6模块，因为交给 webpack 处理了
      // 如果是 jest 使用，则不能设为 false
      "modules": false,

      "targets": {
        "browsers": ["> 1%", "last 2 versions", "not ie <= 8"]
      }
    }]
  ],
  "plugins": [
    "@babel/plugin-transform-runtime",
    "@babel/plugin-syntax-dynamic-import",
    "transform-vue-jsx"
  ]
}
```

