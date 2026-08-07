import { defineUserConfig } from 'vuepress'
import { viteBundler } from '@vuepress/bundler-vite'
import theme from './theme.js'
import { stripOrderPrefix } from './shared/utils.js'

export default defineUserConfig({
  base: '/',

  port: 3008,
  lang: 'zh-CN',
  title: '开发笔记',

  theme,

  // 排除 __old__ 目录，不参与构建
  pagePatterns: ['**/*.md', '!__old__', '!.vuepress', '!node_modules'],

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
    {
      name: 'modifyTitle',
      extendsPage: (page) => {
        page.routeMeta.title =
          page.data.title || stripOrderPrefix(page.slug)
      },
    },
  ],

  bundler: viteBundler({
    viteOptions: {
      plugins: [],
    },
  }),
})
