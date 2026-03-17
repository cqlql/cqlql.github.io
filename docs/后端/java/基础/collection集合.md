## 循环方式

### 经典方式（最常用 & 性能最好）

#### 1. 普通 for（索引循环）

适用于 `List`

```
for (int i = 0; i < list.size(); i++) {
    String val = list.get(i);
}
```

✅ 优点：

- 性能最好（尤其 ArrayList）
- 可控制索引（下标操作）

❌ 缺点：

- 代码稍冗长
- 不适用于 Set

##### 变体示例

| 类型       | 示例                               |
| ---------- | ---------------------------------- |
| 倒序循环   | `for (int i = 10; i > 0; i--)`     |
| 多变量循环 | `for (int i=0,j=10; i<j; i++,j--)` |
| 无限循环   | `for(;;){ ... break; }`            |

---

##### 循环控制语句

| 语句       | 作用                         |
| ---------- | ---------------------------- |
| `break`    | 退出整个循环                 |
| `continue` | 跳过本次循环，进入下一次迭代 |

示例：

```
for (int i = 0; i < 10; i++) {
    if (i % 2 == 0) continue;  // 跳过偶数
    if (i > 7) break;          // 大于7则退出循环
    System.out.println(i);
}
```



------

#### 2. 增强 for（foreach）

本质是 Iterator 的语法糖

```
for (String val : list) {
}
```

✅ 优点：

- 简洁、最常用
- 自动处理 Iterator

❌ 缺点：

- 不能安全删除元素（会触发 ConcurrentModificationException）

------

#### 3. Iterator（显式迭代器）

```
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    String val = it.next();
}
```

✅ 优点：

- **唯一安全删除方式**

```
it.remove();
```

❌ 缺点：

- 写法冗长

### 二、函数式（Java 8+）

#### 4. forEach（Iterable 默认方法）

```
list.forEach(val -> {
});
```

或者方法引用：

```
list.forEach(System.out::println);
```

✅ 优点：

- 简洁
- 比 Stream 轻量

❌ 缺点：

- 不支持 break / continue

------

#### 5. Stream API

```
List<String> result = ids.stream()             // 1. 开启传送带，把数据装上去
    .map(obj -> Objects.toString(obj, ""))    // 2. 加工：把流里的每个元素传给转换函数
    .collect(Collectors.toList());            // 3. 打包：把处理完的所有元素装进一个新的 List
    
    
list.stream()
    .filter(x -> x.length() > 3) // 过滤
    .forEach(System.out::println); // 循环
```

将一个**静态的集合**（Collection）转换为一个**动态的流**（Stream）的过程。你可以把它想象成把一池子水（List）抽进一根透明的管子（Stream）里，让水流经过一个个过滤器或加工站。

`Stream` 不是一种数据结构，它不存储数据。它更像是一个**传送带**，数据在上面流过，你可以在传送带上对每个元素进行处理。

- **数据源 (Source)**：这里的 `list` 就是源。
- **中间操作 (Intermediate Operations)**：比如 `.map()`、`.filter()`。它们是“懒”的，只有在最后关头才会执行。
- **终端操作 (Terminal Operation)**：比如 `.collect()`、`.forEach()`。一旦执行，流就会关闭。

`.collect(Collectors.toList())` 解释：

- `Collectors.toList()` 产生并传递了一份“说明书”。
- Stream 引擎阅读这份说明书，发现里面写着：“去创建一个 `ArrayList`，把流里的字符串都塞进去”。
- 最后，Stream 引擎按照说明书完成工作，并把装满数据的 `List` 交还给你。

✅ 优点：

- 声明式编程
- 支持 map / filter / reduce
- 可并行

❌ 缺点：

- 有一定性能损耗
- 调试不如 for 直观

------

#### 6. 并行流（parallelStream）

当处理 **10万+** 数据量时，将`stream()` 改成`parallelStream()`，速度倍增。

```
// 只需要改一个词，Java 就会自动利用多核 CPU 并行处理转换，速度倍增
List<String> result = ids.parallelStream()
    .map(String::valueOf)
    .collect(Collectors.toList());
```

✅ 优点：

- 自动并行

❌ 注意：

- **不保证顺序**
- 不适合 IO / 小任务

### ✅ 最推荐的几种

| 场景       | 推荐方式           |
| ---------- | ------------------ |
| 普通遍历   | foreach            |
| 需要 index | for                |
| 需要删除   | Iterator           |
| 函数式处理 | Stream             |
| Map 遍历   | entrySet / forEach |

## List → Map 转换

### 示例代码

```java
List<Item> items = ...; // 任意列表

Map<KeyType, ValueType> map = items.stream()
    .collect(Collectors.toMap(
        Item::getKey,          // keyMapper：Map 的 key
        item -> item.getValue() // valueMapper：Map 的 value
    ));
```

