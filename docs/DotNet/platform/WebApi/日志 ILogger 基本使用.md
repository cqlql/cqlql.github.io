```csharp
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class InfoController : ControllerBase
{

  // 从容器中获取ILogger实例
  private readonly ILogger<LogTestController> _logger;
  public LogTestController(ILogger<LogTestController> logger)
  {
      _logger = logger;
  }

  // 使用ILogger
  [HttpGet("log")]
  public void Log()
  {
      _logger.LogInformation("Info");
      _logger.LogError("Error");
      _logger.LogWarning("Warning");
  }

  [HttpGet(Name = "GetInfo")]
  public int Get()
  {
    return Random.Shared.Next(2);
  }
}


```

## 参考文档

[.net 日志 ILogger 基本使用](https://blog.csdn.net/m0_47659279/article/details/119845995)

[.NET 中的日志记录](https://docs.microsoft.com/zh-cn/dotnet/core/extensions/logging)
