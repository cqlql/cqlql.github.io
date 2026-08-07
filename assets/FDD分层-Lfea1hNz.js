import{I as e,O as t,k as n}from"./app-DcnrHXHx.js";import{t as r}from"./plugin-vue_export-helper-BDNMzG2s.js";var i=JSON.parse(`{"path":"/%E5%89%8D%E7%AB%AF/%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/FDD%E5%88%86%E5%B1%82.html","title":"","lang":"zh-CN","frontmatter":{"description":"Feature-driven Development (FDD) FDD（Feature First） 轻量FDD 纯FDD","head":[["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"\\",\\"image\\":[\\"\\"],\\"dateModified\\":\\"2026-07-17T09:30:01.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"桥黎\\",\\"url\\":\\"\\"}]}"],["meta",{"property":"og:url","content":"https://docs.cqlql.top/%E5%89%8D%E7%AB%AF/%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/FDD%E5%88%86%E5%B1%82.html"}],["meta",{"property":"og:site_name","content":"开发笔记"}],["meta",{"property":"og:description","content":"Feature-driven Development (FDD) FDD（Feature First） 轻量FDD 纯FDD"}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2026-07-17T09:30:01.000Z"}],["meta",{"property":"article:modified_time","content":"2026-07-17T09:30:01.000Z"}]]},"git":{"createdTime":1782120601000,"updatedTime":1784280601000,"contributors":[{"name":"cql","username":"cql","email":"cql.ql@qq.com","commits":3,"url":"https://github.com/cql"}]},"readingTime":{"minutes":0.12,"words":36},"filePathRelative":"前端/架构设计/FDD分层.md","autoDesc":true}`),a={name:`FDD分层.md`};function o(r,i,a,o,s,c){return e(),t(`div`,null,[...i[0]||=[n(`<p>Feature-driven Development (FDD)</p><p>FDD（Feature First）</p><p>轻量FDD</p><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-"><span class="line"><span>features</span></span>
<span class="line"><span>├─user</span></span>
<span class="line"><span>│  ├─api.ts</span></span>
<span class="line"><span>│  ├─types.ts</span></span>
<span class="line"><span>│  ├─UserList.tsx</span></span>
<span class="line"><span>│  └─UserForm.tsx</span></span>
<span class="line"><span>│</span></span>
<span class="line"><span>├─role</span></span>
<span class="line"><span>│  ├─api.ts</span></span>
<span class="line"><span>│  ├─types.ts</span></span>
<span class="line"><span>│  └─RoleList.tsx</span></span>
<span class="line"><span>│</span></span>
<span class="line"><span>├─invite</span></span>
<span class="line"><span>│  ├─api.ts</span></span>
<span class="line"><span>│  └─InviteRuleList.tsx</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>纯FDD</p><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-"><span class="line"><span>features</span></span>
<span class="line"><span>└─user</span></span>
<span class="line"><span>    ├─api</span></span>
<span class="line"><span>    ├─components</span></span>
<span class="line"><span>    ├─hooks</span></span>
<span class="line"><span>    ├─store</span></span>
<span class="line"><span>    ├─utils</span></span>
<span class="line"><span>    ├─constants</span></span>
<span class="line"><span>    ├─services</span></span>
<span class="line"><span>    ├─types</span></span>
<span class="line"><span>    ├─pages</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,6)]])}var s=r(a,[[`render`,o]]);export{i as _pageData,s as default};