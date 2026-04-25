## 对象初始化器

不使用构造函数，而使用对象初始化器创建并初始化实例

```csharp
namespace CqlDotNet.SDK.APIEntity;
public class APIResult
{
  public string? message { get; set; }

  public int status { get; set; }

  public Object? result { get; set; }

  public static APIResult Ok(object result)
  {
    // 使用对象初始化器
    return new APIResult 
    { 
      status = 200,
      result = result 
    };
    // 也可以加上括号。构造函数没有参数可以省略括号
    // return new APIResult() { status = 200, result = result };

    // 相当于
    /*
    var apiResult = new APIResult()
    apiResult.status = 200
    apiResult.result = result
    */
  }
}

```

## 匿名类型实例化

使用对象初始化器方式创建

```csharp
var example = new { Greeting = "Hello", Name = "World" };
Console.WriteLine($"{example.Greeting}, {example.Name}!");
// Output:
// Hello, World!
```

## 参考文档

[第 90 讲：C# 3 之对象初始化器](https://www.bilibili.com/read/cv15412899)

[对象和集合初始值设定项 - C# 编程指南 | Microsoft Docs](https://docs.microsoft.com/zh-cn/dotnet/csharp/programming-guide/classes-and-structs/object-and-collection-initializers)

[new 运算符 - C# 参考 | Microsoft Docs](https://docs.microsoft.com/zh-cn/dotnet/csharp/language-reference/operators/new-operator)
