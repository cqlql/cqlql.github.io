---
title: git
sort: 25
---

## 基础配置

### 用户名与邮箱

```sh
# 全局
git config --global user.name "your name"
git config --global user.email "you@example.com"

# 针对单个仓库（进入仓库目录后执行，不加 --global）
git config user.name "your name"
git config user.email "you@example.com"
```

### 查看配置

```sh
git config --list
git config user.name
```

## SSH 多账号配置（同平台多密钥）

> 更完整的 SSH 登录/密钥管理见 `ssh/` 目录下的笔记。

生成密钥（推荐 Ed25519，旧系统可用 RSA）：

```sh
ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/id_rsa_github
# 旧系统兼容
ssh-keygen -t rsa -b 4096 -C "your_email@example.com" -f ~/.ssh/id_rsa_github
```

配置 `~/.ssh/config`：

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_rsa_github

# 第二个账号，用别名区分
Host github-work
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_rsa_github_work
```

测试：

```sh
ssh -T git@github.com
ssh -T git@github-work
```

克隆时改用别名：

```sh
git clone git@github-work:your-work-org/your-repo.git
```

## 记住凭据（避免每次输入密码）

```sh
# 记住密码（默认 15 分钟）
git config --global credential.helper cache

# 自定义超时（单位秒）
git config --global credential.helper 'cache --timeout=3600'

# Windows 下用 wincred 长期保存
git config --global credential.helper wincred
```

## 常用命令速查

```sh
git status                  # 查看状态
git add .                   # 暂存全部
git commit -m "feat: xxx"   # 提交（推荐 Conventional Commits 风格）
git push                    # 推送
git pull                    # 拉取并合并
git log --oneline -10       # 简洁查看最近 10 条提交
git branch                  # 查看分支
git checkout -b dev         # 新建并切换分支
git stash                   # 暂存当前修改
git stash pop               # 恢复暂存
```

## 提交信息规范（Conventional Commits）

| 类型 | 说明 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档变更 |
| `style` | 格式（不影响代码逻辑） |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `build` | 构建/依赖变动 |
| `ci` | CI 配置变动 |
| `chore` | 其他杂项 |
| `revert` | 回滚 |

示例：`feat: 支持深色模式`、`fix: 修复登录校验为空的问题`。
