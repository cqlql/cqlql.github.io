- [nodejs 测试问题](#nodejs-测试问题)
  - [会根据 `.babelrc` 文件进行 babel 转化](#会根据-babelrc-文件进行-babel-转化)
- [--watch 模式](#--watch-模式)
- [使用指定的 babel.config](#使用指定的-babelconfig)
- [开始测试](#开始测试)
  - [异步 mock funciton](#异步-mock-funciton)
  - [函数的调用次数](#函数的调用次数)
- [一些问题](#一些问题)
  - [与 webpack](#与-webpack)
  - [运行很慢](#运行很慢)

## nodejs 测试问题

### 会根据 `.babelrc` 文件进行 babel 转化

[使用 babel - 官方解释](https://facebook.github.io/jest/docs/zh-Hans/getting-started.html#%E4%BD%BF%E7%94%A8-babel)

**解决**

1. 更改 pageage.json

```js
// package.json
{
  "jest": {
    "transform": {}
  }
}
```

2. 使用配置文件

```js
// jest.config
module.exports = {
  name: "my-project",
  transform: {},
  testEnvironment: "node",
};
```

## --watch 模式

很聪明，只会测试更改的文件

当然，`--watchAll` 就会测试所有了

## 使用指定的 babel.config

jest-js-transformer.js

```js
const babelOptions = {
  presets: [
    [
      "@babel/preset-env",
      {
        // "modules": 'auto',
        // "useBuiltIns": "usage",
        // "targets": {
        //   "browsers": ["> 1%", "last 2 versions", "not ie <= 8"]
        // }
      },
    ],
  ],
  plugins: [
    "@babel/plugin-transform-runtime",
    "@babel/plugin-syntax-dynamic-import",
    // "transform-vue-jsx"
  ],
};

module.exports = require("babel-jest").createTransformer(babelOptions);
```

jest.config.js

```js
module.exports = {
  verbose: true,
  rootDir: "../",
  testMatch: ["<rootDir>/test/**/*.test.js"],
  // 'testRegex': [
  //   '/test/unit/.+(test|spec)\\.[jt]sx?$'
  // ],
  testPathIgnorePatterns: ["/src/", "node_modules"],
  moduleNameMapper: {
    // 同步 webpack 别名
    "@/(.*)$": "<rootDir>/src/$1",
  },

  transform: { "^.+\\.js$": "<rootDir>/test/jest-preprocess.js" },
};
```

## 开始测试

### 异步 mock funciton

```js
test("只执行一次", async () => {
  const asyncMock = jest.fn().mockResolvedValue();
  await asyncMock();
  expect(asyncMock).toHaveBeenCalledTimes(1);
});
```

### 函数的调用次数

```js
test("只执行一次", async () => {
  const drink = jest.fn();
  drink();
  expect(drink).toHaveBeenCalledTimes(1);
});
```

## 一些问题

### 与 webpack

### 运行很慢

即使只有一个简单的测试文件

cli 加 `-i`

```bash
jest -i
```
