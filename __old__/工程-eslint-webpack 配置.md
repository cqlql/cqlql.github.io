# webpack 配置

[eslint 官网](https://eslint.org/)

此处使用 [standard](https://github.com/standard/standard/blob/master/docs/README-zhcn.md) 规范

## 1. 首先要有 webpack 环境

## 2. eslint 相关包

eslint eslint-config-standard eslint-friendly-formatter eslint-plugin-html eslint-plugin-import eslint-plugin-node eslint-plugin-promise eslint-plugin-standard eslint-loader babel-eslint


## 3. eslint-loader 配置

```js
module: {
  //加载器配置
  rules: [
    {
      test: /\.(js|vue)$/,
      loader: 'eslint-loader',
      enforce: 'pre',//必须保证先执行此 loader ，所以加了此字段
      include: [resolve('../src'), resolve('../test')],
      options: {
        formatter: require('eslint-friendly-formatter')
      }
    }
  ]
},
```

## 4. 项目根目录加入配置文件: `.eslintrc.js` `.eslintignore`



### .eslintrc.js 规范检查核心配置

```js
// http://eslint.org/docs/user-guide/configuring

module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module'
  },
  env: {
    browser: true,
  },
  // https://github.com/standard/standard/blob/master/docs/RULES-en.md
  extends: 'standard',
  // required to lint *.vue files
  plugins: [
    'html'
  ],
  // add your custom rules here
  'rules': {
    // allow paren-less arrow functions
    'arrow-parens': 0,
    // allow async-await
    'generator-star-spacing': 0,
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0
  }
}

```

### .eslintignore 检查排除

```
build/*.js
config/*.js
src/lib/*.js
*.config.js
dist/*
karma.conf.js
```

## 4. 大功告成~
就是这么简单


## 附：编辑器编码规范配置

放根目录。使用编辑器格式化代码时，会根据此配置文件格式化

[.editorconfig](http://editorconfig.org/)

```
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

```
