---
title: android
sort: 21
---

## 判断是横屏还是竖屏

```java
if (this.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE) {
    // 横屏
} else if (this.getResources().getConfiguration().orientation == Configuration.ORIENTATION_PORTRAIT) {
    // 竖屏
}
```

## 设置全屏

1. 在 `AndroidManifest.xml` 中对应的 Activity 添加：

```xml
android:theme="@android:style/Theme.NoTitleBar.Fullscreen"
```

2. 或在 `Activity` 的 `onCreate` 中设置：

```java
this.getWindow().setFlags(
    WindowManager.LayoutParams.FLAG_FULLSCREEN,
    WindowManager.LayoutParams.FLAG_FULLSCREEN
);
```

## 取得屏幕的宽和高

```java
WindowManager wm = (WindowManager) this.getSystemService(Context.WINDOW_SERVICE);
DisplayMetrics dm = new DisplayMetrics();
wm.getDefaultDisplay().getMetrics(dm);
int width = dm.widthPixels;
int height = dm.heightPixels;
```

## 监听 edittext 点击弹出键盘

```java
editText.setOnClickListener(new View.OnClickListener() {
    @Override
    public void onClick(View v) {
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null) {
            imm.showSoftInput(editText, InputMethodManager.SHOW_FORCED);
        }
    }
});
```

## 取得用户安装的 apk 名称

```java
PackageManager pm = getPackageManager();
List<PackageInfo> packages = pm.getInstalledPackages(0);
for (PackageInfo pkg : packages) {
    // 过滤掉系统应用：pkg.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM
    String appName = pm.getApplicationLabel(pkg.applicationInfo).toString();
    Log.d("installed", appName);
}
```
