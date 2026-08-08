---
title: Lambda 表达式与方法引用
icon: mdi:lambda
---

# Lambda 表达式与方法引用

方法引用实际上是 Lambda 表达式的一种**缩写形式（语法糖）**只要一个 Lambda 表达式仅仅是调用一个已存在的方法，就可以用方法引用来替换。

- **Lambda 写法：** `(str) -> System.out.println(str)`
- **方法引用写法：** `System.out::println`

### 语法格式

它的基本格式是：

> **目标引用 :: 方法名**

根据场景不同，主要分为以下几种：

| **类型**                   | **示例**              | **对应的 Lambda 写法**       |
| -------------------------- | --------------------- | ---------------------------- |
| **静态方法引用**           | `Integer::parseInt`   | `s -> Integer.parseInt(s)`   |
| **特定对象的实例方法**     | `System.out::println` | `x -> System.out.println(x)` |
| **特定类型的任意对象方法** | `String::toUpperCase` | `s -> s.toUpperCase()`       |
| **构造方法引用**           | `ArrayList::new`      | `() -> new ArrayList()`      |

搜寻阶段在编译阶段完成。不允许猜谜，只能一种可能，两种或以上都将报错

