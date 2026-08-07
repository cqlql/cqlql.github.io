


https://doc.webpack-china.org/guides/caching#-module-identifiers-

有2个插件可以解决


- [NamedModulesPlugin](https://doc.webpack-china.org/plugins/named-modules-plugin)  将id换成路径。
还可以很快定位缺少模块问题
 
- [HashedModuleIdsPlugin](https://doc.webpack-china.org/plugins/hashed-module-ids-plugin) 将id换成路径的hash值 [推荐]


## 注意是使用 [chunkhash]
不能使用 [hash]

```js
module.exports = {
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: "js/[name].[chunkhash:4].js",
    chunkFilename: 'js/[name].bundle.[chunkhash:4].js',
  },
  plugins: [
    new ExtractTextPlugin('css/[name].[chunkhash:4].css'),
    new webpack.HashedModuleIdsPlugin()
  ]
}

```