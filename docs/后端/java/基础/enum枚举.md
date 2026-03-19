# java enum 枚举

## 基础语法

```java
public class Demo {

    public enum Day {
        MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY
    }

    public static void main(String[] args) {
        Day[] days = Day.values();
        System.out.println(days[0].equals(Day.MONDAY)); // true
        System.out.println(Day.MONDAY.name()); // "MONDAY"
        System.out.println(Day.MONDAY.ordinal()); // 0 (跟声明位置有关系)
    }
}

```

如何使用：

- **直接引用：** `Day today = Day.MONDAY;`
- **Switch 语句：** 枚举与 `switch` 是绝配，代码可读性极高。
- **常用方法：**
  - `values()`: 返回包含所有枚举常量的数组。
  - `valueOf(String name)`: 将字符串转换为对应的枚举对象。
  - `name()`: `Day.MONDAY.name()` 的值就是 `"MONDAY"。
  - `ordinal()`: 返回枚举常量的索引（从 0 开始）。

## 枚举的底层原理

当你写下 `enum Color { RED }` 时，Java 编译器实际上会将其转换成类似下面的代码：

```java
public final class Color extends java.lang.Enum<Color> {
    public static final Color RED = new Color("RED", 0);
    // ... 其他生成的代码
}
```

- **单例性：** 每个枚举常量在 JVM 中只有一个实例。
- **线程安全：** 枚举实例的创建是线程安全的。
- **序列化安全：** Java 专门为枚举处理了序列化，防止通过反序列化创建多个对象。

## 枚举的高级特性（它是个类！）

在 Java 中，枚举可以拥有**成员变量、构造方法和方法**。这使得枚举能够携带更多信息。

### 标准写法（90% 场景）

```java
public class Demo {

    public enum OrderStatus {
        CREATED(0, "已创建"), PAID(1, "已支付"), CANCELED(2, "已取消");

        private final int code;
        private final String desc;

        // 构造器必须是私有的
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

    public static void main(String[] args) {
        System.out.println(OrderStatus.CREATED.code); // 0
        System.out.println(OrderStatus.CREATED.getDesc()); // "已创建"
    }
}

```

👉 这里的关键点是：

- **枚举值本身就是在调用构造函数**
- 构造函数 **不能是 public**
- 字段一般设成 `final`（枚举是常量）

## 自定义序列化规则 @JsonValue @JsonCreator

```java
package com.xiaodingtie.passup.common.util;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.databind.ObjectMapper;
public class Demo {

    public enum OrderStatus {
        CREATED(0, "已创建"), PAID(1, "已支付"), CANCELED(2, "已取消");

        private final int code;
        private final String desc;

        OrderStatus(int code, String desc) {
            this.code = code;
            this.desc = desc;
        }

        public int getCode() {
            return code;
        }

        @JsonValue
        public String getDesc() {
            return desc;
        }

        @JsonCreator
        public static OrderStatus from(String desc) {
            for (OrderStatus status : OrderStatus.values()) {
                if (status.desc.equals(desc)) {
                    return status;
                }
            }
            return null;
        }
    }

    public static class User {
        public String name = "张三";
        public OrderStatus status = OrderStatus.PAID;
    }

    public static void main(String[] args) throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        OrderStatus status = OrderStatus.PAID;

        User user = new User();

