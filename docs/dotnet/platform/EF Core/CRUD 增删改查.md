
## 查


### 只查第一个

```cs
// 查不到返回初始值，一般是 null
User? updateUser = _db.User.FirstOrDefault(u => u.id == id);

// 查不到直接报错
User updateUser = _db.User.First(u => u.id == id);
```


### 是否存在

```cs
bool isExists = await _db.User.Where(u => u.username == user.username).AnyAsync();
```



## 增

```cs
[HttpPost("Add")]
public APIResult<object> Add(User user)
{
  // mark product as added in change tracking
  _db.Add(user);
  // save tracked changes to database
  int affected = _db.SaveChanges();

  if (affected == 1)
  {
    return APIResult.Ok();
  }
  return APIResult.Error<object>("新增失败");
}
```



## 改

直接使用完整的实例实现修改

```cs
[HttpPost("Update")]
public APIResult<object> Update(User user)
{
  _db.Update(user);

  // save tracked changes to database 
  int affected = _db.SaveChanges();

  if (affected == 1)
  {
    return APIResult.Ok("修改成功");
  }
  return APIResult.Error("修改失败");
}
```

修改指定的属性

```cs
[HttpPost("UpdatePassword")]
public APIResult<object> UpdatePassword(User user)
{
  SharpPad.Output.DumpBlocking(user);
  
  // get first user whose name starts with name
  User updateUser = _db.User.First(u => u.id == user.id);
  updateUser.password = user.password;

  // save tracked changes to database 
  int affected = _db.SaveChanges();

  if (affected == 1)
  {
    return APIResult.Ok("修改成功");
  }

  return APIResult.Error("修改失败");
}
```


## 删

```cs
// DELETE: api/User/5
[HttpDelete("{id}")]
public APIResult<object> Delete(long id)
{
  User? updateUser = _db.User.FirstOrDefault(u => u.id == id);

  if (updateUser == null) {
    return APIResult.Error("用户不存在");
  }

  _db.User!.Remove(updateUser);

  int affected = _db.SaveChanges();

  if (affected == 1)
  {
    return APIResult.Ok("删除成功");
  }

  return APIResult.Error("删除失败");
}
```


## 参考文档

[教程：使用 ASP.NET Core 创建 Web API](https://learn.microsoft.com/zh-cn/aspnet/core/tutorials/first-web-api?view=aspnetcore-7.0&tabs=visual-studio)
