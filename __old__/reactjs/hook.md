- [useState 创建响应属性](#usestate-创建响应属性)
- [useEffect 副效应](#useeffect-副效应)
  - [作用](#作用)
  - [示例](#示例)
- [useContext 状态共享](#usecontext-状态共享)
- [useEffect ??](#useeffect-)
- [useCallback ??](#usecallback-)
- [props](#props)
- [自定义 hook](#自定义-hook)
- [问题](#问题)
  - [每次状态改变，函数都会执行吗？](#每次状态改变函数都会执行吗)

## useState 创建响应属性

代替 `this` 保存当前组件的状态

```tsx
import styles from './index.less'
import React, { useState } from 'react'

export default function IndexPage() {
  const [count, setCount] = useState(0)

  function onClick() {
    setCount(count + 1)
  }

  return (
    <div>
      <pre className={styles.title}>Page index {count}</pre>
      <button onClick={onClick}>test</button>
    </div>
  )
}
```

## useEffect 副效应

### 作用

1. 每次状态改变都会执行
2. 也可当某属性改变后才执行

### 示例

```jsx
import React, { useEffect } from 'react'

function Welcome(props) {
  useEffect(() => {
    console.log('只要发生改变这里就会执行')
    document.title = '加载完成'
  })
  return <h1>Hello, {props.name}</h1>
}
```

## useContext 状态共享

```tsx
import React, { useState, useContext } from 'react'

const colorContext = React.createContext('')

function Bar() {
  const color = useContext(colorContext)
  return <div style={{ color }}>{color}</div>
}
function Foo() {
  return <Bar />
}
export default function App() {
  const [color, setColor] = useState('red')
  function click() {
    setColor(color === 'grey' ? 'red' : 'grey')
  }
  return (
    <colorContext.Provider value={color}>
      <Foo />
      <button onClick={click}>改变</button>
    </colorContext.Provider>
  )
}
```

## useEffect ??

参数 2 到底时怎么一回事？？

真的能实现 watch 吗？？

## useCallback ??

## props

可以把 props 看出标签属性集，跟 vue 一样

```tsx
import { useState, useEffect } from 'react'

type WelcomeProps = {
  name?: string
}

const Welcome: React.FC<WelcomeProps> = (props) => {
  useEffect(() => {
    document.title = '加载完成'
  })
  return <h1>Hello, {props.name}</h1>
}

export default () => {
  const [name, setName] = useState('Jo')

  function click() {
    // eslint-disable-next-line no-bitwise
    setName(`Jo${~~(Math.random() * 100)}`)
  }

  return (
    <>
      <button onClick={click}>test</button>
      <Welcome name={name} />
    </>
  )
}
```

## 自定义 hook

也就是 hook 封装以及调用。

看上去就是函数，只是有些写法约定

## 问题

### 每次状态改变，函数都会执行吗？

函数重新执行后状态会重置成初始值吗？

```jsx
import React, { useState } from 'react'

function useTest(): [number, React.Dispatch<React.SetStateAction<number>>] {
  const [count, setCount] = useState(0)
  console.log('这里每次渲染都会执行，但状态保存了', count)
  return [count, setCount]
}

export default ({ title }: { title: string }) => {
  const [count, setCount] = useTest()

  function onClick() {
    setCount(Math.random())
  }

  return (
    <div>
      <h1>{title}</h1>
      <p>{count}</p>
      <button onClick={onClick}>test</button>
    </div>
  )
}
```
