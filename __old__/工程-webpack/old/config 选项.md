
## output

### output.publicPath
[output.publicPath API 参考](https://doc.webpack-china.org/configuration/output#output-publicpath)

输出还是按照 output.path 输出，只是更正全局资源引用路径。否则引用将相对 output.path 

部分 loader 有单独的 publicPath，这个只是在全局的基础上追加，比如 file-loader 

### output.filename

#### 除了设置名称，还可以设置输出路径

部分loader，比如 file-loader 的 name，还有 HtmlWebpackPlugin 的 filename 也有此特性

#### [hash]

每次构建都会生成一个跟之前不一样的，唯一的 hash，所有输出的文件共用同一个 hash

#### [chunkhash]

建议用这个，根据 chunk 生成，chunk 改变才改变

但，使用 devServer 构建情况，不能用这个，否则报错

```js
filename: "[name].[hash].bundle.js"
```

## modules 指定模块寻找，支持 nodejs require 机制

- 文件夹名称：支持往上寻找
- 相对路径
- 绝对路径

文件夹名称、相对路径 问题：
**一个 chunk 中可能会打包出多个相同模块**。  
比如一个js中有2个vue框架。因为其他项目的 vue 引用会捆绑自己的 `node_modules`，并且独立生成。但如果使用同一个 `node_modules`(绝对路径) 就不会有此问题

webpack.config.js
```js
modules: [
    // 其他不同路径的独立项目打包时会使用它们自己的的 node_modules
    // "node_modules",
    
    // 只使用当前项目的 node_modules，其他不同路径的独立项目打包时也会使用此node_modules
    path.resolve(__dirname,'node_modules'),
    
    'E:/Dropbox/github/cqlql.github.io/libr',
    'E:/Dropbox/github/cqlql.github.io/js/modules',
    'E:/Dropbox/github/cqlql.github.io/css/modules'

],
```

调用
```js
import click from 'dom/click';  // E:/Dropbox/github/cqlql.github.io/js/modules/dom/click.js
import prism from 'prism/prism';  // E:/Dropbox/github/cqlql.github.io/libr/prism/prism.js
```
