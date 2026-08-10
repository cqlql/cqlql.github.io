/**
 * 导航树节点 - 代表导航树中的单个条目（目录或 Markdown 文件）
 */
export interface NavNode {
  /** 展示文本（来自 frontmatter title / .config title / 文件名去序号） */
  text: string
  /** 相对于当前节点的链接（文件：xxx.md；目录节点不存在此字段） */
  link?: string
  /** 图标名（Iconify 格式，如 mdi:home、devicon:docker） */
  icon: string
  /** 侧边栏路径前缀（仅目录节点有值，如 "/前端/"、"vue/"） */
  prefix?: string
  /** 相对于 docs/ 的完整路径（文件节点有值，目录节点不存在此字段） */
  fullLink?: string
  /** 排序权重（越小越靠前） */
  sort: number
  /** 子节点 */
  children?: NavNode[]
  /** 侧边栏是否可折叠（仅目录节点） */
  collapsible?: boolean
}

/**
 * 导航栏配置项：可以是字符串路径或分组对象
 */
export interface NavbarGroup {
  text: string
  children: string[]
}

export type NavbarConfigItem = string | NavbarGroup

/**
 * 导航栏渲染项（vuepress-theme-hope navbar 所需格式）
 */
export interface NavbarItem {
  text: string
  link: string
  icon?: string
  prefix?: string
  children?: NavbarItem[]
}
