# java enum 枚举

## 基础语法

```java
public class Demo {

    public enum Day {
        MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY
    }

    public static void main(String[] args) {
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

