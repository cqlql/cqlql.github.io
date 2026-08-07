
`this.$root.constructor`

单文件组件有时可能需要使用 Vue 构造器对象，来使用部分全局 API。

```js
export default {
  mounted () {
    // 正确方式
    console.log(this.$root.constructor)
    // 错误方式，获取的是 VueComponent 组件构造器
    console.log(this.constructor)
    
  }
}
```
