web.config 已经过时，现在推荐使用 appsettings.json
## webapi 项目可在入口文件 Program.cs 中直接获取


```cs
ConfigurationExtensions.GetConnectionString(builder.Configuration, "UserManageDb");
```


## 通过 ConfigurationBuilder 类获取


appsettings.json 示例

```json
{
  "ConnectionStrings": {
    "MysqlDatabase": "server=192.168.1.124;database=db_user;user=joly;password=123123"
  },
}
```

先导入相关包

```sh
dotnet add package Microsoft.Extensions.Configuration
dotnet add package Microsoft.Extensions.Configuration.FileExtensions
dotnet add package Microsoft.Extensions.Configuration.Json
```

上代码

```cs
using Microsoft.Extensions.Configuration;

// 用指定 json 文件创建 ConfigurationBuilder 对象
var builder = new ConfigurationBuilder()
    // Microsoft.Extensions.Configuration.FileExtensions 包
    .SetBasePath(Directory.GetCurrentDirectory()) 
    // Microsoft.Extensions.Configuration.Json 包
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);

IConfigurationRoot configuration = builder.Build();

// 获取连接字符串
var connectionString = ConfigurationExtensions.GetConnectionString(configuration, "MysqlDatabase");

Console.WriteLine(connectionString);
```


## 参考文档

[Application Settings (appsettings.json)](https://learn.microsoft.com/zh-cn/iis-administration/configuration/appsettings.json)

[ConfigurationExtensions.GetConnectionString(IConfiguration, String) 方法 ](https://learn.microsoft.com/zh-cn/dotnet/api/microsoft.extensions.configuration.configurationextensions.getconnectionstring?view=dotnet-plat-ext-7.0)
