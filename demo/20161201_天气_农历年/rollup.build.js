
const rollup = require('rollup');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');
const uglify = require('rollup-plugin-uglify');

async function build() {
  const bundle = await rollup.rollup({
    input: './src/index.js',
    plugins: [

      babel({
        exclude: ['../../node_modules/**','./modules/weather'],

        // 使用助手
        // 即代码中将嵌入 Promise 实现，使之支持 Promise
        plugins: ['transform-runtime'],
        runtimeHelpers:true,

        // 是否排除助手
        // externalHelpers: true

      }),
      resolve({
        customResolveOptions: {
          moduleDirectory: 'node_modules'
        }
      }),
      commonjs(),
      uglify()
    ]
  });

  await bundle.write({
    format: 'cjs',
    name: 'corejs',
    file: './dist/weather.js', // equivalent to --output
    sourcemap: true
  });
}

build()
