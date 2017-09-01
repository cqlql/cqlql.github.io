

const Webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const webpackConfig = require('./webpack.config')();

const compiler = Webpack(webpackConfig);
const server = new WebpackDevServer(compiler, {
  stats: {
    // 增加资源信息
    assets: true,
    // 增加子级的信息
    children: false,
    // 增加包信息（设置为 `false` 能允许较少的冗长输出）
    chunks: false,
    // 将内置模块信息增加到包信息
    chunkModules: false,
    // 增加包 和 包合并 的来源信息
    chunkOrigins: false,
    // `webpack --colors` 等同于
    colors: true,
    // 增加错误信息
    errors: true,
    // 增加错误的详细信息（就像解析日志一样）
    errorDetails: true,
    // 增加编译的哈希值
    hash: false,
    // 增加内置的模块信息
    modules: false,
    publicPath: true,
    // 增加提示
    warnings: true,
  }
});

server.listen(8080, '192.168.1.222', () => {
  console.log('Starting server on http://192.168.1.222:8080');
});
