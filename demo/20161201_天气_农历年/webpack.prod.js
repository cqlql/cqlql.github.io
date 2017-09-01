const webpackConfig = require('./webpack.config')('p');

const Webpack = require('webpack');

const compiler = Webpack(webpackConfig,require('./build/msg'));
