

## 涉及到的包

babel-plugin-external-helpers

rollup rollup-plugin-commonjs rollup-plugin-babel

## options
```js
const rollup = require('rollup');
const commonjs = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');

// see below for details on the options
const inputOptions = {
  input: './src/index.js',
  plugins: [
    babel({
      include: ['./src/**']
    }),
    commonjs()
  ]
};
const outputOptions = {
  format: 'cjs',
  // format: 'umd',
  // name: 'mccard',
  file: 'dist/index.cjs.js'
};

```

## .babelrc

```
{
  "presets": [
    [
      "env",
      {
        "modules": false
      }
    ]
  ],
  "plugins": [
    "external-helpers"
  ]
}
```

## rollup.rollup 使用

```js
async function build() {
  // create a bundle
  const bundle = await rollup.rollup(inputOptions);

  // generate code and a sourcemap
  const { code, map } = await bundle.generate(outputOptions);

  // or write the bundle to disk
  await bundle.write(outputOptions);
}

build()

```

## rollup.watch 使用

```js
let watchOptions = Object.assign(inputOptions, {

  output: [outputOptions],
  watch: {
    include:'./src/**'
  }
});

const watcher = rollup.watch(watchOptions);

watcher.on('event', event => {
  // event.code can be one of:
  //   START        — the watcher is (re)starting
  //   BUNDLE_START — building an individual bundle
  //   BUNDLE_END   — finished building a bundle
  //   END          — finished building all bundles
  //   ERROR        — encountered an error while bundling
  //   FATAL        — encountered an unrecoverable error
  console.log(event)
  console.log(event.code)
});

// stop watching
// watcher.close();
```
