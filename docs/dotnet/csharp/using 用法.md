## 1. using 指令
用在源代码文件开头。导入命名空间的所有类，这样使用类时就无需详细指定命名空间了。

可以将以下修饰符用于 using 指令：

- `global` 只需导入一次，当前项目的所有源代码都有效。可结合 static 使用。
- `static` 导入静态类的所有成员，这样连类名都无需指定了。

更详细的介绍参考官方文档：[using 指令 - C# 参考 | Microsoft Learn](https://learn.microsoft.com/zh-cn/dotnet/csharp/language-reference/keywords/using-directive)

## 2. 释放资源

using 范围内执行完后自动调用 Dispose 释放，但只有实现了 IDisposable 接口的类才可以

## 3. using 别名

```cs

using aClass = NameSpace1.MyClass;
using bClass = NameSpace2.MyClass;

namespace testUsing
{
    class Class1
    {
        static void Main(string[] args)
        {
            aClass my1 = new aClass();
            Console.WriteLine(my1);
            bClass my2 = new bClass();
            Console.WriteLine(my2);
        }
    }
}

```

## 与 try catch 区别

try catch 只能捕获异常，能知道具体的异常；不能释放资源，需手动释放

using 释放资源，即使异常也能释放；异常情况不能知道是什么异常

## 参考文档

https://blog.csdn.net/fuhanghang/article/details/84453734

[using 与 try catch](https://blog.csdn.net/ironxue/article/details/12071901)

[using 关键字 - C# 参考 | Microsoft Learn](https://learn.microsoft.com/zh-cn/dotnet/csharp/language-reference/keywords/using)
