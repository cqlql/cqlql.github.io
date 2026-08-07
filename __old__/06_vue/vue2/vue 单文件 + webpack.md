
## 相关包

vue vue-loader vue-template-compiler

有时候会漏掉 `vue-template-compiler` 。。。

## css 导入先后：js 与 style 方式

js：import 方式

style：style 嵌入方式

单文件中同时使用这两种方式，无论style 位置，**js 将先导入，然后才是 style**，符合预想

```html
<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <h2>Essential Links</h2>
  </div>
</template>

<script>
import '../assets/comm.css'
export default {
  name: 'hello',
  data () {
    return {
      msg: 'Welcome to Your Vue.js App'
    }
  }
}
</script>

<style scoped>
h1, h2 {
  font-weight: normal;
}
</style>
```

## js(import) css 是否归 vue-loader 管 / 异步单文件 js(import) css提取

js(import) 方式不归 vue-loader 管。vue-loader 只管 style。

而且，**外界的css提取依然可以影响**

但，**异步**情况特殊，外css提取，vue-loadert提取都无法生效。

也就是说，异步包无法提取css？？不，可以提取，但只能提取 js(import) 方式，通过 `CommonsChunkPlugin` 开启 `children:true`。
将多处异步包中调用模块提取到父 chunk 中，然后css提取便生效

也就是说，异步包的 style 方式固定无法提取

## js(import)导入 css，实现不重复
**懒加载单文件模块，单文件中 js 方式导入 css，多处导入实现不重复方式：**
- 入口js 文件导入一次后，多处**异步**单文件中的相同导入不会重复生成
- 通过 `CommonsChunkPlugin`，开启 `children:true`

## 某种情况下说，vue-loader 的提取没有意义



## vue-loader webpack 配置

```js
{
    test: /\.vue$/,
    loader: 'vue-loader',
    options: {
        loaders: {
            js: {
                loader: 'babel-loader',
                include: [
                    path.resolve(__dirname, "src")
                ],
            },
            // 带提取
            css: ExtractTextPlugin.extract({
                fallback: 'style-loader',
                use: [{
                    loader: 'css-loader',
                    options: {
                        importLoaders: 1,
                        sourceMap: true,

                    }
                }, {
                    loader: 'postcss-loader',
                    options: {
                        sourceMap: 'inline'
                    }
                }]
            }),
            // 不提取
            // css: {
            //     use: [{
            //         loader: 'style-loader'
            //     }, {
            //         loader: 'css-loader', options: {
            //             importLoaders: 1,
            //             sourceMap: true
            //         }
            //     }, {
            //         loader: 'postcss-loader',
            //         options: {
            //             sourceMap: 'inline',
            //             // parser
            //         }
            //     }]
            // }

            scss: ExtractTextPlugin.extract({
                fallback: 'style-loader',
                use: [{
                    loader: 'css-loader',
                    options: {
                        importLoaders: 1,
                        sourceMap: true,

                    }
                }, {
                    loader: 'sass-loader',
                    options: {
                        sourceMap: true,
                        includePaths: ['E:/_work/mobile_webview/smallpitch.webview/src/modules/base-libs/css']
                    }
                }]
            }),

        }
    }
}
```



## vue-loader webpack 配置 css loader 写法2
上面不提取写法似乎有问题。待详细测试

```js
{
  test: /\.vue$/,
  loader: 'vue-loader',
  options: {
    loaders: {
      js: {
        loader: 'babel-loader',
        include: [
          resolve("src")
        ],
      },
      postcss: 'vue-style-loader!css-loader?sourceMap=true!postcss-loader?sourceMap=true',
      scss: 'vue-style-loader!css-loader?sourceMap=true!sass-loader?sourceMap=true'
    }
  }
}
```
