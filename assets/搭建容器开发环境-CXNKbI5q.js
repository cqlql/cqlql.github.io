import{I as e,O as t,k as n}from"./app-DWO2fZMU.js";import{t as r}from"./plugin-vue_export-helper-BDNMzG2s.js";var i=JSON.parse(`{"path":"/%E5%90%8E%E7%AB%AF/%E4%BA%91%E5%8E%9F%E7%94%9F/docker/%E6%90%AD%E5%BB%BA%E5%AE%B9%E5%99%A8%E5%BC%80%E5%8F%91%E7%8E%AF%E5%A2%83.html","title":"搭建容器开发环境","lang":"zh-CN","frontmatter":{"description":"搭建容器开发环境 如果是容器部署，推荐使用容器环境开发，这样开发环境与正式环境能做到最小差异。 开发容器设置所在目录结构 devcontainer.json Dockerfile.dev","head":[["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"搭建容器开发环境\\",\\"image\\":[\\"\\"],\\"dateModified\\":\\"2026-08-08T11:48:24.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"桥黎\\",\\"url\\":\\"\\"}]}"],["meta",{"property":"og:url","content":"https://docs.cqlql.top/%E5%90%8E%E7%AB%AF/%E4%BA%91%E5%8E%9F%E7%94%9F/docker/%E6%90%AD%E5%BB%BA%E5%AE%B9%E5%99%A8%E5%BC%80%E5%8F%91%E7%8E%AF%E5%A2%83.html"}],["meta",{"property":"og:site_name","content":"开发笔记"}],["meta",{"property":"og:title","content":"搭建容器开发环境"}],["meta",{"property":"og:description","content":"搭建容器开发环境 如果是容器部署，推荐使用容器环境开发，这样开发环境与正式环境能做到最小差异。 开发容器设置所在目录结构 devcontainer.json Dockerfile.dev"}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2026-08-08T11:48:24.000Z"}],["meta",{"property":"article:modified_time","content":"2026-08-08T11:48:24.000Z"}]]},"git":{"createdTime":1776850201000,"updatedTime":1786189704000,"contributors":[{"name":"cql","username":"cql","email":"cql.ql@qq.com","commits":2,"url":"https://github.com/cql"},{"name":"陈桥黎","username":"","email":"cql.ql@qq.com","commits":1}]},"readingTime":{"minutes":1.28,"words":385},"filePathRelative":"后端/云原生/docker/搭建容器开发环境.md","autoDesc":true}`),a={name:`搭建容器开发环境.md`};function o(r,i,a,o,s,c){return e(),t(`div`,null,[...i[0]||=[n(`<h1 id="搭建容器开发环境" tabindex="-1"><a class="header-anchor" href="#搭建容器开发环境"><span>搭建容器开发环境</span></a></h1><p>如果是容器部署，推荐使用容器环境开发，这样开发环境与正式环境能做到最小差异。</p><p>开发容器设置所在目录结构</p><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-"><span class="line"><span>project/</span></span>
<span class="line"><span> │</span></span>
<span class="line"><span> ├── .devcontainer/      </span></span>
<span class="line"><span> │     ├── devcontainer.json</span></span>
<span class="line"><span> │     └── Dockerfile.dev</span></span>
<span class="line"><span> │</span></span>
<span class="line"><span> └── src</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>devcontainer.json</p><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-"><span class="line"><span>{</span></span>
<span class="line"><span>    &quot;name&quot;: &quot;pass-up.dev&quot;,</span></span>
<span class="line"><span>    &quot;build&quot;: {</span></span>
<span class="line"><span>        &quot;dockerfile&quot;: &quot;./Dockerfile.dev&quot;,</span></span>
<span class="line"><span>        &quot;context&quot;: &quot;..&quot;</span></span>
<span class="line"><span>    },</span></span>
<span class="line"><span>    &quot;workspaceFolder&quot;: &quot;/pass-up.backend-pydantic_ai&quot;,</span></span>
<span class="line"><span>    &quot;customizations&quot;: {</span></span>
<span class="line"><span>        &quot;vscode&quot;: {</span></span>
<span class="line"><span>            &quot;settings&quot;: {</span></span>
<span class="line"><span>                // 自动关联 uv 的虚拟环境（已交给Dockerfile.dev设置，所以注释）</span></span>
<span class="line"><span>                // &quot;python.defaultInterpreterPath&quot;: &quot;/app/.venv/bin/python&quot;,</span></span>
<span class="line"><span>            },</span></span>
<span class="line"><span>            &quot;extensions&quot;: [</span></span>
<span class="line"><span>                &quot;ms-python.debugpy&quot;,</span></span>
<span class="line"><span>                &quot;MarsCode.marscode-extension&quot;,</span></span>
<span class="line"><span>                &quot;eamodio.gitlens&quot;</span></span>
<span class="line"><span>            ]</span></span>
<span class="line"><span>        }</span></span>
<span class="line"><span>    },</span></span>
<span class="line"><span>    &quot;features&quot;: {</span></span>
<span class="line"><span>        // 自动安装常用的 Git 辅助工具</span></span>
<span class="line"><span>        &quot;ghcr.io/devcontainers/features/git:1&quot;: {}</span></span>
<span class="line"><span>    },</span></span>
<span class="line"><span>    </span></span>
<span class="line"><span>    &quot;mounts&quot;: [</span></span>
<span class="line"><span>        // 挂载整个 root，解决部分配置重建后丢失问题</span></span>
<span class="line"><span>        &quot;source=pass-up.backend-pydantic_ai.root,target=/root,type=volume&quot;,</span></span>
<span class="line"><span>		// uc 缓存，避免每次重新拉取</span></span>
<span class="line"><span>        &quot;source=uv-cache,target=/root/.cache/uv,type=volume&quot;,</span></span>
<span class="line"><span>        // 代码</span></span>
<span class="line"><span>        &quot;source=pass-up.backend-pydantic_ai,target=\${containerWorkspaceFolder},type=volume&quot;,</span></span>
<span class="line"><span>        // git 免密</span></span>
<span class="line"><span>        &quot;source=ssh-keys,target=/root/.ssh,type=volume&quot;</span></span>
<span class="line"><span>    ],</span></span>
<span class="line"><span>    // 容器创建后自动同步</span></span>
<span class="line"><span>    &quot;postCreateCommand&quot;: &quot;uv sync&quot;</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Dockerfile.dev</p><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-"><span class="line"><span>FROM python:3.12-slim</span></span>
<span class="line"><span></span></span>
<span class="line"><span># 从官方镜像中直接把 uv 拷贝进来</span></span>
<span class="line"><span>COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/</span></span>
<span class="line"><span></span></span>
<span class="line"><span># 安装 ssh</span></span>
<span class="line"><span>RUN apt-get update &amp;&amp; \\</span></span>
<span class="line"><span>    apt-get install -y openssh-client &amp;&amp; \\</span></span>
<span class="line"><span>    rm -rf /var/lib/apt/lists/*</span></span>
<span class="line"><span></span></span>
<span class="line"><span># 设置工作目录</span></span>
<span class="line"><span>WORKDIR /pass-up.backend-pydantic_ai</span></span>
<span class="line"><span></span></span>
<span class="line"><span># 环境变量配置</span></span>
<span class="line"><span># 避免 python 产生 pyc 文件；强制输出日志，不缓存</span></span>
<span class="line"><span>ENV PYTHONDONTWRITEBYTECODE=1</span></span>
<span class="line"><span>ENV PYTHONUNBUFFERED=1</span></span>
<span class="line"><span># 告诉 uv 虚拟环境就在项目目录下</span></span>
<span class="line"><span>ENV UV_PROJECT_ENVIRONMENT=/pass-up.backend-pydantic_ai/.venv</span></span>
<span class="line"><span></span></span>
<span class="line"><span># (可选) 预复制依赖文件，利用 Docker 缓存层</span></span>
<span class="line"><span># 这样即便你还没打开 VS Code，镜像构建时也会先装好基础包</span></span>
<span class="line"><span># COPY pyproject.toml uv.lock ./</span></span>
<span class="line"><span># RUN uv sync --frozen --no-install-project</span></span>
<span class="line"><span></span></span>
<span class="line"><span># 剩下的代码不需要在 Dockerfile 里 COPY，</span></span>
<span class="line"><span># 因为 .devcontainer 会通过 Bind Mount 实时挂载你的本地代码</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,8)]])}var s=r(a,[[`render`,o]]);export{i as _pageData,s as default};