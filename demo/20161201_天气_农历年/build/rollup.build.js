const rollup = require('rollup');
let {inputOptions,outputOptions} = require('./rollup.comm');
const uglify = require('rollup-plugin-uglify');

inputOptions.plugins.push(uglify())

async function build() {
  // create a bundle
  const bundle = await rollup.rollup(inputOptions);

  // generate code and a sourcemap
  // const { code, map } = await bundle.generate(outputOptions);

  // or write the bundle to disk
  await bundle.write(outputOptions);
}

build()
