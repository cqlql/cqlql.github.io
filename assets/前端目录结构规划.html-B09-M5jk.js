import{_ as n}from"./plugin-vue_export-helper-DlAUqK2U.js";import{c as a,i,o as e}from"./app-Da628rHu.js";const l={};function p(t,s){return e(),a("div",null,[...s[0]||(s[0]=[i(`<h2 id="vue" tabindex="-1"><a class="header-anchor" href="#vue"><span>vue</span></a></h2><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-"><span class="line"><span>src/</span></span>
<span class="line"><span>  main.ts</span></span>
<span class="line"><span>  App.vue</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  router/</span></span>
<span class="line"><span>    index.ts</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  store/</span></span>
<span class="line"><span>    index.ts</span></span>
<span class="line"><span>    user.ts</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  layout/</span></span>
<span class="line"><span>    MainLayout.vue</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  features/</span></span>
<span class="line"><span>    realtime-voice/</span></span>
<span class="line"><span>      components/</span></span>
<span class="line"><span>      hooks/</span></span>
<span class="line"><span>      services/</span></span>
<span class="line"><span>      store/</span></span>
<span class="line"><span>      utils/</span></span>
<span class="line"><span>      index.ts</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  shared/</span></span>
<span class="line"><span>    components/</span></span>
<span class="line"><span>    hooks/</span></span>
<span class="line"><span>    utils/</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  styles/</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="react" tabindex="-1"><a class="header-anchor" href="#react"><span>react</span></a></h2><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-"><span class="line"><span>src/</span></span>
<span class="line"><span> ├── router/</span></span>
<span class="line"><span> │     └── index.tsx</span></span>
<span class="line"><span> ├── pages/</span></span>
<span class="line"><span> │     ├── HomePage.tsx</span></span>
<span class="line"><span> │     └── AboutPage.tsx</span></span>
<span class="line"><span> ├── features/</span></span>
<span class="line"><span> │     └── realtime-voice/</span></span>
<span class="line"><span> │           ├── components/</span></span>
<span class="line"><span> │           │     ├── VoicePanel.tsx</span></span>
<span class="line"><span> │           │     ├── VoiceControls.tsx</span></span>
<span class="line"><span> │           │     └── TranscriptView.tsx</span></span>
<span class="line"><span> │           │</span></span>
<span class="line"><span> │           ├── hooks/</span></span>
<span class="line"><span> │           │     ├── useDisplayAudio.ts</span></span>
<span class="line"><span> │           │     ├── usePCMProcessor.ts</span></span>
<span class="line"><span> │           │     ├── useVoiceWebSocket.ts</span></span>
<span class="line"><span> │           │     └── useRealtimeVoice.ts</span></span>
<span class="line"><span> │           ├── pages/</span></span>
<span class="line"><span> │           │     ├── VoicePage.tsx</span></span>
<span class="line"><span> │           │     ├── VoiceSettingsPage.tsx</span></span>
<span class="line"><span> │           │     └── VoiceHistoryPage.tsx</span></span>
<span class="line"><span> │           ├── services/</span></span>
<span class="line"><span> │           │     └── voiceSocketClient.ts</span></span>
<span class="line"><span> │           │</span></span>
<span class="line"><span> │           ├── utils/</span></span>
<span class="line"><span> │           │     ├── pcm.ts</span></span>
<span class="line"><span> │           │     └── downsample.ts</span></span>
<span class="line"><span> │           │</span></span>
<span class="line"><span> │           ├── types.ts</span></span>
<span class="line"><span> │           └── index.ts</span></span>
<span class="line"><span> │           └── router.tsx</span></span>
<span class="line"><span> │</span></span>
<span class="line"><span> ├── shared/</span></span>
<span class="line"><span> │     ├── hooks/</span></span>
<span class="line"><span> │     ├── utils/</span></span>
<span class="line"><span> │     └── components/</span></span>
<span class="line"><span> │</span></span>
<span class="line"><span> └── App.tsx</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="潜在的挑战与优化建议" tabindex="-1"><a class="header-anchor" href="#潜在的挑战与优化建议"><span>潜在的挑战与优化建议</span></a></h3><p>虽然结构很好，但在实际开发中需要注意以下几点，以防止混乱：</p><h4 id="a-路由管理的协调" tabindex="-1"><a class="header-anchor" href="#a-路由管理的协调"><span>A. 路由管理的协调</span></a></h4><p>你有一个顶层的 <code>router/index.tsx</code> 和一个 <code>features/.../router.tsx</code>。</p><ul><li><p><strong>建议:</strong> 确保顶层路由使用懒加载（Lazy Loading）导入 Feature 的路由。</p></li><li><p><strong>代码示例:</strong></p><p>TypeScript</p><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-"><span class="line"><span>// src/router/index.tsx</span></span>
<span class="line"><span>const VoiceRoutes = lazy(() =&gt; import(&#39;../features/realtime-voice/router&#39;));</span></span>
<span class="line"><span></span></span>
<span class="line"><span>// ... 在路由定义中</span></span>
<span class="line"><span>{</span></span>
<span class="line"><span>  path: &#39;voice/*&#39;, // 注意这里的 *</span></span>
<span class="line"><span>  element: &lt;VoiceRoutes /&gt;</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></li></ul><h4 id="b-pages-的歧义" tabindex="-1"><a class="header-anchor" href="#b-pages-的歧义"><span>B. <code>pages</code> 的歧义</span></a></h4><p>你有 <code>src/pages</code> 和 <code>src/features/.../pages</code>。</p><ul><li><strong>规则建议:</strong> 严格规定 <code>features</code> 内部的 <code>pages</code> 只能被该 feature 内部的路由引用。如果 <code>VoicePage.tsx</code> 是该功能的唯一入口，外部应该通过 <code>router</code> 或 <code>index.ts</code> 访问，而不是直接 import 这个文件。</li></ul><h4 id="c-依赖方向原则-dependency-rule" tabindex="-1"><a class="header-anchor" href="#c-依赖方向原则-dependency-rule"><span>C. 依赖方向原则 (Dependency Rule)</span></a></h4><p>为了防止循环依赖，建议制定以下规则：</p><ol><li><strong>Shared</strong> 不能引用 <strong>Features</strong>。</li><li><strong>Features</strong> 可以引用 <strong>Shared</strong>。</li><li><strong>Feature A</strong> 最好不要直接引用 <strong>Feature B</strong> 的内部文件。如果必须通信，应通过 <code>App</code> 层传递 Props，或者使用全局状态管理（Redux/Zustand），或者仅引用对方 <code>index.ts</code> 暴露的接口。</li></ol><h3 id="src-features-realtime-voice-index-ts-代码示例" tabindex="-1"><a class="header-anchor" href="#src-features-realtime-voice-index-ts-代码示例"><span><code>src/features/realtime-voice/index.ts</code> 代码示例</span></a></h3><div class="language-typescript line-numbers-mode" data-highlighter="shiki" data-ext="typescript" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-typescript"><span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// src/features/realtime-voice/index.ts</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// ✅ 1. 导出该功能的路由入口 (最常用)</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// 这样主路由只需要加载这个 VoiceRoutes，而不需要知道内部有 VoicePage, SettingsPage 等</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">export</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;"> { </span><span style="--shiki-light:#E45649;--shiki-dark:#C678DD;">default</span><span style="--shiki-light:#383A42;--shiki-dark:#C678DD;"> as</span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;"> VoiceRoutes</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;"> } </span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">from</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> &#39;./router&#39;</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// ✅ 2. 导出可能在全局使用的组件 (比如放在顶部导航栏的麦克风小图标)</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// 注意：只导出需要跨模块使用的组件，不要导出内部专用的子组件</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">export</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;"> { </span><span style="--shiki-light:#E45649;--shiki-dark:#C678DD;">default</span><span style="--shiki-light:#383A42;--shiki-dark:#C678DD;"> as</span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;"> VoiceIndicator</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;"> } </span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">from</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> &#39;./components/VoicePanel&#39;</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">; </span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// ✅ 3. 导出类型定义</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// 如果其他模块需要知道 &quot;VoiceStatus&quot; 是什么状态，可以导出类型</span></span>
<span class="line"><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">export</span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;"> type</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;"> { </span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;">VoiceConfig</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">, </span><span style="--shiki-light:#E45649;--shiki-dark:#E06C75;">VoiceStatus</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;"> } </span><span style="--shiki-light:#A626A4;--shiki-dark:#C678DD;">from</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> &#39;./types&#39;</span><span style="--shiki-light:#383A42;--shiki-dark:#ABB2BF;">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// ❌ 4. 【重要】不要导出内部实现细节！</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// 外部不需要知道你用了 WebSocket 还是 WebRTC，也不需要知道你是怎么处理 PCM 的。</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">// 所以，不要导出 services, utils, 或内部 hooks (如 usePCMProcessor)</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>这种写法带来的三大好处</p><ol><li><strong>重构自由 (Refactoring Safety):</strong> 如果你决定把 <code>VoicePanel.tsx</code> 改名为 <code>StatusPanel.tsx</code>，或者移动文件夹位置，你只需要修改 <code>features/realtime-voice/index.ts</code> 里的引用。外部的 <code>App.tsx</code> 完全不需要改动，因为它只认 <code>VoiceIndicator</code> 这个名字。</li><li><strong>认知负担更低 (Less Cognitive Load):</strong> 当其他开发者（或者三个月后的你）查看 <code>realtime-voice</code> 文件夹时，只需看一眼 <code>index.ts</code>，就能立刻知道：“哦，这个模块对外只提供了这三个东西”。不需要去翻阅十几个文件来猜测哪个是入口。</li><li><strong>避免循环依赖 (Avoid Circular Dependencies):</strong> 严格限制导出内容，能有效防止不小心在 Feature A 和 Feature B 之间形成复杂的蜘蛛网式依赖。</li></ol>`,19)])])}const r=n(l,[["render",p]]),o=JSON.parse('{"path":"/%E5%89%8D%E7%AB%AF/%E5%89%8D%E7%AB%AF%E7%9B%AE%E5%BD%95%E7%BB%93%E6%9E%84%E8%A7%84%E5%88%92.html","title":"","lang":"zh-CN","frontmatter":{"description":"vue react 潜在的挑战与优化建议 虽然结构很好，但在实际开发中需要注意以下几点，以防止混乱： A. 路由管理的协调 你有一个顶层的 router/index.tsx 和一个 features/.../router.tsx。 建议: 确保顶层路由使用懒加载（Lazy Loading）导入 Feature 的路由。 代码示例: TypeScript...","head":[["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"\\",\\"image\\":[\\"\\"],\\"dateModified\\":\\"2026-02-12T09:30:01.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"桥黎\\",\\"url\\":\\"\\"}]}"],["meta",{"property":"og:url","content":"http://docs.cqlql.top/%E5%89%8D%E7%AB%AF/%E5%89%8D%E7%AB%AF%E7%9B%AE%E5%BD%95%E7%BB%93%E6%9E%84%E8%A7%84%E5%88%92.html"}],["meta",{"property":"og:site_name","content":"开发笔记"}],["meta",{"property":"og:description","content":"vue react 潜在的挑战与优化建议 虽然结构很好，但在实际开发中需要注意以下几点，以防止混乱： A. 路由管理的协调 你有一个顶层的 router/index.tsx 和一个 features/.../router.tsx。 建议: 确保顶层路由使用懒加载（Lazy Loading）导入 Feature 的路由。 代码示例: TypeScript..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2026-02-12T09:30:01.000Z"}],["meta",{"property":"article:modified_time","content":"2026-02-12T09:30:01.000Z"}]]},"git":{"createdTime":1770888601000,"updatedTime":1770888601000,"contributors":[{"name":"cql","username":"cql","email":"cql.ql@qq.com","commits":1,"url":"https://github.com/cql"}]},"readingTime":{"minutes":2.48,"words":744},"filePathRelative":"前端/前端目录结构规划.md","autoDesc":true}');export{r as comp,o as data};
