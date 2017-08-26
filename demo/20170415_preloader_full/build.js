const fs = require('fs-extra');
const path = require('path');
let webpack = require('webpack');
//
let msg = require('./build/msg');
let conf = require('./webpack.config')('p')

webpack(conf, function (err, stats) {
  msg(err, stats)

  fs.removeSync(path.resolve(conf.output.path,'./css'))
  fs.removeSync(path.resolve(conf.output.path,'./js'))
})

