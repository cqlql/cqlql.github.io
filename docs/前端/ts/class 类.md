---
title: class 类
icon: mdi:alpha-c-box
sort: 5
---

## 快速使用

```ts
class Animal {
  public name: string                // 默认 public，可省略
  private name2: string              // 仅类内部可访问，派生类也不行
  protected name3: string = 'Animal3' // 类内部 + 派生类可访问
  readonly name4: string = 'Animal4'  // 声明时或构造函数中初始化
  name5?: string                      // 相当于 string | undefined

  constructor(theName: string) {
    this.name = theName
    this.name2 = theName
  }
  move(distanceInMeters: number = 0) {
    console.log(`Animal moved ${distanceInMeters}m.`)
  }
}

class Dog extends Animal {
  bark() {
    console.log('Woof! Woof!')
  }
}
```

## typeof + class

`typeof Greeter` 取的是**类（构造函数）本身的类型**，而非实例类型。

```ts
class Greeter {
  greeting: string
  constructor() { this.greeting = '' }
  greet() {}
}
let greeterMaker: typeof Greeter = Greeter
```

## 静态成员

静态成员属于类本身，修改会影响所有实例。

```ts
class Greeter {
  static standardGreeting = 'Hello, there'
  greet() {
    return Greeter.standardGreeting
  }
}
let greeterMaker: typeof Greeter = Greeter
greeterMaker.standardGreeting = 'Hey there!'
```

## private / protected 区别

- `private`：仅声明类内部访问，派生类内部也不可访问。
- `protected`：声明类及派生类内部可访问，外部不可访问。

## 存取器 (getter/setter)

```ts
class Employee {
  private _fullName: string = ''
  get fullName(): string {
    return this._fullName
  }
  set fullName(value: string) {
    this._fullName = value
  }
}
```

## 类的约束 implements

```ts
interface CreateHttpConstructor {
  new (): CreateHttp
  post: () => void
  get: () => void
}
export default class CreateHttp implements CreateHttpConstructor {
  constructor() {}
}
```
