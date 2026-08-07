## 使用 css 的 3 种方式：外部样式表，内部样式表，内联样式

## 元素上设置遮罩层 mask-image

https://developer.mozilla.org/zh-CN/docs/Web/CSS/mask-image

## 多列 columns

特性：

- 多余的文本会自动往下一列

## translate scale 书写顺序影响效果

translate 需写在 scale 前面

```css
.message {
  transform: translate(-50%, -50%);
}

.zoom-in-enter,
.zoom-out-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}
```

## z-index 负数

参照层有背景会被背景遮住
