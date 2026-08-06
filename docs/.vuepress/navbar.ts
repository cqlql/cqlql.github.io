import { navbar } from 'vuepress-theme-hope'
import navData, { NavDataItem } from './utils/nav-generate'

interface NavbarGroup {
  text: string
  children: string[]
}

type NavbarConfigItem = string | NavbarGroup

const navbarConfig: NavbarConfigItem[] = [
  '/',
  '前端',
  '后端',
  'linux',
  'ai',
  '其他',
  '项目',
]

function getLink(children: NavDataItem[]): string | undefined {
  const firstItem = children[0]
  if (!firstItem) return undefined
  if (firstItem.link) {
    return firstItem.fullLink
  }
  return getLink(firstItem.children ?? [])
}

function parseNavbarConfig() {
  const map: Record<string, NavDataItem> = {}
  navData.forEach((firstItem: NavDataItem) => {
    const newItem: NavDataItem = {
      ...firstItem,
      children: undefined,
    }
    if (firstItem.children?.length) {
      newItem.link = getLink(firstItem.children) ?? ''
    }
    map[firstItem.text.toLowerCase()] = newItem
  })

  function handle(list: NavbarConfigItem[]) {
    list.forEach((conf, index) => {
      if (typeof conf !== 'string') {
        handle(conf.children as unknown as NavbarConfigItem[])
      } else {
        const item = map[conf.toLowerCase()]

        if (item) {
          list[index] = item as unknown as NavbarConfigItem
        } else if (conf !== '/') {
          console.warn(`"${conf}"没有对应的菜单`)
        }
      }
    })
  }

  handle(navbarConfig)
}

parseNavbarConfig()

export default navbar(navbarConfig)
