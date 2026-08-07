## math.div 使用

@use 'sass:math';

```scss
.test {
  margin-top: math.div(-$centerSize, 2);
}
```

## 问题

### 变量覆盖 default 不生效

在 js 中 import 不生效，必须在 scss 文件中进行 import

## 颜色透明函数

```scss
$color-primary: #409eff;
.test {
  color: rgba($color-primary, 0.1);
}
```
