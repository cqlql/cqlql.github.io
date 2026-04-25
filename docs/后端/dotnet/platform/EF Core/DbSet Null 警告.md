
给 DbSet 一个默认空值来解决。

那么，需不需要判断表是否存在呢？ 答案是不需要。因为一般来说，数据库表肯定是有的。

```cs
public class NullableReferenceTypesContext : DbContext
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        => optionsBuilder
            .UseSqlServer(
                @"Server=(localdb)\mssqllocaldb;Database=EFNullableReferenceTypes;Trusted_Connection=True");
}
```


## 参考文档
[使用可为 null 引用类型 - EF Core | Microsoft Learn](https://learn.microsoft.com/zh-cn/ef/core/miscellaneous/nullable-reference-types#dbcontext-and-dbset)
