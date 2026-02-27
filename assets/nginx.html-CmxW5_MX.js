import{_ as i}from"./plugin-vue_export-helper-DlAUqK2U.js";import{c as e,d as n,i as a,o as l}from"./app-Da628rHu.js";const p={};function d(r,s){return l(),e("div",null,[n(' @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=6 orderedList=false} '),n(" code_chunk_output "),s[0]||(s[0]=a('<ul><li><a href="#%E5%AE%89%E8%A3%85">安装</a><ul><li><a href="#1%E4%BD%BF%E7%94%A8-apt-%E5%AE%89%E8%A3%85">1.使用 apt 安装</a></li><li><a href="#2%E7%BC%96%E8%AF%91%E5%AE%89%E8%A3%85">2.编译安装</a><ul><li><a href="#%E4%B8%8B%E8%BD%BD">下载</a></li><li><a href="#%E7%BC%96%E8%AF%91%E5%AE%89%E8%A3%85">编译安装</a></li><li><a href="#%E4%BE%9D%E8%B5%96%E5%BA%93-zlib-pcre-openssl">依赖库 zlib, pcre, openssl</a></li><li><a href="#%E5%8F%AF%E8%83%BD%E9%9C%80%E8%A6%81">可能需要</a></li></ul></li></ul></li><li><a href="#%E9%85%8D%E7%BD%AE">配置</a></li><li><a href="#process-%E5%91%BD%E4%BB%A4">process 命令</a></li><li><a href="#%E5%A4%9A%E4%B8%AA-location-%E6%8C%87%E5%90%91%E4%B8%8D%E5%90%8C%E7%9A%84%E6%9C%AC%E5%9C%B0%E7%9B%AE%E5%BD%95">多个 location 指向不同的本地目录</a></li><li><a href="#%E5%B0%86%E6%89%80%E6%9C%89%E8%AF%B7%E6%B1%82%E6%8C%87%E5%90%91%E5%90%8C%E4%B8%80%E4%B8%AA%E9%A1%B5%E9%9D%A2">将所有请求指向同一个页面</a></li><li><a href="#nginxconfg">nginx.confg</a></li><li><a href="#%E5%8F%82%E8%80%83%E6%96%87%E6%A1%A3">参考文档</a></li></ul>',1)),n(" /code_chunk_output "),s[1]||(s[1]=a(`<h2 id="安装" tabindex="-1"><a class="header-anchor" href="#安装"><span>安装</span></a></h2><h3 id="_1-使用-apt-安装" tabindex="-1"><a class="header-anchor" href="#_1-使用-apt-安装"><span>1.使用 apt 安装</span></a></h3><div class="language-bash line-numbers-mode" data-highlighter="shiki" data-ext="bash" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-bash"><span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"># 查看 nginx 相关包</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> apt</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> search</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> nginx</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"># 安装</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> apt</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> install</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> nginx</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="_2-编译安装" tabindex="-1"><a class="header-anchor" href="#_2-编译安装"><span>2.编译安装</span></a></h3><h4 id="下载" tabindex="-1"><a class="header-anchor" href="#下载"><span>下载</span></a></h4><p><a href="https://nginx.org/en/download.html" target="_blank" rel="noopener noreferrer">从官网拿最新的下载地址</a></p><div class="language-sh line-numbers-mode" data-highlighter="shiki" data-ext="sh" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-sh"><span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"># 下载</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">wget</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> https://nginx.org/download/nginx-1.14.2.tar.gz</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"># 解压缩</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">tar</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> -xzvf</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> nginx-1.14.2.tar.gz</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"># 重命名</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">mv</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> nginx-1.14.2</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> nginx</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h4 id="编译安装" tabindex="-1"><a class="header-anchor" href="#编译安装"><span>编译安装</span></a></h4><div class="language-sh line-numbers-mode" data-highlighter="shiki" data-ext="sh" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-sh"><span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"># 配置（这条命令在解压后的Nginx目录下执行，/usr/local/nginx 为安装路径）(可能需要安装 gcc)</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> ./configure</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> --user=www</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> --group=www</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> --prefix=/usr/local/nginx</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> --with-http_stub_status_module</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> --with-http_ssl_module</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> --with-http_realip_module</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"># 编译 (可能需要安装 make)</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> make</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"># 安装</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> make</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> install</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h4 id="依赖库-zlib-pcre-openssl" tabindex="-1"><a class="header-anchor" href="#依赖库-zlib-pcre-openssl"><span>依赖库 zlib, pcre, openssl</span></a></h4><p><a href="https://blog.csdn.net/z920954494/article/details/52132125" target="_blank" rel="noopener noreferrer">ubuntu 下安装 nginx 时依赖库 zlib，pcre，openssl 安装方法</a></p><p>http_rewrite_module 需要 PCRE library</p><div class="language-sh line-numbers-mode" data-highlighter="shiki" data-ext="sh" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-sh"><span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> apt-get</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> install</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> libpcre3</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> libpcre3-dev</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>http_ssl_module 需要 OpenSSL library</p><div class="language-sh line-numbers-mode" data-highlighter="shiki" data-ext="sh" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-sh"><span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> apt-get</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> install</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> openssl</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> libssl-dev</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><h4 id="可能需要" tabindex="-1"><a class="header-anchor" href="#可能需要"><span>可能需要</span></a></h4><p>安装编译工具</p><div class="language-sh line-numbers-mode" data-highlighter="shiki" data-ext="sh" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-sh"><span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"># 安装 gcc，编译器</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> apt</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> install</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> gcc</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;"># 安装 make，编译执行</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> apt</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> install</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> make</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>新建用户和用户组</p><div class="language-sh line-numbers-mode" data-highlighter="shiki" data-ext="sh" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-sh"><span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">/usr/sbin/groupadd</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> -f</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> www</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">/usr/sbin/useradd</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> -g</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> www</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> www</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="配置" tabindex="-1"><a class="header-anchor" href="#配置"><span>配置</span></a></h2><p>配置文件位置，输入如下命令，找到关键字 <code>--conf-path</code></p><div class="language-bash line-numbers-mode" data-highlighter="shiki" data-ext="bash" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-bash"><span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> nginx</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> -V</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>测试配置文件是否正确</p><div class="language-bash line-numbers-mode" data-highlighter="shiki" data-ext="bash" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-bash"><span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> nginx</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> -t</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><h2 id="process-命令" tabindex="-1"><a class="header-anchor" href="#process-命令"><span>process 命令</span></a></h2><div class="language-bash line-numbers-mode" data-highlighter="shiki" data-ext="bash" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-bash"><span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">## 停止</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> nginx</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> -s</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> stop</span></span>
<span class="line"><span style="--shiki-light:#A0A1A7;--shiki-light-font-style:italic;--shiki-dark:#7F848E;--shiki-dark-font-style:italic;">## 重启</span></span>
<span class="line"><span style="--shiki-light:#4078F2;--shiki-dark:#61AFEF;">sudo</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> nginx</span><span style="--shiki-light:#986801;--shiki-dark:#D19A66;"> -s</span><span style="--shiki-light:#50A14F;--shiki-dark:#98C379;"> reload</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><a href="https://nginx.org/en/docs/switches.html" target="_blank" rel="noopener noreferrer">参考文档</a></p><h2 id="多个-location-指向不同的本地目录" tabindex="-1"><a class="header-anchor" href="#多个-location-指向不同的本地目录"><span>多个 location 指向不同的本地目录</span></a></h2><p>一个 server 中配置多个 location 指向不同的本地目录</p><p>参考文档：<a href="http://daimin.github.io/posts/Nginx-zhong-yi-ge-server-pei-zhi-duo-ge.html" target="_blank" rel="noopener noreferrer">Nginx 中一个 server 配置多个 location | 茶瓯葱丝</a></p><div class="language-nginxconf line-numbers-mode" data-highlighter="shiki" data-ext="nginxconf" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-nginxconf"><span class="line"><span>location / {</span></span>
<span class="line"><span>    root   E:/github/my-note-build/dist;</span></span>
<span class="line"><span>    index  index.html index.htm;</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span># 其他目录需使用别名</span></span>
<span class="line"><span>location /docs {</span></span>
<span class="line"><span>    alias   D:/_work/oa-mobile/projects/_docs/dist;</span></span>
<span class="line"><span>    index  index.html index.htm;</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="将所有请求指向同一个页面" tabindex="-1"><a class="header-anchor" href="#将所有请求指向同一个页面"><span>将所有请求指向同一个页面</span></a></h2><div class="language-nginxconf line-numbers-mode" data-highlighter="shiki" data-ext="nginxconf" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-nginxconf"><span class="line"><span># 方式 1，通过 try_files</span></span>
<span class="line"><span>location / {</span></span>
<span class="line"><span>    root   E:/github/my-note-build/dist;</span></span>
<span class="line"><span>    try_files $uri $uri/ /index.html;</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span># 方式 2，通过重定向 404</span></span>
<span class="line"><span>error_page 404 =200 /index.html;</span></span>
<span class="line"><span></span></span>
<span class="line"><span># 只处理子路径的所有请求</span></span>
<span class="line"><span>location /a4 {</span></span>
<span class="line"><span>    alias /home/wwwroot/v2;</span></span>
<span class="line"><span>    index  index.html;</span></span>
<span class="line"><span>    try_files $uri $uri/ /a4/index.html;</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="nginx-confg" tabindex="-1"><a class="header-anchor" href="#nginx-confg"><span>nginx.confg</span></a></h2><p>位置：nginx/conf/nginx.conf</p><p><a href="https://www.cnblogs.com/netsa/p/6383094.html" target="_blank" rel="noopener noreferrer">nginx 常见正则匹配符号表示</a></p><ul><li>~ 为区分大小写匹配</li><li>~* 为不区分大小写匹配</li><li>!~和!~*分别为区分大小写不匹配及不区分大小写不匹配</li></ul><div class="language-nginxconf line-numbers-mode" data-highlighter="shiki" data-ext="nginxconf" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code class="language-nginxconf"><span class="line"><span></span></span>
<span class="line"><span>user  www www;</span></span>
<span class="line"><span>worker_processes  1;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>#error_log  logs/error.log;</span></span>
<span class="line"><span>#error_log  logs/error.log  notice;</span></span>
<span class="line"><span>#error_log  logs/error.log  info;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>#pid        logs/nginx.pid;</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>events {</span></span>
<span class="line"><span>    worker_connections  1024;</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>http {</span></span>
<span class="line"><span>    # 设置mime类型，类型由mime.type文件定义</span></span>
<span class="line"><span>    include       mime.types;</span></span>
<span class="line"><span>    default_type  application/octet-stream;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    # 设定日志格式</span></span>
<span class="line"><span>    #log_format  main  &#39;$remote_addr - $remote_user [$time_local] &quot;$request&quot; &#39;</span></span>
<span class="line"><span>    #                  &#39;$status $body_bytes_sent &quot;$http_referer&quot; &#39;</span></span>
<span class="line"><span>    #                  &#39;&quot;$http_user_agent&quot; &quot;$http_x_forwarded_for&quot;&#39;;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    #access_log  logs/access.log  main;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    # sendfile指令指定Nginx是否调用sendfile函数（zero copy方式）来输出文件，对于普通应用，必须设定为on，如果用来进行下载等应用磁盘IO重负载应用，可设置为off，以平衡磁盘与网络I/O处理速度，降低系统的uptime</span></span>
<span class="line"><span>    sendfile        on;</span></span>
<span class="line"><span>    #tcp_nopush     on;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    # 设置超时时间</span></span>
<span class="line"><span>    #keepalive_timeout  0;</span></span>
<span class="line"><span>    keepalive_timeout  65;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    gzip  on; # 开启gzip压缩</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    server {</span></span>
<span class="line"><span>        listen       80;  # Nginx的监听端口</span></span>
<span class="line"><span>        server_name  localhost;  # 访问Nginx服务器的域名</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        # 编码设置</span></span>
<span class="line"><span>        #charset koi8-r;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        # 设定虚拟主机的访问日志</span></span>
<span class="line"><span>        #access_log  logs/host.access.log  main;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        location / {</span></span>
<span class="line"><span>            root   html; # 前端项目入口文件的路径</span></span>
<span class="line"><span>            index  index.html index.htm; # 前端入口文件为index.html</span></span>
<span class="line"><span>        }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        location /api {  # 凡是以/api开头的http请求都会被下面的服务器处理</span></span>
<span class="line"><span>            proxy_pass  https://127.0.0.1:3000;  # 被代理的服务器的域名</span></span>
<span class="line"><span>            #proxy_redirect     off;</span></span>
<span class="line"><span>            #proxy_set_header   Host             $host; // 很多时候开启这个代理反而失败</span></span>
<span class="line"><span>            #proxy_set_header   X-Real-IP        $remote_addr;</span></span>
<span class="line"><span>            #proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;</span></span>
<span class="line"><span>        }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        # 静态文件交给Nginx直接处理</span></span>
<span class="line"><span>        #location ~* ^.+\\.(css|js|txt|swf|mp4)$ {</span></span>
<span class="line"><span>        #location ~ /public { # 这样应该更好 /public 下是所有的静态资源</span></span>
<span class="line"><span>        #    root E:/web/public; # 注意，不能是反斜杠(\\)</span></span>
<span class="line"><span>        #    access_log off;</span></span>
<span class="line"><span>        #    expires 24h;</span></span>
<span class="line"><span>        #}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        error_page  404              /404.html;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        # redirect server error pages to the static page /50x.html</span></span>
<span class="line"><span>        #</span></span>
<span class="line"><span>        error_page   500 502 503 504  /50x.html;</span></span>
<span class="line"><span>        location = /50x.html {</span></span>
<span class="line"><span>            root   html;</span></span>
<span class="line"><span>        }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        # proxy the PHP scripts to Apache listening on 127.0.0.1:80</span></span>
<span class="line"><span>        #</span></span>
<span class="line"><span>        #location ~ \\.php$ {</span></span>
<span class="line"><span>        #    proxy_pass   http://127.0.0.1;</span></span>
<span class="line"><span>        #}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        # pass the PHP scripts to FastCGI server listening on 127.0.0.1:9000</span></span>
<span class="line"><span>        #</span></span>
<span class="line"><span>        #location ~ \\.php$ {</span></span>
<span class="line"><span>        #    root           html;</span></span>
<span class="line"><span>        #    fastcgi_pass   127.0.0.1:9000;</span></span>
<span class="line"><span>        #    fastcgi_index  index.php;</span></span>
<span class="line"><span>        #    fastcgi_param  SCRIPT_FILENAME  /scripts$fastcgi_script_name;</span></span>
<span class="line"><span>        #    include        fastcgi_params;</span></span>
<span class="line"><span>        #}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        # deny access to .htaccess files, if Apache&#39;s document root</span></span>
<span class="line"><span>        # concurs with nginx&#39;s one</span></span>
<span class="line"><span>        #</span></span>
<span class="line"><span>        #location ~ /\\.ht {</span></span>
<span class="line"><span>        #    deny  all;</span></span>
<span class="line"><span>        #}</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    # 多个server，可实现同一个端口，多个域名</span></span>
<span class="line"><span>    #server {</span></span>
<span class="line"><span>    #    listen       80;</span></span>
<span class="line"><span>    #    #域名</span></span>
<span class="line"><span>    #    server_name  blog.huruji3.com;</span></span>
<span class="line"><span>    #    location / {</span></span>
<span class="line"><span>    #        #node.js应用的端口</span></span>
<span class="line"><span>    #        proxy_pass http://127.0.0.1:3001;</span></span>
<span class="line"><span>    #        root blog;</span></span>
<span class="line"><span>    #    }</span></span>
<span class="line"><span>    #}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    # another virtual host using mix of IP-, name-, and port-based configuration</span></span>
<span class="line"><span>    #</span></span>
<span class="line"><span>    #server {</span></span>
<span class="line"><span>    #    listen       8000;</span></span>
<span class="line"><span>    #    listen       somename:8080;</span></span>
<span class="line"><span>    #    server_name  somename  alias  another.alias;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    #    location / {</span></span>
<span class="line"><span>    #        root   html;</span></span>
<span class="line"><span>    #        index  index.html index.htm;</span></span>
<span class="line"><span>    #    }</span></span>
<span class="line"><span>    #}</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>    # HTTPS server</span></span>
<span class="line"><span>    #</span></span>
<span class="line"><span>    #server {</span></span>
<span class="line"><span>    #    listen       443 ssl;</span></span>
<span class="line"><span>    #    server_name  localhost;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    #    ssl_certificate      cert.pem;</span></span>
<span class="line"><span>    #    ssl_certificate_key  cert.key;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    #    ssl_session_cache    shared:SSL:1m;</span></span>
<span class="line"><span>    #    ssl_session_timeout  5m;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    #    ssl_ciphers  HIGH:!aNULL:!MD5;</span></span>
<span class="line"><span>    #    ssl_prefer_server_ciphers  on;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    #    location / {</span></span>
<span class="line"><span>    #        root   html;</span></span>
<span class="line"><span>    #        index  index.html index.htm;</span></span>
<span class="line"><span>    #    }</span></span>
<span class="line"><span>    #}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="参考文档" tabindex="-1"><a class="header-anchor" href="#参考文档"><span>参考文档</span></a></h2><p><a href="https://blog.csdn.net/niceliusir/article/details/81048373" target="_blank" rel="noopener noreferrer">Ubuntu Server 16.04.1 LTS 64 位安装 Nginx 以及简单应用</a></p><p><a href="https://nginx.org/en/docs/configure.html" target="_blank" rel="noopener noreferrer">二进制安装官方配置文档</a></p><p><a href="https://www.qdskill.com/information/8426.html" target="_blank" rel="noopener noreferrer">Nginx 与前端开发</a></p><p><a href="https://mp.weixin.qq.com/s/wecUdGnuHdZOs3t7zc16jw" target="_blank" rel="noopener noreferrer">前端必备！最全 nginx 技术分析 - 前端之巅</a></p>`,44))])}const h=i(p,[["render",d]]),o=JSON.parse('{"path":"/old__/nginx.html","title":"","lang":"zh-CN","frontmatter":{"description":"安装 1.使用 apt 安装 2.编译安装 下载 编译安装 依赖库 zlib, pcre, openssl 可能需要 配置 process 命令 多个 location 指向不同的本地目录 将所有请求指向同一个页面 nginx.confg 参考文档 安装 1.使用 apt 安装 2.编译安装 下载 从官网拿最新的下载地址 编译安装 依赖库 zlib, ...","head":[["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"\\",\\"image\\":[\\"\\"],\\"dateModified\\":\\"2024-10-28T02:50:25.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"桥黎\\",\\"url\\":\\"\\"}]}"],["meta",{"property":"og:url","content":"http://docs.cqlql.top/old__/nginx.html"}],["meta",{"property":"og:site_name","content":"开发笔记"}],["meta",{"property":"og:description","content":"安装 1.使用 apt 安装 2.编译安装 下载 编译安装 依赖库 zlib, pcre, openssl 可能需要 配置 process 命令 多个 location 指向不同的本地目录 将所有请求指向同一个页面 nginx.confg 参考文档 安装 1.使用 apt 安装 2.编译安装 下载 从官网拿最新的下载地址 编译安装 依赖库 zlib, ..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2024-10-28T02:50:25.000Z"}],["meta",{"property":"article:modified_time","content":"2024-10-28T02:50:25.000Z"}]]},"git":{"createdTime":1652927496000,"updatedTime":1730083825000,"contributors":[{"name":"cqlql","username":"cqlql","email":"cql.ql@qq.com","commits":1,"url":"https://github.com/cqlql"},{"name":"陈桥黎","username":"","email":"cql.ql@qq.com","commits":1}]},"readingTime":{"minutes":4.05,"words":1215},"filePathRelative":"__old__/nginx.md","autoDesc":true}');export{h as comp,o as data};
