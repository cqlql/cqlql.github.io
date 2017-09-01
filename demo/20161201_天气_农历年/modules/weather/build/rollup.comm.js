
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
  file: '../index.js',
  globals: {
    // 'promise':'babel-runtime/core-js/promise'
    // 'babel-runtime/core-js/promise': 'promise' // <------- switch these
  }
};

module.exports = {
  inputOptions,
  outputOptions
}
