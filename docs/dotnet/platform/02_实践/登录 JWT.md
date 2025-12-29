## 加盐

```

// SHA512 版
salt = md5(pwd) // md5 结果中的 1357 作为 salt
SHA512(SHA512(pwd) + salt[1]+salt[3]+salt[5]+salt[7])

// md5版
code = md5(pwd) // md5 结果中的 125 作为 salt
md5(code + code[1]+ code[2]+code[5])
```

用 md5 加密就行了，没必要用 SHA512 ,性能好些，定好 salt 的规则，一般情况也够用

## token - JWT

jwt + redis 实现时间有效性

时间有效性另一种实现方式。待验证

```c#
var payload = new Dictionary<string, dynamic>
{
{"iss", M.iss},//非必须。issuer 请求实体，可以是发起请求的用户的信息，也可是jwt的签发者。
{"iat", jwtcreated},//非必须。issued at。 token创建时间，unix时间戳格式
{"exp", jwtcreatedOver},//非必须。expire 指定token的生命周期。unix时间戳格式
{"aud", M.aud},//非必须。接收该JWT的一方。
{"sub", M.sub},//非必须。该JWT所面向的用户
{"jti", M.jti},//非必须。JWT ID。针对当前token的唯一标识
{"UserId", M.UserId},//自定义字段 用于存放当前登录人账户信息
{"UserName", M.UserName},//自定义字段 用于存放当前登录人账户信息
{"UserPwd", M.UserPwd},//自定义字段 用于存放当前登录人登录密码信息
{"UserRole", M.UserRole},//自定义字段 用于存放当前登录人登录权限信息
};
return JWT.JsonWebToken.Encode(payload, SecretKey,
JWT.JwtHashAlgorithm.HS256);

```

## 参考文档

[加盐密码保存的最通用方法是？](https://www.zhihu.com/question/20299384)

[Bcrypt 加密速度慢是否是鸡肋？](https://www.php.cn/php-weizijiaocheng-105725.html)

[什么是 JWT -- JSON WEB TOKEN](https://www.jianshu.com/p/576dbf44b2ae)

[JWT、JWS、JWE 的区别](https://cloud.tencent.com/developer/article/1460770)

[C# 实现 Token](https://www.cnblogs.com/ckfuture/p/14516741.html)

[什么是单点登录（SSO）](https://zhuanlan.zhihu.com/p/66037342)
