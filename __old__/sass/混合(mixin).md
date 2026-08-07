

> 声明 简单声明 css块 css块声明 功能块声明

简单声明一些公用样式块

## 声明

```
@mixin center-block {
    margin-left:auto;
    margin-right:auto;
}
```


## 带参声明


```
@mixin opacity($opacity:50) {
  opacity: $opacity / 100;
  filter: alpha(opacity=$opacity);
}
```

## 使用

```
.demo{
    @include center-block;
}
```

