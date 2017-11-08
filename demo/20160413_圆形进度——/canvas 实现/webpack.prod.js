let path = require('path');
let webpack = require('webpack');

let ExtractTextPlugin = require("extract-text-webpack-plugin");
let HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
let HtmlWebpackPlugin = require('html-webpack-plugin');

let CleanPlugin = require('./build/clean-plugin')
function resolve (p) {
  return path.resolve(__dirname, p)
}

let conf = {
  entry: {
    main: ["./src/js/report.js"]
  },
  output: {
    path: path.resolve(__dirname, './dist'),

    filename: "js/[name].[chunkhash:7].js",
    chunkFilename: 'js/[name].bundle.[chunkhash:7].js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: './report.html',
      template: './src/report.html',
      chunks: ['main'],
      inlineSource: '.(css|js)$',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        minifyCSS: true,
        minifyJS: true
        // more options:
        // https://github.com/kangax/html-minifier#options-quick-reference
      }
    }),
    new ExtractTextPlugin('css/[name].css'),
    new HtmlWebpackInlineSourcePlugin(),
    // new webpack.optimize.CommonsChunkPlugin({
    //   name: ['common']
    // }),
    // new webpack.optimize.CommonsChunkPlugin({
    //   children: true,
    //   minChunks: function (module) {
    //     return (/.css$/).test(module.resource)
    //   }
    // }),

    new webpack.optimize.UglifyJsPlugin(), // 压缩
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
    new webpack.LoaderOptionsPlugin({ // 设置所有loader，压缩css等
      minimize: true
    }),
    // new HtmlPlugin({options: ''}),
    new CleanPlugin({
      before: [resolve('dist')],
      after: [resolve('dist/css'), resolve('dist/js')]
    }),
    new webpack.HashedModuleIdsPlugin({
      hashDigestLength: 7
    })
  ],

  module: {
    //加载器配置
    rules: [{
      test: /\.js$/,
      include: [resolve('src')],
      // exclude: ['node_modules'],
      loader: 'babel-loader'
    },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        loader: 'url-loader',
        query: {
          limit: 5000,//单位 字节，1千字节(kb)=1024字节(b)
          // path: '/',
          // publicPath: '../',
          name: 'imgs/[name].[ext]'
        }
      }, {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        loader: 'url-loader',
        query: {
          limit: 5000,
          // publicPath: '../',
          // name: '../fonts/[name].[hash:7].[ext]'
          name: 'fonts/[name].[ext]'
        }
      }, {
      test: /\.css$/,
      use: ExtractTextPlugin.extract({
        fallback: 'style-loader', // 超有用，不要漏了。解决 vue 单文件 js(import) 方式导入 css 无效问题
        use: ['css-loader','postcss-loader']
      }),
      // use: ['style-loader','css-loader','postcss-loader']

    }]
  },
}

webpack(conf,function (err, stats) {

  const info = stats.toString({
    colors: true
  });

  console.log(info)

  // fs.removeSync(path.resolve(conf.output.path,'./css'))
  // fs.removeSync(path.resolve(conf.output.path,'./js'))
})
