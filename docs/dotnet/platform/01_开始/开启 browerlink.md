---
title: 开启 browerlink
---

实现修改代码实时编译并刷新浏览器

刷新浏览器需配合 [Browser Reload on Save](https://marketplace.visualstudio.com/items?itemName=MadsKristensen.BrowserReloadonSave) 插件

相关文档：

https://docs.microsoft.com/zh-cn/aspnet/core/client-side/using-browserlink?view=aspnetcore-6.0

::: warning

1. 此功能只用于 visual studio
2. 需先生成项目，并且开启 browerlink，然后点击链接仪表盘的在“浏览器中查看”，这时就会有连接，否则仪表板显示 0 连接
3. webapi 项目无法使用，仪表盘一直显示 0 连接，浏览器也不自动刷新。

:::
