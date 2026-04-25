<font style="color:rgb(17, 17, 17);"> iPhone X 及其后续机型底部滑动区域</font>

> <font style="color:rgb(17, 17, 17);">env()需配合 viewport-fit=cover 使用？</font>
>

```css
.safe-page-bottom {
  padding-bottom: constant(safe-area-inset-bottom); /* 兼容 iOS < 11.2 */
  padding-bottom: env(safe-area-inset-bottom); /* 兼容 iOS >= 11.2 */
}
```

