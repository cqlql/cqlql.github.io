let path = require('path')

let ExtractTextPlugin = require('extract-text-webpack-plugin')

function resolve (p) {
  return path.resolve(__dirname, p)
}

let conf = {
  entry: {
    main: ['./src/index.js']
  },
  output: {
    path: resolve('./dist'),

    filename: 'js/[name].[chunkhash:7].js',
    chunkFilename: 'js/[name].bundle.[chunkhash:7].js',
  },
  plugins: [
    new ExtractTextPlugin('css/[name].css'),
  ],

  module: {
    // 加载器配置
    rules: [{
      test: /\.js$/,
      include: [
        resolve('./src'),
        resolve('../../modules'),
      ],
      // exclude: ['node_modules'],
      loader: 'babel-loader',
      options: {
        'presets': ['env'],
        'plugins': ['transform-runtime', 'syntax-dynamic-import'],
      }
    }, {
      test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
      loader: 'url-loader',
      query: {
        limit: 5000, // 单位 字节，1千字节(kb)=1024字节(b)
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
        use: ['css-loader', 'postcss-loader']
      }),
      // use: ['style-loader','css-loader','postcss-loader']

    }]
  },
}

module.exports = conf
