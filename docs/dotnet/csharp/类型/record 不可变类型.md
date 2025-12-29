## record 不可变类型

使用 record class 描述不可变类型，是引用类型，class 关键字可以省略。

使用 record struct 描述不可变类型，是值类型。

仅仅只是语义而已。需要结合 init 使用，如果使用 set 依然还是可变的。

以下两个示例效果是一样的：

```cs
// 简写
public record Person(string FirstName, string LastName);
```

```cs
// 完整写法
public record Person
{
    public string FirstName { get; init; } = default!;
    public string LastName { get; init; } = default!;
};
```

### with

复制对象，并且可使用对象初始化器初始化

只能复制 record 对象或者 struct 对象。

```cs
public record Person
{
  public string? FirstName { get; set; }
  public string? LastName { get; set; }
  public string? Address { get; set; }
  public string? City { get; set; }
  public string? Country { get; set; }
}

var john = new Person
{
  City = "Hyderabad"
};

var joly = john with { City = "Bangalore" };

WriteLine(john.Equals(joly)); // False
WriteLine(john.City); // Hyderabad
WriteLine(joly.City); // Bangalore
```

## init-only 不可变属性

也可用于 class

```cs
public class DbMetadata
{
  public string DbName { get; init; }
  public string DbType { get; init; }
}

DbMetadata dbMetadata = new DbMetadata()
{
  DbName = "Test",
  DbType = "Oracle"
};

// 报错，不允许
dbMetadata.DbType = "SQL Server";

```

## 参考文档

[记录 - C# 参考 | Microsoft Learn](https://learn.microsoft.com/zh-cn/dotnet/csharp/language-reference/builtin-types/record)
