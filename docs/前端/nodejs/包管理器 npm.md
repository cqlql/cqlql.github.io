## 常用命令

### 更新 npm

npm install npm@latest -g

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

### 使用 mirror-config-china [推荐]

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

可直接运行非全局的模块命令。  
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
