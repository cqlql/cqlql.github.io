window['cb_功能代码临时记录']({"outline":{"children":[{"index":0,"level":1,"name":"递归","children":[{"index":1,"level":2,"name":"带级数的递归","children":[]}]}],"name":"功能代码临时记录"},"content":"<section><h1 id=递归 data-index=0>递归</h1><section><h2 id=带级数的递归 data-index=1>带级数的递归</h2><p>1</p><pre><code class=language-js><span class=hljs-function><span class=hljs-keyword>function</span> <span class=hljs-title>handle</span>(<span class=hljs-params>itms,lv</span>) </span>{\n\n    each(itms,<span class=hljs-function><span class=hljs-keyword>function</span> (<span class=hljs-params>itm</span>) </span>{\n        <span class=hljs-keyword>if</span>(lv&lt;level){\n            itm.classList.remove(<span class=hljs-string>'fold'</span>)\n        }<span class=hljs-keyword>else</span>{\n            itm.classList.add(<span class=hljs-string>'fold'</span>)\n        }\n        <span class=hljs-keyword>let</span> child = itm.children\n        handle((child[<span class=hljs-number>1</span>]||child[<span class=hljs-number>0</span>]).children,lv+<span class=hljs-number>1</span>)\n    })\n}\n\nhandle(items,<span class=hljs-number>1</span>)</code></pre></section></section>"})