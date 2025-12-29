

## 在 docker 环境中安装 mysql

[详情移步](/MySql/00_docker%20环境快速使用教程)

## 创建模型

```cs
namespace AppConsole
{
  [Table("user")] // 当表名不一样时
  public class User
  {
    [Colum("Id")] // 字段名重新映射
    public int id { get; set; }
    
    [Required] // 字段必须
    [StringLength(45)] // 字段长度
    [Colum(TypeName="char")] // 类型重新映射
    public string? username { get; set; }

    public string? password { get; set; }
    public string? nickname { get; set; }
  }
}
```

## 创建继承 DbContext 的类

这个类将对应一个数据库。

::: info 在新建前，先学习连接字符串相关知识

**连接字符串**以后可能会修改，有时也涉及到需要保护的敏感信息，所以一般不直接存放在源码中，可以存储在 appsettings.json、环境变量、用户机密存储或其他配置源中。这里我就放在 appsettings.json 中。

[appsettings.json 的使用文档](/DotNet/appsettings.json%20使用.html)

[数据库连接字符串的更多信息](https://learn.microsoft.com/zh-cn/ef/core/miscellaneous/connection-strings)

:::

继承 DbContext 的类代码如下

```cs
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
namespace AppConsole
{
  public class UserManage : DbContext
  {
    // 将 User 映射到表
    public DbSet<User> User  => Set<User>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
      // Program.configuration 说明：这是根据 appsettings.json 创建的对象，将在控制台程序运行时进行初始化，实现代码见下面的控制台程序入口
      // MysqlDatabase 是数据库名
      optionsBuilder.UseMySQL(ConfigurationExtensions.GetConnectionString(Program.configuration!, "MysqlDatabase")!);
    }
  }
}

```

## 控制台程序使用

```cs
using Microsoft.Extensions.Configuration;
namespace AppConsole
{
  class Program
  {
    public static IConfigurationRoot? configuration;
    static void Main(string[] args)
    {
      // 用指定 json 文件创建 ConfigurationBuilder 对象
      var builder = new ConfigurationBuilder()
          // Microsoft.Extensions.Configuration.FileExtensions 包
          .SetBasePath(Directory.GetCurrentDirectory())
          // Microsoft.Extensions.Configuration.Json 包
          .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);

      configuration = builder.Build();

      using (var db = new UserManage())
      {
        foreach (var item in db.User)
        {
          Console.WriteLine(item.username);
        }
      }
    }
  }
}

```

## 参考文档

[MySql.EntityFrameworkCore 包使用文档](https://dev.mysql.com/doc/connector-net/en/connector-net-entityframework-core.html)
