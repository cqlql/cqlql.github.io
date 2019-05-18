window['cb_nodejs']({"outline":[{"id":"1532651955","level":1,"name":"require 模块","children":[{"id":"1421164284","level":2,"name":"<strong>模块定义\\导出</strong>","children":[]},{"id":"3387010006","level":2,"name":"require自动寻找特性","children":[]}]},{"id":"3562340088","level":1,"name":"获取本机 IP","children":[]},{"id":"1155816734","level":1,"name":"Nodejs 实现windows后台运行","children":[]},{"id":"578747644","level":1,"name":"node 实用模块","children":[{"id":"3833968428","level":2,"name":"node-portfinder 自动获取可用端口","children":[]},{"id":"2951224538","level":2,"name":"node-ip 可获取本机ip地址","children":[]},{"id":"1902060328","level":2,"name":"cli 参数获取","children":[]},{"id":"1282671611","level":2,"name":"终端相关","children":[{"id":"414038800","level":3,"name":"加载指示图标动画","children":[]},{"id":"3112393191","level":3,"name":"输出文本样式颜色控制","children":[]}]},{"id":"1933993334","level":2,"name":"node-notifier","children":[]},{"id":"1452717518","level":2,"name":"opn 打开其他程序","children":[]},{"id":"2653537014","level":2,"name":"chokidar","children":[]}]},{"id":"1588175777","level":1,"name":"npm 使用","children":[{"id":"840085760","level":2,"name":"切换仓库","children":[]},{"id":"4274907007","level":2,"name":"更新所有包","children":[]}]},{"id":"3902257298","level":1,"name":"path","children":[{"id":"406856879","level":2,"name":"路径信息","children":[]}]},{"id":"3319488544","level":1,"name":"文件系统 - fs","children":[{"id":"2214300140","level":2,"name":"文件列表(包括文件夹)","children":[{"id":"777350567","level":3,"name":"原生 readdir：只能当前目录，不寻找下级","children":[]},{"id":"1170671811","level":3,"name":"读取指定目录下的所有文件，支持过滤","children":[]}]},{"id":"3028361459","level":2,"name":"判断是不是[文件/目录]","children":[]},{"id":"1387359068","level":2,"name":"判断[文件/目录]是否存在 - fs.access(path[, mode], callback)","children":[]},{"id":"2319939491","level":2,"name":"判断[文件/目录]是否存在 - fs.exists(弃用)","children":[]},{"id":"1378298050","level":2,"name":"读取文件 fs.readFile","children":[]},{"id":"2092436126","level":2,"name":"改名(文件名，目录名)","children":[]},{"id":"87055947","level":2,"name":"删除","children":[{"id":"1760389645","level":3,"name":"标准删","children":[]},{"id":"1255202323","level":3,"name":"递归删：第三方扩展","children":[]}]},{"id":"2082920386","level":2,"name":"创建目录","children":[]},{"id":"709296185","level":2,"name":"写/创建 文件","children":[]},{"id":"183944347","level":2,"name":"copy","children":[]}]},{"id":"1225439272","level":1,"name":"服务端部署","children":[{"id":"3050294037","level":2,"name":"node 服务启动框架","children":[{"id":"2128702588","level":3,"name":"<a href=\"https://github.com/Unitech/pm2\">pm2 进程管理工具</a> - 生产环境","children":[{"id":"1895397500","level":4,"name":"使用配置文件启动","children":[]}]},{"id":"2300721790","level":3,"name":"nodemon - 开发环境","children":[]},{"id":"3920074446","level":3,"name":"其他启动框架","children":[]}]}]}],"content":"<section><h1 id=\"1532651955\">require 模块</h1><section><h2 id=\"1421164284\"><strong>模块定义\\导出</strong></h2><p>导出1：直接导出模块</p>\n<pre><code class=\"language-js\"><span class=\"hljs-comment\">// math.js</span>\n<span class=\"hljs-keyword\">var</span> math={\n  <span class=\"hljs-attr\">add</span>:<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span>(<span class=\"hljs-params\"></span>)</span>{\n    <span class=\"hljs-keyword\">var</span> sum = <span class=\"hljs-number\">0</span>,\n      i = <span class=\"hljs-number\">0</span>,\n      args = <span class=\"hljs-built_in\">arguments</span>,\n      l = args.length;\n    <span class=\"hljs-keyword\">while</span> (i &lt; l) {\n      sum += args[i++];\n    }\n    <span class=\"hljs-keyword\">return</span> sum;\n  }\n};\n<span class=\"hljs-built_in\">module</span>.exports=math;</code></pre>\n<p>导出2：自定义导出</p>\n<pre><code class=\"language-js\"><span class=\"hljs-comment\">// math.js</span>\nexports.add = <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\"></span>) </span>{\n  <span class=\"hljs-keyword\">var</span> sum = <span class=\"hljs-number\">0</span>,\n    i = <span class=\"hljs-number\">0</span>,\n    args = <span class=\"hljs-built_in\">arguments</span>,\n    l = args.length;\n  <span class=\"hljs-keyword\">while</span> (i &lt; l) {\n    sum += args[i++];\n  }\n  <span class=\"hljs-keyword\">return</span> sum;\n};</code></pre>\n<p><strong>使用：</strong></p>\n<p>上面两个例子的效果一致</p>\n<pre><code class=\"language-js\"><span class=\"hljs-comment\">// program.js</span>\n<span class=\"hljs-keyword\">var</span> math = <span class=\"hljs-built_in\">require</span>(<span class=\"hljs-string\">'math'</span>);\nmath.add(val, <span class=\"hljs-number\">1</span>);</code></pre>\n</section><section><h2 id=\"3387010006\">require自动寻找特性</h2><p>不指明路径的直接模块调用，比如 require(&#39;gulp&#39;)，将自动在 node_modules中寻找。</p>\n<p>目录级别不影响。即可以是node_modules同级，也可以是某子级</p>\n</section></section><section><h1 id=\"3562340088\">获取本机 IP</h1><pre><code class=\"language-js\"><span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> <span class=\"hljs-title\">getIPAdress</span>(<span class=\"hljs-params\"></span>)</span>{  \n  <span class=\"hljs-keyword\">var</span> interfaces = <span class=\"hljs-built_in\">require</span>(<span class=\"hljs-string\">'os'</span>).networkInterfaces();  \n  <span class=\"hljs-keyword\">for</span>(<span class=\"hljs-keyword\">var</span> devName <span class=\"hljs-keyword\">in</span> interfaces){  \n    <span class=\"hljs-keyword\">var</span> iface = interfaces[devName];  \n    <span class=\"hljs-keyword\">for</span>(<span class=\"hljs-keyword\">var</span> i=<span class=\"hljs-number\">0</span>;i&lt;iface.length;i++){  \n      <span class=\"hljs-keyword\">var</span> alias = iface[i];  \n      <span class=\"hljs-keyword\">if</span>(alias.family === <span class=\"hljs-string\">'IPv4'</span> &amp;&amp; alias.address !== <span class=\"hljs-string\">'127.0.0.1'</span> &amp;&amp; !alias.internal){  \n        <span class=\"hljs-keyword\">return</span> alias.address;  \n      }  \n    }  \n  }  \n}</code></pre>\n</section><section><h1 id=\"1155816734\">Nodejs 实现windows后台运行</h1><p>首先需要到<a href=\"http://nssm.cc/download/?page=download\">http://nssm.cc/download/?page=download</a> 下载 nssm</p>\n<p>下下来之后是压缩包形式的，解压之后 ctrl + R 进入cmd 命令行界面</p>\n<p>在命令行模式下进入到nssm的目录， 注意是32位或64位的系统进入相应的目录。</p>\n<p>之后运行：</p>\n<pre><code><span class=\"hljs-selector-tag\">nssm</span> <span class=\"hljs-selector-tag\">install</span> <span class=\"hljs-selector-tag\">NodeJS</span> “\\<span class=\"hljs-selector-tag\">node</span><span class=\"hljs-selector-class\">.exe</span>” “\\<span class=\"hljs-selector-tag\">server</span><span class=\"hljs-selector-class\">.js</span>” <span class=\"hljs-selector-tag\">net</span> <span class=\"hljs-selector-tag\">start</span> <span class=\"hljs-selector-tag\">NodeJS</span>\n<span class=\"hljs-selector-tag\">nssm</span> <span class=\"hljs-selector-tag\">install</span> <span class=\"hljs-selector-tag\">NodeJS</span>（安装后的服务名称） “(<span class=\"hljs-selector-tag\">node</span><span class=\"hljs-selector-class\">.exe</span>安装的地址)\\<span class=\"hljs-selector-tag\">node</span><span class=\"hljs-selector-class\">.exe</span>” “（要启动的<span class=\"hljs-selector-tag\">JS</span>文件）\\<span class=\"hljs-selector-tag\">server</span><span class=\"hljs-selector-class\">.js</span>” <span class=\"hljs-selector-tag\">net</span> <span class=\"hljs-selector-tag\">start</span> <span class=\"hljs-selector-tag\">NodeJS</span>（安装后的服务名称）</code></pre><p>最后要卸载服务用 nssm remove NodeJS（安装后的服务名称)</p>\n</section><section><h1 id=\"578747644\">node 实用模块</h1><section><h2 id=\"3833968428\">node-portfinder 自动获取可用端口</h2><p><a href=\"https://github.com/indexzero/node-portfinder\">node-portfinder</a></p>\n</section><section><h2 id=\"2951224538\">node-ip 可获取本机ip地址</h2><p><a href=\"https://github.com/indutny/node-ip\">https://github.com/indutny/node-ip</a></p>\n<pre><code class=\"language-js\">ip.address() <span class=\"hljs-comment\">// 可局域网访问的本机ip</span></code></pre>\n</section><section><h2 id=\"1902060328\">cli 参数获取</h2><p><a href=\"https://github.com/yargs/yargs\">yargs</a></p>\n</section><section><h2 id=\"1282671611\">终端相关</h2><section><h3 id=\"414038800\">加载指示图标动画</h3><p><a href=\"https://github.com/sindresorhus/ora\">https://github.com/sindresorhus/ora</a></p>\n</section><section><h3 id=\"3112393191\">输出文本样式颜色控制</h3><p><a href=\"https://github.com/chalk/chalk\">https://github.com/chalk/chalk</a></p>\n</section></section><section><h2 id=\"1933993334\">node-notifier</h2><p>似乎可以控制 vscode 弹消息框</p>\n</section><section><h2 id=\"1452717518\">opn 打开其他程序</h2><pre><code class=\"language-js\"><span class=\"hljs-keyword\">const</span> opn = <span class=\"hljs-built_in\">require</span>(<span class=\"hljs-string\">'opn'</span>)\nopn(<span class=\"hljs-string\">`http://<span class=\"hljs-subst\">${host}</span>:<span class=\"hljs-subst\">${port}</span>`</span>, {<span class=\"hljs-attr\">app</span>: [<span class=\"hljs-string\">'chrome'</span>]})</code></pre>\n</section><section><h2 id=\"2653537014\">chokidar</h2><p><a href=\"https://github.com/paulmillr/chokidar\">https://github.com/paulmillr/chokidar</a></p>\n<p>基于node.JS的监听文件夹改变模块</p>\n<p>一般前端环境框架直接有依赖安装</p>\n</section></section><section><h1 id=\"1588175777\">npm 使用</h1><section><h2 id=\"840085760\">切换仓库</h2><p><a href=\"https://www.jianshu.com/p/c5609434cd60\">NPM 切换仓库</a></p>\n<pre><code class=\"language-sh\">npm config ls\n\n# https:<span class=\"hljs-comment\">//registry.npmjs.org 原仓库</span>\n# https:<span class=\"hljs-comment\">//registry.npm.taobao.org 淘宝</span>\n\nnpm config <span class=\"hljs-keyword\">get</span> registry\nnpm config <span class=\"hljs-keyword\">set</span> registry https:<span class=\"hljs-comment\">//registry.npm.taobao.org # 设置淘宝仓库</span></code></pre>\n</section><section><h2 id=\"4274907007\">更新所有包</h2><pre><code class=\"language-sh\"><span class=\"hljs-comment\"># 先更新 package.json 版本</span>\n<span class=\"hljs-attribute\">npm</span> update local <span class=\"hljs-comment\"># 更新所有本地包</span>\nnpm update global <span class=\"hljs-comment\"># 全局包</span></code></pre>\n</section></section><section><h1 id=\"3902257298\">path</h1><section><h2 id=\"406856879\">路径信息</h2><pre><code class=\"language-js\"><span class=\"hljs-attribute\">let</span> <span class=\"hljs-literal\">info</span> = path.parse(<span class=\"hljs-string\">'./dir/index.js'</span>)\n\n<span class=\"hljs-literal\">info</span>.ext // 扩展名，如果是目录，则为空字符串\n</code></pre>\n</section></section><section><h1 id=\"3319488544\">文件系统 - fs</h1><section><h2 id=\"2214300140\">文件列表(包括文件夹)</h2><section><h3 id=\"777350567\">原生 readdir：只能当前目录，不寻找下级</h3><pre><code class=\"language-js\"><span class=\"hljs-attribute\">let</span> dirList = fs.readdirSync(<span class=\"hljs-string\">'./dir'</span>)\n// 返回值示例：\n// [<span class=\"hljs-string\">\".DS_Store\"</span>,<span class=\"hljs-string\">\"Update.exe\"</span>,<span class=\"hljs-string\">\"version\"</span>,<span class=\"hljs-string\">\"views_resources_200_percent.pak\"</span>,<span class=\"hljs-string\">\"xinput1_3.dll\"</span>]</code></pre>\n</section><section><h3 id=\"1170671811\">读取指定目录下的所有文件，支持过滤</h3><p>使用 <a href=\"https://github.com/jergason/recursive-readdir\">recursive-readdir</a>，但不会列出文件夹</p>\n<p>需列出文件夹使用：<a href=\"https://github.com/bigstickcarpet/readdir-enhanced\">readdir-enhanced</a></p>\n</section></section><section><h2 id=\"3028361459\">判断是不是[文件/目录]</h2><pre><code class=\"language-js\"><span class=\"hljs-built_in\">fs</span>.statSync(<span class=\"hljs-built_in\">path</span>).isDirectory() // 是不是目录，即路径最终指向的是文件夹\n<span class=\"hljs-built_in\">fs</span>.statSync(<span class=\"hljs-built_in\">path</span>).isFile() // 是不是文件</code></pre>\n<p>当然，也可用来判断文件目录是否存在，但不推荐。<strong>判断是否存在，推荐用 <code>fs.access</code></strong></p>\n<p>fs.stat 用来获取文件状态</p>\n<pre><code class=\"language-js\"><span class=\"hljs-keyword\">var</span> fs = <span class=\"hljs-built_in\">require</span>(<span class=\"hljs-string\">\"fs\"</span>);\n<span class=\"hljs-comment\">/*\n    读取文件的状态；\n    fs.stat(path,callback);\n    callback有两个参数；err，stats；stats是一个fs.Stats对象；\n    如果发生错误err.code是常见错误之一；\n 不建议在调用 fs.open() 、fs.readFile() 或 fs.writeFile() 之前使用 fs.stat() 检查一个文件是否存在。 作为替代，用户代码应该直接打开/读取/写入文件，当文件无效时再处理错误。\n 如果要检查一个文件是否存在且不操作它，推荐使用 fs.access()。\n */</span>\nfs.stat(<span class=\"hljs-string\">\"./wenjian.txt\"</span>,<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span>(<span class=\"hljs-params\">err,stats</span>)</span>{\n    <span class=\"hljs-built_in\">console</span>.log(err);\n    <span class=\"hljs-built_in\">console</span>.log(stats);\n<span class=\"hljs-comment\">//    获取文件的大小；</span>\n    <span class=\"hljs-built_in\">console</span>.log(stats.size);\n<span class=\"hljs-comment\">//    获取文件最后一次访问的时间；</span>\n    <span class=\"hljs-built_in\">console</span>.log(stats.atime.toLocaleString());\n<span class=\"hljs-comment\">//    文件创建的时间；</span>\n    <span class=\"hljs-built_in\">console</span>.log(stats.birthtime.toLocaleString());\n<span class=\"hljs-comment\">//    文件最后一次修改时间；</span>\n    <span class=\"hljs-built_in\">console</span>.log(stats.mtime.toLocaleString());\n<span class=\"hljs-comment\">//    状态发生变化的时间；</span>\n    <span class=\"hljs-built_in\">console</span>.log(stats.ctime.toLocaleString())\n<span class=\"hljs-comment\">//判断是否是目录；是返回true；不是返回false；</span>\n    <span class=\"hljs-built_in\">console</span>.log(stats.isFile())\n<span class=\"hljs-comment\">//    判断是否是文件；是返回true、不是返回false；</span>\n    <span class=\"hljs-built_in\">console</span>.log(stats.isDirectory())\n})\n<span class=\"hljs-comment\">// --------------------- </span>\n<span class=\"hljs-comment\">// 作者：sunlizhen </span>\n<span class=\"hljs-comment\">// 来源：CSDN </span>\n<span class=\"hljs-comment\">// 原文：https://blog.csdn.net/sunlizhen/article/details/78016202 </span>\n<span class=\"hljs-comment\">// 版权声明：本文为博主原创文章，转载请附上博文链接！</span></code></pre>\n</section><section><h2 id=\"1387359068\">判断[文件/目录]是否存在 - fs.access(path[, mode], callback)</h2><pre><code class=\"language-js\"><span class=\"hljs-keyword\">var</span> fs = <span class=\"hljs-built_in\">require</span>(<span class=\"hljs-string\">\"fs\"</span>);\n<span class=\"hljs-comment\">/*\n-----判断文件和目录是否存在；\nfs.access(path[, mode], callback);\npath:判断的文件名；\ncallback：回调函数；\n */</span>\nfs.access(<span class=\"hljs-string\">\"./wenjian.txt\"</span>,<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span>(<span class=\"hljs-params\">err</span>)</span>{\n<span class=\"hljs-comment\">//    文件和目录不存在的情况下；</span>\n    <span class=\"hljs-keyword\">if</span>(err.code == <span class=\"hljs-string\">\"ENOENT\"</span>){\n        <span class=\"hljs-built_in\">console</span>.log(<span class=\"hljs-string\">\"文件和目录不存在\"</span>)\n    }\n})\n<span class=\"hljs-comment\">/*\n 不建议在调用 fs.open() 、 fs.readFile() 或 fs.writeFile() 之前使用 fs.access() 检查一个文件的可访问性\n */</span>\n<span class=\"hljs-comment\">//不建议使用：</span>\nfs.access(<span class=\"hljs-string\">\"./wenjian.txt\"</span>,<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span>(<span class=\"hljs-params\">err</span>)</span>{\n    <span class=\"hljs-keyword\">if</span>(!err){\n        <span class=\"hljs-built_in\">console</span>.log(<span class=\"hljs-string\">\"文件已经存在\"</span>);\n        <span class=\"hljs-keyword\">return</span>;\n    }\n    fs.open(<span class=\"hljs-string\">\"./wenjian.txt\"</span>,<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span>(<span class=\"hljs-params\">err</span>)</span>{\n        <span class=\"hljs-built_in\">console</span>.log(err)\n    })\n})\n<span class=\"hljs-comment\">//推荐使用；</span>\nfs.open(<span class=\"hljs-string\">\"./wenjian.txt\"</span>,<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span>(<span class=\"hljs-params\">err,fd</span>)</span>{\n    cnsole.log(err)\n})\n<span class=\"hljs-comment\">// --------------------- </span>\n<span class=\"hljs-comment\">// 作者：sunlizhen </span>\n<span class=\"hljs-comment\">// 来源：CSDN </span>\n<span class=\"hljs-comment\">// 原文：https://blog.csdn.net/sunlizhen/article/details/78016157 </span>\n<span class=\"hljs-comment\">// 版权声明：本文为博主原创文章，转载请附上博文链接！</span></code></pre>\n</section><section><h2 id=\"2319939491\">判断[文件/目录]是否存在 - fs.exists(弃用)</h2><p> <code>fs.exists(path)</code> <strong>nodejs 9.0弃用</strong></p>\n<p>对应的同步方法 <code>fs.existsSync(path)</code> ，这个还可以用</p>\n</section><section><h2 id=\"1378298050\">读取文件 fs.readFile</h2><p>读取不存在文件会报错</p>\n<pre><code class=\"language-js\"><span class=\"hljs-selector-tag\">fs</span><span class=\"hljs-selector-class\">.readFile</span>(<span class=\"hljs-selector-tag\">file</span><span class=\"hljs-selector-attr\">[, options]</span>, <span class=\"hljs-selector-tag\">callback</span>)\n<span class=\"hljs-selector-tag\">fs</span><span class=\"hljs-selector-class\">.readFileSync</span>(<span class=\"hljs-selector-tag\">file</span><span class=\"hljs-selector-attr\">[, options]</span>)</code></pre>\n<pre><code class=\"language-js\"><span class=\"hljs-comment\">// 默认获取二进制数据。参数设置为utf8将获取文本数据</span>\nfs.readFile(<span class=\"hljs-string\">'note_data/index.html'</span>, <span class=\"hljs-string\">'utf8'</span>, <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">err, data</span>) </span>{\n    <span class=\"hljs-keyword\">if</span> (err) {\n      <span class=\"hljs-built_in\">console</span>.log(err)\n      <span class=\"hljs-keyword\">return</span>\n    }\n    <span class=\"hljs-built_in\">console</span>.log(<span class=\"hljs-built_in\">arguments</span>)\n})\n\n<span class=\"hljs-comment\">// 同步</span>\n<span class=\"hljs-keyword\">let</span> data = fs.readFileSync(<span class=\"hljs-string\">'note_data/index.html'</span>, <span class=\"hljs-string\">'utf8'</span>)\n</code></pre>\n</section><section><h2 id=\"2092436126\">改名(文件名，目录名)</h2><pre><code class=\"language-js\"><span class=\"hljs-built_in\">fs</span>.<span class=\"hljs-built_in\">rename</span>(oldPath, newPath, callback)\n<span class=\"hljs-built_in\">fs</span>.renameSync(oldPath, newPath)</code></pre>\n<p>oldPath, newPath必须相同级数，可以完全一样，只能修改末级</p>\n</section><section><h2 id=\"87055947\">删除</h2><section><h3 id=\"1760389645\">标准删</h3><p>只能删除文件</p>\n<pre><code class=\"language-js\"><span class=\"hljs-built_in\">fs</span>.unlink(<span class=\"hljs-built_in\">path</span>, callback)\n<span class=\"hljs-built_in\">fs</span>.unlinkSync(<span class=\"hljs-built_in\">path</span>)</code></pre>\n<pre><code class=\"language-js\">fs.unlink(<span class=\"hljs-string\">'/tmp/hello.txt'</span>, <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">err</span>) </span>{\n    <span class=\"hljs-keyword\">if</span> (err) <span class=\"hljs-keyword\">throw</span> err;\n    <span class=\"hljs-built_in\">console</span>.log(<span class=\"hljs-string\">'successfully deleted /tmp/hello'</span>);\n});\n</code></pre>\n<p>只能删除空目录</p>\n<pre><code><span class=\"hljs-built_in\">fs</span>.<span class=\"hljs-built_in\">rmdir</span>(<span class=\"hljs-built_in\">path</span>, callback)</code></pre></section><section><h3 id=\"1255202323\">递归删：第三方扩展</h3><p>删除指定目录下的所有文件和目录</p>\n<p>使用 <a href=\"https://github.com/jprichardson/node-fs-extra\">fs-extra</a> ，或者使用 <a href=\"https://github.com/isaacs/rimraf\">rimraf</a></p>\n<p>fs-extra 的 <a href=\"https://github.com/jprichardson/node-fs-extra/blob/master/docs/remove-sync.md\">remove-sync</a> 示例</p>\n<pre><code class=\"language-js\"><span class=\"hljs-keyword\">const</span> fs = <span class=\"hljs-built_in\">require</span>(<span class=\"hljs-string\">'fs-extra'</span>)\n\n<span class=\"hljs-comment\">// remove file</span>\nfs.removeSync(<span class=\"hljs-string\">'/tmp/myfile'</span>)\n\nfs.removeSync(<span class=\"hljs-string\">'/home/jprichardson'</span>) <span class=\"hljs-comment\">// I just deleted my entire HOME directory.</span></code></pre>\n</section></section><section><h2 id=\"2082920386\">创建目录</h2><p>fs.mkdir(path[, mode], callback)<br>fs.mkdirSync(path[, mode])</p>\n<p>只能在已存在的目录下创建，越级创建将报错</p>\n</section><section><h2 id=\"709296185\">写/创建 文件</h2><ul>\n<li>将内容写入文件。</li>\n<li>有文件将直接替换现有内容，没有将创建新的并写入。</li>\n<li>路径不存在将无法写入</li>\n</ul>\n<p>语法</p>\n<pre><code class=\"language-js\"><span class=\"hljs-selector-tag\">fs</span><span class=\"hljs-selector-class\">.writeFile</span>(<span class=\"hljs-selector-tag\">file</span>, <span class=\"hljs-selector-tag\">data</span><span class=\"hljs-selector-attr\">[, options]</span>, <span class=\"hljs-selector-tag\">callback</span>)\n<span class=\"hljs-selector-tag\">fs</span><span class=\"hljs-selector-class\">.writeFileSync</span>(<span class=\"hljs-selector-tag\">file</span>, <span class=\"hljs-selector-tag\">data</span><span class=\"hljs-selector-attr\">[, options]</span>)</code></pre>\n<p>例子</p>\n<pre><code class=\"language-js\">fs.writeFile(<span class=\"hljs-string\">'note_data/hello.txt'</span>, <span class=\"hljs-string\">'hello'</span>,<span class=\"hljs-string\">'utf8'</span>, <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span>(<span class=\"hljs-params\">err</span>) </span>{\n  <span class=\"hljs-keyword\">if</span>(err) <span class=\"hljs-keyword\">throw</span> err;\n  <span class=\"hljs-built_in\">console</span>.log(<span class=\"hljs-string\">'File write completed'</span>);\n});\n\nfs.writeFileSync(<span class=\"hljs-string\">'note_data/hello.txt'</span>, <span class=\"hljs-string\">'hello'</span>,<span class=\"hljs-string\">'utf8'</span>);</code></pre>\n<p>或直接使用 fs-extra 的 <a href=\"hhttps://github.com/jprichardson/node-fs-extra/blob/master/docs/outputFile-sync.md\">outputFileSync</a>、<a href=\"https://github.com/jprichardson/node-fs-extra/blob/master/docs/outputJson-sync.md\">outputJsonSync</a>，路径不存在也能进行写入</p>\n<pre><code class=\"language-js\"><span class=\"hljs-built_in\">fs</span>.outputJsonSync(<span class=\"hljs-built_in\">path</span>.resolve(outputPath, 'data-demo-list.json'), worksList)</code></pre>\n</section><section><h2 id=\"183944347\">copy</h2><p>使用 <a href=\"https://github.com/jprichardson/node-fs-extra\">fs-extra</a></p>\n<p><a href=\"https://github.com/jprichardson/node-fs-extra/blob/master/docs/copy.md\">copy 文档</a></p>\n<p><a href=\"https://github.com/jprichardson/node-fs-extra/blob/master/docs/copy-sync.md\">copySync 文档</a></p>\n<p>copySync 示例</p>\n<pre><code class=\"language-js\"><span class=\"hljs-keyword\">const</span> fs = <span class=\"hljs-built_in\">require</span>(<span class=\"hljs-string\">'fs-extra'</span>)\n\n<span class=\"hljs-comment\">// copy file</span>\nfs.copySync(<span class=\"hljs-string\">'/tmp/myfile'</span>, <span class=\"hljs-string\">'/tmp/mynewfile'</span>)\n\n<span class=\"hljs-comment\">// copy directory, even if it has subdirectories or files</span>\nfs.copySync(<span class=\"hljs-string\">'/tmp/mydir'</span>, <span class=\"hljs-string\">'/tmp/mynewdir'</span>)\n\n<span class=\"hljs-comment\">// 支持过滤</span>\n<span class=\"hljs-keyword\">const</span> filterFunc = <span class=\"hljs-function\">(<span class=\"hljs-params\">src, dest</span>) =&gt;</span> {\n  <span class=\"hljs-comment\">// your logic here</span>\n  <span class=\"hljs-comment\">// it will be copied if return true</span>\n}\nfs.copySync(<span class=\"hljs-string\">'/tmp/mydir'</span>, <span class=\"hljs-string\">'/tmp/mynewdir'</span>, { <span class=\"hljs-attr\">filter</span>: filterFunc })</code></pre>\n</section></section><section><h1 id=\"1225439272\">服务端部署</h1><section><h2 id=\"3050294037\">node 服务启动框架</h2><p><a href=\"https://blog.csdn.net/maquealone/article/details/79550120\">https://blog.csdn.net/maquealone/article/details/79550120</a></p>\n<p><a href=\"https://www.cnblogs.com/zhoujie/p/nodejs4.html\">https://www.cnblogs.com/zhoujie/p/nodejs4.html</a></p>\n<p><a href=\"https://www.cnblogs.com/chris-oil/p/6239097.html\">https://www.cnblogs.com/chris-oil/p/6239097.html</a></p>\n<section><h3 id=\"2128702588\"><a href=\"https://github.com/Unitech/pm2\">pm2 进程管理工具</a> - 生产环境</h3><p>适用于网站访问量比较大,需要完整的监控界面</p>\n<p>支持异常自动重启</p>\n<p>运行管理多个进程程序</p>\n<p>除了nodejs，还<a href=\"https://pm2.io/doc/en/runtime/guide/process-management/?utm_source=github#manage-any-application-type\">支持其他语言程序</a> </p>\n<pre><code class=\"language-sh\"><span class=\"hljs-comment\"># 运行js</span>\n<span class=\"hljs-attribute\">pm2</span> start app.js\n<span class=\"hljs-comment\"># 支持命令</span>\npm2 start http-server -- /usr/website</code></pre>\n<section><h4 id=\"1895397500\">使用配置文件启动</h4><p><a href=\"https://www.cnblogs.com/chyingp/p/pm2-documentation.html\">参考文档</a></p>\n<p>pm2.config.json</p>\n<pre><code class=\"language-json\">{\n  <span class=\"hljs-string\">\"name\"</span>        : <span class=\"hljs-string\">\"nginx\"</span>, <span class=\"hljs-comment\">// 应用名称</span>\n  <span class=\"hljs-string\">\"script\"</span>      : <span class=\"hljs-string\">\"./nginx.exe\"</span>, <span class=\"hljs-comment\">// 实际启动脚本</span>\n  <span class=\"hljs-string\">\"cwd\"</span>         : <span class=\"hljs-string\">\"./\"</span>, <span class=\"hljs-comment\">// 当前工作路径</span>\n  <span class=\"hljs-string\">\"watch\"</span>: [ <span class=\"hljs-comment\">// 监控变化的目录，一旦变化，自动重启</span>\n    <span class=\"hljs-string\">\"conf\"</span>\n  ],\n  <span class=\"hljs-string\">\"ignore_watch\"</span> : [ <span class=\"hljs-comment\">// 从监控目录中排除</span>\n    <span class=\"hljs-string\">\"node_modules\"</span>, \n    <span class=\"hljs-string\">\"logs\"</span>,\n    <span class=\"hljs-string\">\"public\"</span>\n  ],\n  <span class=\"hljs-string\">\"watch_options\"</span>: {\n    <span class=\"hljs-string\">\"followSymlinks\"</span>: <span class=\"hljs-literal\">false</span>\n  },\n  <span class=\"hljs-string\">\"error_file\"</span> : <span class=\"hljs-string\">\"./logs/app-err.log\"</span>, <span class=\"hljs-comment\">// 错误日志路径</span>\n  <span class=\"hljs-string\">\"out_file\"</span>   : <span class=\"hljs-string\">\"./logs/app-out.log\"</span>, <span class=\"hljs-comment\">// 普通日志路径</span>\n  <span class=\"hljs-string\">\"env\"</span>: {\n      <span class=\"hljs-string\">\"NODE_ENV\"</span>: <span class=\"hljs-string\">\"production\"</span> <span class=\"hljs-comment\">// 环境参数，当前指定为生产环境</span>\n  }\n}</code></pre>\n</section></section><section><h3 id=\"2300721790\">nodemon - 开发环境</h3><p>支持修改自动重启</p>\n</section><section><h3 id=\"3920074446\">其他启动框架</h3><ol>\n<li>supervisor 是开发环境用。Python(2.4+) 开发的</li>\n<li>forever 管理多个站点，每个站点访问量不大，不需要监控。</li>\n<li>node-dev</li>\n</ol>\n"})