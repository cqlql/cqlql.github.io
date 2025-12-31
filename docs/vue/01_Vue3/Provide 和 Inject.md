## 说明

方便父组件可与深层次子组件共享状态

## 相关文档

[Provide / Inject 官方](https://v3.cn.vuejs.org/guide/component-provide-inject.htm)

## 常规使用示例

```js
const app = Vue.createApp({})

app.component('todo-list', {
  data() {
    return {
      todos: ['Feed a cat', 'Buy tickets'],
    }
  },
  provide: {
    user: 'John Doe',
  },
  template: `
    <div>
      {{ todos.length }}
      <!-- 模板的其余部分 -->
    </div>
  `,
})

app.component('todo-list-statistics', {
  inject: ['user'],
  created() {
    console.log(`Injected property: ${this.user}`) // > 注入的 property: John Doe
  },
})
```

## setup 使用

父组件：提供

```ts
import { provide, ref } from 'vue'

provide('setting', {
  // 非响应式
  name: '',
  // ref 响应式
  status: ref(''),
})

// 再设置一个，并且是直接设置一个响应式变量
const isLeader = ref(false)
provide('isLeader', isLeader)
```

深层次子组件：注入并使用

```ts
import { inject } from 'vue'
const setting = inject<Setting>('setting')
const isLeader = inject<Ref<boolean>>('isLeader')

// 可在子组件中修改
isLeader.value = true
```
