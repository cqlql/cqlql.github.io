window['cb_android']({"outline":{"children":[{"index":0,"level":1,"name":"使用 webview - java","children":[]}],"name":"android"},"content":"<section><h1 id=\"使用 webview - java\" data-index=0>使用 webview - java</h1><pre><code class=language-java>  <span class=hljs-keyword>import</span> android.support.v7.app.AppCompatActivity;\n  <span class=hljs-keyword>import</span> android.os.Bundle;\n  <span class=hljs-comment>//import android.webkit.JavascriptInterface;</span>\n  <span class=hljs-comment>//import android.webkit.WebChromeClient;</span>\n  <span class=hljs-keyword>import</span> android.webkit.WebSettings;\n  <span class=hljs-keyword>import</span> android.webkit.WebChromeClient;\n  <span class=hljs-keyword>import</span> android.webkit.WebView;\n  <span class=hljs-keyword>import</span> android.webkit.WebViewClient;\n\n  setContentView(R.layout.activity_main);\n\n  WebView webview = (WebView) findViewById(R.id.webView1);\n  webview.setWebChromeClient(<span class=hljs-keyword>new</span> WebChromeClient());\n  webview.setWebViewClient(<span class=hljs-keyword>new</span> WebViewClient());\n  WebView.setWebContentsDebuggingEnabled(<span class=hljs-literal>true</span>);\n\n  WebSettings webSettings = webview.getSettings();\n  webSettings.setJavaScriptEnabled(<span class=hljs-literal>true</span>);\n\n  <span class=hljs-comment>// WebSettings settings = webView.getSettings();</span>\n  <span class=hljs-comment>// settings.setJavaScriptEnabled(true);</span>\n  <span class=hljs-keyword>if</span> (android.os.Build.VERSION.SDK_INT &gt;= android.os.Build.VERSION_CODES.JELLY_BEAN) {\n      webSettings.setAllowFileAccessFromFileURLs(<span class=hljs-literal>true</span>);\n  }\n\n  webview.loadUrl(<span class=hljs-string>\"http://192.168.1.222:8080\"</span>);\n  <span class=hljs-comment>// webview.loadUrl(\"file:///android_asset/index.html\");</span>\n  <span class=hljs-comment>// webview.loadUrl(\"http://baidu.com\");</span></code></pre></section>"})