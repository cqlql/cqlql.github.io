<font style="color:#DF2A3F;">注意，需要 10.14 或更高版本的系统</font>



## 签名
大致这几步：

1. 加入开发者，每年需要缴费
2. 用 mac 电脑钥匙串生成 `CertificateSigningRequest.certSigningRequest`，生成证书需要。
3. 去[developer.apple.com](https://developer.apple.com/account/resources/certificates/list)生成签名证书，生成后下载，打开即可安装。

详细步骤可参考此文档：[Electron-builder 构建MacOS应用小白教程](https://juejin.cn/post/7009179524520738824)，公证部分不要看，已经过时



官方证书页面：[Apple PKI - Apple](https://www.apple.com/certificateauthority/)

## 公证
公证是需要将安装包上传到 apple 官方公证的。



可使用两种凭证方式：

1. 个人appleId创建app专用密码， 但需要加入开发者
2. 直接使用团队账号--推荐使用

### 命令行公证
注意，[不要使用 altool 命令](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow#Upload-your-app-to-the-notarization-service)，已过时

个人方式参数说明：

`--team-id`  这里查看 [Account - Apple Developer](https://developer.apple.com/account)

`--apple-id` 个人 AppleId

`--password`  个人账户下申请的app 专用密码

团队方式参数说明：

`--key-id`团队密钥id，在这里生成 [App Store Connect (apple.com)](https://appstoreconnect.apple.com/access/integrations/api)

`--key`团队密钥路径，将生成好的密钥下载下来

`--issuer`令牌创建者id，生成页面可直接找到[App Store Connect (apple.com)](https://appstoreconnect.apple.com/access/integrations/api)

```shell
# 存储凭证，两种方式，执行成功后可在钥匙串中查看
## 个人
xcrun notarytool store-credentials "XDT_DESKTOP" --apple-id "cql.ql@qq.com" --team-id SMJ8S66QQ8 --password qhfp-bkki-wiow-nksc
## 团队账号
xcrun notarytool store-credentials "XDT_DESKTOP" --key-id 9Q7Y9242T9 --issuer 236be1ca-59e3-4143-9d98-27a92b5ff90f --key "/Users/qiaozuchen/Downloads/AuthKey_9Q7Y9242T9.p8"

# 将安装包上传公证
xcrun notarytool submit /Users/qiaozuchen/mgmt/mgmt-frontend-inner/dist/xiaodingtie.dmg --keychain-profile "XDT_DESKTOP"

# 查看公证信息，是否公证成功
xcrun notarytool info a490f9a9-239b-43a6-b532-701475f3d63b --keychain-profile "XDT_DESKTOP"

# 将公证日志下载到文件本地查看，方便排查错误
xcrun notarytool log a490f9a9-239b-43a6-b532-701475f3d63b --keychain-profile "XDT_DESKTOP" developer_log.json
```





### <font style="color:rgb(37, 41, 51);">electron-notarize</font>
可直接集成到 electron-builder 中使用，当然可以单独使用。下面介绍集成进 electron-builder 的公证方式

```shell
afterSign: notarize.js
```

```shell
require('dotenv').config();
const { notarize } = require('electron-notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    tool: 'notarytool',
    teamId: process.env.APPLETEAMID,
    appBundleId: 'com.yourcompany.yourAppId',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
  });
};
```



### 公证参考文档
[一文读懂，如何工程化实现 macOS App 公证过程前言 对于 macOS App 开发者来说，我们通常情况下可能会选 - 掘金 (juejin.cn)](https://juejin.cn/post/7255684102111035447)

[@ Electron/notarize - npm --- @electron/notarize - npm (npmjs.com)](https://www.npmjs.com/package/@electron/notarize)

[为 App Store Connect API 创建 API 密钥 |苹果开发者文档 --- Creating API Keys for App Store Connect API | Apple Developer Documentation](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api)

[Code Signing - electron-builder](https://www.electron.build/code-signing)

[公证您的 Electron 应用程序基利安·瓦尔克霍夫 --- Notarizing your Electron application | Kilian Valkhof](https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/)

