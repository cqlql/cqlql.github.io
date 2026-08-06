import { defineUserConfig } from "vuepress";
import { viteBundler } from '@vuepress/bundler-vite'
import theme from "./theme.js";
import path from "path";
import log4js from "log4js";
import { removeBasenameFirstNo } from "./utils/nav-generate.js";

// 日志记录调试用
// log4js.configure({
//   appenders: {
//     console: { type: "console" },
//     // 单文件
//     file: { type: "file", filename: path.join(__dirname, "logs/node.log") },
//     // 多文件
//     multi: {
//       type: "multiFile",
//       base: path.join(__dirname, "logs/"),
//       // 日志文件名。 categoryName 表示使用 log4js.getLogger参数名称
//       property: "categoryName",
//       extension: ".log",
//       // 单文件大小 单位为字节
//       maxLogSize: 524288,
//       // 最多文件数
//       backups: 20,
//     },
//   },
//   categories: {
//     default: { appenders: ["multi"], level: "INFO" },
//   },
// });
// var logger = log4js.getLogger();

export default defineUserConfig({
  base: '/',

  port: 3008,
  lang: 'zh-CN',
  title: '开发笔记',
  // description: 'welcome',

  theme,

  head: [
    [
      'link',
      {
        rel: 'stylesheet',
        href: '//at.alicdn.com/t/font_2410206_mfj6e1vbwo.css',
      },
    ],
  ],
  alias: {
    '@': __dirname,
  },
  plugins: [
    // 修改路由标题
    {
      name: 'modifyTitle',
      extendsPage: (page) => {
        page.routeMeta.title = page.data.title || removeBasenameFirstNo(page.slug)
      },
    },

  ],
  bundler: viteBundler({
    viteOptions: {
      plugins: [
      ],
    },
  }),
})
