const fs = require('fs-extra')
const path = require('path')
let webpack = require('webpack')
let conf = require('./webpack.config')('p')

delete conf.devtool

webpack(conf, (err, stats) => {
  const info = stats.toString({
    colors: true
  })

  console.log(info)

  fs.removeSync(path.resolve(conf.output.path, './css'))
  fs.removeSync(path.resolve(conf.output.path, './js'))
})
