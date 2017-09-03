let webpack = require('webpack');
let merge = require('webpack-merge');

let conf = require('./webpack.config')()

conf = merge(conf,{
  plugins:[
    // --optimize-minimize
    new webpack.optimize.UglifyJsPlugin(),
    // --define process.env.NODE_ENV="production"
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
  ],
})

webpack(conf,function (err, stats) {
  if (err) {
    console.error(err.stack || err);
    if (err.details) {
      console.error(err.details);
    }
    return;
  }

  // const info = stats.toJson();
  const info =stats.toString({
    // chunks: true,
    // Add console colors
    colors: true
  });

  if (stats.hasErrors()) {
    console.error(info.errors);
  }

  if (stats.hasWarnings()) {
    console.warn(info.warnings)
  }

  console.log(info)
})
