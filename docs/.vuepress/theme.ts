import { hopeTheme } from 'vuepress-theme-hope'
import navbar from './navbar'
import sidebarData from './sidebar'

export default hopeTheme({
  hostname: 'https://docs.cqlql.top',

  author: {
    name: '桥黎',
    url: '',
  },

  // logo: '/logo.svg',

  repo: 'cqlql/node-md',

  docsDir: 'docs',

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
    slimsearch: {
      indexContent: true,
    },
  },

  markdown: {
    highlighter: {
      type: 'shiki',
      langs: ['bash', 'nginx', 'ini', 'jsx', 'tsx'],
    },
  },
})
