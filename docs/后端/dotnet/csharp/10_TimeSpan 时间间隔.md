

示例：

```cs
// 秒
TimeSpan interval1 = TimeSpan.FromSeconds(15); // 00:00:15

// 时、分、秒
TimeSpan interval2 = new TimeSpan(2, 14, 18); // 02:14:18

// 天、时、分、秒
TimeSpan interval2 = new TimeSpan(1, 2, 14, 18); // 1.02:14:18

// 天、时、分、秒、毫秒
TimeSpan interval3 = new TimeSpan(1, 2, 14, 18, 500); // 1.02:14:18.5000000
```

更多信息：
[TimeSpan 结构](https://learn.microsoft.com/zh-cn/dotnet/api/system.timespan?view=net-7.0)
