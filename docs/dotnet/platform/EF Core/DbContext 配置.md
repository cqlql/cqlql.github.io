## 注入方式：webapi + EFCore 项目

appsettings.json 配置文件

```json {9-11}
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "UserManageDb": "server=192.168.1.223;database=db_user;user=joly;password=123123"
  }
}
```

新建继承 DbContext 的 UserManageDbContext.cs 文件

```cs

using Microsoft.EntityFrameworkCore;
namespace AppWebApi
{
  public class UserManageDbContext : DbContext
  {
    public DbSet<User>? User { get; set; }

    public UserManageDbContext(DbContextOptions<UserManageDbContext> options) : base(options)
    {
    }
  }
}
```

入口文件 Program.cs

获取连接字符串，并注入到 DbContext

```cs {3-4}
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddDbContext<UserManageDbContext>(options =>
              options.UseMySQL(ConfigurationExtensions.GetConnectionString(builder.Configuration, "UserManageDb")));
```


控制器文件 UserController.cs

由框架通过控制器构造函数注入 UserManageDbContext 实例

将为每个请求创建 `ApplicationDbContext` 实例，并传递给控制器，并在请求结束后释放连接资源。

```cs
[ApiController]
[Route("[controller]")]
[Produces("application/json")]
public class UserController : ControllerBase
{
    private readonly ILogger<UserController> _logger;
    private readonly UserManageDbContext _context;

    public UserController(UserManageDbContext context, ILogger<UserController> logger)
    {
      _context = context;
      _logger = logger;
    }

    [HttpGet("GetUserList")]
    public DbSet<User> GetUserList()
    {
      return _context.User!;
    }
}
```

## new 方式：任意项目

这是一个控制台程序例子

UserManageDbContext.cs

```cs
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
namespace AppConsole
{
  public class UserManageDbContext : DbContext
  {
    // 将 User 映射到表
    public DbSet<User> User { get; set; }

    private readonly IConfigurationRoot? _configuration;
    public UserManageDbContext (IConfigurationRoot configuration) {
      _configuration = configuration;
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
      // MysqlDatabase 是数据库名
      optionsBuilder.UseMySQL(ConfigurationExtensions.GetConnectionString(_configuration!, "MysqlDatabase")!);
    }
  }
}

```

Program.cs

```cs
using Microsoft.Extensions.Configuration;
 // 用指定 json 文件创建 ConfigurationBuilder 对象
  var builder = new ConfigurationBuilder()
      // Microsoft.Extensions.Configuration.FileExtensions 包
      .SetBasePath(Directory.GetCurrentDirectory())
      // Microsoft.Extensions.Configuration.Json 包
      .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);

using (var db = new UserManageDbContext(builder.Build()))
{
  foreach (var item in db.User!)
  {
    Console.WriteLine(item.username);
  }
}
```

## 数据播种

数据播种不能单纯为“可以实现如果没有数据，将填充一个初始数据”。种子设定不应该是正常应用的一部分，因为会造成并发问题，所以是[数据迁移](https://learn.microsoft.com/zh-cn/ef/core/managing-schemas/migrations/managing?source=recommendations&tabs=dotnet-core-cli)情况使用？目前还有很多细节没搞清楚，等有时间了再来学习。

- 数据播种参考文档：
  1. [数据种子设定 - EF Core](https://learn.microsoft.com/zh-cn/ef/core/modeling/data-seeding)
  2. [EntityFrameworkCore 教程：Data-Seeding（种子数据）](https://www.cnblogs.com/dotnet261010/p/12359695.html)

目前测试结论，只有在表都没有的情况，才会初始化数据（会自动建表）

以下是测试例子

UserManageDbContext.cs

```cs
using Microsoft.EntityFrameworkCore;
namespace AppWebApi
{
  public class UserManageDbContext : DbContext
  {
    public DbSet<User>? User { get; set; }

    public UserManageDbContext(DbContextOptions<UserManageDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
      modelBuilder.Entity<User>()
      .HasData(new User
      {
        id = 1,
        username = "joly",
        password = "123",
        nickname = "张三"
      });
    }
  }
}
```

控制器文件 UserController.cs

```cs
[ApiController]
[Route("[controller]")]
[Produces("application/json")]
public class UserController : ControllerBase
{
  private readonly ILogger<UserController> _logger;
  private readonly UserManageDbContext _context;

  public UserController(UserManageDbContext context, ILogger<UserController> logger)
  {
    _context = context;
    _logger = logger;
  }

  [HttpGet("Test")]
  public bool Test()
  {
    // 使种子设定生效
    var tfTrue = db.Database.EnsureCreated();

    if(tfTrue)
    {
        Console.WriteLine("数据库创建成功!");
    }
    else
    {
        Console.WriteLine("数据库创建失败!");
    }

    return tfTrue
  }
}
```

## fluent api

实现对模型中的注解特性进行代替或者补充

```cs
using Microsoft.EntityFrameworkCore;
namespace UserManage;

public class UserManageDbContext : DbContext
{
  public DbSet<User>? User { get; set; }

  public UserManageDbContext(DbContextOptions<UserManageDbContext> options) : base(options)
  {
  }

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    // example of using Fluent API instead of attributes
    // to limit the length of a user name to under 15
    modelBuilder.Entity<User>()
      .ToTable("user")
      .Property(user => user.username)
      .IsRequired() // NOT NULL
      .HasMaxLength(15);
  }
}
```
