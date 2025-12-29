
## Task 说明

从线程池中使用一个线程

## Task 基础使用

等待方法

| 方法                 | 说明                                       |
| -------------------- | ------------------------------------------ |
| t.Wait()             | 等待名为 t 的 Task 实例执行完成            |
| Task.WaitAny(Task[]) | 数组中的任务并行执行，只等待最先完成的任务 |
| Task.WaitAll(Task[]) | 数组中的任务并行执行，等待所有任务执行完成 |

创建任务示例

```cs
using System.Diagnostics;
using static System.Console;

var timer = Stopwatch.StartNew();

/* 创建任务的 3 种方式 */
// 方式1
Task taskA = new Task(MethodA);
taskA.Start(); // 单独调用 Start 开始。更灵活
// 方式2 直接开始任务
Task taskB = Task.Factory.StartNew(MethodB);
// 方式3 直接开始任务
Task taskC = Task.Run(new Action(MethodC));

// 等待所有任务运行。否则将立即往下执行
Task[] tasks = { taskA, taskB, taskC };
Task.WaitAll(tasks);

WriteLine($"{timer.ElapsedMilliseconds}ms");

void MethodA()
{
  WriteLine("Starting Method A...");
  Thread.Sleep(1_000);
  WriteLine("Finished Method A...");
}

void MethodB()
{
  WriteLine("Starting Method B...");
  Thread.Sleep(2_000);
  WriteLine("Finished Method B...");
}

void MethodC()
{
  WriteLine("Starting Method C...");
  Thread.Sleep(3_000);
  WriteLine("Finished Method C.");
}
```

## 使用 `Task.Factory.StartNew` 依次执行任务

等待上一个任务完成后再执行下一个任务，并且将上一个任务的返回值传递给下一个任务，例子如下

```cs
static decimal CallWebService()
{
  WriteLine("Starting call to web service...");
  Thread.Sleep((new Random()).Next(2000, 4000));
  WriteLine("Finished call to web service.");
  return 89.99M;
}

static string CallStoredProcedure(decimal amount)
{
  WriteLine("Starting call to stored procedure...");
  Thread.Sleep((new Random()).Next(2000, 4000));
  WriteLine("Finished call to stored procedure.");
  return $"12 products cost more than {amount:C}.";
}

var timer = Stopwatch.StartNew();

WriteLine("Passing the result of one task as an input into another.");

var taskCallWebServiceAndThenStoredProcedure =
  Task.Factory.StartNew(CallWebService)
    .ContinueWith(previousTask => CallStoredProcedure(previousTask.Result));

// 这步很关键
// 调用 taskCallWebServiceAndThenStoredProcedure.Result 就会等待任务执行完
WriteLine($"Result: {taskCallWebServiceAndThenStoredProcedure.Result}");

WriteLine($"{timer.ElapsedMilliseconds:#,##0}ms elapsed.");
```


## 嵌套任务 - 使用 `Task.Factory.StartNew` 实现

在任务中又创建一个任务，这个新建的任务就是子任务。

没有特殊声明情况，父任务和子任务是一起运行的。如果需要等待子任务完成后再完成父任务，则需要再创建子任务的时候增加参数TaskCreationOptions.AttachedToParent。

```cs
using System;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;
using static System.Console;

namespace NestedAndChildTasks
{
  class Program
  {
    static void OuterMethod()
    {
      WriteLine("Outer method starting...");

      // 子任务
      // TaskCreationOptions.AttachedToParent 参数实现串联执行
      var inner = Task.Factory.StartNew(InnerMethod, TaskCreationOptions.AttachedToParent);
      
      WriteLine("Outer method finished.");
    }

    static void InnerMethod()
    {
      WriteLine("Inner method starting...");
      Thread.Sleep(2000);
      WriteLine("Inner method finished.");
    }

    static void Main(string[] args)
    {
      var outer = Task.Factory.StartNew(OuterMethod);
      outer.Wait();
      WriteLine("Console app is stopping.");
    }
  }
}
```

参考文档：[C#嵌套任务和子任务](https://cloud.tencent.com/developer/article/1432315)


## “Task.Factory.StartNew” vs “new Task(…).Start”

`Task.Factory.StartNew` 能确保只调用一次 start，
而 `new Task(…).Start` 可能在其他地方多次调用 start，。
但有些地方还是需要 `new Task(…).Start`，见下：

```cs
// 错误的例子
 Task t = null;
t = Task.Factory.StartNew(() =>
{
    // …
      // 这里 t会被视为 null
    t.ContinueWith(/* … */);
});

// 正确的例子
Task t = null;
t = new Task(() =>
{
    // …
    t.ContinueWith(/* … */);
});
t.Start();
```

原文链接：["Task.Factory.StartNew" vs "new Task(...).Start" - .NET Parallel Programming (microsoft.com)](https://devblogs.microsoft.com/pfxteam/task-factory-startnew-vs-new-task-start/)