        try {
            // 序列化：将对象转为 JSON 字符串
            // 此时 @JsonValue 生效，将使用 getDesc() 作为值，而不是默认的 name()
            String json = mapper.writeValueAsString(user);
            System.out.println(json); // 输出: {"name":"张三","status":"已支付"}
                                      // 没有@JsonValue将输出：{"name":"张三","status":"PAID"}

            // 反序列化：将 JSON 字符串转回对象
            // 此时 @JsonCreator 生效，调用 from() 方法处理字符串
            OrderStatus deserialized = mapper.readValue("\"已支付\"", OrderStatus.class);
            System.out.println(deserialized); // 输出: PAID
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

```

## map 性能优化版（Java 8）

```java
package com.xiaodingtie.passup.modules.auth.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.HashMap;
import java.util.Map;

public enum PlatformType {
    IOS("ios"), ANDROID("android"), WINDOWS("windows"), MACOS("macos"), UNKNOWN("unknown");

    private final String code;

    // 使用 Map 缓存所有可能的输入
    private static final Map<String, PlatformType> LOOKUP = new HashMap<>();

    static {
        for (PlatformType type : PlatformType.values()) {
            LOOKUP.put(type.code, type);
            LOOKUP.put(type.name().toLowerCase(), type);
        }

        // 额外的兼容性映射（别名）
        LOOKUP.put("iphone", IOS);
        LOOKUP.put("ipad", IOS);
        LOOKUP.put("win", WINDOWS);
        LOOKUP.put("mac", MACOS);
        LOOKUP.put("osx", MACOS);
    }

    PlatformType(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static PlatformType from(String input) {
        if (input == null || input.isBlank()) {
            // 注意：这里建议返回 UNKNOWN 而不是 null，避免调用方出现 NPE
            return UNKNOWN;
        }

        // O(1) 查询，且支持别名
        return LOOKUP.getOrDefault(input.trim().toLowerCase(), UNKNOWN);
    }
}

```

## switch 终极版（Java 17+ ）

```java
public enum PlatformType {
    IOS("ios"), 
    ANDROID("android"), 
    WINDOWS("windows"), 
    MACOS("macos"), 
    UNKNOWN("unknown");

    private final String code;

    PlatformType(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static PlatformType from(String input) {
        if (input == null || input.isBlank()) {
            return UNKNOWN;
        }

        // 这种写法被称为 "Switch Expression"
        // 它会直接返回匹配到的枚举分支
        return switch (input.trim().toLowerCase()) {
            case "ios", "iphone", "ipad"      -> IOS;
            case "android"                    -> ANDROID;
            case "windows", "win", "win10"    -> WINDOWS;
            case "macos", "mac", "osx"        -> MACOS;
            case "unknown"                    -> UNKNOWN;
            default                           -> UNKNOWN;
        };
    }
}
```

### 为什么 Java 17 的 `switch` 比 `for` 循环和 `Map` 更好？

#### 1. 性能接近极致

在处理字符串时，Java 编译器会对 `switch` 进行特殊优化。它通常会先计算字符串的 `hashCode`，然后生成一个跳转表（Jump Table）。相比于 `Map` 方案，它省去了：

- `HashMap` 对象的创建和维护成本。
- `Node` 节点的内存开销。
- 查找时的引用间接寻址（Indirect addressing）。

#### 2. 语法极简（多值匹配）

注意代码中的 `case "ios", "iphone", "ipad"`。在 Java 17 之前，你需要写一串冗长的 `case` 穿透逻辑，而现在一行就解决了。这种写法非常直观地表达了**别名（Aliases）**的关系。

#### 3. 编译时完备性检查

如果你将 `switch` 作为表达式使用（比如直接 `return switch...`），Java 编译器会强制要求你覆盖所有可能的情况（必须有 `default` 分支或者覆盖所有枚举值）。这大大降低了漏掉某种情况导致的逻辑漏洞。

#### 4. 内存零开销

这个方法不需要任何静态缓存。除了代码本身占用的字节码空间外，它在运行时不占任何额外的堆内存，非常适合对内存敏感的微服务环境。

#### 5. 所以`switch` 肯对最好？
实际还得视情况而定，下例用 map就更好：

1. **易于维护**：新增枚举项时，你只需要添加一行定义（如 `FACE_ID("face_id"),`），`from` 方法**完全不需要修改**，它会自动将其加入缓存。
2. **性能更强**：`switch` 在底层虽然很快，但对于字符串匹配，`HashMap` 的 $O(1)$ 查找在逻辑清晰度和速度上取得了很好的平衡。
3. **错误信息更精准**：区分了“输入为空”和“输入非法”两种报错语义。

```java
public enum UserAuthType {
    PASSWORD("password"), 
    WECHAT_MINIAPP("wechat_miniapp"), 
    SMS("sms");

    private final String value;

    // 1. 使用 Map 进行静态缓存，只需在类加载时计算一次
    private static final java.util.Map<String, UserAuthType> LOOKUP = new java.util.HashMap<>();

    static {
        for (UserAuthType type : values()) {
            LOOKUP.put(type.value.toLowerCase(), type);
        }
    }

    UserAuthType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static UserAuthType from(String input) {
        // 2. 简洁的判空逻辑
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("AuthType cannot be null or empty");
        }

        // 3. 直接从 Map 中获取，复杂度为 O(1)
        UserAuthType result = LOOKUP.get(input.trim().toLowerCase());
        
        if (result == null) {
            throw new IllegalArgumentException("Unknown authType: " + input);
        }
        return result;
    }
}
```
