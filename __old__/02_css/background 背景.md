

## size && position 冲突

设置 background-size 后，对应的 background-position 会失效

```css
test{
  background-size: 100% auto; /* 设置了 x 100% */
  background-position-x: 83%; /* x失效，y有效 */
}
```

## body 背景

不像 fixed 那样固定在视窗，会被滚动条移动隐藏，且不受 body 高度影响，撑满视窗包括滚动隐藏距离。也就是 **铺满内容+视窗**
