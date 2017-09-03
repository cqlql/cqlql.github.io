const rollup = require('rollup');
const commonjs = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');

// see below for details on the options
const inputOptions = {
  input: './src/banner-fade.js',
  plugins: [
    babel({
      include: ['./src/**']
    }),
    commonjs()
  ]
};
const outputOptions = {
  // format: 'cjs',
  format: 'umd',
  name: 'bannerFade',
  file: 'dist/banner-fade.js'
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
