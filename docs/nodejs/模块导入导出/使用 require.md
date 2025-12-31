- [模块定义\导出](#模块定义导出)
- [require 自动寻找特性](#require-自动寻找特性)

## 模块定义\导出

导出 1：直接导出模块

```js
// math.js
var math = {
  add: function () {
    var sum = 0,
      i = 0,
      args = arguments,
      l = args.length
    while (i < l) {
      sum += args[i++]
    }
    return sum
  },
}
module.exports = math
```

导出 2：自定义导出，可以导出多个

```js
// math.js
exports.add = function () {
  var sum = 0,
    i = 0,
    args = arguments,
    l = args.length
  while (i < l) {
    sum += args[i++]
  }
  return sum
}

exports.sub = function () {}

// app.js 可以这样使用
const { add } = require('./math')
```

**使用：**

上面两个例子的效果一致

```js
// program.js
var math = require('math')
math.add(val, 1)
```

## require 自动寻找特性

不指明路径的直接模块调用，比如 require('gulp')，将自动在 node_modules 中寻找。

目录级别不影响。即可以是 node_modules 同级，也可以是某子级
