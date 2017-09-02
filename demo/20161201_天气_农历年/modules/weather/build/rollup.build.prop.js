const rollup = require('rollup');
const uglify = require('rollup-plugin-uglify');
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
    // uglify()
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

async function build() {
  // create a bundle
  const bundle = await rollup.rollup(inputOptions);

  // generate code and a sourcemap
  // const { code, map } = await bundle.generate(outputOptions);

  // or write the bundle to disk
  await bundle.write(outputOptions);
}

build()
