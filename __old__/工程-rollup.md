

## 只能使用 import 导入模块，但可通过插件改变

通过 rollup-plugin-commonjs 插件使支持 require 模块

## 外部模块不会解析成es5
需借用 [rollup-plugin-babel](#rollup-plugin-babel) 插件

## 插件

### rollup-plugin-node-resolve 打包外部模块

允许将外部模块编译进来，比如把 node_modules 中的模块。当然，也可以自定义的模块。  
只需指定一个文件夹名称，似乎会寻找硬盘的所有位置，很强大（指定路径将无效）
```js
plugins: [
  resolve({
    customResolveOptions: {
      moduleDirectory: ['node_modules','github']
    }
  })
]
```


### rollup-plugin-commonjs

使支持 require 模块。否则只能 import 模块

### rollup-plugin-babel

解析成es5代码。目前所知，必须使用`.babelrc`配置文件

```js
export default {
    plugins: [
        babel({
            // 使用数组，排除多个目录或文件
            exclude: ['node_modules/**','./src/katex.min.js'],
        })
    ]
}

```

### rollup-plugin-uglify

代码压缩

```js
const uglify = require('rollup-plugin-uglify');

export default {
    plugins: [
        uglify()
    ]
}
```


## rollup.config

目前常用：

- `cjs`: 打包成nodejs模块
- `iife`: 
    - 构建成可通过 `&lt;script&gt;` 标签使用的js。
    - 不能直接构建导出的模块
- `umd`: 
    - browser(AMD+全局) + nodejs
    - 需与moduleName选项一起使用
    - 可直接构建模块

## 加 banner 注释

需自己拼 

```
// generate code and a sourcemap
const { code, map } = await bundle.generate(outputOptions);

  
```


