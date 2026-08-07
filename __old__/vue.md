- [实例挂载](#实例挂载)
  - [$mount 多次调用不会更改挂载元素，也不会发生重新挂载](#mount-多次调用不会更改挂载元素也不会发生重新挂载)
  - [实例未挂载，其子组件不会初始](#实例未挂载其子组件不会初始)
- [计算属性可进行设置操作](#计算属性可进行设置操作)
- [keep-alive 缓存](#keep-alive-缓存)
- [mixin](#mixin)
- [slot](#slot)
- [router-view 加 key](#router-view-加-key)
- [组件直接渲染到 document 中](#组件直接渲染到-document-中)
- [改变 document 位置的组件销毁时不会被删除](#改变-document-位置的组件销毁时不会被删除)
- [$scopedSlot 与 $slot 区别](#scopedslot-与-slot-区别)

## 实例挂载

### $mount 多次调用不会更改挂载元素，也不会发生重新挂载

### 实例未挂载，其子组件不会初始

main.js

```js
import Vue from 'vue'
import App from './app.vue'

new Vue({
  // el: '#app', // 不挂在元素
  created() {
    console.log('created') // 触发
  },
  mounted() {
    console.log('mounted') // 不触发
  },
  router,
  template: '<app/>',
  components: {
    App,
  },
})
```

App.vue

```html
<template>
  <div>App</div>
</template>

<script>
  export default {
    beforeCreate() {
      console.log('app beforeCreate') // 不触发
    },
    created() {
      console.log('app created') // 不触发
    },
    mounted() {
      console.log('app mounted') // 不触发
    },
  }
</script>
```

## 计算属性可进行设置操作

计算属性返回的如果是对象引用，那么，可通过次计算属性设置其成员值

## keep-alive 缓存

`<router-view></router-view>` 也是支持的

父组件的销毁同样会销毁 keep-alive 的子组件

## mixin

**mounted 不会覆盖**  
mixins 中的 mounted 也会执行，并且先于组件 mounted 执行

**methods 中的同名成员会覆盖**  
以组件数据优先

## slot

例子涉及的特性

1. 动态具名插槽，也就是动态设置 name (不是动态插槽名)
2. 作用域插槽：prop 传值

组件中 slot 定义

```vue
<template>
  <div><slot :name="name" :d="data" /></div>
</template>
<script>
export default {
  data() {
    return {
      name: 'slotA',
      data: { label: '桃源', value: '1' },
    }
  },
}
</script>
```

使用

```vue
<template>
  <comp>
    <template v-slot:slotA="{ d }"> {{ d.label }}:{{ d.value }} </template>
  </comp>
</template>

<script>
import comp from './comp.vue'
export default {
  components: { comp },
}
</script>
```

## router-view 加 key

实现不共用组件实例

```xml
<router-view :key="key" />
```

## 组件直接渲染到 document 中

```js
import ToastComponent from './Toast.vue'
const Toast = Vue.extend(ToastComponent)
const toast = new Toast().$mount()
document.body.appendChild(toast.$el)

// 2 支持给组件传参，绑定状态，但多了一个父组件
import AreaSelectorComp from './AreaSelector.vue'
const areaSelector = new Vue({
  render: (h) =>
    h(AreaSelectorComp, {
      attrs: {
        get: this.getRegionList,
      },
    }),
}).$mount()
document.body.appendChild(areaSelector.$el)
```

## 改变 document 位置的组件销毁时不会被删除

```vue
<template>
  <div>test</div>
</template>

<script>
export default {
  mounted() {
    // 改变文档位置后销毁不会被删除
    document.body.appendChild(this.$el)
  },
  destroyed() {
    // 由于不会删除，所以在销毁后手动删除
    this.$el.remove()
  },
}
</script>
```

## $scopedSlot 与 $slot 区别

$slot：当前组件已加载的插槽

$scopedSlot：获取当前组件声明的插槽
