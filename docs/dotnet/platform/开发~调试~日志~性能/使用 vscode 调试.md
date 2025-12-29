## 是否可以使用 watch 来调试？答案是不行。

按 F5 选择 [.net 5+.net core] vscode 就会自动配置好调试配置。尝试将配置好的 .vscode/launch.json 文件中的 preLaunchTask 值 build 改为 watch，将无法触发断点调试，调试必须在终端运行结束后才开始运行，看来只能使用 build 进行调试。

## 满足条件才触发断点？

编辑断点即可，包括表达式和次数，目前消息断点是不可用的

## SharpPad ，像前端一样调试代码

终于可以像浏览器 js console 一样，使用控制台方式调试代码了。

类似工具：LINQPad


