---
title: sass 概览
icon: devicon:sass
sort: 1
---

## math.div 使用

@use 'sass:math';

```scss
.test {
  margin-top: math.div(-$centerSize, 2);
}
```

## 颜色函数

### 颜色变暗

`darken` 已废弃，改用 `color.scale`：

```scss
.font{
  // 旧
  color: darken($color: $uni-primary, $amount: 40%);
  // 改用
  color: color.scale($color: $uni-primary, $lightness: -40%);
}
```

### 颜色透明

```scss
$color-primary: #409eff;
.test {
  color: rgba($color-primary, 0.1);
}
```

## 问题

### 变量覆盖 default 不生效

在 js 中 import 不生效，必须在 scss 文件中进行 import
