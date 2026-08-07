## 相关文档

[vue 教程 - JSX](https://cn.vuejs.org/v2/guide/render-function.html#JSX)

[语法文档](https://github.com/vuejs/jsx#installation)

[属性事件绑定方法](https://cn.vuejs.org/v2/guide/render-function.html#%E6%B7%B1%E5%85%A5%E6%95%B0%E6%8D%AE%E5%AF%B9%E8%B1%A1)

## 循环

```jsx
var MyComponent = Vue.extend({
  data() {
    return {
      list: ["1", "2"],
    };
  },
  methods: {
    testfn() {
      console.log(this);
    },
  },
  render() {
    let ls = [<li>{this.name}</li>];
    this.list.forEach((v) => {
      ls.push(<li>{v}</li>);
    });
    return (
      <div class="top-list-select">
        <ul class="l-mu">{ls}</ul>
      </div>
    );
  },
});
```

## class 标签属性操作

```
<dl class="m-group">2</dl>
```

```jsx
let isFold = 1;
return <dl class={["m-group", { fold: isFold }]}>2</dl>;
```

## 依然支持指令

包括集成指令、自定义指令

```jsx
<div class="select-box-p" v-show={this.isMultiple}></div>
```

## slot

```js
export default {
  render() {
    return <div>{this.$slots.default}</div>;
  },
};
```

```jsx
export default {
  render() {
    // 获取当前组件 插槽值
    let vBtns = $scopedSlots.btns && $scopedSlots.btns()

    // 给 TableListToolBar 定义插槽
    return (
      <div>
        <TableListToolBar
          scopedSlots={{
            top: () => {
              return <span>123</span>
            }
        />
        <vBtns />
      </div>
    )
  }
}
```
