## 示例：获取字段名称

```cs
public class APIResult<T>
{
  public string? Message { get; set; }

  public int Code { get; set; }

  public T? Result { get; set; }
}

internal class Program
{

    var apiResult = new APIResult<object>() { Message = "Hello", Code = 200, Result = { } };

    var t = apiResult.GetType();

    var props = t.GetProperties();

    Console.WriteLine(props[0].Name);
}
```

## 参考文档

[.NET Framework 中的动态编程](https://docs.microsoft.com/zh-cn/dotnet/framework/reflection-and-codedom/)
