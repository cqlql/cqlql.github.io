window['cb_工程-rollup']({"outline":{"children":[{"index":0,"level":1,"name":"只能使用 import 导入模块，但可通过插件改变","children":[]},{"index":1,"level":1,"name":"外部模块不会解析成es5","children":[]},{"index":2,"level":1,"name":"插件","children":[{"index":3,"level":2,"name":"rollup-plugin-node-resolve 打包外部模块","children":[]},{"index":4,"level":2,"name":"rollup-plugin-commonjs","children":[]},{"index":5,"level":2,"name":"rollup-plugin-babel","children":[]},{"index":6,"level":2,"name":"rollup-plugin-uglify","children":[]}]},{"index":7,"level":1,"name":"rollup.config","children":[]},{"index":8,"level":1,"name":"加 banner 注释","children":[]},{"index":9,"level":1,"name":"0 快速使用-node API","children":[{"index":10,"level":2,"name":"涉及到的包","children":[]},{"index":11,"level":2,"name":"options","children":[]},{"index":12,"level":2,"name":".babelrc","children":[]},{"index":13,"level":2,"name":"rollup.rollup 使用","children":[]},{"index":14,"level":2,"name":"rollup.watch 使用","children":[]}]},{"index":15,"level":1,"name":"使支持 Promise","children":[]},{"index":16,"level":1,"name":"问题","children":[{"index":17,"level":2,"name":"用 babel 解析部分 es5 语法都会报错","children":[]}]}],"name":"工程-rollup"},"content":"<section><h1 id=\"只能使用 import 导入模块，但可通过插件改变\" data-index=0>只能使用 import 导入模块，但可通过插件改变</h1><p>通过 rollup-plugin-commonjs 插件使支持 require 模块</p></section><section><h1 id=外部模块不会解析成es5 data-index=1>外部模块不会解析成es5</h1><p>需借用 <a href=#rollup-plugin-babel>rollup-plugin-babel</a> 插件</p></section><section><h1 id=插件 data-index=2>插件</h1><section><h2 id=\"rollup-plugin-node-resolve 打包外部模块\" data-index=3>rollup-plugin-node-resolve 打包外部模块</h2><p>允许将外部模块编译进来，比如把 node_modules 中的模块。当然，也可以自定义的模块。<br>只需指定一个文件夹名称，似乎会寻找硬盘的所有位置，很强大（指定路径将无效）</p><pre><code class=language-js>plugins: [\n  resolve({\n    <span class=hljs-attr>customResolveOptions</span>: {\n      <span class=hljs-attr>moduleDirectory</span>: [<span class=hljs-string>'node_modules'</span>,<span class=hljs-string>'github'</span>]\n    }\n  })\n]</code></pre></section><section><h2 id=rollup-plugin-commonjs data-index=4>rollup-plugin-commonjs</h2><p>使支持 require 模块。否则只能 import 模块</p></section><section><h2 id=rollup-plugin-babel data-index=5>rollup-plugin-babel</h2><p>解析成es5代码。目前所知，必须使用<code>.babelrc</code>配置文件</p><pre><code class=language-js><span class=hljs-selector-tag>export</span> <span class=hljs-selector-tag>default</span> {\n    <span class=hljs-attribute>plugins</span>: [\n        <span class=hljs-built_in>babel</span>({\n            // 使用数组，排除多个目录或文件\n            exclude: [<span class=hljs-string>'node_modules/**'</span>,<span class=hljs-string>'./src/katex.min.js'</span>],\n        })\n    ]\n}\n</code></pre></section><section><h2 id=rollup-plugin-uglify data-index=6>rollup-plugin-uglify</h2><p>代码压缩</p><pre><code class=language-js><span class=hljs-keyword>const</span> uglify = <span class=hljs-built_in>require</span>(<span class=hljs-string>'rollup-plugin-uglify'</span>);\n\n<span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n    <span class=hljs-attr>plugins</span>: [\n        uglify()\n    ]\n}</code></pre></section></section><section><h1 id=rollup.config data-index=7>rollup.config</h1><p>目前常用：</p><ul><li><code>cjs</code>: 打包成nodejs模块</li><li><code>iife</code>:<ul><li>构建成可通过 <code>&amp;lt;script&amp;gt;</code> 标签使用的js。</li><li>不能直接构建导出的模块</li></ul></li><li><code>umd</code>:<ul><li>browser(AMD+全局) + nodejs</li><li>需与moduleName选项一起使用</li><li>可直接构建模块</li></ul></li></ul></section><section><h1 id=\"加 banner 注释\" data-index=8>加 banner 注释</h1><p>需自己拼</p><pre><code><span class=hljs-comment>// generate code and a sourcemap</span>\n<span class=hljs-keyword>const</span> { code, map } = <span class=hljs-keyword>await</span> bundle.generate(outputOptions);\n\n</code></pre></section><section><h1 id=\"0 快速使用-node API\" data-index=9>0 快速使用-node API</h1><section><h2 id=涉及到的包 data-index=10>涉及到的包</h2><p>babel-plugin-external-helpers</p><p>rollup rollup-plugin-commonjs rollup-plugin-babel</p></section><section><h2 id=options data-index=11>options</h2><pre><code class=language-js><span class=hljs-keyword>const</span> rollup = <span class=hljs-built_in>require</span>(<span class=hljs-string>'rollup'</span>);\n<span class=hljs-keyword>const</span> commonjs = <span class=hljs-built_in>require</span>(<span class=hljs-string>'rollup-plugin-commonjs'</span>);\n<span class=hljs-keyword>const</span> babel = <span class=hljs-built_in>require</span>(<span class=hljs-string>'rollup-plugin-babel'</span>);\n\n<span class=hljs-comment>// see below for details on the options</span>\n<span class=hljs-keyword>const</span> inputOptions = {\n  <span class=hljs-attr>input</span>: <span class=hljs-string>'./src/index.js'</span>,\n  <span class=hljs-attr>plugins</span>: [\n    babel({\n      <span class=hljs-attr>include</span>: [<span class=hljs-string>'./src/**'</span>]\n    }),\n    commonjs()\n  ]\n};\n<span class=hljs-keyword>const</span> outputOptions = {\n  <span class=hljs-attr>format</span>: <span class=hljs-string>'cjs'</span>,\n  <span class=hljs-comment>// format: 'umd',</span>\n  <span class=hljs-comment>// name: 'mccard',</span>\n  file: <span class=hljs-string>'dist/index.cjs.js'</span>\n};\n</code></pre></section><section><h2 id=.babelrc data-index=12>.babelrc</h2><pre><code>{\n  <span class=hljs-string>\"presets\"</span>: [\n    [\n      <span class=hljs-string>\"env\"</span>,\n      {\n        <span class=hljs-string>\"modules\"</span>: <span class=hljs-literal>false</span>\n      }\n    ]\n  ],\n  <span class=hljs-string>\"plugins\"</span>: [\n    <span class=hljs-string>\"external-helpers\"</span>\n  ]\n}</code></pre></section><section><h2 id=\"rollup.rollup 使用\" data-index=13>rollup.rollup 使用</h2><pre><code class=language-js><span class=hljs-keyword>async</span> <span class=hljs-function><span class=hljs-keyword>function</span> <span class=hljs-title>build</span>(<span class=hljs-params></span>) </span>{\n  <span class=hljs-comment>// create a bundle</span>\n  <span class=hljs-keyword>const</span> bundle = <span class=hljs-keyword>await</span> rollup.rollup(inputOptions);\n\n  <span class=hljs-comment>// generate code and a sourcemap</span>\n  <span class=hljs-keyword>const</span> { code, map } = <span class=hljs-keyword>await</span> bundle.generate(outputOptions);\n\n  <span class=hljs-comment>// or write the bundle to disk</span>\n  <span class=hljs-keyword>await</span> bundle.write(outputOptions);\n}\n\nbuild()\n</code></pre></section><section><h2 id=\"rollup.watch 使用\" data-index=14>rollup.watch 使用</h2><pre><code class=language-js><span class=hljs-keyword>let</span> watchOptions = <span class=hljs-built_in>Object</span>.assign(inputOptions, {\n\n  <span class=hljs-attr>output</span>: [outputOptions],\n  <span class=hljs-attr>watch</span>: {\n    <span class=hljs-attr>include</span>:<span class=hljs-string>'./src/**'</span>\n  }\n});\n\n<span class=hljs-keyword>const</span> watcher = rollup.watch(watchOptions);\n\nwatcher.on(<span class=hljs-string>'event'</span>, event =&gt; {\n  <span class=hljs-comment>// event.code can be one of:</span>\n  <span class=hljs-comment>//   START        — the watcher is (re)starting</span>\n  <span class=hljs-comment>//   BUNDLE_START — building an individual bundle</span>\n  <span class=hljs-comment>//   BUNDLE_END   — finished building a bundle</span>\n  <span class=hljs-comment>//   END          — finished building all bundles</span>\n  <span class=hljs-comment>//   ERROR        — encountered an error while bundling</span>\n  <span class=hljs-comment>//   FATAL        — encountered an unrecoverable error</span>\n  <span class=hljs-built_in>console</span>.log(event)\n  <span class=hljs-built_in>console</span>.log(event.code)\n});\n\n<span class=hljs-comment>// stop watching</span>\n<span class=hljs-comment>// watcher.close();</span></code></pre></section></section><section><h1 id=\"使支持 Promise\" data-index=15>使支持 Promise</h1><p>在使用 Promise 等高级特性情况，会自动生成 Promise 实现。默认不生成</p><p>关键设置</p><pre><code><span class=hljs-keyword>let</span> inputOptions = {\n  <span class=hljs-attr>plugins</span>: [\n    babel({\n      <span class=hljs-comment>// 关键</span>\n      plugins: [<span class=hljs-string>'transform-runtime'</span>],\n      <span class=hljs-attr>runtimeHelpers</span>:<span class=hljs-literal>true</span>\n\n    }),\n  ],\n};</code></pre><p>完整示例</p><pre><code class=language-js><span class=hljs-keyword>const</span> commonjs = <span class=hljs-built_in>require</span>(<span class=hljs-string>'rollup-plugin-commonjs'</span>);\n<span class=hljs-keyword>const</span> babel = <span class=hljs-built_in>require</span>(<span class=hljs-string>'rollup-plugin-babel'</span>);\n<span class=hljs-keyword>const</span> resolve = <span class=hljs-built_in>require</span>(<span class=hljs-string>'rollup-plugin-node-resolve'</span>);\n\n<span class=hljs-keyword>const</span> bundle = <span class=hljs-keyword>await</span> rollup.rollup({\n  <span class=hljs-attr>input</span>: <span class=hljs-string>'./src/index.js'</span>,\n  <span class=hljs-attr>plugins</span>: [\n    babel({\n      <span class=hljs-attr>plugins</span>: [<span class=hljs-string>'transform-runtime'</span>],\n      <span class=hljs-attr>runtimeHelpers</span>:<span class=hljs-literal>true</span>\n    }),\n    resolve({\n      <span class=hljs-attr>customResolveOptions</span>: {\n        <span class=hljs-attr>moduleDirectory</span>: <span class=hljs-string>'node_modules'</span>\n      }\n    }),\n    commonjs(),\n    <span class=hljs-comment>// uglify()</span>\n  ]\n});\n\n  <span class=hljs-keyword>await</span> bundle.write({\n    <span class=hljs-attr>format</span>: <span class=hljs-string>'cjs'</span>,\n    <span class=hljs-attr>name</span>: <span class=hljs-string>'corejs'</span>,\n    <span class=hljs-attr>file</span>: <span class=hljs-string>'./dist/index.cjs.js'</span>, <span class=hljs-comment>// equivalent to --output</span>\n\n    sourcemap: <span class=hljs-literal>true</span>\n  });</code></pre></section><section><h1 id=问题 data-index=16>问题</h1><section><h2 id=\"用 babel 解析部分 es5 语法都会报错\" data-index=17>用 babel 解析部分 es5 语法都会报错</h2><p>对于已经解析过的一定要排除出去，否则可能会报错</p><pre><code><span class=hljs-keyword>const</span> bundle = <span class=hljs-keyword>await</span> rollup.rollup({\n  <span class=hljs-attr>input</span>: <span class=hljs-string>'./src/index.js'</span>,\n  <span class=hljs-attr>plugins</span>: [\n    babel({\n      <span class=hljs-attr>exclude</span>: [<span class=hljs-string>'../../node_modules/**'</span>,<span class=hljs-string>'./modules/weather/index.js'</span>],\n    })\n  ]\n});</code></pre></section></section>"})