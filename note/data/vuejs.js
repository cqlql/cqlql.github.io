window['cb_vuejs']({"outline":{"children":[{"index":0,"level":1,"name":"实例未挂载，其子组件不会初始","children":[]},{"index":1,"level":1,"name":"计算属性可进行设置操作","children":[]},{"index":2,"level":1,"name":"keep-alive 缓存","children":[]},{"index":3,"level":1,"name":"css scoped 后代选择器注意","children":[]},{"index":4,"level":1,"name":"JSX","children":[{"index":5,"level":2,"name":"循环","children":[]},{"index":6,"level":2,"name":"class","children":[]},{"index":7,"level":2,"name":"依然支持指令","children":[]},{"index":8,"level":2,"name":"slot","children":[]}]},{"index":9,"level":1,"name":"vue 单文件 + webpack","children":[{"index":10,"level":2,"name":"相关包","children":[]},{"index":11,"level":2,"name":"css 导入先后：js 与 style 方式","children":[]},{"index":12,"level":2,"name":"js(import) css 是否归 vue-loader 管 / 异步单文件 js(import) css提取","children":[]},{"index":13,"level":2,"name":"js(import)导入 css，实现不重复","children":[]},{"index":14,"level":2,"name":"某种情况下说，vue-loader 的提取没有意义","children":[]},{"index":15,"level":2,"name":"vue-loader webpack 配置","children":[]},{"index":16,"level":2,"name":"vue-loader webpack 配置 css loader 写法2","children":[]}]},{"index":17,"level":1,"name":"事件","children":[{"index":18,"level":2,"name":"模板中 event 获取","children":[]}]},{"index":19,"level":1,"name":"单文件组件","children":[{"index":20,"level":2,"name":"关于 export default 是否与 es6 常规相符","children":[]}]},{"index":21,"level":1,"name":"各种问题","children":[{"index":22,"level":2,"name":"vue-loader 问题","children":[{"index":23,"level":3,"name":"使用 postcss 时，不能直接使用 plugins 选项，需使用 postcss.config.js 文件","children":[]}]},{"index":24,"level":2,"name":"vue 单文件问题","children":[{"index":25,"level":3,"name":"style 部分无法热更新","children":[]},{"index":26,"level":3,"name":"js import 方式导入的 css 无效。异步单文件情况","children":[]}]}]},{"index":27,"level":1,"name":"实例中 Vue 构造器获取","children":[]},{"index":28,"level":1,"name":"插件编写","children":[]},{"index":29,"level":1,"name":"数据响应","children":[{"index":30,"level":2,"name":"组件之间响应传值","children":[{"index":31,"level":3,"name":"可借助引用类型特性","children":[]}]},{"index":32,"level":2,"name":"展示页，编辑组件。技巧","children":[]},{"index":33,"level":2,"name":"object 增删改","children":[{"index":34,"level":3,"name":"增","children":[]},{"index":35,"level":3,"name":"删","children":[]},{"index":36,"level":3,"name":"改","children":[]}]},{"index":37,"level":2,"name":"array 增删改","children":[{"index":38,"level":3,"name":"增","children":[]},{"index":39,"level":3,"name":"删","children":[]},{"index":40,"level":3,"name":"改","children":[]},{"index":41,"level":3,"name":"数组替换、数组清空","children":[]}]},{"index":42,"level":2,"name":"数据响应举例。watch 监听问题","children":[{"index":43,"level":3,"name":"会触发更新，并且重新绑定情况","children":[]},{"index":44,"level":3,"name":"不会触发更新情况","children":[]}]}]},{"index":45,"level":1,"name":"标签属性","children":[{"index":46,"level":2,"name":"不带值的标签属性可解析为 true","children":[]}]},{"index":47,"level":1,"name":"模板中的函数与过滤器","children":[]},{"index":48,"level":1,"name":"注意事项","children":[{"index":49,"level":2,"name":"在组件编写时就应该考虑组件被复用情况的更新","children":[]}]},{"index":50,"level":1,"name":"状态共享的其他方式","children":[{"index":51,"level":2,"name":"使用根实例 $root。子组件内依然可享受数据绑定更新","children":[]},{"index":52,"level":2,"name":"局部使用 Vue 实例，实现局部共享","children":[]}]},{"index":53,"level":1,"name":"生命周期","children":[{"index":54,"level":2,"name":"beforeCreate","children":[]},{"index":55,"level":2,"name":"created 此时可以操作属性","children":[]},{"index":56,"level":2,"name":"beforeMount","children":[]},{"index":57,"level":2,"name":"mounted 此时可以操作元素，$el已存在","children":[]},{"index":58,"level":2,"name":"beforeUpdate","children":[]},{"index":59,"level":2,"name":"updated","children":[]},{"index":60,"level":2,"name":"activated","children":[]},{"index":61,"level":2,"name":"deactivated","children":[]},{"index":62,"level":2,"name":"beforeDestroy","children":[]},{"index":63,"level":2,"name":"destroyed","children":[]}]}],"name":"vuejs"},"content":"<section><h1 id=实例未挂载，其子组件不会初始 data-index=0>实例未挂载，其子组件不会初始</h1><p>main.js</p><pre><code class=language-js><span class=hljs-keyword>import</span> Vue <span class=hljs-keyword>from</span> <span class=hljs-string>'vue'</span>\n<span class=hljs-keyword>import</span> App <span class=hljs-keyword>from</span> <span class=hljs-string>'./app.vue'</span>\n\n<span class=hljs-keyword>new</span> Vue({\n  <span class=hljs-comment>// el: '#app', // 不挂在元素</span>\n  created () {\n    <span class=hljs-built_in>console</span>.log(<span class=hljs-string>'created'</span>) <span class=hljs-comment>// 触发</span>\n  },\n  mounted () {\n    <span class=hljs-built_in>console</span>.log(<span class=hljs-string>'mounted'</span>) <span class=hljs-comment>// 不触发</span>\n  },\n  router,\n  <span class=hljs-attr>template</span>: <span class=hljs-string>'&lt;app/&gt;'</span>,\n  <span class=hljs-attr>components</span>: {\n    App\n  }\n})\n</code></pre><p>App.vue</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>template</span>&gt;</span>\n  <span class=hljs-tag>&lt;<span class=hljs-name>div</span>&gt;</span>App<span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>template</span>&gt;</span>\n\n<span class=hljs-tag>&lt;<span class=hljs-name>script</span>&gt;</span><span class=javascript>\n<span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  beforeCreate () {\n    <span class=hljs-built_in>console</span>.log(<span class=hljs-string>'app beforeCreate'</span>) <span class=hljs-comment>// 不触发</span>\n  },\n  created () {\n    <span class=hljs-built_in>console</span>.log(<span class=hljs-string>'app created'</span>) <span class=hljs-comment>// 不触发</span>\n  },\n  mounted () {\n    <span class=hljs-built_in>console</span>.log(<span class=hljs-string>'app mounted'</span>) <span class=hljs-comment>// 不触发</span>\n  }\n}\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>script</span>&gt;</span>\n</code></pre></section><section><h1 id=计算属性可进行设置操作 data-index=1>计算属性可进行设置操作</h1><p>计算属性返回的如果是对象引用，那么，可通过次计算属性设置其成员值</p></section><section><h1 id=\"keep-alive 缓存\" data-index=2>keep-alive 缓存</h1><p><code>&lt;router-view&gt;&lt;/router-view&gt;</code> 也是支持的</p><p>父组件的销毁同样会销毁 keep-alive 的子组件</p></section><section><h1 id=\"css scoped 后代选择器注意\" data-index=3>css scoped 后代选择器注意</h1><p>scoped 不会影响到子组件。<br>所以，如果子组件css写在父组件css中，父组件使用scoped，css就会无效</p><p>这种转换结果看上去总觉得不够好</p><pre><code><span class=hljs-tag>&lt;<span class=hljs-name>style</span> <span class=hljs-attr>scoped</span>&gt;</span><span class=css>\n<span class=hljs-selector-class>.example</span> <span class=hljs-selector-tag>span</span>{\n  <span class=hljs-attribute>color</span>: red;\n}\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>style</span>&gt;</span>\n\n<span class=hljs-tag>&lt;<span class=hljs-name>template</span>&gt;</span>\n  <span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"example\"</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>span</span>&gt;</span>hi<span class=hljs-tag>&lt;/<span class=hljs-name>span</span>&gt;</span>\n  <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>template</span>&gt;</span>\n</code></pre><p>转换结果：</p><pre><code><span class=hljs-tag>&lt;<span class=hljs-name>style</span>&gt;</span><span class=css>\n<span class=hljs-selector-class>.example</span> <span class=hljs-selector-tag>span</span><span class=hljs-selector-attr>[data-v-f3f3eg9]</span> {\n  <span class=hljs-attribute>color</span>: red;\n}\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>style</span>&gt;</span>\n\n<span class=hljs-tag>&lt;<span class=hljs-name>template</span>&gt;</span>\n  <span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>data-v-4c878eb4</span>=<span class=hljs-string>\"\"</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"example\"</span>&gt;</span><span class=hljs-tag>&lt;<span class=hljs-name>span</span> <span class=hljs-attr>data-v-4c878eb4</span>=<span class=hljs-string>\"\"</span>&gt;</span>hi<span class=hljs-tag>&lt;/<span class=hljs-name>span</span>&gt;</span><span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>template</span>&gt;</span></code></pre></section><section><h1 id=JSX data-index=4>JSX</h1><p><a href=https://github.com/vuejs/babel-plugin-transform-vue-jsx#usage>使用文档</a></p><section><h2 id=循环 data-index=5>循环</h2><pre><code class=language-jsx><span class=hljs-keyword>var</span> MyComponent = Vue.extend({\n  data () {\n    <span class=hljs-keyword>return</span> {\n      <span class=hljs-attr>list</span>: [<span class=hljs-string>'1'</span>, <span class=hljs-string>'2'</span>]\n    }\n  },\n  <span class=hljs-attr>methods</span>: {\n    testfn () {\n      <span class=hljs-built_in>console</span>.log(<span class=hljs-keyword>this</span>)\n    }\n  },\n  render () {\n    <span class=hljs-keyword>let</span> ls = [<span class=xml><span class=hljs-tag>&lt;<span class=hljs-name>li</span>&gt;</span>{this.name}<span class=hljs-tag>&lt;/<span class=hljs-name>li</span>&gt;</span></span>]\n    <span class=hljs-keyword>this</span>.list.forEach(<span class=hljs-function><span class=hljs-params>v</span> =&gt;</span> {\n      ls.push(<span class=xml><span class=hljs-tag>&lt;<span class=hljs-name>li</span>&gt;</span>{v}<span class=hljs-tag>&lt;/<span class=hljs-name>li</span>&gt;</span></span>)\n    })\n    <span class=hljs-keyword>return</span> (\n      <span class=xml><span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"top-list-select\"</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>ul</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"l-mu\"</span>&gt;</span>\n          {ls}\n        <span class=hljs-tag>&lt;/<span class=hljs-name>ul</span>&gt;</span>\n\n      <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span></span>\n    )\n  }\n})\n</code></pre></section><section><h2 id=class data-index=6>class</h2><pre><code><span class=hljs-tag>&lt;<span class=hljs-name>dl</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"m-group\"</span>&gt;</span>2<span class=hljs-tag>&lt;/<span class=hljs-name>dl</span>&gt;</span></code></pre><pre><code class=language-jsx><span class=hljs-keyword>let</span> isFold = <span class=hljs-number>1</span>\n<span class=hljs-keyword>return</span> <span class=xml><span class=hljs-tag>&lt;<span class=hljs-name>dl</span> <span class=hljs-attr>class</span>=<span class=hljs-string>{[</span>'<span class=hljs-attr>m-group</span>', {<span class=hljs-attr>fold:</span> <span class=hljs-attr>isFold</span>}]}&gt;</span>2<span class=hljs-tag>&lt;/<span class=hljs-name>dl</span>&gt;</span></span></code></pre></section><section><h2 id=依然支持指令 data-index=7>依然支持指令</h2><p>包括集成指令、自定义指令</p><pre><code class=language-jsx>&lt;div <span class=hljs-class><span class=hljs-keyword>class</span></span>=<span class=hljs-string>\"select-box-p\"</span> v-show={<span class=hljs-keyword>this</span>.isMultiple}&gt;<span class=xml><span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span></span></code></pre></section><section><h2 id=slot data-index=8>slot</h2><pre><code class=language-js><span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  render () {\n    <span class=hljs-keyword>return</span> (\n      <span class=xml><span class=hljs-tag>&lt;<span class=hljs-name>div</span>&gt;</span>{this.$slots.default}<span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span></span>\n    )\n  }\n}</code></pre></section></section><section><h1 id=\"vue 单文件 + webpack\" data-index=9>vue 单文件 + webpack</h1><section><h2 id=相关包 data-index=10>相关包</h2><p>vue vue-loader vue-template-compiler</p><p>有时候会漏掉 <code>vue-template-compiler</code> 。。。</p></section><section><h2 id=\"css 导入先后：js 与 style 方式\" data-index=11>css 导入先后：js 与 style 方式</h2><p>js：import 方式</p><p>style：style 嵌入方式</p><p>单文件中同时使用这两种方式，无论style 位置，<strong>js 将先导入，然后才是 style</strong>，符合预想</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>template</span>&gt;</span>\n  <span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"hello\"</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>h1</span>&gt;</span>{{ msg }}<span class=hljs-tag>&lt;/<span class=hljs-name>h1</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>h2</span>&gt;</span>Essential Links<span class=hljs-tag>&lt;/<span class=hljs-name>h2</span>&gt;</span>\n  <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>template</span>&gt;</span>\n\n<span class=hljs-tag>&lt;<span class=hljs-name>script</span>&gt;</span><span class=javascript>\n<span class=hljs-keyword>import</span> <span class=hljs-string>'../assets/comm.css'</span>\n<span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  <span class=hljs-attr>name</span>: <span class=hljs-string>'hello'</span>,\n  data () {\n    <span class=hljs-keyword>return</span> {\n      <span class=hljs-attr>msg</span>: <span class=hljs-string>'Welcome to Your Vue.js App'</span>\n    }\n  }\n}\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>script</span>&gt;</span>\n\n<span class=hljs-tag>&lt;<span class=hljs-name>style</span> <span class=hljs-attr>scoped</span>&gt;</span><span class=css>\n<span class=hljs-selector-tag>h1</span>, <span class=hljs-selector-tag>h2</span> {\n  <span class=hljs-attribute>font-weight</span>: normal;\n}\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>style</span>&gt;</span></code></pre></section><section><h2 id=\"js(import) css 是否归 vue-loader 管 / 异步单文件 js(import) css提取\" data-index=12>js(import) css 是否归 vue-loader 管 / 异步单文件 js(import) css提取</h2><p>js(import) 方式不归 vue-loader 管。vue-loader 只管 style。</p><p>而且，<strong>外界的css提取依然可以影响</strong></p><p>但，<strong>异步</strong>情况特殊，外css提取，vue-loadert提取都无法生效。</p><p>也就是说，异步包无法提取css？？不，可以提取，但只能提取 js(import) 方式，通过 <code>CommonsChunkPlugin</code> 开启 <code>children:true</code>。 将多处异步包中调用模块提取到父 chunk 中，然后css提取便生效</p><p>也就是说，异步包的 style 方式固定无法提取</p></section><section><h2 id=\"js(import)导入 css，实现不重复\" data-index=13>js(import)导入 css，实现不重复</h2><p><strong>懒加载单文件模块，单文件中 js 方式导入 css，多处导入实现不重复方式：</strong></p><ul><li>入口js 文件导入一次后，多处<strong>异步</strong>单文件中的相同导入不会重复生成</li><li>通过 <code>CommonsChunkPlugin</code>，开启 <code>children:true</code></li></ul></section><section><h2 id=\"某种情况下说，vue-loader 的提取没有意义\" data-index=14>某种情况下说，vue-loader 的提取没有意义</h2></section><section><h2 id=\"vue-loader webpack 配置\" data-index=15>vue-loader webpack 配置</h2><pre><code class=language-js>{\n    <span class=hljs-attr>test</span>: <span class=hljs-regexp>/\\.vue$/</span>,\n    <span class=hljs-attr>loader</span>: <span class=hljs-string>'vue-loader'</span>,\n    <span class=hljs-attr>options</span>: {\n        <span class=hljs-attr>loaders</span>: {\n            <span class=hljs-attr>js</span>: {\n                <span class=hljs-attr>loader</span>: <span class=hljs-string>'babel-loader'</span>,\n                <span class=hljs-attr>include</span>: [\n                    path.resolve(__dirname, <span class=hljs-string>\"src\"</span>)\n                ],\n            },\n            <span class=hljs-comment>// 带提取</span>\n            css: ExtractTextPlugin.extract({\n                <span class=hljs-attr>fallback</span>: <span class=hljs-string>'style-loader'</span>,\n                <span class=hljs-attr>use</span>: [{\n                    <span class=hljs-attr>loader</span>: <span class=hljs-string>'css-loader'</span>,\n                    <span class=hljs-attr>options</span>: {\n                        <span class=hljs-attr>importLoaders</span>: <span class=hljs-number>1</span>,\n                        <span class=hljs-attr>sourceMap</span>: <span class=hljs-literal>true</span>,\n\n                    }\n                }, {\n                    <span class=hljs-attr>loader</span>: <span class=hljs-string>'postcss-loader'</span>,\n                    <span class=hljs-attr>options</span>: {\n                        <span class=hljs-attr>sourceMap</span>: <span class=hljs-string>'inline'</span>\n                    }\n                }]\n            }),\n            <span class=hljs-comment>// 不提取</span>\n            <span class=hljs-comment>// css: {</span>\n            <span class=hljs-comment>//     use: [{</span>\n            <span class=hljs-comment>//         loader: 'style-loader'</span>\n            <span class=hljs-comment>//     }, {</span>\n            <span class=hljs-comment>//         loader: 'css-loader', options: {</span>\n            <span class=hljs-comment>//             importLoaders: 1,</span>\n            <span class=hljs-comment>//             sourceMap: true</span>\n            <span class=hljs-comment>//         }</span>\n            <span class=hljs-comment>//     }, {</span>\n            <span class=hljs-comment>//         loader: 'postcss-loader',</span>\n            <span class=hljs-comment>//         options: {</span>\n            <span class=hljs-comment>//             sourceMap: 'inline',</span>\n            <span class=hljs-comment>//             // parser</span>\n            <span class=hljs-comment>//         }</span>\n            <span class=hljs-comment>//     }]</span>\n            <span class=hljs-comment>// }</span>\n\n            scss: ExtractTextPlugin.extract({\n                <span class=hljs-attr>fallback</span>: <span class=hljs-string>'style-loader'</span>,\n                <span class=hljs-attr>use</span>: [{\n                    <span class=hljs-attr>loader</span>: <span class=hljs-string>'css-loader'</span>,\n                    <span class=hljs-attr>options</span>: {\n                        <span class=hljs-attr>importLoaders</span>: <span class=hljs-number>1</span>,\n                        <span class=hljs-attr>sourceMap</span>: <span class=hljs-literal>true</span>,\n\n                    }\n                }, {\n                    <span class=hljs-attr>loader</span>: <span class=hljs-string>'sass-loader'</span>,\n                    <span class=hljs-attr>options</span>: {\n                        <span class=hljs-attr>sourceMap</span>: <span class=hljs-literal>true</span>,\n                        <span class=hljs-attr>includePaths</span>: [<span class=hljs-string>'E:/_work/mobile_webview/smallpitch.webview/src/modules/base-libs/css'</span>]\n                    }\n                }]\n            }),\n\n        }\n    }\n}</code></pre></section><section><h2 id=\"vue-loader webpack 配置 css loader 写法2\" data-index=16>vue-loader webpack 配置 css loader 写法2</h2><p>上面不提取写法似乎有问题。待详细测试</p><pre><code class=language-js>{\n  <span class=hljs-attr>test</span>: <span class=hljs-regexp>/\\.vue$/</span>,\n  <span class=hljs-attr>loader</span>: <span class=hljs-string>'vue-loader'</span>,\n  <span class=hljs-attr>options</span>: {\n    <span class=hljs-attr>loaders</span>: {\n      <span class=hljs-attr>js</span>: {\n        <span class=hljs-attr>loader</span>: <span class=hljs-string>'babel-loader'</span>,\n        <span class=hljs-attr>include</span>: [\n          resolve(<span class=hljs-string>\"src\"</span>)\n        ],\n      },\n      <span class=hljs-attr>postcss</span>: <span class=hljs-string>'vue-style-loader!css-loader?sourceMap=true!postcss-loader?sourceMap=true'</span>,\n      <span class=hljs-attr>scss</span>: <span class=hljs-string>'vue-style-loader!css-loader?sourceMap=true!sass-loader?sourceMap=true'</span>\n    }\n  }\n}</code></pre></section></section><section><h1 id=事件 data-index=17>事件</h1><section><h2 id=\"模板中 event 获取\" data-index=18>模板中 event 获取</h2><p>$event</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>input</span> <span class=hljs-attr>type</span>=<span class=hljs-string>\"number\"</span> <span class=hljs-attr>:value</span>=<span class=hljs-string>\"book.number\"</span> @<span class=hljs-attr>input</span>=<span class=hljs-string>\"updateNumber($event.target,book)\"</span>&gt;</span></code></pre></section></section><section><h1 id=单文件组件 data-index=19>单文件组件</h1><section><h2 id=\"关于 export default 是否与 es6 常规相符\" data-index=20>关于 export default 是否与 es6 常规相符</h2><p>组件中 <code>export default</code> 与es6常规相符合，即模块只会被创建执行一次，并且在一个函数域中。<br>组件多个调用情况，下例中的data变量将被共享</p><p>而且 template 最终应该是被解析成组件 render 函数选项</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>template</span>&gt;</span>\n<span class=hljs-tag>&lt;<span class=hljs-name>div</span>&gt;</span>{{num}}<span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>template</span>&gt;</span>\n\n<span class=hljs-tag>&lt;<span class=hljs-name>script</span>&gt;</span><span class=javascript>\n  <span class=hljs-keyword>let</span> data = {\n    <span class=hljs-attr>num</span>: <span class=hljs-number>1</span>\n  }\n  <span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n    <span class=hljs-attr>name</span>: <span class=hljs-string>'comp'</span>,\n    data () {\n      <span class=hljs-keyword>return</span> data\n    },\n    created () {\n      data.num++\n    }\n  }\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>script</span>&gt;</span>\n</code></pre></section></section><section><h1 id=各种问题 data-index=21>各种问题</h1><section><h2 id=\"vue-loader 问题\" data-index=22>vue-loader 问题</h2><section><h3 id=\"使用 postcss 时，不能直接使用 plugins 选项，需使用 postcss.config.js 文件\" data-index=23>使用 postcss 时，不能直接使用 plugins 选项，需使用 postcss.config.js 文件</h3></section></section><section><h2 id=\"vue 单文件问题\" data-index=24>vue 单文件问题</h2><section><h3 id=\"style 部分无法热更新\" data-index=25>style 部分无法热更新</h3><p>使用 vue.esm.js 即可</p></section><section><h3 id=\"js import 方式导入的 css 无效。异步单文件情况\" data-index=26>js import 方式导入的 css 无效。异步单文件情况</h3><p>强调，跟提取无关，包括外提取、vue-loader 提取，跟异步有关。<br>首先异步包 css 无法被提取。不管是 vue-loader 还是外 css loader 提取，提取都无效。<br>而且单文件 js(import) 归外 css loader 管，如果没有设置 style-loader，将不会被增加。</p><p>注：style 方式正常</p><p>解决，增加<code>fallback: &#39;style-loader&#39;</code>。</p><p>总之，<code>fallback: &#39;style-loader&#39;</code>可用来处理异步包中的 js(import) 导入的css</p><pre><code class=language-js>rules: [{\n  <span class=hljs-attr>test</span>: <span class=hljs-regexp>/\\.css$/</span>,\n  <span class=hljs-attr>use</span>: ExtractTextPlugin.extract({\n    <span class=hljs-attr>fallback</span>: <span class=hljs-string>'style-loader'</span>,\n    <span class=hljs-attr>use</span>: [<span class=hljs-string>'css-loader'</span>,<span class=hljs-string>'postcss-loader'</span>]\n  }),\n}]</code></pre></section></section></section><section><h1 id=\"实例中 Vue 构造器获取\" data-index=27>实例中 Vue 构造器获取</h1><p><code>this.$root.constructor</code></p><p>单文件组件有时可能需要使用 Vue 构造器对象，来使用部分全局 API。</p><pre><code class=language-js><span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  mounted () {\n    <span class=hljs-comment>// 正确方式</span>\n    <span class=hljs-built_in>console</span>.log(<span class=hljs-keyword>this</span>.$root.constructor)\n    <span class=hljs-comment>// 错误方式，获取的是 VueComponent 组件构造器</span>\n    <span class=hljs-built_in>console</span>.log(<span class=hljs-keyword>this</span>.constructor)\n\n  }\n}</code></pre></section><section><h1 id=插件编写 data-index=28>插件编写</h1><p>简单3步。详情看<a href=https://cn.vuejs.org/v2/guide/plugins.html>官方文档</a>。下例为添加内部的实例方法</p><p>1 编写</p><pre><code class=language-js><span class=hljs-comment>// ./modules/msg-mobile/simple-msg-vue.js</span>\n\n<span class=hljs-keyword>import</span> simpleMsg <span class=hljs-keyword>from</span> <span class=hljs-string>'./simple-msg'</span>\n<span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  install (Vue) {\n    Vue.prototype.$simpleMsg = <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params>msg</span>) </span>{\n      simpleMsg(msg)\n    }\n  }\n}\n</code></pre><p>2 注册</p><pre><code class=language-js><span class=hljs-comment>// main.js</span>\n<span class=hljs-keyword>import</span> simpleMsg <span class=hljs-keyword>from</span> <span class=hljs-string>'./modules/msg-mobile/simple-msg-vue'</span>\nVue.use(simpleMsg)</code></pre><p>3 插件使用</p><pre><code class=language-js><span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  mounted () {\n    <span class=hljs-keyword>this</span>.$simpleMsg(<span class=hljs-string>'mounted 执行'</span>)\n  }\n}</code></pre></section><section><h1 id=数据响应 data-index=29>数据响应</h1><section><h2 id=组件之间响应传值 data-index=30>组件之间响应传值</h2><section><h3 id=可借助引用类型特性 data-index=31>可借助引用类型特性</h3><p>比如传一个响应数据对象到某子组件。 当然，子组件中直接的覆盖操作是不允许的。 但对响应对象的成员修改是能触发所有相关组件的响应更新的</p></section></section><section><h2 id=展示页，编辑组件。技巧 data-index=32>展示页，编辑组件。技巧</h2><p>一个页面，实现展示+编辑</p><p>虽然数据一样，但不能同时共享一份。因为当用于选择取消编辑便回不去了，后果很严重</p><p>展示页 可弄两份数据，一份源数据，再copy一份。将copy数据传入编辑页，再利用引用类型特性，编辑页对copy数据修改会同步到展示页。</p><pre><code class=language-js>vm.$set(vm.d, <span class=hljs-string>'list'</span>, list)</code></pre></section><section><h2 id=\"object 增删改\" data-index=33>object 增删改</h2><section><h3 id=增 data-index=34>增</h3><p><strong>1 根成员增加</strong></p><p>根成员只能在 data 中以声明方式增加</p><pre><code class=language-js><span class=hljs-selector-tag>new</span> <span class=hljs-selector-tag>Vue</span>({\n    <span class=hljs-attribute>data</span>: {\n        msg: <span class=hljs-string>'hello'</span>\n    }\n})</code></pre><p><strong>2 后代成员增加</strong></p><pre><code class=language-js>vm.$set(vm.d, <span class=hljs-string>'list'</span>, list)</code></pre></section><section><h3 id=删 data-index=35>删</h3><p><strong>1 根成员是否可以删除？还没试</strong></p><p><strong>2 后代成员删除</strong></p><pre><code class=language-js>vm.$<span class=hljs-keyword>delete</span>(target, key)</code></pre><p><strong>注意：使用自带 delete：此方式无法触发更新</strong></p></section><section><h3 id=改 data-index=36>改</h3><p><strong>成员修改</strong> 一般赋值操作即可</p><p><strong>自身替换</strong> 直接赋值替换即可，后代成员都可享受响应更新</p></section></section><section><h2 id=\"array 增删改\" data-index=37>array 增删改</h2><section><h3 id=增 data-index=38>增</h3><p>可通过 object 的方式，也支持 Array 原生方法</p></section><section><h3 id=删 data-index=39>删</h3><p>待实践</p></section><section><h3 id=改 data-index=40>改</h3><p>一般方式即可</p></section><section><h3 id=数组替换、数组清空 data-index=41>数组替换、数组清空</h3><pre><code class=language-js>vm.arr = newArr <span class=hljs-comment>// 直接替换</span>\n\nvm.arr = [] <span class=hljs-comment>// 清空</span></code></pre></section></section><section><h2 id=\"数据响应举例。watch 监听问题\" data-index=42>数据响应举例。watch 监听问题</h2><section><h3 id=会触发更新，并且重新绑定情况 data-index=43>会触发更新，并且重新绑定情况</h3><p>给已绑定字段重新赋值，会触发重新绑定，字段子成员都会重新绑定</p><p>测试例子</p><pre><code class=language-js><span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  data () {\n    <span class=hljs-comment>// 这里声明的所有属性都将绑定</span>\n    <span class=hljs-keyword>return</span> {\n      <span class=hljs-attr>a</span>: {\n        <span class=hljs-attr>b</span>: {\n          <span class=hljs-attr>c</span>: <span class=hljs-number>123</span>\n        }\n      }\n    }\n  },\n  created () {\n\n  },\n  <span class=hljs-attr>methods</span>: {\n    test () {\n      <span class=hljs-comment>// 触发更新，子成员全部重新绑定</span>\n      <span class=hljs-comment>// 同时触发下面的 watch 更改</span>\n      <span class=hljs-keyword>this</span>.a = {\n        <span class=hljs-attr>d</span>: {\n          <span class=hljs-attr>e</span>: <span class=hljs-number>123</span>\n        }\n      }\n    }\n  },\n  <span class=hljs-attr>components</span>: {\n  },\n  <span class=hljs-attr>watch</span>: {\n    <span class=hljs-string>'a.b'</span> (v) {\n      <span class=hljs-built_in>console</span>.log(<span class=hljs-string>'更改 a.b'</span>, v) <span class=hljs-comment>// '更改 a.b', undefined</span>\n    }\n  }\n}</code></pre></section><section><h3 id=不会触发更新情况 data-index=44>不会触发更新情况</h3><pre><code class=language-js><span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  data () {\n    <span class=hljs-keyword>return</span> {\n      <span class=hljs-attr>a</span>: {\n        <span class=hljs-attr>b</span>: {\n          <span class=hljs-attr>c</span>: <span class=hljs-number>123</span>\n        }\n      }\n    }\n  },\n  created () {\n\n  },\n  <span class=hljs-attr>methods</span>: {\n    test () {\n      <span class=hljs-comment>// 新增成员不会触发更新。</span>\n      <span class=hljs-keyword>this</span>.a.d = <span class=hljs-number>123</span>\n      <span class=hljs-comment>// 需借助 this.$set()</span>\n      <span class=hljs-keyword>this</span>.$set(thia.a, <span class=hljs-string>'d'</span>, <span class=hljs-number>123</span>) <span class=hljs-comment>// 绑定，并触发更新</span>\n    }\n  },\n  <span class=hljs-attr>components</span>: {\n  }\n}</code></pre></section></section></section><section><h1 id=标签属性 data-index=45>标签属性</h1><section><h2 id=\"不带值的标签属性可解析为 true\" data-index=46>不带值的标签属性可解析为 true</h2><p>foo.vue</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>template</span>&gt;</span>\n  <span class=hljs-tag>&lt;<span class=hljs-name>bar-component</span> <span class=hljs-attr>group</span>&gt;</span><span class=hljs-tag>&lt;/<span class=hljs-name>bar-component</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>template</span>&gt;</span></code></pre><p>bar-component.vue</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>template</span>&gt;</span>\n  <span class=hljs-tag>&lt;<span class=hljs-name>div</span>&gt;</span>bar<span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>template</span>&gt;</span>\n<span class=hljs-tag>&lt;<span class=hljs-name>script</span>&gt;</span><span class=javascript>\n<span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  <span class=hljs-attr>props</span>: {\n    <span class=hljs-attr>group</span>: {\n      <span class=hljs-attr>type</span>: <span class=hljs-built_in>Boolean</span>\n    }\n  },\n  created () {\n    <span class=hljs-built_in>console</span>.log(<span class=hljs-keyword>this</span>.group) <span class=hljs-comment>// true</span>\n  }\n}\n&lt;script&gt;</span></code></pre></section></section><section><h1 id=模板中的函数与过滤器 data-index=47>模板中的函数与过滤器</h1><p>不相关的值变动也会触发。尽量少在模版中写函数？或者过滤器？</p><p><strong>例子：</strong></p><pre><code class=language-js><span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>v-html</span>=<span class=hljs-string>\"handle(latex)\"</span>&gt;</span><span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n<span class=hljs-tag>&lt;<span class=hljs-name>div</span>&gt;</span>{{msg}}<span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span></code></pre><p>只改变 msg，也会重新触发 handle，即使使用过滤器也一样</p></section><section><h1 id=注意事项 data-index=48>注意事项</h1><section><h2 id=在组件编写时就应该考虑组件被复用情况的更新 data-index=49>在组件编写时就应该考虑组件被复用情况的更新</h2><p>很多情况，可能会将逻辑处理写在生命周期中，组件被复用可能无法更新，此时不要去尝试手动重新加载当前组件(试图重走一遍生命周期)。</p></section></section><section><h1 id=状态共享的其他方式 data-index=50>状态共享的其他方式</h1><p>也就是非 vuex 的方式</p><section><h2 id=\"使用根实例 $root。子组件内依然可享受数据绑定更新\" data-index=51>使用根实例 $root。子组件内依然可享受数据绑定更新</h2></section><section><h2 id=\"局部使用 Vue 实例，实现局部共享\" data-index=52>局部使用 Vue 实例，实现局部共享</h2><p>hello-state.js</p><pre><code class=language-js><span class=hljs-keyword>import</span> Vue <span class=hljs-keyword>from</span> <span class=hljs-string>'vue'</span>\n<span class=hljs-keyword>const</span> vm = <span class=hljs-keyword>new</span> Vue({\n  data () {\n    <span class=hljs-keyword>return</span> {\n      <span class=hljs-attr>d</span>: <span class=hljs-string>'foo'</span>\n    }\n  }\n})\n<span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> vm</code></pre><p>demo.vue</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>template</span>&gt;</span>\n  <span class=hljs-tag>&lt;<span class=hljs-name>div</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"test\"</span>&gt;</span>hello word, {{helloState.d}}<span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>button</span> @<span class=hljs-attr>click</span>=<span class=hljs-string>\"onChangeOtherState\"</span>&gt;</span>改变额外的状态<span class=hljs-tag>&lt;/<span class=hljs-name>button</span>&gt;</span>\n  <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>template</span>&gt;</span>\n\n<span class=hljs-tag>&lt;<span class=hljs-name>script</span>&gt;</span><span class=javascript>\n<span class=hljs-keyword>import</span> helloState <span class=hljs-keyword>from</span> <span class=hljs-string>'./hello-state.js'</span>\n<span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  created () {\n    <span class=hljs-keyword>this</span>.helloState = helloState\n  },\n  <span class=hljs-attr>methods</span>: {\n    onChangeOtherState () {\n      helloState.d = helloState.d === <span class=hljs-string>'bar'</span> ? <span class=hljs-string>'foo'</span> : <span class=hljs-string>'bar'</span>\n    }\n  }\n}\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>script</span>&gt;</span></code></pre></section></section><section><h1 id=生命周期 data-index=53>生命周期</h1><p><a href=https://cn.vuejs.org/v2/api/#%E9%80%89%E9%A1%B9-%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F%E9%92%A9%E5%AD%90>官方文档很详细</a></p><section><h2 id=beforeCreate data-index=54>beforeCreate</h2><p>在实例初始化之后，数据观测 (data observer) 和 event/watcher 事件配置之前被调用。</p><p>此时 data 属性还没绑定监听，也不能操作</p></section><section><h2 id=\"created 此时可以操作属性\" data-index=55>created 此时可以操作属性</h2><p>组件实例创建完成，属性已绑定，属性的操作会触发更新，所以此时可以操作属性了。</p><p>但不能操作DOM元素，DOM还未生成，$el属性还不存在</p></section><section><h2 id=beforeMount data-index=56>beforeMount</h2><p>在挂载开始之前被调用：相关的 render 函数首次被调用。</p></section><section><h2 id=\"mounted 此时可以操作元素，$el已存在\" data-index=57>mounted 此时可以操作元素，$el已存在</h2><p>如果 root 实例挂载了一个文档内元素，当 mounted 被调用时 vm.$el 也在文档内。</p><p>注意 mounted 不会承诺所有的子组件也都一起被挂载。如果你希望等到整个视图都渲染完毕，可以用 vm.$nextTick 替换掉 mounted：</p><pre><code class=language-js>mounted: <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n  <span class=hljs-keyword>this</span>.$nextTick(<span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n    <span class=hljs-comment>// Code that will run only after the</span>\n    <span class=hljs-comment>// entire view has been rendered</span>\n  })\n}</code></pre></section><section><h2 id=beforeUpdate data-index=58>beforeUpdate</h2><p>组件更新之前</p></section><section><h2 id=updated data-index=59>updated</h2><p>组件更新之后</p></section><section><h2 id=activated data-index=60>activated</h2><p>keep-alive, 组件被激活前</p></section><section><h2 id=deactivated data-index=61>deactivated</h2><p>keep-alive, 组件被激活后</p></section><section><h2 id=beforeDestroy data-index=62>beforeDestroy</h2><p>实例被销毁前</p></section><section><h2 id=destroyed data-index=63>destroyed</h2><p>实例被销毁后</p></section></section>"})