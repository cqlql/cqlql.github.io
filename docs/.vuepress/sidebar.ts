import navbarData, { NavDataItem } from "./utils/nav-generate";

const sidebarData: Record<string, any[]> = {}
navbarData.forEach((item: NavDataItem) => {
  if (item.prefix) {
    // 二级、三级目录设置可折叠
    if (item.children && item.children.length > 0) {
      item.children.forEach((child: any) => {
        if (child.children && child.children.length > 0) {
          child.collapsible = true
          child.children.forEach((grandchild: any) => {
            if (grandchild.children && grandchild.children.length > 0) {
              grandchild.collapsible = true
            }
          })
        }
      })
    }
    sidebarData[item.prefix] = [item]
  }
})
export default sidebarData
