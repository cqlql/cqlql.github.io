# Java 访问修饰符

| 关键字           | 含义                 |
| ---------------- | -------------------- |
| abstract class   | 不允许直接 new，只能继承           |
| abstract method  | 强制你实现           |
| final field      | 强制你只赋值一次     |
| final method     | 禁止你改流程         |
| protected method | 只给子类 + 同包，不给外人           |
| public method    | 给容器调用           |

## 一句话总结

> - **public**：给别人用
> - **protected**：给子类用
> - **default**：给同包用
> - **private**：只给自己
> - **final**：不许改（类 / 方法 / 引用）（先加，不需要再去掉）
> - **abstract**：你必须实现

## 🚨 常见误区（你顺手避掉）

### ❌ 误区 1：final = 值完全不可变

```
final List<String> list = new ArrayList<>();
list.add("a"); // ✅ 可以
list = new ArrayList<>(); // ❌ 不行
```

👉 **final 限制的是“引用”，不是“对象内容”**

------

### ❌ 误区 2：final field 只是“编码洁癖”

在 Spring / 并发 / Filter 场景里：

- final field = 更清晰的线程安全语义
- final field = 更强的设计约束
- final field = IDE & 编译器帮你兜底

👉 **不是洁癖，是工程习惯**