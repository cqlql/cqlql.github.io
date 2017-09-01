
const commonjs = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');

// see below for details on the options
let inputOptions = {
  input: '../src/index.js',
  plugins: [
    babel({
      include: ['../src/**']
    }),
    commonjs()
  ]
};
let outputOptions = {
  format: 'cjs',
  // format: 'umd',
  // name: 'mccard',
  file: '../dist/index.js'
};

module.exports = {
  inputOptions,
  outputOptions
}
