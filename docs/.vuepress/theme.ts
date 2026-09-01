import { hopeTheme } from 'vuepress-theme-hope'
import navbar from './navbar'
import sidebar from './sidebar'

export default hopeTheme({
  hostname: 'https://docs.cqlql.top',

  author: {
    name: '桥黎',
    url: '',
  },

  repo: 'cqlql/node-md',

  docsDir: 'docs',

  navbar,

  sidebar,

  displayFooter: true,

  pageInfo: ['Author', 'Original', 'Date', 'Category', 'Tag'],

  plugins: {
    icon: {
      assets: "iconify"
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
    mermaid: true,
  },
})