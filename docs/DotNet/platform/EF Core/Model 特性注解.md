

## 简单示例

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

## 特性说明
