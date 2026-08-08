---
title: html5plus 原生标题栏
icon: mdi:page-layout-header
---

uni-app / 5+ App 中通过 `plus.webview` 操作原生标题栏（titleNView）。

## 获取当前 webview 标题栏

```js
var titleNView = plus.webview.currentWebview().getTitleNView();
```

## manifest.json 静态配置

```json
{
  "plus": {
    "launchwebview": {
      "titleNView": {
        "backgroundcolor": "#f7f7f7",
        // "titletext": "首页",  // 不设置便会以 webview title 作为值
        "titlecolor": "#ff461f",
        "autoBackButton": true // 显示内置返回按钮，将触发原生返回事件
      }
    }
  }
}
```

## 动态修改 title / 颜色

不设置 `titleText` 则自动使用浏览器 title。

```js
plus.webview.currentWebview().setStyle({
  titleNView: {
    titleText: "new text",
    titlecolor: isShow ? "#88b8f8" : "#00000000", // #00000000 为透明色
  },
});
```

## 定制按钮

```js
plus.webview.currentWebview().setStyle({
  titleNView: {
    titleColor: "#000",
    buttons: [
      // 返回按钮
      {
        type: "back",
        text: "\ue123",
        float: "left",
        onclick: clickButton(),
      },
      // 分享按钮
      {
        float: "right",
        fontSize: "27px",
        fontSrc: "__wap2app.ttf", // wap2app 内置字体文件
        text: "\ue602",
        onclick:
          "javascript:plus.webview.getWebviewById('page1').evalJS('myshare();')",
      },
    ],
  },
});
```

### wap2app 内置字体图标

| 图标 | unicode |
| --- | --- |
| 向右箭头 | `\ue600` |
| 向左箭头（返回） | `\ue601` |
| 分享 | `\ue602` |
| 收藏 | `\ue604` |
| 主页 | `\ue605` |
| 关闭 | `\ue650` |

## webview 是否可后退

```js
plus.webview.currentWebview().canBack(function (e) {
  console.log("是否可返回：" + e.canBack);
});
```

## 物理返回键 / 再按一次退出

```js
// callback 传一个 function
var plusReady = function (callback) {
  if (window.plus) {
    callback();
  } else {
    document.addEventListener("plusready", callback);
  }
};

plusReady(function () {
  var firstBack = 0;
  var handleBack = function () {
    var currentWebview = plus.webview.currentWebview();
    var now = Date.now || function () { return new Date().getTime(); };

    currentWebview.canBack(function (evt) {
      /**
       * 有可后退的历史记录则后退，否则关闭当前窗口。
       * 如果当前窗口是入口页，执行退出逻辑。
       */
      if (currentWebview.id === plus.runtime.appid) {
        if (!firstBack) {
          firstBack = now();
          plus.nativeUI.toast("再按一次退出应用");
          setTimeout(function () {
            firstBack = 0;
          }, 2000);
        } else if (now() - firstBack < 2000) {
          plus.runtime.quit(); // 退出应用
        }
      } else {
        if (evt.canBack) {
          history.back();
        } else {
          currentWebview.close("auto");
        }
      }
    });
  };
  // backbutton 为物理返回键
  plus.key.addEventListener("backbutton", handleBack);
});
```

## 参考

- <https://ask.dcloud.net.cn/article/1205>
- <https://ask.dcloud.net.cn/article/1246>
