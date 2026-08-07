/**
 * 去掉文件名/目录名前缀的两位数序号（如 "01_开始" → "开始"）
 * 序号仅用于文件系统排序，展示时移除
 */
export function stripOrderPrefix(name: string): string {
  return name.replace(/^\d{2}_/, '')
}
