# java类

## static 只能是内部类

> 静态内部类 = 不依赖外部类实例的内部类
>
> 静态内部类 ≈ 一个普通类，只是写在 Outer 里面
> 它和外部类没有实例级关系

### 何时使用

#### 1. 表达“强归属关系”

```java
public class Token {
    @Getter
    public static class Payload {
    	private String userName;
    }
}
// 使用
Token.Payload payload = new Token.Payload("张三");
```

语义上就是：

> **Payload 只属于 Token，不该被单独使用**

------

#### 2. 工具类 / DTO / Builder

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

#### 3. 避免内存泄漏（Android / 长生命周期）

静态内部类 **不持有外部类引用**，
 比非静态内部类安全得多。

------

#### 4. 实现经典设计模式（重点）

🔥 静态内部类单例（强烈推荐）

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

### 使用时是否需要new

#### 静态成员不需要new

```java
public class Outer {

    static class Inner {
        static void sayHello() {
            System.out.println("hello");
        }
    }
}

// 调用
Outer.Inner.sayHello();
```

#### 调用普通方法 —— 需要 new

```
Outer.Inner inner = new Outer.Inner();
inner.sayHello();
```

⚠️ 注意写法是：

```
new Outer.Inner();
```

而不是：

```
new Inner();        // ❌ 编译错误
```

## 普通内部类

> **非静态内部类 = 必须“依附某个外部对象而存在”的对象**

如果这个对象：

- **没有外部对象就没有意义**
- **天然要访问外部对象的状态**
- **生命周期和外部对象强绑定**

那它就该是 **非静态内部类**。

### 使用时需要new

```java
class Outer {
    private String name;
    public Outer(String name) {
        this.name = name;
    }
    class Inner {
        void print() {
            System.out.println(name);
        }
    }
}
```

创建多个内部类对象

```java
Outer outer = new Outer("张三");

Outer.Inner i1 = outer.new Inner();
Outer.Inner i2 = outer.new Inner();

i1.print();  // 张三
i2.print();  // 张三
```

- `i1` 和 `i2` 是 **两个不同的 Inner 实例**
- 但它们都持有 **同一个 outer 引用**
- 所以访问的是同一个 `Outer` 实例的数据

## final class

`final` 修饰类的核心作用只有一个：**禁止继承**，除此之外，这个类依然是普通类，依然可以被new

### 实现真正静态类

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

## enum 

### enum 内部类

内部 enum 默认就是 `static`

```java
public final class AudioPacket {
    public enum Type {
        AUDIO,
        POISON
    }
}
```

等价于（概念上）：

```java
public final class AudioPacket {
    public static enum Type {
        AUDIO,
        POISON
    }
}
```

### enum 为什么可以用 == 比较？

因为 Java 的 enum 常量在 JVM 中是单例对象，类加载时初始化，整个进程只有一份实例，因此可以用 `==` 进行引用比较，既安全又高效。

用 `==` 可以避免 NPE

```java
AudioPacket.Type type = null;

// 安全写法
if (type == AudioPacket.Type.POISON) { ... } // ✅ 不会报错

// 不安全写法
if (type.equals(AudioPacket.Type.POISON)) { ... } // ⚠ 会报 NullPointerException
```

## 类型判断

**传统写法（Java 14 之前）：**

```java
if (ex instanceof MethodArgumentNotValidException) {
    // 1. 既然判断过了，还得手动强转一次
    MethodArgumentNotValidException manve = (MethodArgumentNotValidException) ex;
    // 2. 然后才能使用 manve
    bindingResult = manve.getBindingResult();
}
```

**现代写法（Java 16+）：**

```java
// 如果 ex 是这个类型，直接把它赋值给变量 manve
if (ex instanceof MethodArgumentNotValidException manve) {
    // 这里直接用 manve，不需要强转
    bindingResult = manve.getBindingResult();
}
```
