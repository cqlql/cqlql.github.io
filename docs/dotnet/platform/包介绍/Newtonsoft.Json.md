一款受欢迎的高性能的 JSON 框架, 从 .net core 开始默认集成

## 可以修正映射

当请求带的 json 参数字段名与后端定义的模型不一样时，便可通过 `JsonProperty` 修正

模型

```csharp
/// <summary>
/// 登录参数
/// </summary>
public class LoginView
{
  /// <summary>
  /// 账号
  /// </summary>
  [JsonProperty("username")]
  [Required(ErrorMessage = "账号不能为空")]
  public string? UserName { get; set; }

  /// <summary>
  /// 密码
  /// </summary>
  [JsonProperty("password")]
  public string? Password { get; set; }
}


```

某控制器内

```csharp
  [HttpPost()]
  public APIResult<object> Login(LoginView user)
  {
    return APIResult.Ok<object>(new {});
  }
```

请求

```
### 登录
POST https://{{hostname}}/api/login
content-type: application/json

{
  "username": "joly",
  "password": "123123"
}

```
