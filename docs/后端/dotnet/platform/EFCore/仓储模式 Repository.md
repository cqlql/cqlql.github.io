---
title: 仓储模式 Repository
icon: mdi:database-cog
---

在 DbContext 之上再封装一层仓储接口，隔离数据访问逻辑，便于替换实现与单元测试。

## DbContext

```csharp
public class LyricContext : DbContext
{
    public DbSet<Lyric> Lyric { get; set; }

    public LyricContext(DbContextOptions<LyricContext> options) : base(options) { }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        // 连接字符串也可以在 services.AddDbContext 中指定
        optionsBuilder.UseMySQL("server=192.168.1.115;database=LyricSys;user=jo;password=xxx");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Lyric>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
        });
    }
}
```

## 注册服务

`Startup.ConfigureServices`（或 .NET 6+ 的 `builder.Services`）：

```csharp
services.AddDbContext<LyricContext>();
// 或在此处指定连接字符串，则 OnConfiguring 中无需再写：
// services.AddDbContext<LyricContext>(options =>
//     options.UseMySQL("server=192.168.1.115;database=LyricSys;user=jo;password=xxx"));

services.AddScoped<ILyricRepository, LyricRepository>();
```

## 仓储接口

```csharp
using System.Threading.Tasks;
using System.Collections.Generic;

namespace mywebapi
{
    public interface ILyricRepository
    {
        Task<IEnumerable<Lyric>> RetrieveAllAsync();
    }
}
```

## 仓储实现（带内存缓存）

下例直接缓存在进程内存，实际应用应改用 Redis 等分布式缓存。

```csharp
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Linq;

namespace mywebapi
{
    public class LyricRepository : ILyricRepository
    {
        private LyricContext db;
        private static ConcurrentDictionary<int, Lyric> lyricsCache;

        public LyricRepository(LyricContext db)
        {
            this.db = db;

            // 预加载数据为 Dictionary，再转为线程安全的 ConcurrentDictionary
            if (lyricsCache == null)
            {
                lyricsCache = new ConcurrentDictionary<int, Lyric>(
                    db.Lyric.ToDictionary(c => c.Id));
            }
        }

        public Task<IEnumerable<Lyric>> RetrieveAllAsync()
        {
            // 出于性能考虑，从缓存读取
            return Task.Run<IEnumerable<Lyric>>(() => lyricsCache.Values);
        }
    }
}
```

## 相关文档

- [数据库提供程序](https://learn.microsoft.com/zh-cn/ef/core/providers/)
- [MySQL Connector/NET 与 EF Core](https://dev.mysql.com/doc/connector-net/en/connector-net-entityframework-core.html)
