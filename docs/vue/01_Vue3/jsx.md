## 函数式组件

函数式组件中的钩子函数，ref 状态并不能保存

```tsx
import { ref } from 'vue'

function useSearch() {
  // 每次执行都是新的 a，状态并没有保存
  // react 这里也式每次都执行，但状态有保存
  const a = ref('inside')
  console.log(`每次渲染这里都会执行 -- useSearch`, a)
  return {
    a,
  }
}

export default function (props: any, { slots }: any) {
  const { a } = useSearch()
  console.log(`每次渲染这里都会执行 -- render`, a)

  return (
    <div>
      {props.name}
      <p>a 的值: {a.value}</p>
      <button onClick={() => (a.value = String(Math.random()))}>change</button>
    </div>
  )
}
```

## setup 方式

```tsx
import { defineComponent } from 'vue'

export default defineComponent({
  props: {
    name: String,
  },
  setup(props) {
    console.log(`🚀 只会执行一次 -- setup -- props`, props)
    return () => {
      console.log(`🚀 每次渲染这里都会执行 -- props`, props)
      return <div>{props.name}</div>
    }
  },
})
```
