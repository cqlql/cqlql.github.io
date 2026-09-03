## 常用命令

### 更新 npm

npm install npm\@latest -g

### 更新包

```sh
# 先更新 package.json 版本
npm update local # 更新所有本地包
npm update global # 全局包
```

### 删除包

```sh
npm uninstall -g <package>
npm uninstall <package>

# 可简写
npm uni <package>
```

### 查看过时本地包

npm outdated

### 查看本地包列表

npm ls

## npm 项目路径最好不要包含$符号

即文件夹最好不用`$`命名，因为`$`为命令关键字

## 通过 npm 执行 package.json 准备的命令

scripts 字段

```cmd
npm run dev
```

部分命令无需加 run，比如 start，可直接

```cmd
npm start
```

## 下载加速

### 使用 mirror-config-china \[推荐]

```sh
# 安装
npm i -g mirror-config-china --registry=https://registry.npm.taobao.org
# 检查是否安装成功
npm config list
```

[mirror-config-china 文档](https://www.npmjs.com/package/mirror-config-china)

### 切换仓库

[NPM 切换仓库](https://www.jianshu.com/p/c5609434cd60)

```sh
npm config ls

# https://registry.npmjs.org 原仓库
# https://registry.npm.taobao.org 淘宝

npm config get registry # 查看创库地址
npm config set registry https://registry.npm.taobao.org # 设置淘宝仓库
```

### 或者安装 cnpm 命令

```cmd
npm install -g cnpm --registry=https://registry.npm.taobao.org
```

## 废弃配置项导致的警告

新版 npm（10.x 起）会对 `.npmrc` 里它不认识的配置项发出警告，下个大版本会直接忽略/报错，建议尽早清理：

```text
npm warn Unknown project config "sharp-libvips-binary-host". This will stop working in the next major version of npm.
npm warn Unknown user config "disturl". This will stop working in the next major version of npm.
```

### 常见废弃项与替代

| 配置项                         | 位置             | 过时用途                                  | 替代方案                                                                          |
| --------------------------- | -------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `disturl`                   | 用户级 `~/.npmrc` | 老 node-sass / node-gyp 下载 Node 头文件的镜像 | node-sass 已弃用（改用 `sass`/dart-sass，纯 JS 无需下载二进制）；node-gyp 用 `node-mirror` 环境变量 |
| `sharp-libvips-binary-host` | 项目 `.npmrc`    | sharp 下载 libvips 二进制的镜像               | 改用环境变量 `SHARP_LIBVIPS_BINARY_HOST`                                            |

### 处理方式

**1. 直接删除废弃键（多数项目够用）**

保留 `registry`，其余删掉。sharp 若只是 antd 等库的间接依赖，实际装不到它的二进制，直接删即可，无需备份：

```ini
registry=https://registry.npmmirror.com
```

**2. 改环境变量写法（sharp 确实需要镜像时）**

sharp 会读环境变量 `SHARP_LIBVIPS_BINARY_HOST`，设成环境变量后 npm 不参与解析，就不会警告：

**Windows（PowerShell）**

```powershell
setx SHARP_LIBVIPS_BINARY_HOST "https://registry.npmmirror.com/-/binary/sharp-libvips"
```

**Linux / macOS**

```sh
# 追加到 ~/.bashrc（或 ~/.zshrc）使其长期生效
echo 'export SHARP_LIBVIPS_BINARY_HOST="https://registry.npmmirror.com/-/binary/sharp-libvips"' >> ~/.bashrc
# 立即在当前会话生效
source ~/.bashrc
```

### 查看配置来源

```sh
npm config list                       # 项目 + 用户 + 环境 全量
npm config list --location=project    # 仅项目级
npm config list --location=user       # 仅用户级
```

- 项目级配置：项目根目录 `.npmrc`

- 用户级配置：`C:\Users\<用户名>\.npmrc`

- 淘宝镜像 `registry.npm.taobao.org` 已迁移到 `registry.npmmirror.com`

## 发布包

**首先关联账号**

```
npm adduser
```

**指定要发布的文件**

通过 pageage.json files 指定。[查看官方文档](https://docs.npmjs.com/files/package.json#files)

```
{
    "files": [
      "dist",
      "src",
      "lib/*"
    ],
}
```

**发布**

- 当前所在文件夹

- 不加点也行

```
npm publish .
```

### 更新发布包

跟[发布包](#发布包)一样，也是通过`npm publish`命令，只是要修改版本

## package.json

### 命令创建 package.json 文件

将在命令运行目录创建

```
npm init
```

### main 字段

nodejs 在 require 模块时，将以此字段指向的 js 文件作为入口

```json
{
  "main": "./lib/app.js"
}
```

### scripts 字段：脚本执行

可直接运行非全局的模块命令。\
因为默认会在`./node_modules/.bin`中寻找命令。但也只限于与`package.json`同级的`node_modules`中寻找。

假如是某其他文件夹的`package.json`，需指定命令的绝对路径：

```json
{
  "scripts": {
    "start": "E:/_work/node_modules/.bin/react-scripts start"
  }
}
```

## 私有仓库部署

使用 [verdaccio](https://verdaccio.org/) 部署

[超简单的 npm 私有库搭建——verdaccio](https://blog.csdn.net/weixin_33757911/article/details/91447376)
