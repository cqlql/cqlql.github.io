window['cb_工具']({"outline":[{"id":"718919685","level":1,"name":"ie6 官方调试工具","children":[]},{"id":"3172738830","level":1,"name":"npm","children":[{"id":"3750354389","level":2,"name":"npm 项目路径最好不要包含$符号","children":[]},{"id":"1550682396","level":2,"name":"通过 npm 执行package.json准备的命令","children":[]},{"id":"3265507966","level":2,"name":"查看创库源地址","children":[]},{"id":"3700761629","level":2,"name":"关于加速","children":[{"id":"843264525","level":3,"name":"使用淘宝镜像","children":[]},{"id":"2806982719","level":3,"name":"或者安装 cnpm 命令","children":[]}]},{"id":"16910046","level":2,"name":"发布包","children":[]},{"id":"3399652737","level":2,"name":"更新发布包","children":[]},{"id":"2015751142","level":2,"name":"package.json","children":[{"id":"1581505852","level":3,"name":"命令创建 package.json 文件","children":[]},{"id":"2133359398","level":3,"name":"main字段","children":[]},{"id":"2833755103","level":3,"name":"scripts字段：脚本执行","children":[]}]},{"id":"3645248465","level":2,"name":"参考网址","children":[]},{"id":"2434187449","level":2,"name":"更新 npm 工具","children":[]},{"id":"1187023521","level":2,"name":"更新本地包","children":[]},{"id":"1402800308","level":2,"name":"查看过时本地包","children":[]},{"id":"969639630","level":2,"name":"查看本地包列表","children":[]}]},{"id":"2376940439","level":1,"name":"postman","children":[]},{"id":"555868421","level":1,"name":"yarn","children":[{"id":"1104076087","level":2,"name":"更新所有包","children":[]}]}],"content":"<section><h1 id=\"718919685\">ie6 官方调试工具</h1><p><a href=\"https://www.microsoft.com/en-us/download/details.aspx?id=2020\">Superpreview</a></p>\n</section><section><h1 id=\"3172738830\">npm</h1><section><h2 id=\"3750354389\">npm 项目路径最好不要包含$符号</h2><p>即文件夹最好不用$命名，因为$为命令关键字</p>\n</section><section><h2 id=\"1550682396\">通过 npm 执行package.json准备的命令</h2><p>scripts 字段</p>\n<pre><code class=\"language-cmd\"><span class=\"hljs-attribute\">npm</span> run dev</code></pre>\n<p>部分命令无需加 run，比如start，可直接</p>\n<pre><code class=\"language-cmd\"><span class=\"hljs-attribute\">npm</span> start</code></pre>\n</section><section><h2 id=\"3265507966\">查看创库源地址</h2><pre><code class=\"language-cmd\">npm config <span class=\"hljs-keyword\">get</span> registry</code></pre>\n</section><section><h2 id=\"3700761629\">关于加速</h2><section><h3 id=\"843264525\">使用淘宝镜像</h3><pre><code class=\"language-cmd\">npm config <span class=\"hljs-keyword\">set</span> registry https:<span class=\"hljs-comment\">//registry.npm.taobao.org</span></code></pre>\n<p>源镜像地址：<a href=\"https://registry.npmjs.org/\">https://registry.npmjs.org/</a></p>\n<pre><code class=\"language-cmd\">npm config <span class=\"hljs-keyword\">set</span> registry https:<span class=\"hljs-comment\">//registry.npmjs.org/</span></code></pre>\n</section><section><h3 id=\"2806982719\">或者安装 cnpm 命令</h3><pre><code class=\"language-cmd\">npm install -g cnpm --registry=https:<span class=\"hljs-comment\">//registry.npm.taobao.org</span></code></pre>\n</section></section><section><h2 id=\"16910046\">发布包</h2><p>首先关联账号</p>\n<pre><code><span class=\"hljs-attribute\">npm</span> adduser</code></pre><p>发布  </p>\n<ul>\n<li>当前所在文件夹  </li>\n<li>不加点也行</li>\n</ul>\n<pre><code><span class=\"hljs-attribute\">npm</span> publish .</code></pre></section><section><h2 id=\"3399652737\">更新发布包</h2><p>跟<a href=\"#%E5%8F%91%E5%B8%83%E5%8C%85\">发布包</a>一样，也是通过<code>npm publish</code>命令，只是要修改版本</p>\n</section><section><h2 id=\"2015751142\">package.json</h2><section><h3 id=\"1581505852\">命令创建 package.json 文件</h3><p>将在命令运行目录创建</p>\n<pre><code><span class=\"hljs-attribute\">npm</span> init</code></pre></section><section><h3 id=\"2133359398\">main字段</h3><p>nodejs 在 require 模块时，将以此字段指向的js文件作为入口</p>\n<pre><code class=\"language-json\">{\n    <span class=\"hljs-string\">\"main\"</span>:<span class=\"hljs-string\">\"./lib/app.js\"</span>\n}</code></pre>\n</section><section><h3 id=\"2833755103\">scripts字段：脚本执行</h3><p>可直接运行非全局的模块命令。<br>因为默认会在<code>./node_modules/.bin</code>中寻找命令。但也只限于与<code>package.json</code>同级的<code>node_modules</code>中寻找。</p>\n<p>假如是某其他文件夹的<code>package.json</code>，需指定命令的绝对路径：</p>\n<pre><code class=\"language-json\">{\n  <span class=\"hljs-string\">\"name\"</span>: <span class=\"hljs-string\">\"my-app\"</span>,\n  <span class=\"hljs-string\">\"version\"</span>: <span class=\"hljs-string\">\"0.1.0\"</span>,\n  <span class=\"hljs-string\">\"private\"</span>: <span class=\"hljs-literal\">true</span>,\n  <span class=\"hljs-string\">\"dependencies\"</span>: {\n    <span class=\"hljs-string\">\"react\"</span>: <span class=\"hljs-string\">\"^15.6.1\"</span>,\n    <span class=\"hljs-string\">\"react-dom\"</span>: <span class=\"hljs-string\">\"^15.6.1\"</span>\n  },\n  <span class=\"hljs-string\">\"devDependencies\"</span>: {\n    <span class=\"hljs-string\">\"react-scripts\"</span>: <span class=\"hljs-string\">\"1.0.7\"</span>\n  },\n  <span class=\"hljs-string\">\"scripts\"</span>: {\n    <span class=\"hljs-string\">\"start\"</span>: <span class=\"hljs-string\">\"E:/_work/node_modules/.bin/react-scripts start\"</span>\n  }\n}\n</code></pre>\n</section></section><section><h2 id=\"3645248465\">参考网址</h2><p><a href=\"http://www.cnblogs.com/penghuwan/p/6973702.html#_label4\">http://www.cnblogs.com/penghuwan/p/6973702.html#_label4</a></p>\n</section><section><h2 id=\"2434187449\">更新 npm 工具</h2><p>npm install npm@latest -g</p>\n</section><section><h2 id=\"1187023521\">更新本地包</h2><p>npm update</p>\n</section><section><h2 id=\"1402800308\">查看过时本地包</h2><p>npm outdated</p>\n</section><section><h2 id=\"969639630\">查看本地包列表</h2><p>npm ls</p>\n</section></section><section><h1 id=\"2376940439\">postman</h1><p>接口测试</p>\n<p>chrome 应用</p>\n</section><section><h1 id=\"555868421\">yarn</h1><section><h2 id=\"1104076087\">更新所有包</h2><p>yarn upgrade --latest</p>\n"})