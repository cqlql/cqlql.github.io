
## 已失效

创建 clientAppEnhance.ts

clientAppEnhance.ts 为 webpack 待编译文件，相当于一个客户端全局入口，可 import css

文件路径 `.vuepress/clientAppEnhance.ts`

```js
import { defineClientAppEnhance } from '@vuepress/client'
import '@/components/Icon/iconfont.css'
export default defineClientAppEnhance(({ app, router, siteData }) => {
  //...
})
```

配置 clientAppEnhanceFiles

文件路径 `.vuepress/config.js`

```js
const vuepressUtils = require('@vuepress/utils')

module.exports = {
  clientAppEnhanceFiles: vuepressUtils.path.resolve(__dirname, './clientAppEnhance.ts'),
}
```


## 新方式

https://v2.vuepress.vuejs.org/zh/advanced/cookbook/usage-of-client-config.html
