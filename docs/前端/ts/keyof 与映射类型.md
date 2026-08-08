---
title: keyof 与映射类型
icon: mdi:key-variant
sort: 11
---

## keyof

取对象类型的所有键，作为联合类型。

```ts
interface Animal {
  live(): void
}
interface Dog extends Animal {
  woof(): void
}
type Example1 = Dog extends Animal ? number : string // number
type Example2 = RegExp extends Animal ? number : string // string
```

`keyof T` 常配合泛型约束使用（见 [泛型](./泛型.md) 的 `getProperty`）。

## 映射类型 (Mapped Types)

通过 `in keyof` 遍历键并转换。

```ts
// 约束常用字段：保留所有键，追加额外字段
function getRolePermission<T extends Object>(conf: T) {
  const result: {
    [k in keyof T | 'isSuperAdmin']?: boolean
  } = { isSuperAdmin: false }
  return result
}
const permit = getRolePermission({ canGet: 'get' })
console.log(permit.canGet)      // boolean
console.log(permit.isSuperAdmin)
```

去掉只读修饰：

```ts
export type Writable<T> = {
  -readonly [P in keyof T]: T[P]
}
```

## Record 键值对

```ts
type FormType = Record<string, string>
```

## 实战：任意数量的其它属性

```ts
interface SquareConfig {
  color?: string
  width?: number
  [propName: string]: any
}
```
