window['cb_html']({"outline":{"children":[{"index":0,"level":1,"name":"HTML 元素参考","children":[]},{"index":1,"level":1,"name":"form 表单","children":[{"index":2,"level":2,"name":"输入控件 disabled 后将不会提交到后台","children":[]},{"index":3,"level":2,"name":"表单提交 name 属性","children":[]}]},{"index":4,"level":1,"name":"input file 动态选择实现","children":[]},{"index":5,"level":1,"name":"其他","children":[{"index":6,"level":2,"name":"页面中的 flash","children":[]}]},{"index":7,"level":1,"name":"body","children":[{"index":8,"level":2,"name":"js","children":[{"index":9,"level":3,"name":"关于body清空","children":[]}]},{"index":10,"level":2,"name":"css","children":[{"index":11,"level":3,"name":"background 设置满屏背景","children":[]},{"index":12,"level":3,"name":"默认css","children":[]}]}]},{"index":13,"level":1,"name":"ie678 实现支持 html5 标签","children":[]},{"index":14,"level":1,"name":"input textear","children":[{"index":15,"level":2,"name":"input [type=text]、textarea","children":[{"index":16,"level":3,"name":"css","children":[{"index":17,"level":4,"name":"-webkit-text-fill-color","children":[]},{"index":18,"level":4,"name":"控制 placeholder 颜色","children":[]}]}]},{"index":19,"level":2,"name":"问题","children":[{"index":20,"level":3,"name":"ios disabled=&quot;disabled&quot; 淡灰 不可控 问题","children":[]}]},{"index":21,"level":2,"name":"file","children":[]},{"index":22,"level":2,"name":"去掉红色波浪线","children":[]}]},{"index":23,"level":1,"name":"lang 语言设置","children":[]},{"index":24,"level":1,"name":"script","children":[{"index":25,"level":2,"name":"script节点引入-带编码","children":[]},{"index":26,"level":2,"name":"标签位置","children":[]},{"index":27,"level":2,"name":"script 引用的js报错不会影响下一个script 执行","children":[]},{"index":28,"level":2,"name":"标签属性","children":[{"index":29,"level":3,"name":"src","children":[]}]}]},{"index":30,"level":1,"name":"table","children":[{"index":31,"level":2,"name":"table-layout 可控 w h","children":[]},{"index":32,"level":2,"name":"caption 表格标题","children":[]},{"index":33,"level":2,"name":"col、colgroup：控制列","children":[]}]},{"index":34,"level":1,"name":"title 页面标题设置","children":[]},{"index":35,"level":1,"name":"video","children":[]},{"index":36,"level":1,"name":"可编辑 contenteditable","children":[{"index":37,"level":2,"name":"回车换行 增加的元素区别","children":[]},{"index":38,"level":2,"name":"兼容性","children":[{"index":39,"level":3,"name":"元素文档位置改变操作","children":[]}]}]},{"index":40,"level":1,"name":"命名实体","children":[{"index":41,"level":2,"name":"html空格","children":[]}]},{"index":42,"level":1,"name":"移动端web缩放控制","children":[{"index":43,"level":2,"name":"简单介绍","children":[]},{"index":44,"level":2,"name":"ios9以下系统同时展示两个webview有bug，高宽超出","children":[]}]},{"index":45,"level":1,"name":"自定义标签","children":[]}],"name":"html"},"content":"<section><h1 id=\"HTML 元素参考\" data-index=0>HTML 元素参考</h1><p><a href=https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element>HTML 元素参考 - HTML（超文本标记语言） | MDN</a></p></section><section><h1 id=\"form 表单\" data-index=1>form 表单</h1><section><h2 id=\"输入控件 disabled 后将不会提交到后台\" data-index=2>输入控件 disabled 后将不会提交到后台</h2><p>兼容性：ie6+</p></section><section><h2 id=\"表单提交 name 属性\" data-index=3>表单提交 name 属性</h2><p>form 表单提交会把所有拥有 name 属性的的 input 的 value 提交给服务器。当然 input[type=&quot;button&quot;] 除外，即使有 name 属性，也会过滤掉</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>form</span> <span class=hljs-attr>action</span>=<span class=hljs-string>\"http://baidu.com/s\"</span> <span class=hljs-attr>method</span>=<span class=hljs-string>\"get\"</span>&gt;</span>\n <span class=hljs-tag>&lt;<span class=hljs-name>input</span> <span class=hljs-attr>type</span>=<span class=hljs-string>\"text\"</span> <span class=hljs-attr>name</span>=<span class=hljs-string>\"wd\"</span> <span class=hljs-attr>value</span>=<span class=hljs-string>\"张三\"</span>&gt;</span>\n <span class=hljs-tag>&lt;<span class=hljs-name>input</span> <span class=hljs-attr>type</span>=<span class=hljs-string>\"button\"</span> <span class=hljs-attr>name</span>=<span class=hljs-string>\"bt_save\"</span> <span class=hljs-attr>value</span>=<span class=hljs-string>\"测试值\"</span>&gt;</span>\n <span class=hljs-tag>&lt;<span class=hljs-name>input</span> <span class=hljs-attr>type</span>=<span class=hljs-string>\"submit\"</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>form</span>&gt;</span></code></pre></section></section><section><h1 id=\"input file 动态选择实现\" data-index=4>input file 动态选择实现</h1><p>为了避免问题，动态文件选择最好 append 到 文档中</p><p>iPhone 微信浏览器因为没有增加到文档，click 方法无效</p><pre><code class=language-js><span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params>onSelect, accept</span>) </span>{\n  <span class=hljs-keyword>let</span> file = <span class=hljs-built_in>document</span>.createElement(<span class=hljs-string>'input'</span>)\n  file.type = <span class=hljs-string>'file'</span>\n  file.accept = accept\n\n  <span class=hljs-comment>// 移动端 file 元素最好加到页面中</span>\n  file.style.display = <span class=hljs-string>'none'</span>\n  <span class=hljs-built_in>document</span>.body.appendChild(file)\n\n  file.onchange = onSelect\n  file.click()\n}\n</code></pre></section><section><h1 id=其他 data-index=5>其他</h1><section><h2 id=\"页面中的 flash\" data-index=6>页面中的 flash</h2><p>改变 display、position 都将重置 flash组件</p></section></section><section><h1 id=body data-index=7>body</h1><section><h2 id=js data-index=8>js</h2><section><h3 id=关于body清空 data-index=9>关于body清空</h3><p>可以这样清空body，这种方式ie678不支持</p><pre><code class=language-js><span class=hljs-built_in>document</span>.body = <span class=hljs-built_in>document</span>.createElement(<span class=hljs-string>'body'</span>);</code></pre><p>其实跟这样效率差别不大，所有浏览器支持</p><pre><code class=language-js><span class=hljs-built_in>document</span>.body.innerHTML =<span class=hljs-string>''</span>;</code></pre></section></section><section><h2 id=css data-index=10>css</h2><section><h3 id=\"background 设置满屏背景\" data-index=11>background 设置满屏背景</h3><p>兼容性：包括ie6的所有</p></section><section><h3 id=默认css data-index=12>默认css</h3><p>默认有margin属性，但margin各浏览器不同</p><p>兼容性：包括ie6的所有</p></section></section></section><section><h1 id=\"ie678 实现支持 html5 标签\" data-index=13>ie678 实现支持 html5 标签</h1><p>实现</p><pre><code><span class=hljs-built_in>document</span>.createElement(<span class=hljs-string>\"header\"</span>);\n<span class=hljs-comment>// 此操作便能使 header 变成真正的标签。注意，生成的标签默认是inline</span></code></pre><p>使用</p><pre><code class=language-html><span class=hljs-comment>&lt;!--[if lte IE 8]&gt;\n(function () {\n    var a = ['header', 'section', 'footer', 'aside'];\n    for (var i = a.length; i--;) document.createElement(a[i]);\n})();\n&lt;![endif]--&gt;</span></code></pre></section><section><h1 id=\"input textear\" data-index=14>input textear</h1><section><h2 id=\"input [type=text]、textarea\" data-index=15>input [type=text]、textarea</h2><section><h3 id=css data-index=16>css</h3><section><h4 id=-webkit-text-fill-color data-index=17>-webkit-text-fill-color</h4><pre><code class=language-css><span class=hljs-selector-tag>input</span> {\n    <span class=hljs-attribute>-webkit-text-fill-color</span>: <span class=hljs-number>#333</span>;    \n}\n</code></pre><p>同时覆盖 placeholder、color 颜色，那不是没什么用吗。。</p></section><section><h4 id=\"控制 placeholder 颜色\" data-index=18>控制 placeholder 颜色</h4><pre><code class=language-css><span class=hljs-selector-tag>input</span><span class=hljs-selector-pseudo>::placeholder</span> {\n    <span class=hljs-attribute>color</span>:<span class=hljs-number>#aaa</span>;\n}</code></pre></section></section></section><section><h2 id=问题 data-index=19>问题</h2><section><h3 id=\"ios disabled=&quot;disabled&quot; 淡灰 不可控 问题\" data-index=20>ios disabled=&quot;disabled&quot; 淡灰 不可控 问题</h3><p>涉及得元素控件：input [type=text]、textarea</p><p>css color 颜色无效。网上 opacity 也无法理想解决</p><p><strong>理想解决：</strong> 使用 readonly=&quot;readonly&quot; 代替</p></section></section><section><h2 id=file data-index=21>file</h2><p>编程式调用情况，input file 必须加到页面中</p><pre><code class=language-js><span class=hljs-keyword>let</span> file = <span class=hljs-built_in>document</span>.createElement(<span class=hljs-string>'input'</span>)\nfile.type = <span class=hljs-string>'file'</span>\n\n<span class=hljs-comment>// ie6+包括ie11，还有部分移动端，比如iPhone，file 元素必须加到页面中</span>\nfile.style.display = <span class=hljs-string>'none'</span>\n<span class=hljs-built_in>document</span>.body.appendChild(file)\n\nfile.onchange = <span class=hljs-function><span class=hljs-params>()</span> =&gt;</span> {\n  <span class=hljs-keyword>this</span>.upload(file.files[<span class=hljs-number>0</span>]).then(<span class=hljs-function><span class=hljs-params>url</span> =&gt;</span> {\n    url &amp;&amp; <span class=hljs-keyword>this</span>.imgs.push(url)\n  })\n}\nfile.click()</code></pre></section><section><h2 id=去掉红色波浪线 data-index=22>去掉红色波浪线</h2><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>textarea</span> <span class=hljs-attr>spellcheck</span>=<span class=hljs-string>\"false\"</span>&gt;</span><span class=hljs-tag>&lt;/<span class=hljs-name>textarea</span>&gt;</span></code></pre></section></section><section><h1 id=\"lang 语言设置\" data-index=23>lang 语言设置</h1><p>一般还是不加吧</p><ol><li>简体中文页面：html lang=zh-cmn-Hans</li><li>繁体中文页面：html lang=zh-cmn-Hant</li><li>英语页面：html lang=en</li></ol></section><section><h1 id=script data-index=24>script</h1><section><h2 id=script节点引入-带编码 data-index=25>script节点引入-带编码</h2><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>script</span> <span class=hljs-attr>type</span>=<span class=hljs-string>\"text/javascript\"</span> <span class=hljs-attr>charset</span>=<span class=hljs-string>\"utf-8\"</span> <span class=hljs-attr>src</span>=<span class=hljs-string>\"./zh_CN.js\"</span>&gt;</span><span class=\"undefined\"></span><span class=hljs-tag>&lt;/<span class=hljs-name>script</span>&gt;</span></code></pre></section><section><h2 id=标签位置 data-index=26>标签位置</h2><p>挨着 body 结束标签，让页面更快展示</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>html</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>head</span>&gt;</span><span class=hljs-tag>&lt;/<span class=hljs-name>head</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>body</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>p</span>&gt;</span> 页面内容 <span class=hljs-tag>&lt;<span class=hljs-name>p</span>/&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>script</span> <span class=hljs-attr>src</span>=<span class=hljs-string>\"vendor.js\"</span> <span class=hljs-attr>charset</span>=<span class=hljs-string>\"utf-8\"</span>&gt;</span><span class=\"undefined\"></span><span class=hljs-tag>&lt;/<span class=hljs-name>script</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>script</span> <span class=hljs-attr>src</span>=<span class=hljs-string>\"pageA.js\"</span> <span class=hljs-attr>charset</span>=<span class=hljs-string>\"utf-8\"</span>&gt;</span><span class=\"undefined\"></span><span class=hljs-tag>&lt;/<span class=hljs-name>script</span>&gt;</span>\n    <span class=hljs-tag>&lt;/<span class=hljs-name>body</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>html</span>&gt;</span></code></pre></section><section><h2 id=\"script 引用的js报错不会影响下一个script 执行\" data-index=27>script 引用的js报错不会影响下一个script 执行</h2></section><section><h2 id=标签属性 data-index=28>标签属性</h2><section><h3 id=src data-index=29>src</h3><p>js文件路径，可以不是.js后缀。但MIME类型必须正确的。 也就是说，不管是什么文件，什么后缀，只要返回javascript的文本即可</p></section></section></section><section><h1 id=table data-index=30>table</h1><section><h2 id=\"table-layout 可控 w h\" data-index=31>table-layout 可控 w h</h2><p>auto：默认，会因为内容的原因，wh不可控 fixed：实现可控wh</p><pre><code class=language-html><span class=hljs-selector-tag>table</span>{\n    <span class=hljs-attribute>table-layout</span>: fixed;\n}</code></pre></section><section><h2 id=\"caption 表格标题\" data-index=32>caption 表格标题</h2></section><section><h2 id=col、colgroup：控制列 data-index=33>col、colgroup：控制列</h2><p>常用属性：span、width</p><p>span：控制多列</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>table</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>colgroup</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>col</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>col</span> <span class=hljs-attr>width</span>=<span class=hljs-string>\"100\"</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>col</span> <span class=hljs-attr>width</span>=<span class=hljs-string>\"160\"</span>&gt;</span>\n    <span class=hljs-tag>&lt;/<span class=hljs-name>colgroup</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>thead</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>tr</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>th</span>&gt;</span>题型<span class=hljs-tag>&lt;/<span class=hljs-name>th</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>th</span>&gt;</span>数量<span class=hljs-tag>&lt;/<span class=hljs-name>th</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>th</span>&gt;</span>分值(总分:<span class=hljs-tag>&lt;<span class=hljs-name>b</span>&gt;</span>100<span class=hljs-tag>&lt;/<span class=hljs-name>b</span>&gt;</span>分)<span class=hljs-tag>&lt;/<span class=hljs-name>th</span>&gt;</span>\n    <span class=hljs-tag>&lt;/<span class=hljs-name>tr</span>&gt;</span>\n    <span class=hljs-tag>&lt;/<span class=hljs-name>thead</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>tbody</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>tr</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>td</span>&gt;</span>选择题<span class=hljs-tag>&lt;/<span class=hljs-name>td</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>td</span>&gt;</span>\n            <span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"score-ipt\"</span>&gt;</span>\n                <span class=hljs-tag>&lt;<span class=hljs-name>a</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"mnus\"</span>&gt;</span><span class=hljs-tag>&lt;/<span class=hljs-name>a</span>&gt;</span>\n                <span class=hljs-tag>&lt;<span class=hljs-name>span</span>&gt;</span>5<span class=hljs-tag>&lt;/<span class=hljs-name>span</span>&gt;</span>\n                <span class=hljs-tag>&lt;<span class=hljs-name>a</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"plus\"</span>&gt;</span><span class=hljs-tag>&lt;/<span class=hljs-name>a</span>&gt;</span>\n            <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n        <span class=hljs-tag>&lt;/<span class=hljs-name>td</span>&gt;</span>\n        <span class=hljs-tag>&lt;<span class=hljs-name>td</span>&gt;</span>\n            <span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"score-ipt\"</span>&gt;</span>\n                <span class=hljs-tag>&lt;<span class=hljs-name>a</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"mnus\"</span>&gt;</span><span class=hljs-tag>&lt;/<span class=hljs-name>a</span>&gt;</span>\n                <span class=hljs-tag>&lt;<span class=hljs-name>span</span>&gt;</span>5<span class=hljs-tag>&lt;/<span class=hljs-name>span</span>&gt;</span>\n                <span class=hljs-tag>&lt;<span class=hljs-name>a</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"plus\"</span>&gt;</span><span class=hljs-tag>&lt;/<span class=hljs-name>a</span>&gt;</span>\n            <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n        <span class=hljs-tag>&lt;/<span class=hljs-name>td</span>&gt;</span>\n    <span class=hljs-tag>&lt;/<span class=hljs-name>tr</span>&gt;</span>\n    <span class=hljs-tag>&lt;/<span class=hljs-name>tbody</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>table</span>&gt;</span></code></pre></section></section><section><h1 id=\"title 页面标题设置\" data-index=34>title 页面标题设置</h1><p>通过 title 标签设置</p><pre><code><span class=hljs-meta>&lt;!doctype html&gt;</span>\n<span class=hljs-tag>&lt;<span class=hljs-name>html</span>&gt;</span>\n<span class=hljs-tag>&lt;<span class=hljs-name>head</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>title</span>&gt;</span>页面标题<span class=hljs-tag>&lt;/<span class=hljs-name>title</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>head</span>&gt;</span>\n<span class=hljs-tag>&lt;<span class=hljs-name>body</span>&gt;</span>\n<span class=hljs-tag>&lt;<span class=hljs-name>h1</span>&gt;</span>一级大标题<span class=hljs-tag>&lt;/<span class=hljs-name>h1</span>&gt;</span>\n<span class=hljs-tag>&lt;<span class=hljs-name>p</span>&gt;</span>我是一句话<span class=hljs-tag>&lt;/<span class=hljs-name>p</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>body</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>html</span>&gt;</span></code></pre></section><section><h1 id=video data-index=35>video</h1><p><a href=https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLVideoElement>HTMLVideoElement</a></p><p><a href=https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLMediaElement>HTMLMediaElement</a></p><p><a href=https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video><video></video></a></p><p><a href=https://www.cnblogs.com/qq984064199/p/6244284.html>HTML5的Video标签的属性,方法和事件汇总</a></p></section><section><h1 id=\"可编辑 contenteditable\" data-index=36>可编辑 contenteditable</h1><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>contenteditable</span>&gt;</span><span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span></code></pre><section><h2 id=\"回车换行 增加的元素区别\" data-index=37>回车换行 增加的元素区别</h2><p>ie 是 增加子p元素，其他增加 子div</p></section><section><h2 id=兼容性 data-index=38>兼容性</h2><p>all浏览器 支持，但有区别。</p><section><h3 id=元素文档位置改变操作 data-index=39>元素文档位置改变操作</h3><p><strong>Firefox</strong></p><p>获焦 后，移动 文本编辑元素，焦点(光标)将停留 原地 再次执行 此 文本编辑元素 的 获焦\\失焦 操作 都将无效 解决方案：移动前先失焦 强调：只有文本编辑元素才这样，input输入框不会</p><p><strong>其他浏览器</strong></p><p>移动后会自动失焦</p></section></section></section><section><h1 id=命名实体 data-index=40>命名实体</h1><section><h2 id=html空格 data-index=41>html空格</h2><pre><code class=language-html>&amp;nbsp;</code></pre><p><code>&amp;nbsp;</code>：一个 表示一个空格</p><p>html 中的 文本 的 实质 换行符、空格符 换行符： 会被浏览器 编译成 单个空格。 每行文本 两头 连续的空格： 会被 清除</p><p>在文本 前头 连续空格中 使用 <code>&amp;nbsp;</code>后 <code>&amp;nbsp;</code>后面的 实质空格符 不会被清掉 <code>&amp;nbsp;</code>前面的 实质空格符会被 清除</p><p>兼容性：上面的讲法 兼容all浏览器</p></section></section><section><h1 id=移动端web缩放控制 data-index=42>移动端web缩放控制</h1><section><h2 id=简单介绍 data-index=43>简单介绍</h2><p>完整</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>meta</span> <span class=hljs-attr>name</span>=<span class=hljs-string>\"viewport\"</span> <span class=hljs-attr>content</span>=<span class=hljs-string>\"height=device-height,width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no\"</span> /&gt;</span> \n</code></pre><p>常用</p><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>meta</span> <span class=hljs-attr>content</span>=<span class=hljs-string>\"width=device-width,initial-scale=1,user-scalable=no\"</span> <span class=hljs-attr>name</span>=<span class=hljs-string>\"viewport\"</span>/&gt;</span></code></pre><p><strong>width,height</strong> 指定视区的逻辑宽度和高度。假如大于浏览器显示区的逻辑高宽，内容将放大指定倍数来显示。小于情况将等于浏览器显示区逻辑高宽。 值可以是具体的像素值； 也可以是一些特殊字指令符，比如device-width、device-heigh，如果不给，默认值就是这两个</p><p>经测试width、height可以不指定。将等于浏览器显示区的逻辑高宽</p></section><section><h2 id=ios9以下系统同时展示两个webview有bug，高宽超出 data-index=44>ios9以下系统同时展示两个webview有bug，高宽超出</h2><p>当页面中同时放两个webview时，指定<code>width=device-width</code>，将大于webview的逻辑宽度，像是设备的逻辑宽度来算。<br><strong>解决：</strong> 去掉width，或者指定为0即可，即如下所示</p><pre><code><span class=hljs-tag>&lt;<span class=hljs-name>meta</span> <span class=hljs-attr>content</span>=<span class=hljs-string>\"initial-scale=1,user-scalable=no\"</span> <span class=hljs-attr>name</span>=<span class=hljs-string>\"viewport\"</span>/&gt;</span>\n或者\n<span class=hljs-tag>&lt;<span class=hljs-name>meta</span> <span class=hljs-attr>content</span>=<span class=hljs-string>\"width=0,initial-scale=1,user-scalable=no\"</span> <span class=hljs-attr>name</span>=<span class=hljs-string>\"viewport\"</span>/&gt;</span></code></pre><p>20170720更新：<br>不到万不得已，不去掉width，也不指定为0，否则ios10会出现 ios click 300ms延迟。 其他低版本未测，没有手机。。</p></section></section><section><h1 id=自定义标签 data-index=45>自定义标签</h1><p>自定义标签名字的w3c规范，小写，并且包含一个短杠</p></section>"})