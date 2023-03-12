window['cb_工程-webpack4']({"outline":[{"id":"930681275","level":1,"name":"代码拆分","children":[]},{"id":"1617700749","level":1,"name":"css 分离 使用 mini-css-extract-plugin","children":[]},{"id":"1449798943","level":1,"name":"entry 也能指定文件夹","children":[]},{"id":"3921238911","level":1,"name":"build 代码不压缩","children":[]},{"id":"4194102935","level":1,"name":"exclude include 同时用,exclude优先级更高","children":[]},{"id":"1226494750","level":1,"name":"webpack babel polyfill 开启按需兼容后 promise 依然报错问题","children":[]}],"content":"<section><h1 id=\"930681275\">代码拆分</h1><p>Since version 4 the <code>CommonsChunkPlugin</code> was removed in favor of <code>optimization.splitChunks</code> and <code>optimization.runtimeChunk</code> options. Here is how the new flow works.</p>\n<p><a href=\"https://webpack.js.org/plugins/split-chunks-plugin\">https://webpack.js.org/plugins/split-chunks-plugin</a></p>\n</section><section><h1 id=\"1617700749\">css 分离 使用 mini-css-extract-plugin</h1><p><a href=\"https://webpack.js.org/plugins/mini-css-extract-plugin\">mini-css-extract-plugin 文档</a></p>\n</section><section><h1 id=\"1449798943\">entry 也能指定文件夹</h1><pre><code class=\"language-js\">entry: {\n  <span class=\"hljs-comment\">// 将为 index.js 新建v3文件夹，</span>\n  <span class=\"hljs-string\">'v3/index'</span>: [<span class=\"hljs-string\">'./src/v3/index.pcss'</span>,<span class=\"hljs-string\">\"./src/v3/index.js\"</span>],\n}</code></pre>\n<p>但自动生成的引用路径可能会多一层，所以直接使用output指定会更好</p>\n<pre><code class=\"language-js\"><span class=\"hljs-selector-tag\">output</span>: {\n  <span class=\"hljs-attribute\">path</span>: path.<span class=\"hljs-built_in\">resolve</span>(__dirname, <span class=\"hljs-string\">\"dist/v3\"</span>), // string\n  filename: <span class=\"hljs-string\">\"[name].js\"</span>,\n},</code></pre>\n</section><section><h1 id=\"3921238911\">build 代码不压缩</h1><p>方便检查编译代码</p>\n<pre><code class=\"language-js\"><span class=\"hljs-keyword\">let</span> webpackConfig = {\n  <span class=\"hljs-attr\">mode</span>: <span class=\"hljs-string\">'none'</span>, <span class=\"hljs-comment\">// 不压缩代码</span>\n  output: {\n    <span class=\"hljs-attr\">pathinfo</span>: <span class=\"hljs-literal\">true</span> <span class=\"hljs-comment\">// 模块标注路径信息</span>\n  }\n}</code></pre>\n</section><section><h1 id=\"4194102935\">exclude include 同时用,exclude优先级更高</h1><pre><code class=\"language-js\">{\n  <span class=\"hljs-attribute\">test</span>: /\\.js$/,\n  include: [ <span class=\"hljs-string\">'E:/_work/template-vue/src'</span> ],\n  exclude: [ <span class=\"hljs-string\">'E:/_work/src/libs/iview-pro'</span> ],       \n  use: [ { loader: <span class=\"hljs-string\">'babel-loader'</span>, options: [Object] } ]\n}</code></pre>\n</section><section><h1 id=\"1226494750\">webpack babel polyfill 开启按需兼容后 promise 依然报错问题</h1><p>虽然已经按需 polyfill，但如果 src 中没使用 promise，但 node_modules 中有使用, 不支持 promise 的浏览器还是会报错，\n比如动态 import() 就有对 promise 的使用，所以这里手动引入\n当然，正式项目肯定会用 promise，所以这种情况可以忽略</p>\n<pre><code class=\"language-js\"><span class=\"hljs-comment\">// 手动导入</span>\n<span class=\"hljs-keyword\">import</span> <span class=\"hljs-string\">'core-js/modules/es6.promise.js'</span></code></pre>\n"})