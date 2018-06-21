window['cb_canvas 画图']({"outline":{"children":[{"index":0,"level":1,"name":"canvas.drawImage","children":[{"index":1,"level":2,"name":"语法","children":[]},{"index":2,"level":2,"name":"兼容问题：","children":[]}]},{"index":3,"level":1,"name":"画圆 画弧","children":[{"index":4,"level":2,"name":"MDN 文档参考","children":[]},{"index":5,"level":2,"name":"画圆弧线条。实现进度条","children":[]}]},{"index":6,"level":1,"name":"画线","children":[{"index":7,"level":2,"name":"1px 看是去有2px","children":[]}]},{"index":8,"level":1,"name":"经验 - 画笔效果，实现","children":[]},{"index":9,"level":1,"name":"经验 - 统计，画轴，画网格，实现","children":[]},{"index":10,"level":1,"name":"经验 - 饼图统计，线末端转折","children":[]}],"name":"canvas 画图"},"content":"<section><h1 id=canvas.drawImage data-index=0>canvas.drawImage</h1><p>提供直接绘制图片的功能</p><section><h2 id=语法 data-index=1>语法</h2><p>canvas.drawImage(image, dx, dy)</p></section><section><h2 id=兼容问题： data-index=2>兼容问题：</h2><p><strong>浏览器：</strong> Android webkit 53.30 v4.0</p><p><strong>image 参数</strong></p><ul><li>是另一个canvas，则必须加到页面才能成功绘制。</li><li>是 img 元素，src 是 base 64，好像也无法绘制(待确定)</li></ul></section></section><section><h1 id=\"画圆 画弧\" data-index=3>画圆 画弧</h1><section><h2 id=\"MDN 文档参考\" data-index=4>MDN 文档参考</h2><p><a href=https://developer.mozilla.org/zh-CN/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors>线条、填充样式颜色API</a></p><p><a href=https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/arc>圆弧 API</a></p></section><section><h2 id=画圆弧线条。实现进度条 data-index=5>画圆弧线条。实现进度条</h2><pre><code class=language-js>\n<span class=hljs-keyword>var</span> canvas = <span class=hljs-built_in>document</span>.getElementById(<span class=hljs-string>\"canvas\"</span>);\n<span class=hljs-keyword>var</span> ctx = canvas.getContext(<span class=hljs-string>\"2d\"</span>);\nctx.strokeStyle = <span class=hljs-string>'red'</span>\nctx.lineWidth = <span class=hljs-number>6</span>;\nctx.lineCap = <span class=hljs-string>\"round\"</span>; <span class=hljs-comment>// 末端样式</span>\nctx.beginPath();\n<span class=hljs-comment>// 右边x轴开始画，也就是参数所示，画的起始点是 x100, y50</span>\n<span class=hljs-comment>// 参数依次是：圆心x, 圆心y, r, 起始弧度, 结束弧度, 默认顺时针</span>\nctx.arc(<span class=hljs-number>50</span>, <span class=hljs-number>50</span>, <span class=hljs-number>50</span>, <span class=hljs-number>0.3</span> * <span class=hljs-built_in>Math</span>.PI, <span class=hljs-number>1.6</span> * <span class=hljs-built_in>Math</span>.PI);\nctx.stroke();\n</code></pre></section></section><section><h1 id=画线 data-index=6>画线</h1><section><h2 id=\"1px 看是去有2px\" data-index=7>1px 看是去有2px</h2><p>画线的坐标参数，是从两个像素之间开始算的，由于抗锯齿，所以看上去是2px</p><p><strong>坐标起始位置，0位置</strong>：canvas 边框内边边缘</p><p>所以要画出1px的线，需要给坐标加 0.5。下例将画出紧贴内边(真正的0起始)1px的线</p><pre><code class=language-js>ctx.beginPath()\n<span class=hljs-keyword>let</span> y = <span class=hljs-number>0.5</span>\nctx.moveTo(<span class=hljs-number>0</span>, y)\nctx.lineTo(<span class=hljs-number>300</span>, y)\nctx.stroke()</code></pre></section></section><section><h1 id=\"经验 - 画笔效果，实现\" data-index=8>经验 - 画笔效果，实现</h1><p>首先是移动轨迹的所有点。也就是监听移动事件，这里可以知道移动轨迹的所有点。</p><p>然后用 lineTo 连接即可。</p><p>边触发边连接</p></section><section><h1 id=\"经验 - 统计，画轴，画网格，实现\" data-index=9>经验 - 统计，画轴，画网格，实现</h1><p>其实只算出刻度数据即可</p><p>x轴，算y刻度</p><p>y轴，算x刻度</p><p>然后再根据刻度数据画轴，画网格，数据与视图分离</p></section><section><h1 id=\"经验 - 饼图统计，线末端转折\" data-index=10>经验 - 饼图统计，线末端转折</h1><p>根据线所在圆的角度判断即可</p></section>"})