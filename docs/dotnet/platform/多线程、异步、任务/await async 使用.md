
## 基本使用

只要能返回 Task，就能使用 await async

下例在 Task.Factory.StartNew 中使用 Task

```cs
class Program
{
  static Random r = new Random();
  static string? Message; // a shared resource

  static void MethodA()
  {
    for (int i = 0; i < 5; i++)
    {
      Thread.Sleep(r.Next(1000));
      Message += "A";
      Write(".");
    }
  }

  static void MethodB()
  {
    for (int i = 0; i < 5; i++)
    {
      Thread.Sleep(r.Next(1000));
      Message += "B";
      Write(".");
    }

  }

  static async Task<int> Main(string[] args)
  {
    WriteLine("Please wait for the tasks to complete.");
    Stopwatch watch = Stopwatch.StartNew();

    await Task.Factory.StartNew(MethodA);
    await Task.Factory.StartNew(MethodB);


    WriteLine();
    WriteLine($"Results: {Message}.");
    WriteLine($"{watch.ElapsedMilliseconds:#,##0} elapsed milliseconds.");

    return 0
  }
}

```

## await foreach 异步数据流

异步迭代

## await using 异步释放


## 参考文档

[await 运算符 - C# 参考 | Microsoft Learn](https://learn.microsoft.com/zh-cn/dotnet/csharp/language-reference/operators/await)
