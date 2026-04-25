

## 配置 Session

```cs {8-13,30}
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddControllersWithViews();

builder.Services.AddDistributedMemoryCache();

builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromSeconds(10);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

app.UseSession();

app.MapRazorPages();
app.MapDefaultControllerRoute();

app.Run();
```


## 设置获取

```cs
HttpContext.Session.SetString("LoginValidateCode", new Random().Next(1000, 9000).ToString());

var code = HttpContext.Session.GetString("LoginValidateCode");
```

## 参考文档
[ASP.NET Core 中的会话](https://learn.microsoft.com/zh-cn/aspnet/core/fundamentals/app-state?view=aspnetcore-7.0)

## 疑问

### 怎么找到当前用户的存储的 Session ？

不用管是哪个用户，直接获取即可，就能找到当前会话用户存储的 Session。

之前认为系统并未记录时哪个用户（浏览器、请求平台）在访问。后来发现，这种事情系统已经做好了。
