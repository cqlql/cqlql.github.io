让字段可为 null，解决可为 null 警告。

```cs
  public record class Person
  {
    public string Address { get; set; } = null!;
    public string FirstName { get; set; } = default!;
    // 添加 ? 注释也可以实现
    public string? LastName { get; set; }
  }
```

更多信息：[! （null 包容）运算符](https://learn.microsoft.com/zh-cn/dotnet/csharp/language-reference/operators/null-forgiving)
