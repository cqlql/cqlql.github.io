const fs = require('fs-extra');
const path = require('path');
let webpack = require('webpack');
let merge = require('webpack-merge');
//
let msg = require('./msg');
let conf = require('../webpack.config')()

conf= merge(conf,{
  // devtool:'source-map'

})

webpack(conf, function (err, stats) {
  msg(err, stats)
})

