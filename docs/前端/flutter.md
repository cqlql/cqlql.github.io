---
title: flutter
icon: devicon:flutter
sort: 86
---

## 安装（Windows）

需先安装 Android Studio。配置环境变量（可配到用户变量）：

- `PATH` 新增 flutter 的 bin 目录，如 `C:\src\flutter\bin`
- `ANDROID_HOME`（SDK 找不到时才需要配），如 `D:\Android\sdk`

## 问题解决

### 卡在 `Running Gradle task 'assembleDebug'`

或报错 `Exception in thread "main" java.util.zip.ZipException: error in opening zip file`。

手动下载对应版本的 gradle，例如 `https://services.gradle.org/distributions/gradle-5.6.2-all.zip`，删除缓存目录（Windows 下形如 `C:\Users\<用户>\.gradle\wrapper\dists\gradle-5.6.2-all\<hash>`）中的 `gradle-5.6.2-all.zip` 和 `gradle-5.6.2` 文件夹，再把下载好的 zip 放进该目录。注意版本要与项目对应。

下载地址也可在项目的 `gradle\wrapper\gradle-wrapper.properties` 中找到。

参考：

- <https://stackoverflow.com/questions/61442718/whenever-i-try-flutter-run-it-gives-me-the-same-error-and-i-am-not-sure-what-to>
- <https://my.oschina.net/u/729139/blog/4496537>

## Dart 语法速记

### final 和 const

- `const`：编译时常量，值必须在编译期确定
- `final`：只赋值一次，值可以在运行时确定

### 集合字面量

```dart
var names = <String>['Seth', 'Kathy', 'Lars'];
var uniqueNames = <String>{'Seth', 'Kathy', 'Lars'};
var pages = <String, String>{
  'index.html': 'Homepage',
  'robots.txt': 'Hints for web robots',
};

// Map 构造
var views = Map<int, View>();
```

### 函数类型

定义带参数个数、参数类型、返回值类型的函数类型：

```dart
typedef Compare = int Function(Object a, Object b);
```

### 空安全访问

```dart
var a = p?.y; // p 为 null 时不取值
```

### 类

```dart
class Impostor implements Person {
  get _name => '';

  // 箭头函数体
  String greet(String who) => 'Hi $who. Do you know who I am?';
}
```

### 待深入

- 重写运算符
- `noSuchMethod`：应对不存在的方法或变量调用导致的 `NoSuchMethodError`
- class 的 Mixin
- 元数据、反射
