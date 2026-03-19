##  --> 字符串

| 方法                        | null 行为 | 推荐度 | 说明               |
| --------------------------- | --------- | ------ | ------------------ 
| `val.toString()`            | ❌ NPE     | ⭐⭐     | 仅限确定非 null |
| `String.valueOf(val)`       | `"null"`  | ⭐⭐⭐⭐   | 通用推荐      |
| `Objects.toString(obj, "")` | `""`      | ⭐⭐⭐⭐⭐  | **最优雅（推荐）** |
| `Objects.toString(obj)`     | `"null"`  | ⭐⭐⭐    | 等价 valueOf  |
| `val + ""`                  | `"null"`  | ⭐⭐     | 不推荐          |
| `String.format("%s", val)`  | `"null"`  | ⭐      | 太重             |


### String.format
#### 常见占位符速查表

| **占位符** | **含义**                         | **示例结果**   |
| ---------- | -------------------------------- | -------------- |
| **`%s`**   | 字符串（最通用，可接收任何类型） | `"Hello"`      |
| **`%d`**   | 整数                             | `100`          |
| **`%.2f`** | 浮点数（保留两位小数）           | `3.14`         |
| **`%tF`**  | 日期（年-月-日）                 | `2024-05-20`   |
| **`%n`**   | 平台无关的换行符                 | `\n` 或 `\r\n` |

#### 多变量拼接的可读性

传统的 `+` 号拼接在变量多的时候会变成“代码毛线球”，而 `format` 非常整洁。

- **糟糕的写法**： `String s = "User " + name + " (ID: " + id + ") logged in from " + ip;`
- **优雅的写法**： `String s = String.format("User %s (ID: %d) logged in from %s", name, id, ip);`

#### 强大的格式化能力

`%s` 只是冰山一角。它支持各种精细控制：

- **控制宽度/对齐**：`String.format("|%10s|", "Hi");`  → 输出 `|        Hi|`（右对齐，占10位）。
- **截取字符串**：`String.format("%.3s", "Hello");` → 输出 `Hel`（只取前三位）。

#### 可以通过数字指定参数位置：

```
// %1$s 表示引用第一个参数，%2$s 引用第二个
String s = String.format("%2$s 喜欢 %1$s", "苹果", "小明");
// 结果: "小明 喜欢 苹果"
```

#### 性能预警 ⚠️

在高性能循环（如处理百万级数据）中，**严禁使用** `String.format`。

#### JDK 15+ 的新选择 `formatted()`

```java
String info = "Name: %s, Age: %d".formatted(name, age);
```

## 空判断

### 使用 Apache Commons Lang (最常用)

如果你在项目中集成了 `commons-lang3`，这是最推荐的做法。

```java
// 判断是否为 null 或 ""
if (StringUtils.isEmpty(defaultPassword)) { ... }

// 更强力的判断：不仅判断 null 和 ""，还判断是否全是空格（如 "  "）
if (StringUtils.isBlank(defaultPassword)) { ... }
```
