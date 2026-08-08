---
title: 元素尺寸
icon: mdi:resize
sort: 8
---

## 精确获取（含小数）

- `Element.getBoundingClientRect()` — 返回元素的大小及相对于视口的位置（含小数） <https://developer.mozilla.org/zh-CN/docs/Web/API/Element/getBoundingClientRect>
- `window.getComputedStyle(element, [pseudoElt])` — 读取计算后的 CSS 值（含动画过程中的瞬时值） <https://developer.mozilla.org/zh-CN/docs/Web/API/Window/getComputedStyle>

```js
const rect = el.getBoundingClientRect()
rect.width   // 含小数
rect.height
rect.top      // 相对视口顶部
rect.left

const style = getComputedStyle(el)
style.width                       // "100px"
style.getPropertyValue('width')
```

## 取整属性（只读，四舍五入为整数）

| 属性 | 含义 | 包含 |
| --- | --- | --- |
| `clientHeight` / `clientWidth` | 可视区（不含边框、不含滚动条） | padding |
| `offsetHeight` / `offsetWidth` | 实际占位（不含 margin） | 边框 + padding |
| `scrollHeight` / `scrollWidth` | 内容总高（含被隐藏部分） | padding |

```js
el.clientHeight   // 不含边框、滚动条
el.offsetHeight   // 含边框
el.scrollHeight   // 内容总高（含溢出隐藏部分）
```

**取不到值（为 0）的情况**：

1. `display: none`
2. 动态创建但未插入文档
3. 操作的是行内元素（`inline` 得到 0，可用 `inline-block` 解决；`offset*` 不受影响）

**与 CSS `width` 的关系**：通常等同 CSS 的 `width`，例外——

- 设置 `box-sizing: border-box` 后，CSS `width` 含边框，而 `client*` 仍不含边框
- `display: none` 时 `client*` 固定为 0

## 边框宽度

`clientLeft`（左边框）、`clientTop`（上边框），**只读**，只取左上两边宽度。

```js
el.clientLeft // 左边框宽度
el.clientTop  // 上边框宽度
```

> 兼容性备注：IE6/7 在元素 CSS 高宽为 `auto` 时 `client*` 可能返回 0，可改用 `offset` 属性间接计算（现代浏览器无需关注）。
