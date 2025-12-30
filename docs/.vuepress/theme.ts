import { hopeTheme } from 'vuepress-theme-hope'
import navbar from './navbar'
import sidebarData from './sidebar'
import { slimsearchPlugin } from '@vuepress/plugin-slimsearch'

export default hopeTheme({
  hostname: 'http://docs.cqlql.top',

  author: {
    name: '桥黎',
    url: '',
  },

  // logo: '/logo.svg',

  repo: 'cqlql/node-md',

  docsDir: 'docs-other',

  // navbar
  navbar: navbar,

  // sidebar
  sidebar: sidebarData,

  displayFooter: true,

  pageInfo: ['Author', 'Original', 'Date', 'Category', 'Tag'],

  plugins: {
    icon: {
      prefix: "iconfont icon-",
    },
  },
})
