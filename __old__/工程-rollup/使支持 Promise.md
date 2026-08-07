
在使用 Promise 等高级特性情况，会自动生成 Promise 实现。默认不生成

关键设置

```
let inputOptions = {
  plugins: [
    babel({
      // 关键
      plugins: ['transform-runtime'],
      runtimeHelpers:true
      
    }),
  ],
};
```

完整示例

```js
const commonjs = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');
const resolve = require('rollup-plugin-node-resolve');

const bundle = await rollup.rollup({
  input: './src/index.js',
  plugins: [
    babel({
      plugins: ['transform-runtime'],
      runtimeHelpers:true
    }),
    resolve({
      customResolveOptions: {
        moduleDirectory: 'node_modules'
      }
    }),
    commonjs(),
    // uglify()
  ]
});

  await bundle.write({
    format: 'cjs',
    name: 'corejs',
    file: './dist/index.cjs.js', // equivalent to --output

    sourcemap: true
  });
```
