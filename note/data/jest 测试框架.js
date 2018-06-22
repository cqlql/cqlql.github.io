window['cb_jest 测试框架']({"outline":{"children":[{"index":0,"level":1,"name":"nodejs 测试问题","children":[{"index":1,"level":2,"name":"会根据 <code>.babelrc</code> 文件进行 babel 转化","children":[]}]}],"name":"jest 测试框架"},"content":"<section><h1 id=\"nodejs 测试问题\" data-index=0>nodejs 测试问题</h1><section><h2 id=\"会根据 .babelrc 文件进行 babel 转化\" data-index=1>会根据 <code>.babelrc</code> 文件进行 babel 转化</h2><p><a href=https://facebook.github.io/jest/docs/zh-Hans/getting-started.html#%E4%BD%BF%E7%94%A8-babel>使用 babel - 官方解释</a></p><p><strong>解决</strong></p><ol><li>更改 pageage.json</li></ol><pre><code class=language-js><span class=hljs-comment>// package.json</span>\n{\n  <span class=hljs-string>\"jest\"</span>: {\n    <span class=hljs-string>\"transform\"</span>: {}\n  }\n}</code></pre><ol start=2><li>使用配置文件</li></ol><pre><code class=language-js><span class=hljs-comment>// jest.config</span>\n<span class=hljs-built_in>module</span>.exports = {\n  <span class=hljs-attr>name</span>: <span class=hljs-string>\"my-project\"</span>,\n  <span class=hljs-attr>transform</span>: {},\n  <span class=hljs-attr>testEnvironment</span>: <span class=hljs-string>\"node\"</span>\n}</code></pre></section></section>"})