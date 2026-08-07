
## 使用 webview - java

```java
  import android.support.v7.app.AppCompatActivity;
  import android.os.Bundle;
  //import android.webkit.JavascriptInterface;
  //import android.webkit.WebChromeClient;
  import android.webkit.WebSettings;
  import android.webkit.WebChromeClient;
  import android.webkit.WebView;
  import android.webkit.WebViewClient;

  setContentView(R.layout.activity_main);

  WebView webview = (WebView) findViewById(R.id.webView1);
  webview.setWebChromeClient(new WebChromeClient());
  webview.setWebViewClient(new WebViewClient());
  WebView.setWebContentsDebuggingEnabled(true);

  WebSettings webSettings = webview.getSettings();
  webSettings.setJavaScriptEnabled(true);

  // WebSettings settings = webView.getSettings();
  // settings.setJavaScriptEnabled(true);
  if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.JELLY_BEAN) {
      webSettings.setAllowFileAccessFromFileURLs(true);
  }

  webview.loadUrl("http://192.168.1.222:8080");
  // webview.loadUrl("file:///android_asset/index.html");
  // webview.loadUrl("http://baidu.com");
```
