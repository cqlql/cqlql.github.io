

## 安全性对比 JWT

JWT 需要密钥，因为用户信息放到 token 中的，比如 userid，客户端拿到后可以伪造。

而 Redis token 只是标识，用户信息都是放服务端的

