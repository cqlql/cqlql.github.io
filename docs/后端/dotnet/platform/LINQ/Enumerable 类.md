- [说明](#说明)
- [Range 生成指定范围的整数序列](#range-生成指定范围的整数序列)
  - [基础](#基础)
  - [配合 Select](#配合-select)
- [相关文档](#相关文档)

## 说明

对数据进行遍历、筛选

## Range 生成指定范围的整数序列

### 基础

```c#
IEnumerable<int> nums = Enumerable.Range(1, 3);

foreach (int num in nums) {
  // 依次输出：1, 2, 3
  Console.WriteLine(num);
}
```

### 配合 Select

有点类似 js 的 map

```c#
IEnumerable<int> nums = Enumerable.Range(1, 5).Select(v => v+1);

foreach (int num in nums) {
  Console.WriteLine(num);
}
```

## 相关文档

[Enumerable 类](https://docs.microsoft.com/zh-cn/dotnet/api/system.linq.enumerable?view=net-5.0)
