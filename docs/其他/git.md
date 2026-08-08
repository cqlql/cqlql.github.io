---
title: git
icon: devicon:git
sort: 40
---

## 远程仓库

下例中 `[shortname]` 为远程仓库名称，如果只有一个仓库，一般命名 `origin`

```sh
# 查看
git remote -v
# 新增
git remote add [shortname] [url]
# 修改
git remote set-url [shortname] [url]
```

## 撤销上一次提交

数字回退到第几个版本。也可用 `HEAD^`，`^` 符号个数决定回退几个版本。

如果当前只有一个提交将无法撤销，可能需要其他命令。

```sh
git reset HEAD~1
```

## 撤销所有未提交的内容

```sh
git reset --hard HEAD
```

## 查看远程分支

```sh
git branch -r
```

## 获取远程分支

新加的分支如果看不到，则需要获取

```sh
git fetch origin
```

## 签出远程分支

签出远程分支到本地

```sh
git checkout -b vue-cli5 origin/vue-cli5
```

## 提交信息规范

参考 vue 规范（Angular）：

| 前缀 | 含义 |
| --- | --- |
| `feat` | 增加新功能 |
| `fix` | 修复问题 / BUG |
| `style` | 代码风格相关，无影响运行结果 |
| `perf` | 优化 / 性能提升 |
| `refactor` | 重构 |
| `revert` | 撤销修改 |
| `test` | 测试相关 |
| `docs` | 文档 / 注释 |
| `chore` | 依赖更新 / 脚手架配置修改等 |
| `workflow` | 工作流改进 |
| `ci` | 持续集成 |
| `mod` | 不确定分类的修改 |
| `wip` | 开发中 |
| `types` | 类型修改 |
| `typo` | 文案 |

示例：

```sh
git commit -m 'feat(home): add home page'
```

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

```sh
ssh -T git@github_x
```

使用

```sh
git clone git@github_x:cqlql/blog.git
```

参考文档

[如何配置 SSH 管理多个 Git 仓库和以及多个 Github 账号](https://segmentfault.com/a/1190000043924833)
