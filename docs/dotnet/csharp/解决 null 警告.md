## 解决 null 警告

```csharp
string? TryGetMessage(int id) => "";

string msg = TryGetMessage(42);  // Possible null assignment.

string notNullMsg = TryGetMessage(42) ?? "Unknown message id: 42";

// 使用 ! （null 包容）
string v = default!;
```

[解决可以为 null 的警告 | Microsoft Docs](https://docs.microsoft.com/zh-cn/dotnet/csharp/nullable-warnings)

[! （null 包容）运算符 - C# 参考 | Microsoft Docs](https://docs.microsoft.com/zh-cn/dotnet/csharp/language-reference/operators/null-forgiving)

[?? 和 ??= 运算符 - C# 参考 | Microsoft Docs](https://docs.microsoft.com/zh-cn/dotnet/csharp/language-reference/operators/null-coalescing-operator)
