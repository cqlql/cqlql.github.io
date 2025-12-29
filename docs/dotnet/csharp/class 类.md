## 类基本定义与使用

```cs

// 定义
class WeatherForecast
{
    public DateTime Date { get; set; }

    public int TemperatureC { get; set; }

    // 只有 get
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);

    // 设置初始值
    public string Title { get; set; } =  string.Empty;

    // 可为 null
    public string? Summary { get; set; };
}

// 使用
// 创建实例，并初始部分成员
var weather = new WeatherForecast
{
  Date = DateTime.Now,
  TemperatureC = 1,
};
Console.WriteLine(weather.Date);
Console.WriteLine(weather.TemperatureF);

```


## 静态类

1. 相当于全局对象，一直存在内存中。
2. 仅包含静态成员。
3. 无法实例化。
4. 只能包含静态构造函数，并且在成员被访问后执行。
5. 密封性，无法被继承。
6. 不建议使用静态类，能不用就不用。


```cs
// 定义
namespace AppConsole
{
  public static class StaticClass
  {
    public static int num = 5;

    // 静态构造函数
    static StaticClass()
    {
      num = 15;
      Console.WriteLine("此处在成员被访问后执行");
    }
  }
}

// 访问
Console.WriteLine(StaticClass.num);
```




## 静态成员

我的理解：
1. 所有实例的共享成员，公共成员。
2. 不用实例化，跟类是否实例化没有关系。
3. 可直接通过类访问、修改。


什么是被初始化？
在类的构造函数执行时，包括静态构造函数和非静态构造函数。

那么类的构造函数什么时候被执行？
在成员被调用时执行，包括静态成员和一般成员。


```cs

public class BankAccount
{
  // 定义静态成员
  public static decimal InterestRete;
}

// 直接调用
Console.WriteLine(BankAccount.InterestRete);
```

## 静态类与普通类中静态成员区别

目前没发现特别的区别，但看介绍是静态类中的静态成员在程序启动就会被初始化，而普通类静态成员在使用时才会被初始化。但这个结论无从验证
