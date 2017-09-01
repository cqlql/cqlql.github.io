const rollup = require('rollup');
let {inputOptions,outputOptions} = require('./rollup.comm');

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
