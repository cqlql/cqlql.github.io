## 说明

不需要在服务端的存储

## 需要安装的包

```sh
dotnet add package Microsoft.IdentityModel.Tokens
dotnet add package System.IdentityModel.Tokens.Jwt
```

## 生成 JWT

注意 "your_secret_key_here" 不能太短，即 大于 16 bytes(字节)（即最少 128bits），否则报错

```cs

using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;

var secretKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("your_secret_key_here"));
var signingCredentials = new SigningCredentials(secretKey, SecurityAlgorithms.HmacSha256);

var claims = new[]
{
    new Claim("user_id", "123"),
    new Claim("username", "john_doe")
};

var token = new JwtSecurityToken(
    // JWT 的签发者，一般是一个 http(s) url，如 https://www.baidu.com。选填。
    issuer: "your_issuer_here",
    // JWT 的受众
    audience: "your_audience_here",
    claims: claims,
    expires: DateTime.UtcNow.AddHours(1),
    signingCredentials: signingCredentials
);

var jwtToken = new JwtSecurityTokenHandler().WriteToken(token);

```

## 验证 JWT ???

需注入到 `builder.Services` 中，处理所有请求

```cs
// 授权支持注入
builder.Services.AddAuthorizationSetupForClient();

// 注入权限处理器
services.AddScoped<IAuthorizationHandler, PermissionForClientHandler>();
services.AddSingleton(permissionRequirement);
```

AllowAnonymous 跳过授权验证

```cs
namespace CoreCms.Net.Web.Admin.Controllers
{
    /// <summary>
    /// 用户授权登录
    /// </summary>
    [Route("api/[controller]/[action]")]
    [AllowAnonymous]
    public class LoginController : ControllerBase
    {
    }
}
```
