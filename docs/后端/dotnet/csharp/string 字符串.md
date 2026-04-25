## 连接字符串

在使用循环连接字符串时，应避免时用 String.Concat 或 + 运算符，应使用使用 [StringBuilder](https://learn.microsoft.com/zh-cn/dotnet/csharp/how-to/concatenate-multiple-strings#stringbuilder) 代替。


```cs
// Use StringBuilder for concatenation in tight loops.
var sb = new System.Text.StringBuilder();
for (int i = 0; i < 20; i++)
{
    sb.AppendLine(i.ToString());
}
System.Console.WriteLine(sb.ToString());
```

更多信息：[连接字符串](https://docs.microsoft.com/zh-cn/dotnet/csharp/how-to/concatenate-multiple-strings)


## 字符串插值

### `$`

行字符串内插入其他字符串值。

```cs
string userName = "<Type your name here>";
string date = DateTime.Today.ToShortDateString();

// Use string interpolation to concatenate strings.
string str = $"Hello {userName}. Today is {date}.";
System.Console.WriteLine(str);
```

更多信息：[如何连接多个字符串（C# 指南） | Microsoft Learn](https://learn.microsoft.com/zh-cn/dotnet/csharp/how-to/concatenate-multiple-strings#string-interpolation)

### `String.Format`

功能比较强大。[间距](https://learn.microsoft.com/zh-cn/dotnet/api/system.string.format?view=net-6.0#control-spacing)，[对齐](https://learn.microsoft.com/zh-cn/dotnet/api/system.string.format?view=net-6.0#control-alignment)都可以控制，还能[自定义格式](https://learn.microsoft.com/zh-cn/dotnet/api/system.string.format?view=net-6.0#custom-formatting-operations)。更高级的用法请看[官方文档](https://learn.microsoft.com/zh-cn/dotnet/api/system.string.format?view=net-6.0)。

```cs
// 1. 控制格式
string s = String.Format("It is now {0:d} at {0:t}", DateTime.Now);
Console.WriteLine(s);
// Output similar to: 'It is now 4/10/2015 at 10:04 AM'

// 2. 多个
string s = String.Format("At {0}, the temperature is {1}°C.",
                         DateTime.Now, 20.4);
Console.WriteLine(s);
// Output similar to: 'At 4/10/2015 9:29:41 AM, the temperature is 20.4°C.'
```




## 多行字符串 `"""`

从 C# 11 开始支持

```cs
string embeddedXML = """
       <element attr = "content">
           <body style="normal">
               Here is the main text
           </body>
           <footer>
               Excerpts from "An amazing story"
           </footer>
       </element >
       """;
```

更多信息：[字符串 - C# 编程指南 | Microsoft Learn](https://learn.microsoft.com/zh-cn/dotnet/csharp/programming-guide/strings/#raw-string-literals)


## 字符串格式

包括数字格式，日期格式，自定义格式等等，这里只列出几种用法示例，更多信息移步[官方文档](https://learn.microsoft.com/zh-cn/dotnet/standard/base-types/formatting-types)。

```cs
// 货币格式
Console.WriteLine(format: "余额: {0:C}",arg0: 1.126); // 余额： ¥1.13

// 数字格式
Console.WriteLine($"数: {10000:N}"); // 10,000.00

// 这里涉及 '#' '0' 占位符，',' 分隔符
WriteLine($"{timer.ElapsedMilliseconds:#,##0}ms elapsed.");
```

## 非空判断

```cs
string.IsNullOrEmpty("") // true
string.IsNullOrEmpty(null) // true
```
