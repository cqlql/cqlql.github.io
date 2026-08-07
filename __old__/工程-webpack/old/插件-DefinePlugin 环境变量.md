

## 编写只有开发环境存在代码

1、开发环境可用。以下代码**不会**生成到正式环境

```js
if (process.env.NODE_ENV !== 'production') {
  console.log('Looks like we are in development mode!');
}
```

2、也会删除如下判断
```js
if (process.env.NODE_ENV === 'production') {
  console.log('Looks like we are in production mode!');
}
```

删除后

```js
console.log('Looks like we are in production mode!');
```

3、也支持三元运算符

三元运算符 `true?1:0` 压缩后 1，也会删除多余代码

4、支持模块

只能使用 require 语法

包括 `require`、 `require.context`

相关内容：

[dependency-management](https://webpack.js.org/guides/dependency-management/)

[批量导入模块](#批量导入模块)

## 可新增其他变量

```js
new webpack.DefinePlugin({
  'process.env': {
    NODE_ENV: JSON.stringify('production'),
    WEB_TEST: JSON.stringify('false')
  }
})
```

## 使用未声明变量并不会转换成 false
注意，在没有新增某变量的情况下，使用此变量，并不会转换成 false。也就是说，此代码块压缩后不会删除

## 多个 DefinePlugin

使用 webpack3 webpack4 测试结论：
同名以第一次为准；不同命不影响，都会存在

*webpack.config.js*

```js
plugins: [
  // 环境变量
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: JSON.stringify('production'),
      APP_TEST: JSON.stringify('false')
    }
  }),
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: JSON.stringify('production2'),
      APP_TEST2: JSON.stringify('true')
    }
  }),
]
```

*页面 index.js*

```js
console.log(process.env.NODE_ENV, process.env.APP_TEST) // production false
console.log(process.env.NODE_ENV, process.env.APP_TEST2) // production true
```
