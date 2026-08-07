import navTree from './scripts/build-nav-tree.js'
import type { NavNode } from './shared/types.js'

/**
 * 递归标记可折叠节点：二级及以上目录标记为可折叠
 */
function markCollapsible(nodes: NavNode[], depth = 0): void {
  for (const node of nodes) {
    if (!node.children?.length) continue

    if (depth >= 1) {
      node.collapsible = true
    }
    markCollapsible(node.children, depth + 1)
  }
}

/**
 * 根据导航树生成侧边栏配置
 * key 为路径前缀，value 为对应的节点树
 */
function buildSidebar(tree: NavNode[]): Record<string, NavNode[]> {
  const sidebar: Record<string, NavNode[]> = {}

  for (const node of tree) {
    if (!node.prefix) continue

    markCollapsible(node.children ?? [])
    sidebar[node.prefix] = [node]
  }

  return sidebar
}

export default buildSidebar(navTree)
