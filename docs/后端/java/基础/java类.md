



## static 只能是内部类

> **静态内部类 = 不依赖外部类实例的内部类**

### ✅ 1. 表达“强归属关系”

```
public class Token {
    public static class Payload {
    }
}
```

语义上就是：

> **Payload 只属于 Token，不该被单独使用**

------

### ✅ 2. 工具类 / DTO / Builder

```
public class User {

    private String name;

    public static class Builder {
        public Builder name(String name) {}
        public User build() {}
    }
}
```

👉 **Builder 必须是 static**
 否则每个 Builder 都会持有一个 User 实例（灾难）

------

### ✅ 3. 避免内存泄漏（Android / 长生命周期）

静态内部类 **不持有外部类引用**，
 比非静态内部类安全得多。

------

### ✅ 4. 实现经典设计模式（重点）

#### 🔥 静态内部类单例（强烈推荐）

```
public class Singleton {

    private Singleton() {}

    private static class Holder {
        private static final Singleton INSTANCE = new Singleton();
    }

    public static Singleton getInstance() {
        return Holder.INSTANCE;
    }
}
```

✔ 懒加载
 ✔ 线程安全
 ✔ 无锁
 ✔ JVM 保证

## 普通内部类

> **非静态内部类 = 必须“依附某个外部对象而存在”的对象**

如果这个对象：

- **没有外部对象就没有意义**
- **天然要访问外部对象的状态**
- **生命周期和外部对象强绑定**

那它就该是 **非静态内部类**。

## final 实现真正静态类

```
public final class MathUtils {

    // 防止被 new
    private MathUtils() {}

    public static int add(int a, int b) {
        return a + b;
    }

    public static boolean isEven(int n) {
        return n % 2 == 0;
    }
}
```

## ⭐ 对比速览表

| 类型          | 是否依赖外部实例 | 能否访问外部实例成员 | 能否独立 new | 常见用途      |
| ------------- | ---------------- | -------------------- | ------------ | ------------- |
| 普通类        | ❌                | ❌                    | ✅            | 业务主类      |
| 普通内部类    | ✅                | ✅                    | ❌            | 强耦合辅助    |
| static 内部类 | ❌                | ❌                    | ✅            | DTO / Builder |
| final 工具类  | ❌                | ❌                    | ❌            | 常量 / 工具   |