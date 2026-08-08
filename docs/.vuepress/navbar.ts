import { navbar } from 'vuepress-theme-hope'
import navTree from './scripts/build-nav-tree.js'
import type { NavNode, NavbarItem } from './shared/types.js'

/**
 * 导航栏显示配置
 * 字符串为 docs/ 下的目录名（大小写不敏感），"/" 为首页
 */
const NAVBAR_CONFIG = [
  '/',
  '前端',
  '后端',
  'linux',
  'ai',
  '项目',
  '其他',
] as const

/**
 * 递归获取子树中第一个有效链接
 */
function findFirstLink(children: NavNode[]): string {
  for (const child of children) {
    if (child.link) return child.fullLink
    if (child.children?.length) {
      const link = findFirstLink(child.children)
      if (link) return link
    }
  }
  return ''
}

/**
 * 构建 { 目录名小写 → NavNode } 索引
 */
function buildIndex(tree: NavNode[]): Map<string, NavNode> {
  const index = new Map<string, NavNode>()
  for (const node of tree) {
    index.set(node.text.toLowerCase(), node)
  }
  return index
}

/**
 * 将 NAVBAR_CONFIG 解析为 vuepress-theme-hope 所需的 NavbarItem 数组
 */
function resolveNavbar(config: readonly string[], tree: NavNode[]): NavbarItem[] {
  const index = buildIndex(tree)
  const items: NavbarItem[] = []

  for (const key of config) {
    if (key === '/') {
      items.push({ text: '首页', link: '/' })
      continue
    }

    const node = index.get(key.toLowerCase())
    if (node) {
      items.push({
        text: node.text,
        link: node.link || findFirstLink(node.children ?? []),
        icon: node.icon,
      })
    } else {
      console.warn(`导航栏配置中的 "${key}" 没有匹配的目录`)
    }
  }

  return items
}

export default navbar(resolveNavbar(NAVBAR_CONFIG, navTree))
