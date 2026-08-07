## 最大化启动

```js
const { chromium } = require("playwright");
const browser = await chromium.launch({
  args: [
    // 最大化参数
    "--start-maximized",
    // 更多参数：https://peter.sh/experiments/chromium-command-line-switches
  ],

  headless: false,
});
const context = await browser.newContext({
  // viewport 需设为 null，否则 args 的窗口控制参数不起作用
  viewport: null,
});
```
