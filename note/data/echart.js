window['cb_echart']({"outline":[{"id":"1729873713","level":1,"name":"tooltip 提示框浮层（可以跟随鼠标）","children":[]},{"id":"671623913","level":1,"name":"饼图","children":[{"id":"2951667942","level":2,"name":"控制饼图半径大小 - radius","children":[]}]}],"content":"<section><h1 id=\"1729873713\">tooltip 提示框浮层（可以跟随鼠标）</h1><p><a href=\"https://echarts.apache.org/zh/option.html#tooltip\">tooltip 文档</a></p>\n<p>也可在具体的 series 中单独配置</p>\n<pre><code class=\"language-js\"><span class=\"hljs-selector-tag\">myChart</span><span class=\"hljs-selector-class\">.setOption</span>({\n  <span class=\"hljs-attribute\">series</span>: [\n    {\n      tooltip: {\n        formatter: <span class=\"hljs-string\">'{a}&lt;br /&gt;{b}: {c}'</span>,\n      },\n    },\n  ],\n})</code></pre>\n</section><section><h1 id=\"671623913\">饼图</h1><section><h2 id=\"2951667942\">控制饼图半径大小 - radius</h2><p><a href=\"https://echarts.apache.org/zh/option.html#series-pie.radius\">文档 pie.radius</a></p>\n<pre><code class=\"language-js\">option = {\n  series: [\n    {\n      name: <span class=\"hljs-string\">'Access From'</span>,\n      <span class=\"hljs-keyword\">type</span>: <span class=\"hljs-string\">'pie'</span>,\n      radius: <span class=\"hljs-string\">'100%'</span>,\n\n      <span class=\"hljs-comment\">// 也可是数组：控制内外圆半径</span>\n      <span class=\"hljs-comment\">// radius: ['60%', '90%'],</span>\n\n      data: [\n        { value: <span class=\"hljs-number\">1048</span>, name: <span class=\"hljs-string\">'Search Engine'</span> },\n        { value: <span class=\"hljs-number\">735</span>, name: <span class=\"hljs-string\">'Direct'</span> },\n        { value: <span class=\"hljs-number\">580</span>, name: <span class=\"hljs-string\">'Email'</span> },\n        { value: <span class=\"hljs-number\">484</span>, name: <span class=\"hljs-string\">'Union Ads'</span> },\n        { value: <span class=\"hljs-number\">300</span>, name: <span class=\"hljs-string\">'Video Ads'</span> },\n      ],\n    },\n  ],\n}</code></pre>\n"})