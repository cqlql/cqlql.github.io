## 颜色变暗
```css
.font{
  // 旧
  color: darken($color: $uni-primary, $amount: 40%);
  // 改用
  color: color.scale($color: $uni-primary, $lightness: -40%);
}
```

