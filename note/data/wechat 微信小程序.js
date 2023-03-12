window['cb_wechat 微信小程序']({"outline":[{"id":"1084370190","level":1,"name":"00速查","children":[{"id":"2563550190","level":2,"name":"相册选图片、视频，相机拍视频、拍照","children":[]}]},{"id":"862022217","level":1,"name":"API 部分常用","children":[{"id":"4144903406","level":2,"name":"获取 appId","children":[]},{"id":"1390842420","level":2,"name":"窗口信息(尺寸等)","children":[]}]},{"id":"3853568050","level":1,"name":"canvas","children":[]},{"id":"1973866773","level":1,"name":"iphoneX 安全区域","children":[]},{"id":"1854655302","level":1,"name":"临时速记","children":[{"id":"2665075546","level":2,"name":"其它","children":[{"id":"3603200220","level":3,"name":"<a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/MINA.html#%E5%93%8D%E5%BA%94%E7%9A%84%E6%95%B0%E6%8D%AE%E7%BB%91%E5%AE%9A\">通过 setData 进行响应式更新</a>","children":[]},{"id":"4033688384","level":3,"name":"<a href=\"https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/\">wxs 语法</a>","children":[]},{"id":"3112690485","level":3,"name":"<a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/page-life-cycle.html\">页面生命周期</a>","children":[]},{"id":"355953560","level":3,"name":"<a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/lifetimes.html\">组件生命周期</a>","children":[]},{"id":"1873493483","level":3,"name":"<a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/view/animation.html\">动画</a>","children":[]},{"id":"3999172376","level":3,"name":"<a href=\"https://developers.weixin.qq.com/miniprogram/dev/reference/api/Component.html\">组件字段</a>","children":[]},{"id":"915081035","level":3,"name":"<a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/\">自定义组件</a>","children":[]},{"id":"4185726340","level":3,"name":"<a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/module.html\">模块化</a>","children":[]},{"id":"3557498693","level":3,"name":"<a href=\"https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html\">网络请求</a>","children":[]},{"id":"3856730603","level":3,"name":"image","children":[]}]},{"id":"2041045491","level":2,"name":"指定页面背景色","children":[]},{"id":"2752003125","level":2,"name":"基础组件","children":[]},{"id":"2946510785","level":2,"name":"本地存储","children":[]},{"id":"1326741342","level":2,"name":"全局变量","children":[]},{"id":"137307672","level":2,"name":"双向绑定","children":[]},{"id":"2145753271","level":2,"name":"wxml 语法","children":[]},{"id":"3922668054","level":2,"name":"自定义组件","children":[{"id":"3953040683","level":3,"name":"插槽","children":[]}]},{"id":"3007449279","level":2,"name":"坐标尺寸","children":[]},{"id":"2871388790","level":2,"name":"路由|页面跳转","children":[{"id":"2877321283","level":3,"name":"页面传值","children":[]}]},{"id":"2982501154","level":2,"name":"事件","children":[]},{"id":"3728014669","level":2,"name":"权限总结","children":[]},{"id":"1879589429","level":2,"name":"问题记录","children":[]},{"id":"257444121","level":2,"name":"富文本","children":[]}]},{"id":"1374059694","level":1,"name":"导航栏控制","children":[]},{"id":"1109100513","level":1,"name":"登录","children":[{"id":"2199816326","level":2,"name":"概述","children":[]},{"id":"190098528","level":2,"name":"拿 openId","children":[]},{"id":"3995899957","level":2,"name":"获取用户信息 - 废弃","children":[{"id":"2823311804","level":3,"name":"授权后可直接获取","children":[]},{"id":"1880598467","level":3,"name":"通过专门的按钮","children":[]}]},{"id":"2433893927","level":2,"name":"获取用户信息 getUserProfile","children":[]},{"id":"562068359","level":2,"name":"获取手机号 - 只能按钮获取","children":[]},{"id":"3577905484","level":2,"name":"代码示例","children":[]}]},{"id":"3610273786","level":1,"name":"组件","children":[{"id":"3238219927","level":2,"name":"image","children":[]},{"id":"510334560","level":2,"name":"到底加载/下拉刷新","children":[]}]},{"id":"3391842892","level":1,"name":"节点","children":[{"id":"609777599","level":2,"name":"获取、尺寸","children":[]},{"id":"1847203482","level":2,"name":"相关文档","children":[]}]},{"id":"1782065560","level":1,"name":"页面传值","children":[{"id":"2945763281","level":2,"name":"url 方式","children":[]},{"id":"823855320","level":2,"name":"events 方式","children":[{"id":"300243895","level":3,"name":"注意事项","children":[]}]}]}],"content":"<section><h1 id=\"1084370190\">00速查</h1><section><h2 id=\"2563550190\">相册选图片、视频，相机拍视频、拍照</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.chooseMedia.html\">wx.chooseMedia - 官方</a></p>\n</section></section><section><h1 id=\"862022217\">API 部分常用</h1><section><h2 id=\"4144903406\">获取 appId</h2><pre><code class=\"language-js\"><span class=\"hljs-keyword\">let</span> { miniProgram } = wx.getAccountInfoSync()\n<span class=\"hljs-built_in\">console</span>.log(miniProgram.appId)</code></pre>\n</section><section><h2 id=\"1390842420\">窗口信息(尺寸等)</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getWindowInfo.html\">wx.getWindowInfo</a></p>\n</section></section><section><h1 id=\"3853568050\">canvas</h1><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html\">canvas</a></p>\n<p>以下是 taro 例子</p>\n<pre><code class=\"language-html\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">template</span>&gt;</span>\n  <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">div</span>&gt;</span> <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">canvas</span> <span class=\"hljs-attr\">type</span>=<span class=\"hljs-string\">\"2d\"</span> <span class=\"hljs-attr\">id</span>=<span class=\"hljs-string\">\"canvas\"</span> <span class=\"hljs-attr\">style</span>=<span class=\"hljs-string\">\"width: 300px; height: 300px\"</span>&gt;</span><span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">canvas</span>&gt;</span> <span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">div</span>&gt;</span>\n<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">template</span>&gt;</span>\n\n<span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">script</span> <span class=\"hljs-attr\">lang</span>=<span class=\"hljs-string\">\"ts\"</span> <span class=\"hljs-attr\">setup</span>&gt;</span><span class=\"javascript\">\n  <span class=\"hljs-keyword\">import</span> { useReady } <span class=\"hljs-keyword\">from</span> <span class=\"hljs-string\">'@tarojs/taro'</span>\n  useReady(<span class=\"hljs-function\"><span class=\"hljs-params\">()</span> =&gt;</span> {\n    wx.createSelectorQuery()\n      .select(<span class=\"hljs-string\">'#canvas'</span>)\n      .fields(\n        {\n          <span class=\"hljs-attr\">node</span>: <span class=\"hljs-literal\">true</span>,\n        },\n        <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">res</span>) </span>{\n          <span class=\"hljs-built_in\">console</span>.log(res)\n        },\n      )\n      .exec()\n  })\n</span><span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">script</span>&gt;</span></code></pre>\n</section><section><h1 id=\"1973866773\">iphoneX 安全区域</h1><p><a href=\"https://developers.weixin.qq.com/community/develop/article/doc/000604d707c5b023a049ba7125b413\">https://developers.weixin.qq.com/community/develop/article/doc/000604d707c5b023a049ba7125b413</a></p>\n<pre><code class=\"language-css\"><span class=\"hljs-comment\">/* 用法示例 */</span>\n<span class=\"hljs-selector-class\">.test</span> {\n  <span class=\"hljs-attribute\">bottom</span>: <span class=\"hljs-built_in\">calc</span>(50px + constant(safe-area-inset-bottom));\n  <span class=\"hljs-attribute\">padding-bottom</span>: <span class=\"hljs-built_in\">constant</span>(safe-area-inset-bottom);\n  <span class=\"hljs-comment\">/* iOS 11.2 beta及其后 */</span>\n  <span class=\"hljs-attribute\">bottom</span>: <span class=\"hljs-built_in\">calc</span>(50px + env(safe-area-inset-bottom));\n  <span class=\"hljs-attribute\">padding-bottom</span>: <span class=\"hljs-built_in\">env</span>(safe-area-inset-bottom);\n}</code></pre>\n</section><section><h1 id=\"1854655302\">临时速记</h1><section><h2 id=\"2665075546\">其它</h2><section><h3 id=\"3603200220\"><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/MINA.html#%E5%93%8D%E5%BA%94%E7%9A%84%E6%95%B0%E6%8D%AE%E7%BB%91%E5%AE%9A\">通过 setData 进行响应式更新</a></h3></section><section><h3 id=\"4033688384\"><a href=\"https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/\">wxs 语法</a></h3></section><section><h3 id=\"3112690485\"><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/page-life-cycle.html\">页面生命周期</a></h3></section><section><h3 id=\"355953560\"><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/lifetimes.html\">组件生命周期</a></h3></section><section><h3 id=\"1873493483\"><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/view/animation.html\">动画</a></h3></section><section><h3 id=\"3999172376\"><a href=\"https://developers.weixin.qq.com/miniprogram/dev/reference/api/Component.html\">组件字段</a></h3></section><section><h3 id=\"915081035\"><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/\">自定义组件</a></h3></section><section><h3 id=\"4185726340\"><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/module.html\">模块化</a></h3></section><section><h3 id=\"3557498693\"><a href=\"https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html\">网络请求</a></h3></section><section><h3 id=\"3856730603\">image</h3><p>显示模式 mode，请查看 <a href=\"https://developers.weixin.qq.com/miniprogram/dev/component/image.html\">image 文档</a></p>\n</section></section><section><h2 id=\"2041045491\">指定页面背景色</h2><p>每个页面 wxss 文件都可以单独设置背景色，可通过 <code>app.wxss</code> 设置全局的</p>\n<pre><code class=\"language-css\"><span class=\"hljs-selector-tag\">page</span> {\n  <span class=\"hljs-attribute\">background-color</span>: <span class=\"hljs-number\">#f7f7f7</span>;\n}</code></pre>\n</section><section><h2 id=\"2752003125\">基础组件</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/component/\">基础组件</a></p>\n</section><section><h2 id=\"2946510785\">本地存储</h2><pre><code class=\"language-js\">wx.setStorageSync(<span class=\"hljs-string\">'logs'</span>, {})\nwx.getStorageSync(<span class=\"hljs-string\">'logs'</span>)</code></pre>\n</section><section><h2 id=\"1326741342\">全局变量</h2><pre><code class=\"language-js\"><span class=\"hljs-selector-tag\">App</span>({\n  <span class=\"hljs-attribute\">onLaunch</span>: function () {},\n  <span class=\"hljs-selector-tag\">globalData</span>: {\n    <span class=\"hljs-attribute\">user_protocol</span>: <span class=\"hljs-string\">''</span>, // 用户协议 网址\n    user_private_protocol: <span class=\"hljs-string\">''</span>, // 隐私协议 网址\n    userInfoHasChange: false,\n  },\n})</code></pre>\n</section><section><h2 id=\"137307672\">双向绑定</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/view/two-way-bindings.html\">简易双向绑定</a></p>\n<p>直接可通过 setData 修改 properties</p>\n</section><section><h2 id=\"2145753271\">wxml 语法</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/\">wxml 语法</a></p>\n<p><code>&lt;block&gt;</code> 类似 html 中的 <code>&lt;template&gt;</code>?</p>\n<pre><code class=\"language-xml\"><span class=\"hljs-comment\">&lt;!-- for循环 --&gt;</span>\n<span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">view</span> <span class=\"hljs-attr\">wx:for</span>=<span class=\"hljs-string\">\"{{list}}\"</span> <span class=\"hljs-attr\">wx:key</span>=<span class=\"hljs-string\">\"id\"</span> <span class=\"hljs-attr\">class</span>=<span class=\"hljs-string\">\"t-item\"</span>&gt;</span>\n{{index}}: {{item.name}}\n<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">view</span>&gt;</span>\n\n<span class=\"hljs-comment\">&lt;!-- 指定 item index --&gt;</span>\n<span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">view</span> <span class=\"hljs-attr\">wx:for</span>=<span class=\"hljs-string\">\"{{array}}\"</span> <span class=\"hljs-attr\">wx:for-index</span>=<span class=\"hljs-string\">\"idx\"</span> <span class=\"hljs-attr\">wx:for-item</span>=<span class=\"hljs-string\">\"itemName\"</span>&gt;</span>\n  {{idx}}: {{itemName.message}}\n<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">view</span>&gt;</span></code></pre>\n</section><section><h2 id=\"3922668054\">自定义组件</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/wxml-wxss.html\">组件模板和样式</a><br><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/component.html\">Component 构造器</a><br><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/events.html\">组件间通信与事件</a></p>\n<p>传值给组件</p>\n<pre><code class=\"language-xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">view</span>&gt;</span>\n  <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">component-tag-name</span> <span class=\"hljs-attr\">a</span>=<span class=\"hljs-string\">\"{{dataFieldA}}\"</span> <span class=\"hljs-attr\">b</span>=<span class=\"hljs-string\">\"{{dataFieldB}}\"</span>&gt;</span>\n    <span class=\"hljs-comment\">&lt;!-- 这部分内容将被放置在组件 &lt;slot&gt; 的位置上 --&gt;</span>\n    <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">view</span>&gt;</span>这里是插入到组件slot中的内容<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">view</span>&gt;</span>\n  <span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">component-tag-name</span>&gt;</span>\n<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">view</span>&gt;</span></code></pre>\n<p>组件接收</p>\n<pre><code class=\"language-js\">Component({\n  properties: {\n    a: {\n      <span class=\"hljs-comment\">// 属性名</span>\n      <span class=\"hljs-keyword\">type</span>: <span class=\"hljs-built_in\">String</span>,\n      value: <span class=\"hljs-string\">''</span>,\n    },\n    b: <span class=\"hljs-built_in\">String</span>, <span class=\"hljs-comment\">// 简化的定义方式</span>\n  },\n})</code></pre>\n<p>事件绑定</p>\n<pre><code class=\"language-xml\"> <span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">pulldown-refresh</span>\n      <span class=\"hljs-attr\">bindload</span>=<span class=\"hljs-string\">\"onLoad\"</span>\n    &gt;</span><span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">pulldown-refresh</span>&gt;</span></code></pre>\n<p>触发</p>\n<pre><code class=\"language-js\"></code></pre>\n<section><h3 id=\"3953040683\">插槽</h3><pre><code class=\"language-xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">slot</span>&gt;</span><span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">slot</span>&gt;</span></code></pre>\n</section></section><section><h2 id=\"3007449279\">坐标尺寸</h2><p>在自定义组件内获取必须用 SelectorQuery.in()</p>\n<pre><code class=\"language-js\"><span class=\"hljs-keyword\">const</span> query = wx.createSelectorQuery().in(<span class=\"hljs-keyword\">this</span>)\nquery\n  .select(<span class=\"hljs-string\">'#emove'</span>)\n  .boundingClientRect(<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">rect</span>) </span>{\n    <span class=\"hljs-built_in\">console</span>.log(rect)\n  })\n  .exec()</code></pre>\n</section><section><h2 id=\"2871388790\">路由|页面跳转</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/route.html\">页面路由</a></p>\n<p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/component/navigator.html\">路由组件 navigator</a></p>\n<p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.switchTab.html\">路由 api|页面跳转 api</a></p>\n<pre><code class=\"language-xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">navigator</span> <span class=\"hljs-attr\">open-type</span>=<span class=\"hljs-string\">\"navigateTo\"</span> <span class=\"hljs-attr\">url</span>=<span class=\"hljs-string\">\"/pages/p1\"</span>&gt;</span>跳转<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">navigator</span>&gt;</span>\n<span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">navigator</span> <span class=\"hljs-attr\">open-type</span>=<span class=\"hljs-string\">\"switchTab\"</span> <span class=\"hljs-attr\">url</span>=<span class=\"hljs-string\">\"/pages/p1\"</span>&gt;</span>跳转<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">navigator</span>&gt;</span></code></pre>\n<section><h3 id=\"2877321283\">页面传值</h3><pre><code class=\"language-xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">navigator</span> <span class=\"hljs-attr\">url</span>=<span class=\"hljs-string\">\"/pages/detail/detail?id=12\"</span>&gt;</span><span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">navigator</span>&gt;</span></code></pre>\n<p>detail 页面接收</p>\n<pre><code class=\"language-js\"><span class=\"hljs-selector-tag\">Page</span>({\n  <span class=\"hljs-attribute\">onLoad</span>: function (options) {\n    console.<span class=\"hljs-built_in\">log</span>(options.id)\n  },\n})</code></pre>\n</section></section><section><h2 id=\"2982501154\">事件</h2><p>事件传值只能通过 dataset</p>\n<p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html\">事件系统</a></p>\n<p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html#%E4%BA%8B%E4%BB%B6%E5%88%86%E7%B1%BB\">事件分类</a></p>\n</section><section><h2 id=\"3728014669\">权限总结</h2></section><section><h2 id=\"1879589429\">问题记录</h2><p>双向绑定 model 指令有 bug，尽量少用</p>\n</section><section><h2 id=\"257444121\">富文本</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/component/editor.html\">https://developers.weixin.qq.com/miniprogram/dev/component/editor.html</a></p>\n<p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/component/rich-text.html\">渲染富文本 rich-text</a></p>\n</section></section><section><h1 id=\"1374059694\">导航栏控制</h1><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/page.html#%E9%85%8D%E7%BD%AE%E9%A1%B9\">官方文档-配置项</a></p>\n<pre><code class=\"language-js\"><span class=\"hljs-keyword\">export</span> <span class=\"hljs-keyword\">default</span> {\n  <span class=\"hljs-attr\">backgroundTextStyle</span>: <span class=\"hljs-string\">'light'</span>,\n\n  <span class=\"hljs-comment\">// 自定义导航：去掉默认导航，页面将到屏幕顶端</span>\n  navigationStyle: <span class=\"hljs-string\">'custom'</span>,\n\n  <span class=\"hljs-comment\">// 导航栏背景颜色</span>\n  navigationBarBackgroundColor: <span class=\"hljs-string\">'#81b3fd'</span>,\n  <span class=\"hljs-comment\">// 导航栏标题颜色，仅支持 black / white</span>\n  navigationBarTextStyle: <span class=\"hljs-string\">'white'</span>,\n\n  <span class=\"hljs-comment\">// 导航栏标题</span>\n  navigationBarTitleText: <span class=\"hljs-string\">'WeChat'</span>,\n}</code></pre>\n</section><section><h1 id=\"1109100513\">登录</h1><section><h2 id=\"2199816326\">概述</h2><ul>\n<li><p>拿 openid</p>\n<ul>\n<li>当前小程序唯一标识</li>\n<li>不用授权，可以进小程序后直接通过 wx.login 获取 code 再到开发者服务器换取。</li>\n<li>拿到后应存到本地 Storage，以便下次直接用。</li>\n<li>本质上此接口就可以注册登录了，但缺少用户信息。</li>\n<li>已注册用户，即已经将用户信息保存到开发者服务器的用户，应该可通过此步骤直接获取用户信息</li>\n</ul>\n</li>\n<li><p>获取用户信息 getUserInfo -- 废弃</p>\n<ul>\n<li>需点击专门按钮，会弹出授权窗口，需要授权</li>\n</ul>\n</li>\n<li><p>获取用户信息 getUserProfile</p>\n<ul>\n<li>用户点击（例如 button 上 bindtap 的回调中）后才可调用，会弹出授权窗口，需要授权</li>\n<li>昵称头像性别等信息，不能获取真实姓名，<a href=\"https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/UserInfo.html\">点击详见</a></li>\n</ul>\n</li>\n<li><p>获取手机号</p>\n<ul>\n<li>通过专门按钮获取，得到的只是凭证信息，需要与 openid 一起到开发者服务器换取</li>\n</ul>\n</li>\n</ul>\n<p>一般登录注册，用户信息、手机号都要，可以引导用户先获取用户信息，再获取手机号，比如 &quot;用户授权&quot;(获取用户信息) ==&gt; &quot;绑定手机&quot;(获取手机号)</p>\n</section><section><h2 id=\"190098528\">拿 openId</h2><p>先通过 wx.login 拿登录凭证 code（有效期五分钟），在通过开发者服务器换取 openId</p>\n<pre><code class=\"language-js\">wx.login({\n  <span class=\"hljs-keyword\">async</span> success(res) {\n    <span class=\"hljs-keyword\">if</span> (res.code) {\n      <span class=\"hljs-comment\">// 发送 res.code 到后台换取 openId, sessionKey, unionId</span>\n      reqOpenId({ <span class=\"hljs-attr\">code</span>: res.code })\n        .then(<span class=\"hljs-function\">(<span class=\"hljs-params\">{ openid }</span>) =&gt;</span> {\n          wx.setStorageSync(<span class=\"hljs-string\">'openid'</span>, openid)\n          resolve(openid)\n        })\n        .catch(<span class=\"hljs-function\">(<span class=\"hljs-params\">e</span>) =&gt;</span> {\n          reject(e)\n        })\n    } <span class=\"hljs-keyword\">else</span> {\n      reject(res.errMsg)\n    }\n  },\n})</code></pre>\n</section><section><h2 id=\"3995899957\">获取用户信息 - 废弃</h2><section><h3 id=\"2823311804\">授权后可直接获取</h3><pre><code class=\"language-js\"><span class=\"hljs-comment\">// 直接获取用户信息</span>\n<span class=\"hljs-keyword\">export</span> <span class=\"hljs-keyword\">default</span> <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> <span class=\"hljs-title\">wxGetUserInfo</span>(<span class=\"hljs-params\"></span>) </span>{\n  <span class=\"hljs-keyword\">return</span> <span class=\"hljs-keyword\">new</span> <span class=\"hljs-built_in\">Promise</span>(<span class=\"hljs-function\">(<span class=\"hljs-params\">resolve, reject</span>) =&gt;</span> {\n    wx.getSetting({\n      <span class=\"hljs-attr\">success</span>: <span class=\"hljs-function\">(<span class=\"hljs-params\">res</span>) =&gt;</span> {\n        <span class=\"hljs-keyword\">if</span> (res.authSetting[<span class=\"hljs-string\">'scope.userInfo'</span>]) {\n          <span class=\"hljs-comment\">// 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框</span>\n          wx.getUserInfo({\n            <span class=\"hljs-attr\">success</span>: <span class=\"hljs-function\">(<span class=\"hljs-params\">res</span>) =&gt;</span> {\n              <span class=\"hljs-comment\">// var userInfo = res.userInfo;</span>\n              <span class=\"hljs-comment\">// var nickName = userInfo.nickName;</span>\n              <span class=\"hljs-comment\">// var avatarUrl = userInfo.avatarUrl;</span>\n              <span class=\"hljs-comment\">// var gender = userInfo.gender; //性别 0：未知、1：男、2：女</span>\n              <span class=\"hljs-comment\">// var province = userInfo.province;</span>\n              <span class=\"hljs-comment\">// var city = userInfo.city;</span>\n              <span class=\"hljs-comment\">// var country = userInfo.country;</span>\n\n              <span class=\"hljs-comment\">// 可以将 res 发送给后台解码出 unionId</span>\n              resolve(res)\n            },\n            fail(err) {\n              reject(err)\n            },\n          })\n        }\n      },\n    })\n  })\n}</code></pre>\n</section><section><h3 id=\"1880598467\">通过专门的按钮</h3><p>当用户拒绝授权后，可通过此按钮恢复授权，并获取用户信息</p>\n<pre><code class=\"language-xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">button</span> <span class=\"hljs-attr\">open-type</span>=<span class=\"hljs-string\">\"getUserInfo\"</span> <span class=\"hljs-attr\">bindgetuserinfo</span>=<span class=\"hljs-string\">\"getUserInfo\"</span> <span class=\"hljs-attr\">class</span>=<span class=\"hljs-string\">\"login-button\"</span>&gt;</span>微信授权<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">button</span>&gt;</span></code></pre>\n<pre><code class=\"language-js\">Page({\n  getUserInfo(e) {\n    <span class=\"hljs-keyword\">if</span> (e.detail.errMsg !== <span class=\"hljs-string\">'getUserInfo:ok'</span>) {\n      wx.showToast({\n        <span class=\"hljs-attr\">icon</span>: <span class=\"hljs-string\">'none'</span>,\n        <span class=\"hljs-attr\">title</span>: <span class=\"hljs-string\">'您拒绝了授权'</span>,\n      })\n      <span class=\"hljs-keyword\">return</span>\n    }\n\n    <span class=\"hljs-comment\">// 拿到了用户信息，可用来登录</span>\n    <span class=\"hljs-keyword\">let</span> userInfo = e.detail\n  },\n})</code></pre>\n</section></section><section><h2 id=\"2433893927\">获取用户信息 getUserProfile</h2><pre><code class=\"language-js\"><span class=\"hljs-selector-tag\">wx</span><span class=\"hljs-selector-class\">.getUserProfile</span>({\n  <span class=\"hljs-attribute\">desc</span>: <span class=\"hljs-string\">'用于完善会员资料'</span>,\n  success: (res) =&gt; {\n    console.<span class=\"hljs-built_in\">log</span>(res.userInfo)\n  },\n})</code></pre>\n</section><section><h2 id=\"562068359\">获取手机号 - 只能按钮获取</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html\">获取手机号 - 官方文档</a></p>\n<p>前端获取到的只是密钥信息，需要服务端根据 openid 和密钥信息换取手机号</p>\n</section><section><h2 id=\"3577905484\">代码示例</h2><pre><code class=\"language-xml\"><span class=\"hljs-tag\">&lt;<span class=\"hljs-name\">button</span> <span class=\"hljs-attr\">open-type</span>=<span class=\"hljs-string\">\"getPhoneNumber\"</span> <span class=\"hljs-attr\">bindgetphonenumber</span>=<span class=\"hljs-string\">\"getPhoneNumber\"</span> <span class=\"hljs-attr\">class</span>=<span class=\"hljs-string\">\"login-button\"</span>&gt;</span>绑定手机号<span class=\"hljs-tag\">&lt;/<span class=\"hljs-name\">button</span>&gt;</span></code></pre>\n<pre><code class=\"language-js\">Page({\n  getPhoneNumber(e) {\n    <span class=\"hljs-built_in\">console</span>.log(e.detail.errMsg)\n    <span class=\"hljs-built_in\">console</span>.log(e.detail.iv)\n    <span class=\"hljs-built_in\">console</span>.log(e.detail.encryptedData)\n\n    <span class=\"hljs-comment\">// 再通过 openid iv encryptedData 到开发者服务器换取手机号等信息</span>\n    <span class=\"hljs-comment\">// openid 由 wx.login 获取</span>\n  },\n})</code></pre>\n</section></section><section><h1 id=\"3610273786\">组件</h1><section><h2 id=\"3238219927\">image</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/component/image.html\">https://developers.weixin.qq.com/miniprogram/dev/component/image.html</a></p>\n</section><section><h2 id=\"510334560\">到底加载/下拉刷新</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html\">scroll-view</a></p>\n</section></section><section><h1 id=\"3391842892\">节点</h1><section><h2 id=\"609777599\">获取、尺寸</h2><pre><code class=\"language-js\">Page({\n  getRect() {\n    wx.createSelectorQuery()\n      .select(<span class=\"hljs-string\">'#the-id'</span>)\n      .boundingClientRect(<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">rect</span>) </span>{\n        rect.id <span class=\"hljs-comment\">// 节点的ID</span>\n        rect.dataset <span class=\"hljs-comment\">// 节点的dataset</span>\n        rect.left <span class=\"hljs-comment\">// 节点的左边界坐标</span>\n        rect.right <span class=\"hljs-comment\">// 节点的右边界坐标</span>\n        rect.top <span class=\"hljs-comment\">// 节点的上边界坐标</span>\n        rect.bottom <span class=\"hljs-comment\">// 节点的下边界坐标</span>\n        rect.width <span class=\"hljs-comment\">// 节点的宽度</span>\n        rect.height <span class=\"hljs-comment\">// 节点的高度</span>\n      })\n      .exec()\n  },\n  getAllRects() {\n    wx.createSelectorQuery()\n      .selectAll(<span class=\"hljs-string\">'.a-class'</span>)\n      .boundingClientRect(<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">rects</span>) </span>{\n        rects.forEach(<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">rect</span>) </span>{\n          rect.id <span class=\"hljs-comment\">// 节点的ID</span>\n          rect.dataset <span class=\"hljs-comment\">// 节点的dataset</span>\n          rect.left <span class=\"hljs-comment\">// 节点的左边界坐标</span>\n          rect.right <span class=\"hljs-comment\">// 节点的右边界坐标</span>\n          rect.top <span class=\"hljs-comment\">// 节点的上边界坐标</span>\n          rect.bottom <span class=\"hljs-comment\">// 节点的下边界坐标</span>\n          rect.width <span class=\"hljs-comment\">// 节点的宽度</span>\n          rect.height <span class=\"hljs-comment\">// 节点的高度</span>\n        })\n      })\n      .exec()\n  },\n})</code></pre>\n</section><section><h2 id=\"1847203482\">相关文档</h2><p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html\">SelectorQuery</a></p>\n<p><a href=\"https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.boundingClientRect.html#%E5%8F%82%E6%95%B0\">NodesRef.boundingClientRect(function callback)</a></p>\n</section></section><section><h1 id=\"1782065560\">页面传值</h1><section><h2 id=\"2945763281\">url 方式</h2><pre><code class=\"language-ts\"><span class=\"hljs-comment\">// page 1</span>\nwx.navigateTo({\n  <span class=\"hljs-attr\">url</span>: <span class=\"hljs-string\">`/pages/details/index?id=<span class=\"hljs-subst\">${item.id}</span>`</span>,\n})\n\n<span class=\"hljs-comment\">// /pages/details/index</span>\nPage({\n  <span class=\"hljs-attr\">onLoad</span>: <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">options</span>) </span>{\n    <span class=\"hljs-built_in\">console</span>.log(options.id)\n  },\n})</code></pre>\n</section><section><h2 id=\"823855320\">events 方式</h2><pre><code class=\"language-js\">wx.navigateTo({\n  <span class=\"hljs-attr\">url</span>: <span class=\"hljs-string\">'test'</span>,\n  <span class=\"hljs-attr\">events</span>: {\n    <span class=\"hljs-comment\">// 接收子页面的传值1</span>\n    acceptDataFromOpenedPage: <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">data</span>) </span>{\n      <span class=\"hljs-built_in\">console</span>.log(data)\n    },\n    <span class=\"hljs-comment\">// 接收子页面的传值2</span>\n    someEvent: <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">data</span>) </span>{\n      <span class=\"hljs-built_in\">console</span>.log(data)\n    },\n  },\n  <span class=\"hljs-attr\">success</span>: <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">res</span>) </span>{\n    <span class=\"hljs-comment\">// 向子页面传值</span>\n    res.eventChannel.emit(<span class=\"hljs-string\">'acceptDataFromOpenerPage'</span>, { <span class=\"hljs-attr\">data</span>: <span class=\"hljs-string\">'test3'</span> })\n  },\n})\n\n<span class=\"hljs-comment\">//test.js</span>\nPage({\n  <span class=\"hljs-attr\">onLoad</span>: <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\"></span>) </span>{\n    <span class=\"hljs-keyword\">const</span> eventChannel = <span class=\"hljs-keyword\">this</span>.getOpenerEventChannel()\n\n    <span class=\"hljs-comment\">// 向父页面传值</span>\n    eventChannel.emit(<span class=\"hljs-string\">'acceptDataFromOpenedPage'</span>, { <span class=\"hljs-attr\">data</span>: <span class=\"hljs-string\">'test1'</span> })\n    eventChannel.emit(<span class=\"hljs-string\">'someEvent'</span>, { <span class=\"hljs-attr\">data</span>: <span class=\"hljs-string\">'test2'</span> })\n\n    <span class=\"hljs-comment\">// 接收父页面的传值</span>\n    eventChannel.on(<span class=\"hljs-string\">'acceptDataFromOpenerPage'</span>, <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">data</span>) </span>{\n      <span class=\"hljs-built_in\">console</span>.log(data)\n    })\n  },\n})</code></pre>\n<section><h3 id=\"300243895\">注意事项</h3><p>子页面的 eventChannel.on 可能会后于页面其它同步 js 异步执行，以下是复现代码</p>\n<p>pageDataReceive.ts : eventChannel.on 封装</p>\n<pre><code class=\"language-ts\"><span class=\"hljs-comment\">/**\n *\n * @param eventName 事件名称。在父页面触发的事件\n * @param cb 回调，传入页面数据\n */</span>\n<span class=\"hljs-keyword\">export</span> <span class=\"hljs-keyword\">default</span> <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> <span class=\"hljs-title\">pageDataReceive</span>(<span class=\"hljs-params\">eventName: <span class=\"hljs-built_in\">string</span>, cb: (data: <span class=\"hljs-built_in\">any</span>) =&gt; <span class=\"hljs-built_in\">void</span></span>) </span>{\n  <span class=\"hljs-comment\">// 子页面</span>\n  <span class=\"hljs-keyword\">const</span> pages = getCurrentPages()\n  <span class=\"hljs-keyword\">const</span> currentPage = pages[pages.length - <span class=\"hljs-number\">1</span>] <span class=\"hljs-comment\">// 当前子页面</span>\n  <span class=\"hljs-keyword\">const</span> eventChannel = currentPage.getOpenerEventChannel()\n\n  <span class=\"hljs-comment\">// 接收父页面的传值</span>\n  eventChannel.on(eventName, <span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> (<span class=\"hljs-params\">data</span>) </span>{\n    cb(data)\n  })\n}</code></pre>\n<p>子页面</p>\n<pre><code class=\"language-ts\"><span class=\"hljs-keyword\">import</span> <span class=\"hljs-keyword\">type</span> { GoodsInfo, GoodsSKUInfo } <span class=\"hljs-keyword\">from</span> <span class=\"hljs-string\">'@/api/model/goodsModel'</span>\n<span class=\"hljs-keyword\">import</span> pageDataReceive <span class=\"hljs-keyword\">from</span> <span class=\"hljs-string\">'@/utils/page-data-receive'</span>\n<span class=\"hljs-keyword\">import</span> { ref } <span class=\"hljs-keyword\">from</span> <span class=\"hljs-string\">'vue'</span>\n\n<span class=\"hljs-keyword\">const</span> quantity = ref(<span class=\"hljs-number\">1</span>)\n<span class=\"hljs-keyword\">const</span> goodsData = ref&lt;GoodsSKUInfo&gt;({})\n<span class=\"hljs-keyword\">const</span> goodsInfo = ref&lt;GoodsInfo&gt;({})\n\npageDataReceive(<span class=\"hljs-string\">'pageInit'</span>, <span class=\"hljs-function\">(<span class=\"hljs-params\">res</span>) =&gt;</span> {\n  <span class=\"hljs-comment\">// 部分微信这里会慢于回调外面的js执行（微信版本 8.0.11 ）</span>\n\n  goodsData.value = res.data\n  goodsInfo.value = res.data.goodsInfo\n\n  <span class=\"hljs-comment\">// ✔️ 这才是 updatePrice 应该放的位置</span>\n  updatePrice()\n})\n\n<span class=\"hljs-keyword\">const</span> goodsPrice = ref&lt;SkuPriceResult&gt;({\n  old_price: <span class=\"hljs-string\">'0'</span>,\n  price: <span class=\"hljs-string\">'0'</span>,\n  total_price: <span class=\"hljs-string\">'0'</span>,\n})\n\n<span class=\"hljs-function\"><span class=\"hljs-keyword\">function</span> <span class=\"hljs-title\">updatePrice</span>(<span class=\"hljs-params\"></span>) </span>{\n  getPrices({\n    sku_id: goodsData.value.sku_id,\n    quantity: quantity.value,\n  }).then(<span class=\"hljs-function\">(<span class=\"hljs-params\">res</span>) =&gt;</span> {\n    goodsPrice.value = res\n  })\n}\n\n<span class=\"hljs-comment\">// updatePrice应该放在 pageInit 回调里面。否则可能拿不到 pageInit 之后的  goodsData</span>\n<span class=\"hljs-comment\">// updatePrice() // ❌</span></code></pre>\n"})