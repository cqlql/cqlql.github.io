推荐redis存role，这样，如果一个用户多端多角色登录，可以实现精准踢下线


建议存储的信息：

```json
{
  "userId": 1001,
  "username": "zhangsan",
  "roles": ["ADMIN"],
  "loginType": "ADMIN_PORTAL",
  "loginIp": "10.0.0.1",
  "loginTime": 1700000000
}
```

