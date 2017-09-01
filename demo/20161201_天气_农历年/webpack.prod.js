const webpackConfig = require('./webpack.config')('p');
const Webpack = require('webpack');
let msg=require('./build/msg')

const compiler = Webpack(webpackConfig,msg);
