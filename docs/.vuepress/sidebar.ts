import navbarData, { NavDataItem } from "./utils/nav-generate";

const sidebarData: Record<string, any[]> = {}
navbarData.forEach((item: NavDataItem) => {
  if (item.prefix) {
    sidebarData[item.prefix] = [{
      ...item,
      collapsible: true,
    }]
  }
})
export default sidebarData
