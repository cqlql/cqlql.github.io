window['cb_单元测试']({"outline":{"children":[{"index":0,"level":1,"name":"karma 中使用 Chrome Headless","children":[]},{"index":1,"level":1,"name":"入门、工具列表...","children":[{"index":2,"level":2,"name":"工具列表","children":[]},{"index":3,"level":2,"name":"好处","children":[]},{"index":4,"level":2,"name":"webdriver 实验","children":[]},{"index":5,"level":2,"name":"参考学习","children":[]}]},{"index":6,"level":1,"name":"20170828 环境搭建总结，测试开始：带dom测试","children":[{"index":7,"level":2,"name":"需要安装的包","children":[]},{"index":8,"level":2,"name":"增加 dom 测试：karma-chai-dom 包","children":[]},{"index":9,"level":2,"name":"给 webpack 增加 sourcemap：karma-sourcemap-loader 包","children":[]},{"index":10,"level":2,"name":"karma.conf.js 配置参考，可直接用","children":[]},{"index":11,"level":2,"name":"测试用例语法：mocha + chai","children":[{"index":12,"level":3,"name":"dom 测试, 完全的浏览器 dom api","children":[]},{"index":13,"level":3,"name":"异步测试","children":[]}]},{"index":14,"level":2,"name":"更详细的测试后报告 <a href=\"https://www.npmjs.com/package/karma-spec-reporter\">karma-spec-reporter</a>","children":[]},{"index":15,"level":2,"name":"开始测试","children":[{"index":16,"level":3,"name":"cli","children":[]},{"index":17,"level":3,"name":"Node.js API","children":[]}]},{"index":18,"level":2,"name":"常用插件","children":[]}]},{"index":19,"level":1,"name":"config 选项","children":[{"index":20,"level":2,"name":"plugins","children":[]}]},{"index":21,"level":1,"name":"jasmine","children":[{"index":22,"level":2,"name":"beforeEach、beforeAll","children":[]}]},{"index":23,"level":1,"name":"mocha API 使用","children":[{"index":24,"level":2,"name":"异步测试","children":[]},{"index":25,"level":2,"name":"only","children":[]}]},{"index":26,"level":1,"name":"思想","children":[]},{"index":27,"level":1,"name":"环境：karma + mocha + chai","children":[{"index":28,"level":2,"name":"这里涉及的工具库：","children":[]},{"index":29,"level":2,"name":"需要安装的包","children":[]},{"index":30,"level":2,"name":"karma.config.js 参考","children":[]},{"index":31,"level":2,"name":"问题解决，注意项：","children":[{"index":32,"level":3,"name":"karma 有依赖缺失问题：","children":[]}]},{"index":33,"level":2,"name":"test.js 代码说明范例","children":[]}]}],"name":"单元测试"},"content":"<section><h1 id=\"karma 中使用 Chrome Headless\" data-index=0>karma 中使用 Chrome Headless</h1><p>需安装 <code>karma-chrome-launcher</code> 插件，之前一直有装，只是使用的是有头版。</p><pre><code class=language-js><span class=hljs-built_in>module</span>.exports = <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params>config</span>) </span>{\n  config.set({\n    <span class=hljs-comment>// browsers: ['Chrome'], // 有头</span>\n    browsers: [<span class=hljs-string>'ChromeHeadless'</span>] <span class=hljs-comment>// 无头</span>\n  })\n}</code></pre></section><section><h1 id=入门、工具列表... data-index=1>入门、工具列表...</h1><section><h2 id=工具列表 data-index=2>工具列表</h2><ul><li>测试管理工具：<a href=http://karma-runner.github.io/1.0/index.html>Karma</a></li><li>测试框架：<a href=https://mochajs.org/ >Mocha</a></li><li>断言库：Jest、Jasmine、<a href=http://chaijs.com/guide/ >chai.js</a></li><li>接口模拟 <a href=https://www.easy-mock.com/ >easy mock</a> 似乎无法本地代理此模拟接口</li><li>reactjs 测试： <a href=http://airbnb.io/enzyme/ >enzyme</a></li><li>web app|站点 测试：<a href=http://nightwatchjs.org/ >Nightwatch.js</a></li></ul><p>可以这么组合：karma + Mocha + chai.js、Karma + Jasmine</p></section><section><h2 id=好处 data-index=3>好处</h2><ul><li>放心大胆重构：代码重构时可保证安全性，即保证功能完整</li><li>测试用例相当于API文档</li><li>迫使编写更易于维护的代码：因为需尽量做到让编写的每个单元都可单独测试</li></ul></section><section><h2 id=\"webdriver 实验\" data-index=4>webdriver 实验</h2><p><a href=https://www.npmjs.com/package/selenium-webdriver>可模拟浏览器点击的测试框架：selenium-webdriver</a></p><p><a href=http://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/index_exports_WebElement.html>http://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/index_exports_WebElement.html</a></p><pre><code class=language-js><span class=hljs-keyword>var</span> webdriver = <span class=hljs-built_in>require</span>(<span class=hljs-string>'selenium-webdriver'</span>),\n    By = webdriver.By,\n    until = webdriver.until;\n\n<span class=hljs-keyword>var</span> driver = <span class=hljs-keyword>new</span> webdriver.Builder()\n    .forBrowser(<span class=hljs-string>'firefox'</span>)\n    .build();\n\ndriver.get(<span class=hljs-string>'https://www.baidu.com/'</span>);\ndriver.findElement(By.id(<span class=hljs-string>'kw'</span>)).sendKeys(<span class=hljs-string>'123'</span>);\ndriver.findElement(By.id(<span class=hljs-string>'su'</span>)).click();\ndriver.wait(until.titleIs(<span class=hljs-string>'百度一下，你就知道'</span>), <span class=hljs-number>1000</span>);\ndriver.quit();</code></pre></section><section><h2 id=参考学习 data-index=5>参考学习</h2><p><a href=https://www.douban.com/note/334051223/ >为什么要做测试？karma的使用</a></p><p><a href=https://github.com/tmallfe/tmallfe.github.io/issues/37>https://github.com/tmallfe/tmallfe.github.io/issues/37</a></p><p><a href=http://www.jianshu.com/p/6726c0410650>http://www.jianshu.com/p/6726c0410650</a></p><p><a href=http://taobaofed.org/blog/2016/01/08/karma-origin/ >http://taobaofed.org/blog/2016/01/08/karma-origin/</a></p></section></section><section><h1 id=\"20170828 环境搭建总结，测试开始：带dom测试\" data-index=6>20170828 环境搭建总结，测试开始：带dom测试</h1><section><h2 id=需要安装的包 data-index=7>需要安装的包</h2><p>webpack</p><p>babel-core babel-loader babel-plugin-external-helpers babel-plugin-transform-runtime babel-preset-env</p><p>相关测试包：<br>chai karma karma-chai karma-chai-dom karma-phantomjs-launcher karma-chrome-launcher karma-mocha karma-sourcemap-loader karma-webpack mocha</p></section><section><h2 id=\"增加 dom 测试：karma-chai-dom 包\" data-index=8>增加 dom 测试：karma-chai-dom 包</h2><p>karma-chai-dom 包下载后即支持：<a href=http://chaijs.com/plugins/chai-dom/ >语法文档</a></p><p>而且直接支持浏览器的 dom 操作</p></section><section><h2 id=\"给 webpack 增加 sourcemap：karma-sourcemap-loader 包\" data-index=9>给 webpack 增加 sourcemap：karma-sourcemap-loader 包</h2><p><a href=https://www.npmjs.com/package/karma-webpack>karma-webpack 文档</a> 中有说明</p><p>karma.conf.js 中需要的配置，2个地方：preprocessors、webpack.devtool</p><pre><code class=language-js><span class=hljs-built_in>module</span>.exports = <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params>config</span>) </span>{\n  config.set({\n    <span class=hljs-attr>preprocessors</span>: {\n      <span class=hljs-string>'./test/*.js'</span>:[<span class=hljs-string>'webpack'</span>, <span class=hljs-string>'sourcemap'</span>]\n    },\n    <span class=hljs-attr>webpack</span>:{\n      <span class=hljs-attr>devtool</span>: <span class=hljs-string>'inline-source-map'</span>\n    }\n  })\n}\n</code></pre></section><section><h2 id=\"karma.conf.js 配置参考，可直接用\" data-index=10>karma.conf.js 配置参考，可直接用</h2><pre><code class=language-js><span class=hljs-keyword>let</span> path = <span class=hljs-built_in>require</span>(<span class=hljs-string>'path'</span>)\n\n<span class=hljs-built_in>module</span>.exports = <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params>config</span>) </span>{\n  config.set({\n    <span class=hljs-attr>frameworks</span>: [<span class=hljs-string>'mocha'</span>,<span class=hljs-string>'chai-dom'</span>,<span class=hljs-string>'chai'</span>],\n    <span class=hljs-attr>files</span>: [\n      <span class=hljs-string>'./test/*.js'</span>\n    ],\n    <span class=hljs-attr>preprocessors</span>: {\n      <span class=hljs-string>'./test/*.js'</span>:[<span class=hljs-string>'webpack'</span>, <span class=hljs-string>'sourcemap'</span>]\n    },\n    <span class=hljs-attr>webpack</span>:{\n      <span class=hljs-attr>module</span>: {\n        <span class=hljs-comment>//加载器配置</span>\n        rules: [\n          {\n            <span class=hljs-attr>test</span>: <span class=hljs-regexp>/\\.js$/</span>,\n            <span class=hljs-attr>include</span>:[\n              path.resolve(__dirname, <span class=hljs-string>'src'</span>),\n              path.resolve(__dirname,<span class=hljs-string>'test'</span>)\n            ],\n            <span class=hljs-comment>// exclude: /node_modules/,</span>\n            loader: <span class=hljs-string>'babel-loader'</span>,\n            <span class=hljs-attr>options</span>: {\n                <span class=hljs-string>\"presets\"</span>: [\n                    <span class=hljs-string>\"env\"</span>\n                ],\n                <span class=hljs-string>\"plugins\"</span>: [\n                    <span class=hljs-string>\"transform-runtime\"</span>\n                ]\n            }\n          }\n        ]\n      },\n      <span class=hljs-attr>devtool</span>: <span class=hljs-string>'inline-source-map'</span>\n    },\n    <span class=hljs-attr>webpackMiddleware</span>: {\n      <span class=hljs-attr>noInfo</span>: <span class=hljs-literal>true</span>\n    },\n    <span class=hljs-attr>browsers</span>: [<span class=hljs-string>'Chrome'</span><span class=hljs-comment>/*, 'PhantomJS'*/</span>],\n  })\n}\n</code></pre></section><section><h2 id=\"测试用例语法：mocha + chai\" data-index=11>测试用例语法：mocha + chai</h2><section><h3 id=\"dom 测试, 完全的浏览器 dom api\" data-index=12>dom 测试, 完全的浏览器 dom api</h3><p>当然，也有断言语法</p><pre><code class=language-js>\ndescribe(<span class=hljs-string>'fullPreloader 功能测试'</span>, <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n\n  it(<span class=hljs-string>'第一次调用 close，是否报错'</span>, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params></span>) </span>{\n\n    fullPreloader.close()\n\n  })\n  <span class=hljs-comment>//</span>\n  it(<span class=hljs-string>'执行 show，是否增加 show'</span>, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params></span>) </span>{\n\n    fullPreloader.show()\n\n    <span class=hljs-keyword>let</span> elem = <span class=hljs-built_in>document</span>.querySelector(<span class=hljs-string>'.preloader-full'</span>)\n\n    elem.should.have.class(<span class=hljs-string>'show'</span>)\n\n\n  })\n})\n</code></pre></section><section><h3 id=异步测试 data-index=13>异步测试</h3><p>需在回调中执行 done，通知测试结束</p><pre><code class=language-js>describe(<span class=hljs-string>'天气信息获取'</span>, <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n\n  it(<span class=hljs-string>'天气信息获取'</span>, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params>done</span>) </span>{\n    weatherInfoLoad(<span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params>d</span>) </span>{\n      <span class=hljs-built_in>console</span>.log(d)\n      done()\n    })\n  })\n})</code></pre></section></section><section><h2 id=\"更详细的测试后报告 karma-spec-reporter\" data-index=14>更详细的测试后报告 <a href=https://www.npmjs.com/package/karma-spec-reporter>karma-spec-reporter</a></h2><p>先安装插件：karma-spec-reporter</p><p>再配置：karma.conf.js</p><pre><code class=language-js><span class=hljs-built_in>module</span>.exports = <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params>config</span>) </span>{\n  config.set({\n      <span class=hljs-attr>reporters</span>: [<span class=hljs-string>\"spec\"</span>]\n      plugins: [<span class=hljs-string>\"karma-spec-reporter\"</span>],\n\n  })\n}</code></pre></section><section><h2 id=开始测试 data-index=15>开始测试</h2><section><h3 id=cli data-index=16>cli</h3><p>package.json</p><pre><code class=language-json>{\n  <span class=hljs-string>\"scripts\"</span>: {\n    <span class=hljs-string>\"test\"</span>: <span class=hljs-string>\"karma start\"</span>\n  }\n}</code></pre><pre><code>npm run test</code></pre></section><section><h3 id=\"Node.js API\" data-index=17>Node.js API</h3><p><a href=https://karma-runner.github.io/1.0/dev/public-api.html>文档</a></p><pre><code class=language-js><span class=hljs-keyword>const</span> karma = <span class=hljs-built_in>require</span>(<span class=hljs-string>'karma'</span>)\n<span class=hljs-keyword>const</span> cfg = karma.config;\n<span class=hljs-keyword>const</span> path = <span class=hljs-built_in>require</span>(<span class=hljs-string>'path'</span>);\n<span class=hljs-keyword>const</span> karmaConfig = cfg.parseConfig(path.resolve(<span class=hljs-string>'../karma.conf.js'</span>));\n\n<span class=hljs-keyword>var</span> Server = karma.Server\n<span class=hljs-keyword>var</span> server = <span class=hljs-keyword>new</span> Server(karmaConfig, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params>exitCode</span>) </span>{\n  <span class=hljs-built_in>console</span>.log(<span class=hljs-string>'Karma has exited with '</span> + exitCode)\n  process.exit(exitCode)\n})\n\nserver.start()\n</code></pre></section></section><section><h2 id=常用插件 data-index=18>常用插件</h2><p>karma.conf.js</p><pre><code><span class=hljs-built_in>module</span>.exports = <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params>config</span>) </span>{\n    config.set({\n        <span class=hljs-attr>plugins</span>: [\n            <span class=hljs-string>\"karma-webpack\"</span>,\n            <span class=hljs-string>\"karma-chai\"</span>,\n            <span class=hljs-string>\"karma-chai-dom\"</span>,\n            <span class=hljs-string>'karma-coverage'</span>,\n            <span class=hljs-string>\"karma-spec-reporter\"</span>,\n            <span class=hljs-string>\"karma-sourcemap-loader\"</span>,\n            <span class=hljs-string>\"karma-mocha\"</span>,\n            <span class=hljs-comment>// 'karma-phantomjs-launcher',</span>\n            <span class=hljs-string>\"karma-chrome-launcher\"</span>\n        ]\n    })\n}\n</code></pre></section></section><section><h1 id=\"config 选项\" data-index=19>config 选项</h1><section><h2 id=plugins data-index=20>plugins</h2><p>此选项可选：</p><ul><li>给值：只加载指定插件</li><li>不给值：加载所有插件</li></ul><p>karma.conf.js</p><pre><code><span class=hljs-built_in>module</span>.exports = <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params>config</span>) </span>{\n    config.set({\n        <span class=hljs-attr>plugins</span>: [\n            <span class=hljs-string>\"karma-webpack\"</span>,\n            <span class=hljs-string>\"karma-chai\"</span>,\n            <span class=hljs-string>\"karma-chai-dom\"</span>,\n            <span class=hljs-string>'karma-coverage'</span>,\n            <span class=hljs-string>\"karma-spec-reporter\"</span>,\n            <span class=hljs-string>\"karma-sourcemap-loader\"</span>,\n            <span class=hljs-string>\"karma-mocha\"</span>,\n            <span class=hljs-comment>// 'karma-phantomjs-launcher',</span>\n            <span class=hljs-string>\"karma-chrome-launcher\"</span>\n        ]\n    })\n}\n</code></pre></section></section><section><h1 id=jasmine data-index=21>jasmine</h1><section><h2 id=beforeEach、beforeAll data-index=22>beforeEach、beforeAll</h2><pre><code class=language-js><span class=hljs-keyword>var</span> i = <span class=hljs-number>0</span>\ndescribe(<span class=hljs-string>'test-foo'</span>, <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n  <span class=hljs-comment>// 每次 it 都会执行</span>\n  <span class=hljs-comment>// 只限于当前 describe</span>\n  beforeEach(<span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n    <span class=hljs-built_in>console</span>.log(<span class=hljs-string>'beforeEach'</span>, i++)\n  });\n\n  <span class=hljs-comment>// 只执行一次</span>\n  beforeAll(<span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n    <span class=hljs-built_in>console</span>.log(<span class=hljs-string>'beforeAll'</span>)\n  });\n\n\n  it(<span class=hljs-string>'it1'</span>, <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n\n\n  })\n\n  it(<span class=hljs-string>'it2'</span>, <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n\n  })\n})\n\ndescribe(<span class=hljs-string>'test-bar'</span>, <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n  it(<span class=hljs-string>'it3'</span>, <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n\n  })\n})\n</code></pre></section></section><section><h1 id=\"mocha API 使用\" data-index=23>mocha API 使用</h1><section><h2 id=异步测试 data-index=24>异步测试</h2><p><strong>可利用此方式查看输出到测试浏览器中的对象：</strong> 测试执行完后，测试浏览器输出的对象被销毁，无法查看，可通过此方式暂停运行，查看输出的对象</p><p>默认超时时间为2s，超时后自动执行done。超时时间可设置</p><pre><code class=language-js>describe(<span class=hljs-string>'加法函数的测试'</span>, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params></span>) </span>{\n  it(<span class=hljs-string>'测试应该5000毫秒后结束'</span>, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params>done</span>) </span>{\n    <span class=hljs-keyword>this</span>.timeout(<span class=hljs-number>5000</span>);<span class=hljs-comment>//设置超时时间为5s</span>\n    <span class=hljs-keyword>var</span> x = <span class=hljs-literal>true</span>;\n    <span class=hljs-keyword>var</span> f = <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params></span>) </span>{\n      x = <span class=hljs-literal>false</span>;\n      expect(x).to.be.not.ok;\n      done(); <span class=hljs-comment>// 通知Mocha测试结束</span>\n    };\n    setTimeout(f, <span class=hljs-number>4000</span>);\n  });\n});</code></pre></section><section><h2 id=only data-index=25>only</h2><pre><code class=language-js>describe(<span class=hljs-string>'Array'</span>, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params></span>) </span>{\n  describe.only(<span class=hljs-string>'#indexOf()'</span>, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params></span>) </span>{\n    it.only(<span class=hljs-string>'should return -1 unless present'</span>, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params></span>) </span>{\n      <span class=hljs-comment>// ...</span>\n    });\n  });\n});</code></pre></section></section><section><h1 id=思想 data-index=26>思想</h1><p>确保所有组件功能的完整。不再担心某次调整而坏了全局</p><p>只测试功能接口。没必要测试内部所有实现</p></section><section><h1 id=\"环境：karma + mocha + chai\" data-index=27>环境：karma + mocha + chai</h1><section><h2 id=这里涉及的工具库： data-index=28>这里涉及的工具库：</h2><ul><li>karma：测试管理工具</li><li>mocha：测试框架</li><li>chai：断言库</li><li>webpack：实现 es6 语法转换</li></ul></section><section><h2 id=需要安装的包 data-index=29>需要安装的包</h2><p>测试相关：<br>mocha karma-mocha chai karma-chai</p><p>测试浏览器环境：<br>karma-chrome-launcher karma-phantomjs-launcher</p><p>es6 转换相关：<br>webpack<br>babel-core babel-loader babel-preset-env <a href=https://www.npmjs.com/package/karma-webpack>karma-webpack</a></p></section><section><h2 id=\"karma.config.js 参考\" data-index=30>karma.config.js 参考</h2><p>这里说明一下，并不需要设置 plugins 选项</p><pre><code class=language-js><span class=hljs-comment>// Karma configuration</span>\n\n<span class=hljs-keyword>let</span> path = <span class=hljs-built_in>require</span>(<span class=hljs-string>'path'</span>)\n\n<span class=hljs-built_in>module</span>.exports = <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params>config</span>) </span>{\n  config.set({\n\n    <span class=hljs-comment>// base path that will be used to resolve all patterns (eg. files, exclude)</span>\n    basePath: <span class=hljs-string>''</span>,\n\n\n    <span class=hljs-comment>// frameworks to use</span>\n    <span class=hljs-comment>// available frameworks: https://npmjs.org/browse/keyword/karma-adapter</span>\n    frameworks: [<span class=hljs-string>'mocha'</span>,<span class=hljs-string>'chai'</span>],\n\n\n    <span class=hljs-comment>// list of files / patterns to load in the browser</span>\n    files: [\n      <span class=hljs-string>'./test/*.js'</span>\n    ],\n\n\n    <span class=hljs-comment>// list of files to exclude</span>\n    <span class=hljs-comment>// exclude: [</span>\n    <span class=hljs-comment>//   'You can use glob patterns, eg. \"js/*.js\" or \"test/**/*Spec.js\".',</span>\n    <span class=hljs-comment>//   'You can use glob patterns, eg. \"js/*.js\" or \"test/**/*Spec.js\".'</span>\n    <span class=hljs-comment>// ],</span>\n\n    <span class=hljs-comment>// preprocess matching files before serving them to the browser</span>\n    <span class=hljs-comment>// available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor</span>\n    preprocessors: {\n        <span class=hljs-string>'./test/*.js'</span>:[<span class=hljs-string>'webpack'</span>]\n    },\n\n    <span class=hljs-attr>webpack</span>:{\n      <span class=hljs-attr>module</span>: {\n        <span class=hljs-comment>//加载器配置</span>\n        rules: [\n          {\n            <span class=hljs-attr>test</span>: <span class=hljs-regexp>/\\.js$/</span>,\n            <span class=hljs-attr>exclude</span>: <span class=hljs-regexp>/node_modules/</span>,\n            <span class=hljs-attr>loader</span>: <span class=hljs-string>'babel-loader'</span>,\n            <span class=hljs-attr>options</span>: {\n              <span class=hljs-string>\"presets\"</span>: [<span class=hljs-string>\"env\"</span>],\n            }\n          }\n        ]\n      },\n    },\n    <span class=hljs-attr>webpackMiddleware</span>: {\n      <span class=hljs-attr>noInfo</span>: <span class=hljs-literal>true</span>\n    },\n\n    <span class=hljs-comment>// test results reporter to use</span>\n    <span class=hljs-comment>// possible values: 'dots', 'progress'</span>\n    <span class=hljs-comment>// available reporters: https://npmjs.org/browse/keyword/karma-reporter</span>\n    reporters: [<span class=hljs-string>'progress'</span>],\n\n    <span class=hljs-comment>// web server port</span>\n    port: <span class=hljs-number>9876</span>,\n\n    <span class=hljs-comment>// enable / disable colors in the output (reporters and logs)</span>\n    colors: <span class=hljs-literal>true</span>,\n\n    <span class=hljs-comment>// level of logging</span>\n    <span class=hljs-comment>// possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG</span>\n    logLevel: config.LOG_INFO,\n\n    <span class=hljs-comment>// enable / disable watching file and executing tests whenever any file changes</span>\n    autoWatch: <span class=hljs-literal>true</span>,\n\n    <span class=hljs-comment>// start these browsers</span>\n    <span class=hljs-comment>// available browser launchers: https://npmjs.org/browse/keyword/karma-launcher</span>\n    browsers: [<span class=hljs-string>'Chrome'</span>, <span class=hljs-string>'PhantomJS'</span>],\n\n    <span class=hljs-comment>// Continuous Integration mode</span>\n    <span class=hljs-comment>// if true, Karma captures browsers, runs the tests and exits</span>\n    singleRun: <span class=hljs-literal>false</span>,\n\n    <span class=hljs-comment>// Concurrency level</span>\n    <span class=hljs-comment>// how many browser should be started simultaneous</span>\n    concurrency: <span class=hljs-literal>Infinity</span>\n  })\n}\n</code></pre></section><section><h2 id=问题解决，注意项： data-index=31>问题解决，注意项：</h2><section><h3 id=\"karma 有依赖缺失问题：\" data-index=32>karma 有依赖缺失问题：</h3><p>勿使用淘宝镜像命令 cnpm 安装。 <strong>可使用 yarn</strong>，速度也很快</p></section></section><section><h2 id=\"test.js 代码说明范例\" data-index=33>test.js 代码说明范例</h2><pre><code><span class=hljs-keyword>import</span> {isNum,isString} <span class=hljs-keyword>from</span> <span class=hljs-string>'../src/index'</span>\n\ndescribe(<span class=hljs-string>'index.js的测试'</span>, <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n    it(<span class=hljs-string>'1应该是数字'</span>, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params></span>) </span>{\n        <span class=hljs-comment>// expect(isNum(1)).to.be.true</span>\n        isNum(<span class=hljs-number>1</span>).should.equal(<span class=hljs-literal>true</span>)\n    })\n    it(<span class=hljs-string>'\"1\" 应该是字符'</span>, <span class=hljs-function><span class=hljs-keyword>function</span>(<span class=hljs-params></span>) </span>{\n        <span class=hljs-comment>// expect(isString('1')).to.be.true</span>\n        isString(<span class=hljs-string>'1'</span>).should.equal(<span class=hljs-literal>true</span>)\n    })\n})\n</code></pre></section></section>"})