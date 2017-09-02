const rollup = require('rollup');
const commonjs = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');
const resolve = require('rollup-plugin-node-resolve');


// see below for details on the options
let inputOptions = {
  input: '../src/index.js',
  plugins: [

    babel({
      include: ['../src/**']
    }),
    commonjs(),
    resolve({
      customResolveOptions: {
        moduleDirectory: 'node_modules'
      }
    }),
  ],
  // external: ['babel-runtime/core-js/promise'],

};
let outputOptions = {
  format: 'cjs',
  // format: 'umd',
  // name: 'mccard',
  file: '../dist/index.js',
  globals: {
    // 'promise':'babel-runtime/core-js/promise'
    // 'babel-runtime/core-js/promise': 'promise' // <------- switch these
  }
};

let watchOptions = Object.assign(inputOptions, {

  output: [outputOptions],
  watch: {
    include:'../src/**'
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
