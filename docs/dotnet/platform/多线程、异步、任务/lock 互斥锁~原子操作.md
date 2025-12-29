
## 理解

多线程同时操作一个资源，如果不是原子的，可能会出问题。这时就需要 lock 互斥锁。

**死锁**：线程X锁定变量A，但一直没有释放锁定，导致其他线程锁定变量A时一直阻塞。

**避免死锁**：使用 Monitor.TryEnter 方法结合 try-finally 语句代替 lock，并提供超时。

**原子**：不能比分割的最小粒子

**原子操作**：不能被中断的一个或一系列操作


## lock 使用

```cs
static Random r = new Random();
static string Message; // a shared resource
static object conch = new object();
static void MethodA()
{
  // 如果 conch 已经锁定，则挂起当前线程，直到 conch 解锁再往下执行
  // 如果 conch 没有锁定，则开始锁定conch，直到 lock 语句执行完成解锁
  lock (conch)
  {
    for (int i = 0; i < 5; i++)
    {
      Thread.Sleep(1000);
      Message += "A";
      Write(".");
    }  
  }
    
}
```

## 参考文档
[lock 语句](https://learn.microsoft.com/zh-cn/dotnet/csharp/language-reference/statements/lock)


## Monitor 使用 -- 推荐

为避免死锁，推荐使用 Monitor


```cs
static Random r = new Random();
static string Message; // a shared resource
static object conch = new object();
static void MethodA()
{
  bool lockWasTaken = false;
  try
  {
    /* 
    如果 conch 已经被其他线程锁定，则挂起线程，并提供最多 15s 挂起时间。超过时间或者 conch 解锁后再往下执行。
    如果 conch 没有被锁定，则开始锁定并往下执行，并且将 lockWasTaken 设为 true。

    参数2 也可直接使用 int 类型的毫秒时间
     */
    Monitor.TryEnter(conch, TimeSpan.FromSeconds(15), ref lockWasTaken);
    
    for (int i = 0; i < 5; i++)
    {
      Thread.Sleep(1000);
      Message += "A";
      Write(".");
    }
  }
  finally
  {
    /* 
    解锁 conch。
    只有是当前进程锁定了 conch 时才能调用 Monitor.Exit，否则会触发 System.Threading.SynchronizationLockException 异常，所以这里最好加个判断。
     */
    if (lockWasTaken) Monitor.Exit(conch);
  }
}
```

## 运算符++不是原子的，可使用 Interlocked.Increment 方法代替

```cs
class Program
{
  static int Counter;

  static void MethodA()
  {
    for (int i = 0; i < 50; i++)
    {
      Thread.Sleep(10);
      // Counter++;
      Interlocked.Increment(ref Counter);
    }
  }

  static void MethodB()
  {
    for (int i = 0; i < 50; i++)
    {
      Thread.Sleep(10);
      // Counter++;
      Interlocked.Increment(ref Counter);
    }
  }

  static void Main(string[] args)
  {
    Task a = Task.Factory.StartNew(MethodA);
    Task b =Task.Factory.StartNew(MethodB);

    Task.WaitAll(new Task[] { a, b});
    WriteLine($"{Counter} string modifications.");
  }
}
```
