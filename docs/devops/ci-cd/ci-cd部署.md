

## Docker Registry 私有仓库

### Registry 账户密码

生成 Registry 密码

```
docker run --rm --entrypoint htpasswd httpd:2-alpine -Bbn 用户名 新密码
```

复制到 ci-cd\registry-auth\htpasswd，可能包含多个用户：

```
admin:$2y$05$xxxx
runner:$2y$05$yyyy
dev:$2y$05$zzzz
```

如果不希望有密码，去掉下面几个环境变量即可：

```
  registry:
    image: registry:3.1
	environment:
      REGISTRY_AUTH: htpasswd
      REGISTRY_AUTH_HTPASSWD_REALM: Registry Realm
      REGISTRY_AUTH_HTPASSWD_PATH: /auth/htpasswd
      REGISTRY_STORAGE_DELETE_ENABLED: "true"
```





## deploy.yml 变量配置位置

通过 Gitea Actions Secrets 实现

Gitea 地址示意: http://localhost:3000/user/settings/actions/secrets