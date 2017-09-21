const fs = require('fs-extra');
const path = require('path');
let webpack = require('webpack');
let conf = require('./webpack.config')('p')

let outputPath = conf.output.path = path.resolve('demo')
delete conf.devtool

webpack(conf,function (err, stats) {

  const info = stats.toString({
    colors: true
  });

  console.log(info)

  fs.removeSync(path.resolve(outputPath,'./css'))
  fs.removeSync(path.resolve(outputPath.path,'./js'))
})
