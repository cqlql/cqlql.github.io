---
title: Switch 表达式
icon: mdi:source-branch
---

# Switch 表达式

在 Java 21 之前，`switch` 只能处理基本类型、枚举或字符串；而现在，它能直接处理**对象类型**。

```java
BindingResult bindingResult = switch (ex) {
    case MethodArgumentNotValidException manve -> manve.getBindingResult();
    case BindException be -> be.getBindingResult();
    default -> throw new IllegalStateException("Unexpected exception type: " + ex.getClass());
};
```