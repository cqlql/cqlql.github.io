window['cb_css']({"outline":{"children":[{"level":1,"name":"使用css的3种方式：外链，内联，行内","children":[]},{"level":1,"name":"元素上设置遮罩层 mask-image","children":[]},{"level":1,"name":"多列 columns","children":[]},{"level":1,"name":"translate scale 书写顺序影响效果","children":[]},{"level":1,"name":"background","children":[{"level":2,"name":"size &amp;&amp; position 冲突","children":[]}]},{"level":1,"name":"float","children":[{"level":2,"name":"浮动与非浮动，发生重叠","children":[]},{"level":2,"name":"多个float元素，高度不一，换行规律","children":[]},{"level":2,"name":"js 相关","children":[{"level":3,"name":"压缩报错问题","children":[]}]}]},{"level":1,"name":"transform 变换","children":[{"level":2,"name":"动画性能","children":[]},{"level":2,"name":"滚动条下面隐藏的元素未渲染","children":[]},{"level":2,"name":"对inline 元素无效，可使用 inline-block 代替","children":[]},{"level":2,"name":"问题：ios wkwebview translate 居然 100% 不能好好动画，改成99%即可","children":[]}]},{"level":1,"name":"transition 过渡动画","children":[{"level":2,"name":"transition 支持情况：ie10+","children":[]},{"level":2,"name":"js 操作","children":[{"level":3,"name":"一般操作步骤","children":[]},{"level":3,"name":"非 number 属性起始情况","children":[]},{"level":3,"name":"动态增加 elem 情况","children":[]},{"level":3,"name":"虽然 ie setTimeout 不能设为 0，但还是异步","children":[]},{"level":3,"name":"不用考虑起始值的属性","children":[]},{"level":3,"name":"删除 transition 后是否会触发 transitionend 事件？","children":[{"level":4,"name":"兼容性","children":[]},{"level":4,"name":"测试代码","children":[]}]},{"level":3,"name":"删除 transition 后，之前注册的 transitionend 是否还有效","children":[]}]}]},{"level":1,"name":"动画库第三方","children":[]},{"level":1,"name":"后代选择写法原则","children":[]},{"level":1,"name":"定位","children":[{"level":2,"name":"fiexd","children":[]}]},{"level":1,"name":"布局","children":[{"level":2,"name":"ABC并行 A适应，并且最前，BC固定","children":[]},{"level":2,"name":"AB并行，A固定，B自适应","children":[{"level":3,"name":"浮动在前","children":[]}]},{"level":2,"name":"居中布局","children":[]},{"level":2,"name":"居中布局 2","children":[]}]},{"level":1,"name":"弹性盒 flex","children":[{"level":2,"name":"flex 弹性盒布局","children":[]}]},{"level":1,"name":"文本","children":[{"level":2,"name":"word-spacing：html 空格宽度控制","children":[]},{"level":2,"name":"换行","children":[]},{"level":2,"name":"不换行","children":[]},{"level":2,"name":"裁剪","children":[]},{"level":2,"name":"垂直居中","children":[]},{"level":2,"name":"文字描边","children":[]}]},{"level":1,"name":"比例单位","children":[{"children":[{"level":3,"name":"em","children":[]},{"level":3,"name":"rem","children":[]}]}]},{"level":1,"name":"毛玻璃","children":[]},{"level":1,"name":"滚动，滚动条","children":[{"level":2,"name":"滚动条样式","children":[]},{"level":2,"name":"加滚动惯性 - IOS 移动端","children":[]}]},{"level":1,"name":"滤镜","children":[{"level":2,"name":"滤镜 - 标准？","children":[]}]},{"level":1,"name":"移动端问题","children":[{"level":2,"name":"ios 去掉点击阴影","children":[]}]},{"level":1,"name":"选择器","children":[{"level":2,"name":"奇偶选择","children":[]}]}],"name":"css"},"content":"<section><h1 id='[\"使用css的3种方式：外链，内联，行内\"]' data-index=0>使用css的3种方式：外链，内联，行内</h1></section><section><h1 id='[\"元素上设置遮罩层 mask-image\"]' data-index=1>元素上设置遮罩层 mask-image</h1><p><a href=https://developer.mozilla.org/zh-CN/docs/Web/CSS/mask-image>https://developer.mozilla.org/zh-CN/docs/Web/CSS/mask-image</a></p></section><section><h1 id='[\"多列 columns\"]' data-index=2>多列 columns</h1><p>特性：</p><ul><li>多余的文本会自动往下一列</li></ul></section><section><h1 id='[\"translate scale 书写顺序影响效果\"]' data-index=3>translate scale 书写顺序影响效果</h1><p>translate 需写在 scale 前面</p><pre><code class=language-css><span class=hljs-selector-class>.message</span> {\n  <span class=hljs-attribute>transform</span>:<span class=hljs-built_in>translate</span>(-50%,-50%);    \n}\n\n<span class=hljs-selector-class>.zoom-in-enter</span>, <span class=hljs-selector-class>.zoom-out-leave-to</span> {\n  <span class=hljs-attribute>opacity</span>: <span class=hljs-number>0</span>;\n  <span class=hljs-attribute>transform</span>: <span class=hljs-built_in>translate</span>(-50%,-50%) <span class=hljs-built_in>scale</span>(0.8);\n}</code></pre></section><section><h1 id='[\"background\"]' data-index=4>background</h1><section><h2 id='[\"background\",\"size &amp;&amp; position 冲突\"]' data-index=5>size &amp;&amp; position 冲突</h2><p>设置 background-size 后，对应的 background-position 会失效</p><pre><code class=language-css><span class=hljs-selector-tag>test</span>{\n  <span class=hljs-attribute>background-size</span>: <span class=hljs-number>100%</span> auto; <span class=hljs-comment>/* 设置了 x 100% */</span>\n  <span class=hljs-attribute>background-position-x</span>: <span class=hljs-number>83%</span>; <span class=hljs-comment>/* x失效，y有效 */</span>\n}</code></pre></section></section><section><h1 id='[\"float\"]' data-index=6>float</h1><section><h2 id='[\"float\",\"浮动与非浮动，发生重叠\"]' data-index=7>浮动与非浮动，发生重叠</h2><p>现有浮动元素 fA，非浮动元素 B。fA 在前，B 在后。</p><ul><li>B 将无视 fA 的存在，发生重叠。</li><li>并且 fA 层叠更高，将覆盖 B（相同 position 情况）</li></ul><p>所以才需要清浮动</p></section><section><h2 id='[\"float\",\"多个float元素，高度不一，换行规律\"]' data-index=8>多个float元素，高度不一，换行规律</h2><p>目前没发现什么实用价值</p></section><section><h2 id='[\"float\",\"js 相关\"]' data-index=9>js 相关</h2><section><h3 id='[\"float\",\"js 相关\",\"压缩报错问题\"]' data-index=10>压缩报错问题</h3><p>作为字面量对象的名称时，尽量以字符串形式。否则无法压缩。原因是float为 javascript 预留保留词</p><pre><code class=language-js><span class=hljs-keyword>var</span> b = { <span class=hljs-attr>float</span>:<span class=hljs-string>'xx'</span> }; <span class=hljs-comment>// 不推荐</span>\n<span class=hljs-keyword>var</span> b = { <span class=hljs-string>'float'</span>: <span class=hljs-string>'xx'</span> }; <span class=hljs-comment>// 推荐</span></code></pre></section></section></section><section><h1 id='[\"transform 变换\"]' data-index=11>transform 变换</h1><section><h2 id='[\"transform 变换\",\"动画性能\"]' data-index=12>动画性能</h2><p>尽量使用 translate3d，但translate3d 会造成模糊，动画完后删掉属性</p></section><section><h2 id='[\"transform 变换\",\"滚动条下面隐藏的元素未渲染\"]' data-index=13>滚动条下面隐藏的元素未渲染</h2><p>滚动条下面未显示的元素，通过设置 translate3d 移上来依然是不显示的</p><p><strong>解决：</strong></p><p>原因是此元素为静态定位(static)所致。设置为非静态定位即可，比如相对定位(relative)</p><p>测试浏览器 chrome 53.0.2785.116 m、android 5.1 webview</p></section><section><h2 id='[\"transform 变换\",\"对inline 元素无效，可使用 inline-block 代替\"]' data-index=14>对inline 元素无效，可使用 inline-block 代替</h2></section><section><h2 id='[\"transform 变换\",\"问题：ios wkwebview translate 居然 100% 不能好好动画，改成99%即可\"]' data-index=15>问题：ios wkwebview translate 居然 100% 不能好好动画，改成99%即可</h2><p>看来跟完全隐藏有关系</p></section></section><section><h1 id='[\"transition 过渡动画\"]' data-index=16>transition 过渡动画</h1><section><h2 id='[\"transition 过渡动画\",\"transition 支持情况：ie10+\"]' data-index=17>transition 支持情况：ie10+</h2></section><section><h2 id='[\"transition 过渡动画\",\"js 操作\"]' data-index=18>js 操作</h2><section><h3 id='[\"transition 过渡动画\",\"js 操作\",\"一般操作步骤\"]' data-index=19>一般操作步骤</h3><p>先加 transition，再设置目的地</p><p>兼容性：ie10+</p><pre><code class=language-js>eBox.style.transition = <span class=hljs-string>'0.3s ease'</span>\neBox.style.transform = <span class=hljs-string>'translateX(100px)'</span>\n</code></pre></section><section><h3 id='[\"transition 过渡动画\",\"js 操作\",\"非 number 属性起始情况\"]' data-index=20>非 number 属性起始情况</h3><p>起始值非 number 的属性，需先设置其实值，还需借助 setTimeout</p><p>兼容性：ie10+。ie setTimeout 不能设为 0，包括 edge</p><pre><code class=language-js>eBox.style.left = <span class=hljs-string>'0'</span> <span class=hljs-comment>// 默认 auto</span>\neBox.style.transition = <span class=hljs-string>'0.3s ease'</span>\nsetTimeout(<span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n  eBox.style.left = <span class=hljs-string>'100px'</span>\n}, <span class=hljs-number>1</span>)</code></pre></section><section><h3 id='[\"transition 过渡动画\",\"js 操作\",\"动态增加 elem 情况\"]' data-index=21>动态增加 elem 情况</h3><p>先加 elem 到页面，再借助 setTimeout</p><p>兼容性：ie10+。ie setTimeout 不能设为 0，包括 edge</p><pre><code class=language-js><span class=hljs-keyword>let</span> eBox = <span class=hljs-built_in>document</span>.createElement(<span class=hljs-string>'div'</span>)\neBox.className = <span class=hljs-string>'a-box'</span>\n<span class=hljs-keyword>this</span>.$el.appendChild(eBox)\nsetTimeout(<span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n  eBox.style.transition = <span class=hljs-string>'0.3s ease'</span>\n  eBox.style.transform = <span class=hljs-string>'translateX(100px)'</span>\n}, <span class=hljs-number>1</span>)</code></pre></section><section><h3 id='[\"transition 过渡动画\",\"js 操作\",\"虽然 ie setTimeout 不能设为 0，但还是异步\"]' data-index=22>虽然 ie setTimeout 不能设为 0，但还是异步</h3><p>发现 ie setTimeout 为0 可能不会触发动画，以为是同步的，但依然是异步</p><pre><code class=language-js><span class=hljs-built_in>console</span>.log(<span class=hljs-number>1</span>)\nsetTimeout(<span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n  <span class=hljs-built_in>console</span>.log(<span class=hljs-number>2</span>)\n}, <span class=hljs-number>0</span>)\n<span class=hljs-built_in>console</span>.log(<span class=hljs-number>3</span>)\n\n<span class=hljs-comment>// 1</span>\n<span class=hljs-comment>// 3</span>\n<span class=hljs-comment>// 2</span></code></pre></section><section><h3 id='[\"transition 过渡动画\",\"js 操作\",\"不用考虑起始值的属性\"]' data-index=23>不用考虑起始值的属性</h3><ul><li>opacity</li><li>transform</li></ul></section><section><h3 id='[\"transition 过渡动画\",\"js 操作\",\"删除 transition 后是否会触发 transitionend 事件？\"]' data-index=24>删除 transition 后是否会触发 transitionend 事件？</h3><p>即动画过程中删除。删除后<strong>不会</strong>触发 transitionend 事件</p><section><h4 id='[\"transition 过渡动画\",\"js 操作\",\"删除 transition 后是否会触发 transitionend 事件？\",\"兼容性\"]' data-index=25>兼容性</h4><p>firefox 无法通过删除 transition 终止动画，所以固定会触发 transitionend。<br>chrome、edge 没问题。</p></section><section><h4 id='[\"transition 过渡动画\",\"js 操作\",\"删除 transition 后是否会触发 transitionend 事件？\",\"测试代码\"]' data-index=26>测试代码</h4><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>template</span>&gt;</span>\n  <span class=hljs-tag>&lt;<span class=hljs-name>div</span>&gt;</span>\n    hello\n  <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>template</span>&gt;</span>\n<span class=hljs-tag>&lt;<span class=hljs-name>script</span>&gt;</span><span class=javascript>\n<span class=hljs-keyword>export</span> <span class=hljs-keyword>default</span> {\n  <span class=hljs-keyword>async</span> mounted () {\n    <span class=hljs-keyword>let</span> el = <span class=hljs-keyword>this</span>.$el\n    <span class=hljs-keyword>let</span> { transitionActive, to } = <span class=hljs-keyword>this</span>.$style\n    <span class=hljs-keyword>let</span> { classList } = el\n    classList.add(transitionActive)\n    el.addEventListener(<span class=hljs-string>'transitionend'</span>, <span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params></span>) </span>{\n      <span class=hljs-built_in>console</span>.log(<span class=hljs-string>'end'</span>)\n    })\n\n    <span class=hljs-keyword>await</span> <span class=hljs-keyword>this</span>.wait(<span class=hljs-number>1</span>)\n    classList.add(to)\n\n    <span class=hljs-keyword>await</span> <span class=hljs-keyword>this</span>.wait(<span class=hljs-number>100</span>) <span class=hljs-comment>// 动画 100ms 后删除</span>\n    classList.remove(transitionActive)\n  },\n  <span class=hljs-attr>methods</span>: {\n    wait (time = <span class=hljs-number>0</span>) {\n      <span class=hljs-keyword>return</span> <span class=hljs-keyword>new</span> <span class=hljs-built_in>Promise</span>(<span class=hljs-function><span class=hljs-params>resolve</span> =&gt;</span> {\n        setTimeout(resolve, time)\n      })\n    }\n  }\n}\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>script</span>&gt;</span>\n\n<span class=hljs-tag>&lt;<span class=hljs-name>style</span> <span class=hljs-attr>module</span>&gt;</span><span class=css>\n<span class=hljs-selector-class>.transitionActive</span> {\n  <span class=hljs-attribute>transition</span>: <span class=hljs-number>0.3s</span> ease;\n  <span class=hljs-attribute>transition-property</span>: opacity, transform;\n}\n<span class=hljs-selector-class>.to</span> {\n  <span class=hljs-attribute>transform</span>: <span class=hljs-built_in>translateX</span>(50%);\n}\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>style</span>&gt;</span>\n</code></pre></section></section><section><h3 id='[\"transition 过渡动画\",\"js 操作\",\"删除 transition 后，之前注册的 transitionend 是否还有效\"]' data-index=27>删除 transition 后，之前注册的 transitionend 是否还有效</h3><p>肯定得有效，也符合正常逻辑</p></section></section></section><section><h1 id='[\"动画库第三方\"]' data-index=28>动画库第三方</h1><p><a href=https://daneden.github.io/animate.css/ >Animate.css</a></p><p><a href=http://vivify.mkcreative.cz/ >vivify</a></p></section><section><h1 id='[\"后代选择写法原则\"]' data-index=29>后代选择写法原则</h1><p>尽量控制在3层</p><p>模块&gt;子模块&gt;随意</p><p>子模块需要可控，尽量小</p></section><section><h1 id='[\"定位\"]' data-index=30>定位</h1><section><h2 id='[\"定位\",\"fiexd\"]' data-index=31>fiexd</h2><p>一些特性：</p><ul><li>不会撑出滚动条</li></ul></section></section><section><h1 id='[\"布局\"]' data-index=32>布局</h1><section><h2 id='[\"布局\",\"ABC并行 A适应，并且最前，BC固定\"]' data-index=33>ABC并行 A适应，并且最前，BC固定</h2><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>template</span>&gt;</span>\n  <span class=hljs-tag>&lt;<span class=hljs-name>div</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>:class</span>=<span class=hljs-string>\"$style.main\"</span>&gt;</span>\n      <span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>:class</span>=<span class=hljs-string>\"$style.mid\"</span>&gt;</span>\n        内容\n      <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n    <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>aside</span> <span class=hljs-attr>:class</span>=<span class=hljs-string>\"$style.aside\"</span>&gt;</span>\n      左侧\n    <span class=hljs-tag>&lt;/<span class=hljs-name>aside</span>&gt;</span>\n    <span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>:class</span>=<span class=hljs-string>\"$style.right\"</span>&gt;</span>\n      右侧\n    <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n  <span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span>\n<span class=hljs-tag>&lt;/<span class=hljs-name>template</span>&gt;</span>\n\n<span class=hljs-tag>&lt;<span class=hljs-name>style</span> <span class=hljs-attr>module</span>&gt;</span><span class=css>\n<span class=hljs-selector-class>.main</span> {\n  <span class=hljs-attribute>float</span>: left;\n  <span class=hljs-attribute>width</span>: <span class=hljs-number>100%</span>;\n  <span class=hljs-attribute>min-height</span>: <span class=hljs-number>100px</span>;\n}\n<span class=hljs-selector-class>.aside</span> {\n  <span class=hljs-attribute>width</span>: <span class=hljs-number>300px</span>;\n  <span class=hljs-attribute>position</span>: relative;\n  <span class=hljs-attribute>float</span>: left;\n  <span class=hljs-attribute>margin-left</span>: -<span class=hljs-number>100%</span>;\n}\n<span class=hljs-selector-class>.mid</span> {\n  <span class=hljs-attribute>margin-left</span>: <span class=hljs-number>300px</span>;\n}\n<span class=hljs-selector-class>.right</span> {\n  <span class=hljs-attribute>width</span>: <span class=hljs-number>375px</span>;\n  <span class=hljs-attribute>margin-left</span>: -<span class=hljs-number>375px</span>;\n}\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>style</span>&gt;</span></code></pre></section><section><h2 id='[\"布局\",\"AB并行，A固定，B自适应\"]' data-index=34>AB并行，A固定，B自适应</h2><section><h3 id='[\"布局\",\"AB并行，A固定，B自适应\",\"浮动在前\"]' data-index=35>浮动在前</h3><p>left + margin：浮动重叠特性</p><p>left + overflow:hidden</p></section></section><section><h2 id='[\"布局\",\"居中布局\"]' data-index=36>居中布局</h2><pre><code class=language-css><span class=hljs-selector-class>.center</span> {\n  <span class=hljs-attribute>position</span>: absolute;\n  <span class=hljs-attribute>top</span>: <span class=hljs-number>50%</span>;\n  <span class=hljs-attribute>left</span>: <span class=hljs-number>50%</span>;\n  <span class=hljs-attribute>transform</span>: <span class=hljs-built_in>translate</span>(-50%, -50%);\n}</code></pre></section><section><h2 id='[\"布局\",\"居中布局 2\"]' data-index=37>居中布局 2</h2><pre><code class=language-css><span class=hljs-selector-class>.center</span> {\n  <span class=hljs-attribute>width</span>: <span class=hljs-number>320px</span>;\n\n  <span class=hljs-attribute>position</span>: fixed;\n  <span class=hljs-attribute>display</span>: table;\n  <span class=hljs-attribute>z-index</span>: <span class=hljs-number>99</span>;\n  <span class=hljs-attribute>top</span>: <span class=hljs-number>0</span>;\n  <span class=hljs-attribute>right</span>: <span class=hljs-number>0</span>;\n  <span class=hljs-attribute>bottom</span>: <span class=hljs-number>0</span>;\n  <span class=hljs-attribute>left</span>: <span class=hljs-number>0</span>;\n  <span class=hljs-attribute>margin</span>: auto;\n}</code></pre></section></section><section><h1 id='[\"弹性盒 flex\"]' data-index=38>弹性盒 flex</h1><section><h2 id='[\"弹性盒 flex\",\"flex 弹性盒布局\"]' data-index=39>flex 弹性盒布局</h2><p><code>width: 600px</code> 等同 <code>flex:0 600px</code></p></section></section><section><h1 id='[\"文本\"]' data-index=40>文本</h1><section><h2 id='[\"文本\",\"word-spacing：html 空格宽度控制\"]' data-index=41>word-spacing：html 空格宽度控制</h2><blockquote><p>关键字：空格 空格控制 空格宽度 空格大小</p></blockquote><pre><code class=language-html><span class=hljs-tag>&lt;<span class=hljs-name>style</span>&gt;</span><span class=css>\n<span class=hljs-selector-class>.l-label</span>{\n    <span class=hljs-attribute>word-spacing</span>: <span class=hljs-number>30px</span>;    \n}\n</span><span class=hljs-tag>&lt;/<span class=hljs-name>style</span>&gt;</span>\n<span class=hljs-tag>&lt;<span class=hljs-name>div</span> <span class=hljs-attr>class</span>=<span class=hljs-string>\"l-label\"</span>&gt;</span>行 为:<span class=hljs-tag>&lt;/<span class=hljs-name>div</span>&gt;</span></code></pre><p>&#39;行为&#39;文本之间有个空格，即控制此空格的间距</p></section><section><h2 id='[\"文本\",\"换行\"]' data-index=42>换行</h2><p>单词默认会自动换行，字母就要加下面的</p><pre><code class=language-css><span class=hljs-selector-class>.t</span> {\n  <span class=hljs-attribute>word-wrap</span>: break-word;\n  <span class=hljs-attribute>word-break</span>: break-all;\n}</code></pre><p>兼容性：所有浏览器</p></section><section><h2 id='[\"文本\",\"不换行\"]' data-index=43>不换行</h2><pre><code class=language-css><span class=hljs-selector-class>.t</span>{\n  <span class=hljs-attribute>white-space</span>: nowrap;      \n}\n</code></pre></section><section><h2 id='[\"文本\",\"裁剪\"]' data-index=44>裁剪</h2><p>快速使用：</p><pre><code class=language-css><span class=hljs-selector-class>.test</span>{\n  <span class=hljs-attribute>width</span>:<span class=hljs-number>10px</span>;\n  <span class=hljs-attribute>overflow</span>:hidden;\n  <span class=hljs-attribute>text-overflow</span>:ellipsis;\n  <span class=hljs-attribute>white-space</span>: nowrap;    \n}</code></pre><p>兼容性：包括ie6的所有</p></section><section><h2 id='[\"文本\",\"垂直居中\"]' data-index=45>垂直居中</h2><p>文本垂直居中。待测</p><pre><code class=language-css><span class=hljs-selector-class>.test</span>{\n  <span class=hljs-attribute>display</span>: flex;\n  <span class=hljs-attribute>align-items</span>: center;\n  <span class=hljs-attribute>justify-content</span>: center;\n}</code></pre></section><section><h2 id='[\"文本\",\"文字描边\"]' data-index=46>文字描边</h2><pre><code class=language-css><span class=hljs-selector-class>.demo</span> {\n  <span class=hljs-attribute>-webkit-text-stroke</span>: <span class=hljs-number>4px</span> red;\n}</code></pre></section></section><section><h1 id='[\"比例单位\"]' data-index=47>比例单位</h1><section><h3 id='[\"比例单位\",null,\"em\"]' data-index=48>em</h3><p>不会参照以 <code>[rm]</code> 单位的上级元素，固定找到设置为<code>[px]</code>的上级元素</p><p>只能用于字体单位？</p></section><section><h3 id='[\"比例单位\",null,\"rem\"]' data-index=49>rem</h3><p><strong>还可作为其他尺寸单位</strong></p><p><strong>兼容性：ie9+</strong></p><p><strong>chrome 最小 12px</strong></p><p>chrome html 最小字体为<code>12px</code>，小于<code>12px</code>的都按<code>12px</code>算。</p><p>ie9+、edge、firefox 都没有这个问题</p><p>代码所示，div width应该是700才对，可实际是1200。</p><pre><code class=language-css><span class=hljs-selector-tag>html</span>{\n    <span class=hljs-attribute>font-size</span>:<span class=hljs-number>7px</span>\n}\n<span class=hljs-selector-tag>div</span>{\n    <span class=hljs-attribute>width</span>:<span class=hljs-number>100rem</span>;\n}</code></pre><p><strong>rem 自适应js备份</strong></p><pre><code class=language-js><span class=hljs-comment>// 自适应</span>\n<span class=hljs-keyword>let</span> w = <span class=hljs-built_in>window</span>.innerWidth\n<span class=hljs-keyword>if</span> (w &lt; <span class=hljs-number>360</span>) {\n    <span class=hljs-comment>// browserWidth * p = fontSize</span>\n    <span class=hljs-comment>// 即：</span>\n    <span class=hljs-comment>// p = fontSize / browserWidth</span>\n    <span class=hljs-built_in>document</span>.documentElement.style.fontSize = w * <span class=hljs-number>0.28</span> + <span class=hljs-string>'px'</span>\n}</code></pre></section></section><section><h1 id='[\"毛玻璃\"]' data-index=50>毛玻璃</h1><p>毛玻璃。让元素变模糊 -webkit-filter: blur(3px);</p></section><section><h1 id='[\"滚动，滚动条\"]' data-index=51>滚动，滚动条</h1><section><h2 id='[\"滚动，滚动条\",\"滚动条样式\"]' data-index=52>滚动条样式</h2><pre><code class=language-css><span class=hljs-comment>/*** ie ***/</span>  \n*{  \n  scrollbar-face-color:#F3F3F3; <span class=hljs-comment>/*面子*/</span>  \n  scrollbar-arrow-color:#C0C0C0; <span class=hljs-comment>/*箭头*/</span>  \n  scrollbar<span class=hljs-number>-3</span>dlight-color:#C0C0C0; <span class=hljs-comment>/*最外左*/</span>  \n  scrollbar-highlight-color:#FFFFFF; <span class=hljs-comment>/*左二*/</span>  \n  scrollbar-shadow-color:#FFFFFF; <span class=hljs-comment>/*右二*/</span>  \n  scrollbar-darkshadow-color:#C0C0C0; <span class=hljs-comment>/*右一*/</span>  \n  scrollbar-track-color:#F3F3F3; <span class=hljs-comment>/*滑道*/</span>  \n }  \n\n<span class=hljs-comment>/*** webkit ***/</span>  \n<span class=hljs-comment>/*滚动条整体*/</span>\n::-webkit-scrollbar{\n  width:<span class=hljs-number>14</span>px; <span class=hljs-comment>/*滚动条宽度*/</span>\n}\n<span class=hljs-comment>/*滚动条按钮*/</span>\n<span class=hljs-comment>/* ::-webkit-scrollbar-button {\n\n} */</span>\n<span class=hljs-comment>/* 滑道 */</span>\n::-webkit-scrollbar-track{\n  background-color:#F3F3F3;\n}\n<span class=hljs-comment>/* ::-webkit-scrollbar-track-piece{\n  background-color:#F3F3F3;\n} */</span>\n\n<span class=hljs-comment>/*横竖滚动条交角*/</span>\n<span class=hljs-comment>/* ::-webkit-scrollbar-corner {\n  background-color: #F3F3F3;\n} */</span>\n<span class=hljs-comment>/*横竖滚动条交角图案*/</span>\n<span class=hljs-comment>/* ::-webkit-resizer {\n  background-repeat: no-repeat;\n  background-position: bottom right;\n} */</span>\n<span class=hljs-comment>/*滚动条*/</span>\n::-webkit-scrollbar-thumb{\n  background-color:#F3F3F3;\n  border:solid <span class=hljs-number>1</span>px #C0C0C0;\n}\n::-webkit-scrollbar-thumb:hover{\n  background-color:#F3F3E0;\n}\n</code></pre></section><section><h2 id='[\"滚动，滚动条\",\"加滚动惯性 - IOS 移动端\"]' data-index=53>加滚动惯性 - IOS 移动端</h2><p><code>-webkit-overflow-scrolling: touch;</code></p><p>网站参考：<br><a href=http://www.renfei.org/blog/how-to-add-ios-inertial-scrolling-to-a-fixed-height-element.html>为固定高度的网页元素添加 iOS Safari 滚动「惯性效果」的方法</a></p></section></section><section><h1 id='[\"滤镜\"]' data-index=54>滤镜</h1><section><h2 id='[\"滤镜\",\"滤镜 - 标准？\"]' data-index=55>滤镜 - 标准？</h2><p>非 ie 也有滤镜了</p><pre><code class=language-css><span class=hljs-selector-class>.test</span> {\n  <span class=hljs-attribute>filter</span>: <span class=hljs-built_in>brightness</span>(0.7) <span class=hljs-built_in>contrast</span>(0.8) <span class=hljs-built_in>sepia</span>(1) <span class=hljs-built_in>hue-rotate</span>(160deg) <span class=hljs-built_in>saturate</span>(3);\n}\n</code></pre></section></section><section><h1 id='[\"移动端问题\"]' data-index=56>移动端问题</h1><section><h2 id='[\"移动端问题\",\"ios 去掉点击阴影\"]' data-index=57>ios 去掉点击阴影</h2><p>a标签的href，或者给元素绑定click，Android ios 会有阴影。可通过如下方式去掉</p><p>给 body 设置即可</p><pre><code class=language-css><span class=hljs-selector-tag>body</span> {\n  <span class=hljs-attribute>-webkit-tap-highlight-color</span>:transparent;\n}</code></pre></section></section><section><h1 id='[\"选择器\"]' data-index=58>选择器</h1><section><h2 id='[\"选择器\",\"奇偶选择\"]' data-index=59>奇偶选择</h2><pre><code class=language-css><span class=hljs-selector-tag>li</span><span class=hljs-selector-pseudo>:nth-child(2n)</span>{<span class=hljs-attribute>color</span>:<span class=hljs-number>#f00</span>;} <span class=hljs-comment>/* 偶数 */</span>\n<span class=hljs-selector-tag>li</span><span class=hljs-selector-pseudo>:nth-child(2n+1)</span>{<span class=hljs-attribute>color</span>:<span class=hljs-number>#000</span>;} <span class=hljs-comment>/* 奇数 */</span></code></pre></section></section>"})