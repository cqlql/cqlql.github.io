import navbarData, { NavDataItem } from "./utils/nav-generate";

const sidebarData: Record<string, NavDataItem[]> = {}
navbarData.forEach((item: NavDataItem) => {
  if (item.prefix) {
    sidebarData[item.prefix] = [item]
  }
})
export default sidebarData
