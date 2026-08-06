

## 配置多用户


生成密钥。公钥 id_rsa.pub 中的内容复制到 github 或者 gitee，私钥放在 `~/.ssh/id_rsa` 位置。
```sh
ssh-keygen -t rsa
```

修改 `~/.ssh/config` 进行配置：
```ini
Host github_x
    Hostname github.com
    IdentityFile ~/.ssh/id_rsa
# 参数说明
## Host 目标服务器别名，以后直接使用此名称
## User github用户名，可选
## Hostname 目标服务器地址，也可以是ip
## IdentityFile 私钥位置
```
测试连接
```
ssh -T git@github_x
```

使用
```sh
git clone git@github_x:cqlql/blog.git
```

参考文档

[如何配置 SSH 管理多个 Git 仓库和以及多个 Github 账号](https://segmentfault.com/a/1190000043924833)


