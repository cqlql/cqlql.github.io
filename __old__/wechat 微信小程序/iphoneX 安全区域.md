https://developers.weixin.qq.com/community/develop/article/doc/000604d707c5b023a049ba7125b413

```css
/* 用法示例 */
.test {
  bottom: calc(50px + constant(safe-area-inset-bottom));
  padding-bottom: constant(safe-area-inset-bottom);
  /* iOS 11.2 beta及其后 */
  bottom: calc(50px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
}
```
