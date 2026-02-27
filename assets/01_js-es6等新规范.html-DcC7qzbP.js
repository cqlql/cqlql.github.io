import{_ as n}from"./plugin-vue_export-helper-DlAUqK2U.js";import{c as i,i as a,o as e}from"./app-Da628rHu.js";const l={};function p(t,s){return e(),i("div",null,[...s[0]||(s[0]=[a(`<h2 id="class" tabindex="-1"><a class="header-anchor" href="#class"><span>class</span></a></h2><h3 id="常用模式、性能" tabindex="-1"><a class="header-anchor" href="#常用模式、性能"><span>常用模式、性能</span></a></h3><p>es6 class 常用模式:</p><div class="language-js line-numbers-mode" data-highlighter="shiki" data-ext="js" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-js"><span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// 私有成员，创建在class 外面，如果还是有其他class，使用 即时函数了</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// 此为目前无奈解决方案</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// 功能初始，最先执行，只执行一次</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">function</span><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;"> testInit</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">() {</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">    // 保证只执行一次</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">    testInit</span><span style="--shiki-light:#0184BC;--shiki-dark:#56B6C2;">=</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">function</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">(){};</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">class</span><span style="--shiki-light:#C18401;--shiki-dark:#E5C07B;"> test</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">{</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">    constructor</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">(){</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">        // 公共成员，非共享</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">    }</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">    // 公共成员，共享</span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">    </span></span>
<span class="line"><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="基本语法" tabindex="-1"><a class="header-anchor" href="#基本语法"><span>基本语法</span></a></h3><p>属性只能在constructor函数中创建</p><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-"><span class="line"><span>// 定义类</span></span>
<span class="line"><span>class hello {</span></span>
<span class="line"><span>  </span></span>
<span class="line"><span>  // 构造函数，如果没有显式定义，一个空的constructor方法会被默认添加。</span></span>
<span class="line"><span>  constructor(name) {</span></span>
<span class="line"><span>    // new 的时候执行</span></span>
<span class="line"><span>    // 参数也是 new 的时候传入的</span></span>
<span class="line"><span>    </span></span>
<span class="line"><span>    this.name = name;</span></span>
<span class="line"><span>    </span></span>
<span class="line"><span>    // 默认返回实例对象（即this）,完全可以指定返回另外一个对象</span></span>
<span class="line"><span>    // return {}</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>  </span></span>
<span class="line"><span>  // 方法成员</span></span>
<span class="line"><span>  hi() {</span></span>
<span class="line"><span>    return &#39;hello &#39;+this.name;</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// 调用。不使用new是没法调用的，会报错</span></span>
<span class="line"><span>let p1 = new hello(&#39;jony&#39;);</span></span>
<span class="line"><span></span></span>
<span class="line"><span>let p2 = new hello; // 不传参也没事</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="继承" tabindex="-1"><a class="header-anchor" href="#继承"><span>继承</span></a></h3><h4 id="速度使用" tabindex="-1"><a class="header-anchor" href="#速度使用"><span>速度使用</span></a></h4><p>extends：继承关键字 super：执行父类的构造函数</p><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-"><span class="line"><span>class ColorPoint extends Point {</span></span>
<span class="line"><span>  constructor(x, y, color) {</span></span>
<span class="line"><span>    super(x, y); // 调用父类的constructor(x, y)</span></span>
<span class="line"><span>    this.color = color;</span></span>
<span class="line"><span>  } </span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,11)])])}const r=n(l,[["render",p]]),h=JSON.parse('{"path":"/old__/01_js-es6%E7%AD%89%E6%96%B0%E8%A7%84%E8%8C%83.html","title":"","lang":"zh-CN","frontmatter":{"description":"class 常用模式、性能 es6 class 常用模式: 基本语法 属性只能在constructor函数中创建 继承 速度使用 extends：继承关键字 super：执行父类的构造函数","head":[["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"\\",\\"image\\":[\\"\\"],\\"dateModified\\":\\"2024-10-28T02:50:25.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"桥黎\\",\\"url\\":\\"\\"}]}"],["meta",{"property":"og:url","content":"http://docs.cqlql.top/old__/01_js-es6%E7%AD%89%E6%96%B0%E8%A7%84%E8%8C%83.html"}],["meta",{"property":"og:site_name","content":"开发笔记"}],["meta",{"property":"og:description","content":"class 常用模式、性能 es6 class 常用模式: 基本语法 属性只能在constructor函数中创建 继承 速度使用 extends：继承关键字 super：执行父类的构造函数"}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2024-10-28T02:50:25.000Z"}],["meta",{"property":"article:modified_time","content":"2024-10-28T02:50:25.000Z"}]]},"git":{"createdTime":1652927496000,"updatedTime":1730083825000,"contributors":[{"name":"cqlql","username":"cqlql","email":"cql.ql@qq.com","commits":1,"url":"https://github.com/cqlql"},{"name":"陈桥黎","username":"","email":"cql.ql@qq.com","commits":1}]},"readingTime":{"minutes":0.92,"words":277},"filePathRelative":"__old__/01_js-es6等新规范.md","autoDesc":true}');export{r as comp,h as data};
