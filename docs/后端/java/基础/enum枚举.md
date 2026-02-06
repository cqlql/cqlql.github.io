# java enum 枚举

## 一、默认 enum 只有「名字」

```
public enum OrderStatus {
    CREATED,
    PAID,
    CANCELED
}
```

此时每个枚举值**只有一个内置属性**：

- `name()` → `"CREATED"`
- `ordinal()` → `0 / 1 / 2`

❌ 没有 code
 ❌ 没有描述
 ❌ 不能表达业务含义

------

## 二、自定义值 = 字段 + 构造函数

### 标准写法（90% 场景）

```
public enum OrderStatus {

    CREATED(0, "已创建"),
    PAID(1, "已支付"),
    CANCELED(2, "已取消");

    private final int code;
    private final String desc;

    OrderStatus(int code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public int getCode() {
        return code;
    }

    public String getDesc() {
        return desc;
    }
}
```

👉 这里的关键点是：

- **枚举值本身就是在调用构造函数**
- 构造函数 **不能是 public**
- 字段一般设成 `final`（枚举是常量）

------

## 三、为什么“必须”写构造函数？

因为下面这句本质是：

```
CREATED(0, "已创建")
```

等价于：

```
new OrderStatus(0, "已创建")
```

而 enum 的实例：

- 只能在 enum 内部创建
- 数量固定
- JVM 启动时一次性创建

所以：

> **你不写构造函数，就没地方接这些参数**

------

## 四、构造函数的访问级别（细节但重要）

下面这些在 enum 里**效果一样**：

```
OrderStatus(int code) { }
private OrderStatus(int code) { }
```

❌ 但不能写：

```
public OrderStatus(int code) { } // 编译错误
```

👉 因为 enum 的实例不允许外部 new。

------

## 五、可以有多个构造函数吗？

✅ 可以（但一般不建议复杂化）

```
public enum Example {
    A(1),
    B(2, "desc");

    private final int code;
    private final String desc;

    Example(int code) {
        this(code, null);
    }

    Example(int code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
```

但在业务 enum 里：

> **一个构造函数 + 明确字段 = 最清晰**

------

## 六、一个很容易忽略但很重要的点

### ❌ 不要这样设计

```
enum OrderStatus {
    CREATED,
    PAID,
    CANCELED;

    private int code; // ❌ 可变的
}
```

然后运行时去 set：

```
status.setCode(1);
```

这是**反枚举设计** ❌
 枚举应该是：

- 不可变
- 无状态变化
- 天生线程安全

------

## 七、你现在这个阶段的“最佳模板”

你以后写 enum，基本可以直接套这个：

```
@Getter
@AllArgsConstructor
public enum XxxEnum {

    A(1, "xxx"),
    B(2, "yyy");

    private final int code;
    private final String desc;

    public static XxxEnum fromCode(int code) {
        for (XxxEnum e : values()) {
            if (e.code == code) {
                return e;
            }
        }
        return null;
    }
}
```

（如果你用 Lombok）

------

## 八、一句话给你压轴

> **enum 本质是“有限个、提前 new 好的对象”**
>
> **要让对象有自定义属性，就必须用构造函数把值灌进去**