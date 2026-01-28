## 概述


除了使用 [Electron Forge](https://www.electronforge.io/)（受官方推荐支持）, [Electron Builder](https://www.electron.build) 也是不错的选择。



## 配置


这里直接写在 package.json 中，不多说，直接贴代码吧。`build` 字段就是打包配置。



更多配置信息见[官方文档](https://www.electron.build/configuration/configuration)



portable 便携版每次打开速度较慢，原理就是每次打开都解压到临时目录，关闭后立即删除。如果不是临时使用，还是使用安装版吧



```json
{
  "name": "pwd-electron",
  "version": "1.0.0",
  "author": "cql",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder build"
  },
  "devDependencies": {
    "electron": "22.0.2",
    "electron-builder": "^23.6.0"
  },
  "build": {  
    "productName":"pwd",
    "appId": "com.pwd.app",
    "copyright":"Copyright © 2023 ${author}",
    "directories": { 
      "output": "build"
    }, 
    "win": {  
      "icon": "./res/logo.ico",
      "target": "nsis",
      // "target": "portable" // 便携版
    }  
  }
}
```

## 使用 electron-vite 默认模板打包问题
### 找不到 index.html
打包后 index.html 文件找不到，没被打进 <font style="color:rgb(31, 31, 31);">app.asar 中</font>

<font style="color:rgb(31, 31, 31);">解决，通过修改 vite.config.ts ,修改页面打包输出目录到 dist-electron，否则默认是打包到 dist 中</font>

```typescript
export default defineConfig({
  build: {
    outDir: 'dist-electron',
  },
});
```

<font style="color:rgb(31, 31, 31);">并且修改 package.json ，新增 files 字段，限制资源目录只有 dist-electron，否则根目录的文件都将打包到 asar，除了 dist</font>

```json
{
  "build":{
    "files": [
      "dist-electron"
    ]
  }
}
```

<font style="color:rgb(31, 31, 31);">还可通过  </font>[@electron/asar](https://www.npmjs.com/package/@electron/asar)<font style="color:rgb(31, 31, 31);"> 包查看 app.asar 中包含的文件</font>

```shell
npx asar l .\app.asar
```

<font style="color:rgb(31, 31, 31);">或者直接修改 pageage.json ，不打包成 asar，这样就可以直接看到都打包了一些什么文件了</font>

```shell
{
  "build":{
    "asar":false
  }
}
```

### <font style="color:rgb(31, 31, 31);">node_modules/vue 也被打进 app.asar 中了</font>
vue 已经通过 vite 打包到浏览器运行的文件中，不需要当成node依赖被electron-builder打包进 app.asar。虽然不影响运行，只是无故多了些用不到的文件。

解决：可以将浏览器依赖比如vue放到 devDependencies 中，如果要区别开发依赖，还可以放到 peerDependencies 中



## 自定义安装脚本--nsisi
开机启动



### 参考文档
[NSISI基本语法---注册表的操作_writeregstr-CSDN博客](https://blog.csdn.net/Ma_Hong_Kai/article/details/83041356)

[NSIS 打包脚本基础 - 静默虚空 - 博客园 (cnblogs.com)](https://www.cnblogs.com/jingmoxukong/p/5033622.html#%E5%8F%98%E9%87%8F)

[NSIS 从入门到编写完整打包脚本——持续更新NSIS是功能强大的安装包制作工具，但其高质量的教程稀少，上手困难。且官方 - 掘金 (juejin.cn)](https://juejin.cn/post/7207410405857034301)

[NSIS 用户手册 (nsisfans.com)](https://www.nsisfans.com/help/)

[NSIS MUI 的内置向导页面 - 预见者 - 博客园 (cnblogs.com)](https://www.cnblogs.com/seer/p/3436946.html)

## mac 签名
去 [developer.apple.com](https://developer.apple.com/account/resources/certificates/add) 申请证书，证书类型 `Developer ID Application`。下载到本地，打开便会自动导入到钥匙串。



打包前配置签名环境变量（export 是临时环境变量，关掉终端会失效）

```shell
export CSC_IDENTITY_AUTO_DISCOVERY=false
export CSC_KEYCHAIN="login"
export CSC_NAME="Comp name (12345)"
```

执行打包

```shell
npm run build:mac
```

### 参看文档
[Electron-builder 构建MacOS应用小白教程（打包 & 签名 & 公证 & 上架）MacOS应用打包，看 - 掘金 (juejin.cn)](https://juejin.cn/post/7009179524520738824)

[Electron builder Mac App signing identity issue for mas build · Issue #7458 · electron-userland/electron-builder (github.com)](https://github.com/electron-userland/electron-builder/issues/7458)

[Electron上Macos平台的编译、签名和公证_electron 打dmg 如何进行签名和公证-CSDN博客](https://blog.csdn.net/hellodaixy/article/details/132480336)

[electron构建Mac app后续的签名公证爬坑指南公证机制 App Notarization 在osx10.14. - 掘金 (juejin.cn)](https://juejin.cn/post/7080781730814099493#heading-1)

## windows 签名
[Electron 在 Windows 下的代码签名 - oldj's blog](https://oldj.net/article/2022/07/15/code-signing-with-electron-on-windows/)

[代码签名 | Electron (electronjs.org)](https://www.electronjs.org/zh/docs/latest/tutorial/code-signing#%E7%AD%BE%E7%BD%B2windows%E5%BA%94%E7%94%A8%E7%A8%8B%E5%BA%8F)

[Electron Builder 使用软证书签名 - VSign](https://support.vsign.com/docs/prologue/electron_config/#windows-%E5%B9%B3%E5%8F%B0)

## 360误报误杀问题
需要到[360软件开放平台](about:blank)提交审核，收录到360开放软件中心。提交软件误报[反馈](https://open.soft.360.cn/report.php)

