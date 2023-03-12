window['cb_reactjs-old']({"outline":[{"id":"2349975291","level":1,"name":"css 方案","children":[]},{"id":"2295677907","level":1,"name":"jsx","children":[]},{"id":"3724021756","level":1,"name":"事件","children":[]},{"id":"761652819","level":1,"name":"学习","children":[{"id":"3832181755","level":2,"name":"组件 &amp; Props","children":[{"id":"37473552","level":3,"name":"props：组件的标签属性。只读","children":[]},{"id":"2366420306","level":3,"name":"组件可嵌套","children":[]}]},{"id":"2797136947","level":2,"name":"State &amp; 生命周期","children":[{"id":"2256623310","level":3,"name":"数据响应使用 State 实现，而非 Props","children":[]}]},{"id":"2807285707","level":2,"name":"可使用 render 进行渲染","children":[{"id":"993873308","level":3,"name":"组件生命周期","children":[]},{"id":"3134846079","level":3,"name":"state 设置","children":[]}]},{"id":"322424106","level":2,"name":"函数组件、类组件","children":[{"id":"2588348858","level":3,"name":"区别","children":[]}]},{"id":"989299300","level":2,"name":"事件处理","children":[{"id":"757114481","level":3,"name":"事件处理函数中的 this 不会返回组件实例","children":[]},{"id":"957434669","level":3,"name":"1 使用 bind","children":[]},{"id":"888586372","level":3,"name":"2 类方法使用箭头函数。建议方式","children":[]},{"id":"2702876202","level":3,"name":"3 JSX 中使用箭头函数","children":[]}]},{"id":"1793205643","level":2,"name":"状态提升：父子组件的通讯","children":[]},{"id":"800023333","level":2,"name":"组合 VS 继承","children":[]}]},{"id":"1469047547","level":1,"name":"环境","children":[{"id":"1350480747","level":2,"name":"1 可控的定制化","children":[{"id":"1461260190","level":3,"name":"相关包","children":[]},{"id":"351087205","level":3,"name":".babelrc 文件，常用配置。使支持 jsx","children":[]}]},{"id":"3479530063","level":2,"name":"2 <a href=\"http://github.com/facebookincubator/create-react-app\">使用官方 create-react-app</a>","children":[]}]}],"content":"<section><h1 id=\"2349975291\">css 方案</h1><p><a href=\"https://github.com/css-modules/css-modules\">https://github.com/css-modules/css-modules</a></p>\n<p><a href=\"https://www.styled-components.com/\">https://www.styled-components.com/</a></p>\n</section><section><h1 id=\"2295677907\">jsx</h1><p>循环</p>\n<pre><code class=\"language-jsx\"><span class=\"hljs-keyword\">var</span> MyComponent = Vue.extend({\n  data () {\n    <span class=\"hljs-keyword\">return</span> {\n      <span class=\"hljs-attr\">list</span>: [<span class=\"hljs-string\">'1'</span>, <span class=\"hljs-string\">'2'</span>]\n    }\n  },\n  <span class=\"hljs-attr\">methods</span>: {\n    testfn () {\n      <span class=\"hljs-built_in\">console</span>.log(<span class=\"hljs-keyword\">this</span>)\n    }\n  },\n  render () {\n    <span class=\"hljs-keyword\">let</span> ls = [<span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">li</span>&gt;</span>{this.name}<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">li</span>&gt;</span></span>]\n    <span class=\"hljs-keyword\">this</span>.list.forEach(<span class=\"hljs-function\"><span class=\"hljs-params\">v</span> =&gt;</span> {\n      ls.push(<span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">li</span>&gt;</span>{v}<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">li</span>&gt;</span></span>)\n    })\n    <span class=\"hljs-keyword\">return</span> (\n      <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">div</span> <span class=\"hljs-attr\">className</span>=<span class=\"hljs-string\">\"top-list-select\"</span>&gt;</span>\n        <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">ul</span> <span class=\"hljs-attr\">className</span>=<span class=\"hljs-string\">\"l-mu\"</span>&gt;</span>\n          {ls}\n        <span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">ul</span>&gt;</span>\n\n      <span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">div</span>&gt;</span></span>\n    )\n  }\n})\n</code></pre>\n</section><section><h1 id=\"3724021756\">事件</h1><pre><code class=\"language-tsx\"><span class=\"hljs-keyword\">export</span> <span class=\"hljs-keyword\">default</span> <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> <span class=\"hljs-title\">IndexPage</span>(<span class=\"hljs-params\"></span>) </span>{\n  <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> <span class=\"hljs-title\">onClick</span>(<span class=\"hljs-params\"></span>) </span>{\n    <span class=\"hljs-built_in\">console</span>.log(<span class=\"hljs-string\">\"click 触发\"</span>);\n  }\n\n  <span class=\"hljs-keyword\">return</span> (\n    <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">div</span>&gt;</span>\n      <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">h1</span>&gt;</span>Page index<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">h1</span>&gt;</span>\n      <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">button</span> <span class=\"hljs-attr\">onClick</span>=<span class=\"hljs-string\">{onClick}</span>&gt;</span>test<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">button</span>&gt;</span>\n    <span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">div</span>&gt;</span></span>\n  );\n}</code></pre>\n</section><section><h1 id=\"761652819\">学习</h1><section><h2 id=\"3832181755\">组件 &amp; Props</h2><section><h3 id=\"37473552\">props：组件的标签属性。只读</h3><pre><code class=\"language-js\"><span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> <span class=\"hljs-title\">Welcome</span>(<span class=\"hljs-params\">props</span>) </span>{\n  <span class=\"hljs-keyword\">return</span> <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">h1</span>&gt;</span>Hello, {props.name}<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">h1</span>&gt;</span></span>;\n}\n\n<span class=\"hljs-keyword\">const</span> element = <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">Welcome</span> <span class=\"hljs-attr\">name</span>=<span class=\"hljs-string\">\"Sara\"</span> /&gt;</span>;\nReactDOM.render(element, document.getElementById(\"root\"));</span></code></pre>\n<p><a href=\"https://doc.react-china.org/docs/composition-vs-inheritance.html#%E5%8C%85%E5%90%AB%E5%85%B3%E7%B3%BB\">还可传递组件或元素</a></p>\n<p>props.children 获取所有组件</p>\n</section><section><h3 id=\"2366420306\">组件可嵌套</h3></section></section><section><h2 id=\"2797136947\">State &amp; 生命周期</h2><section><h3 id=\"2256623310\">数据响应使用 State 实现，而非 Props</h3></section></section><section><h2 id=\"2807285707\">可使用 render 进行渲染</h2><pre><code class=\"language-js\"><span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> <span class=\"hljs-title\">tick</span>(<span class=\"hljs-params\"></span>) </span>{\n  <span class=\"hljs-keyword\">const</span> element = (\n    <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">div</span>&gt;</span>\n      <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">h1</span>&gt;</span>Hello, world!<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">h1</span>&gt;</span>\n      <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">h2</span>&gt;</span>It is {new Date().toLocaleTimeString()}.<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">h2</span>&gt;</span>\n    <span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">div</span>&gt;</span></span>\n  );\n  ReactDOM.render(element, <span class=\"hljs-built_in\">document</span>.getElementById(<span class=\"hljs-string\">\"root\"</span>));\n}\n\nsetInterval(tick, <span class=\"hljs-number\">1000</span>);</code></pre>\n<p>render 的参数 1 可直接写标签</p>\n<pre><code class=\"language-ts\">ReactDOM.render(&lt;Clock date={<span class=\"hljs-keyword\">new</span> <span class=\"hljs-built_in\">Date</span>()} /&gt;, <span class=\"hljs-built_in\">document</span>.getElementById(<span class=\"hljs-string\">\"root\"</span>));</code></pre>\n<section><h3 id=\"993873308\">组件生命周期</h3><pre><code class=\"language-js\"><span class=\"hljs-class\"><span class=\"hljs-keyword\">class</span> <span class=\"hljs-title\">Clock</span> <span class=\"hljs-keyword\">extends</span> <span class=\"hljs-title\">React</span>.<span class=\"hljs-title\">Component</span> </span>{\n  <span class=\"hljs-comment\">// 组件输出到 DOM 后执行</span>\n  componentDidMount() {}\n\n  <span class=\"hljs-comment\">// 组件从 DOM 移出后执行</span>\n  componentWillUnmount() {}\n\n  render() {\n    <span class=\"hljs-keyword\">return</span> <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">div</span>&gt;</span><span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">div</span>&gt;</span></span>;\n  }\n}</code></pre>\n</section><section><h3 id=\"3134846079\">state 设置</h3><pre><code class=\"language-ts\"><span class=\"hljs-class\"><span class=\"hljs-keyword\">class</span> <span class=\"hljs-title\">Clock</span> <span class=\"hljs-keyword\">extends</span> <span class=\"hljs-title\">React</span>.<span class=\"hljs-title\">Component</span> </span>{\n  <span class=\"hljs-keyword\">constructor</span>(props) {\n    <span class=\"hljs-keyword\">super</span>(props);\n    <span class=\"hljs-comment\">// 新增状态，初始值</span>\n    <span class=\"hljs-keyword\">this</span>.state = { <span class=\"hljs-attr\">date</span>: <span class=\"hljs-keyword\">new</span> <span class=\"hljs-built_in\">Date</span>() };\n  }\n\n  componentDidMount() {\n    <span class=\"hljs-keyword\">this</span>.timerID = setInterval(<span class=\"hljs-function\"><span class=\"hljs-params\">()</span> =&gt;</span> <span class=\"hljs-keyword\">this</span>.tick(), <span class=\"hljs-number\">1000</span>);\n  }\n\n  componentWillUnmount() {\n    clearInterval(<span class=\"hljs-keyword\">this</span>.timerID);\n  }\n\n  tick() {\n    <span class=\"hljs-comment\">// 更新状态</span>\n    <span class=\"hljs-comment\">// 设置 date 属性</span>\n    <span class=\"hljs-keyword\">this</span>.setState({\n      <span class=\"hljs-attr\">date</span>: <span class=\"hljs-keyword\">new</span> <span class=\"hljs-built_in\">Date</span>(),\n    });\n  }\n\n  render() {\n    <span class=\"hljs-keyword\">return</span> (\n      <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">div</span>&gt;</span>\n        <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">h1</span>&gt;</span>Hello, world!<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">h1</span>&gt;</span>\n        <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">h2</span>&gt;</span>It is {this.state.date.toLocaleTimeString()}.<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">h2</span>&gt;</span>\n      <span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">div</span>&gt;</span></span>\n    );\n  }\n}\n\nReactDOM.render(<span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">Clock</span> /&gt;</span>, document.getElementById(\"root\"));</span></code></pre>\n</section></section><section><h2 id=\"322424106\">函数组件、类组件</h2><pre><code class=\"language-ts\"><span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> <span class=\"hljs-title\">Welcome</span>(<span class=\"hljs-params\">props</span>) </span>{\n  <span class=\"hljs-keyword\">return</span> <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">h1</span>&gt;</span>Hello, {props.name}<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">h1</span>&gt;</span></span>;\n}</code></pre>\n<pre><code class=\"language-ts\"><span class=\"hljs-class\"><span class=\"hljs-keyword\">class</span> <span class=\"hljs-title\">Welcome</span> <span class=\"hljs-keyword\">extends</span> <span class=\"hljs-title\">React</span>.<span class=\"hljs-title\">Component</span> </span>{\n  render() {\n    <span class=\"hljs-keyword\">return</span> <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">h1</span>&gt;</span>Hello, {this.props.name}<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">h1</span>&gt;</span></span>;\n  }\n}</code></pre>\n<section><h3 id=\"2588348858\">区别</h3><p>类组件有很多其他特性。例如局部状态、生命周期钩子</p>\n</section></section><section><h2 id=\"989299300\">事件处理</h2><section><h3 id=\"757114481\">事件处理函数中的 this 不会返回组件实例</h3><p>三种方式解决</p>\n</section><section><h3 id=\"957434669\">1 使用 bind</h3><p>一般在构造函数 constructor 中</p>\n<pre><code class=\"language-ts\"><span class=\"hljs-class\"><span class=\"hljs-keyword\">class</span> <span class=\"hljs-title\">Toggle</span> <span class=\"hljs-keyword\">extends</span> <span class=\"hljs-title\">React</span>.<span class=\"hljs-title\">Component</span> </span>{\n  <span class=\"hljs-keyword\">constructor</span>(props) {\n    <span class=\"hljs-keyword\">super</span>(props);\n    <span class=\"hljs-keyword\">this</span>.handleClick = <span class=\"hljs-keyword\">this</span>.handleClick.bind(<span class=\"hljs-keyword\">this</span>);\n  }\n  render() {\n    <span class=\"hljs-keyword\">return</span> <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">button</span> <span class=\"hljs-attr\">onClick</span>=<span class=\"hljs-string\">{this.handleClick}</span>&gt;</span>Click me<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">button</span>&gt;</span></span>;\n  }\n}</code></pre>\n<p>也可直接将 bing 写在 JSX 中。不过每次子元素被初始都会绑定一次</p>\n</section><section><h3 id=\"888586372\">2 类方法使用箭头函数。建议方式</h3><pre><code class=\"language-ts\"><span class=\"hljs-class\"><span class=\"hljs-keyword\">class</span> <span class=\"hljs-title\">LoggingButton</span> <span class=\"hljs-keyword\">extends</span> <span class=\"hljs-title\">React</span>.<span class=\"hljs-title\">Component</span> </span>{\n  <span class=\"hljs-comment\">// This syntax ensures `this` is bound within handleClick.</span>\n  <span class=\"hljs-comment\">// Warning: this is *experimental* syntax.</span>\n  handleClick = <span class=\"hljs-function\"><span class=\"hljs-params\">()</span> =&gt;</span> {\n    <span class=\"hljs-built_in\">console</span>.log(<span class=\"hljs-string\">\"this is:\"</span>, <span class=\"hljs-keyword\">this</span>);\n  };\n\n  render() {\n    <span class=\"hljs-keyword\">return</span> <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">button</span> <span class=\"hljs-attr\">onClick</span>=<span class=\"hljs-string\">{this.handleClick}</span>&gt;</span>Click me<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">button</span>&gt;</span></span>;\n  }\n}</code></pre>\n</section><section><h3 id=\"2702876202\">3 JSX 中使用箭头函数</h3><pre><code class=\"language-ts\"><span class=\"hljs-class\"><span class=\"hljs-keyword\">class</span> <span class=\"hljs-title\">LoggingButton</span> <span class=\"hljs-keyword\">extends</span> <span class=\"hljs-title\">React</span>.<span class=\"hljs-title\">Component</span> </span>{\n  handleClick() {\n    <span class=\"hljs-built_in\">console</span>.log(<span class=\"hljs-string\">\"this is:\"</span>, <span class=\"hljs-keyword\">this</span>);\n  }\n\n  render() {\n    <span class=\"hljs-comment\">// This syntax ensures `this` is bound within handleClick</span>\n    <span class=\"hljs-keyword\">return</span> <span class=\"xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">button</span> <span class=\"hljs-attr\">onClick</span>=<span class=\"hljs-string\">{(e)</span> =&gt;</span> this.handleClick(e)}&gt;Click me<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">button</span>&gt;</span></span>;\n  }\n}</code></pre>\n</section></section><section><h2 id=\"1793205643\">状态提升：父子组件的通讯</h2><p>子组件向父组件传值。</p>\n<p>通过 props 给子组件传一个函数，子组件特定条件调用此函数传值即可</p>\n</section><section><h2 id=\"800023333\">组合 VS 继承</h2><p>包含关系，有点类 Vue 的分发内容。本质其实是通过 props 传递元素或组件</p>\n<p>props.children 可获取父组件包含的所有子元素组件</p>\n</section></section><section><h1 id=\"1469047547\">环境</h1><section><h2 id=\"1350480747\">1 可控的定制化</h2><section><h3 id=\"1461260190\">相关包</h3><p>yarn add react react-dom babel-preset-react</p>\n</section><section><h3 id=\"351087205\">.babelrc 文件，常用配置。使支持 jsx</h3><pre><code>{\n  <span class=\"hljs-string\">\"presets\"</span>: [\n    <span class=\"hljs-string\">\"env\"</span>,\n    <span class=\"hljs-string\">\"react\"</span>\n  ],\n  <span class=\"hljs-string\">\"plugins\"</span>: [\n    <span class=\"hljs-string\">\"transform-runtime\"</span>,\n    <span class=\"hljs-string\">\"syntax-dynamic-import\"</span>\n  ]\n}\n</code></pre></section></section><section><h2 id=\"3479530063\">2 <a href=\"http://github.com/facebookincubator/create-react-app\">使用官方 create-react-app</a></h2>"})