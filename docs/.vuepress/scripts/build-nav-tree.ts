import fs from 'node:fs'
import path from 'node:path'
import fm from 'front-matter'
import { stripOrderPrefix } from '../shared/utils.js'
import type { NavNode } from '../shared/types.js'

const ROOT = process.cwd()
const DOCS_DIR = 'docs'
const DOCS_PATH = path.join(ROOT, DOCS_DIR)

function readTextSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function pathExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 从 .config 文件读取目录元数据
 */
function readDirConfig(dirAbsPath: string): { title?: string; icon?: string; sort?: number } {
  const configPath = path.join(dirAbsPath, '.config')
  const content = readTextSafe(configPath)
  if (!content) return {}
  try {
    return JSON.parse(content)
  } catch {
    return {}
  }
}

/**
 * 解析 Markdown frontmatter
 */
function parseFrontmatter(filePath: string): Record<string, unknown> {
  try {
    const content = readTextSafe(filePath)
    return content ? fm<Record<string, unknown>>(content).attributes : {}
  } catch {
    return {}
  }
}

/**
 * 递归遍历 docs/ 目录，构建导航树
 */
function scanDir(
  dirAbsPath: string,
  parentDirname: string,
  relativePath: string,
): NavNode[] {
  const entries = fs.readdirSync(dirAbsPath)
  const nodes: NavNode[] = []

  for (const name of entries) {
    if (['.vuepress', '.config', 'image'].includes(name)) continue
    if (name === 'README.md') continue

    const entryPath = path.join(dirAbsPath, name)
    const fullLink = relativePath ? `${relativePath}/${name}` : name
    const isDir = fs.statSync(entryPath).isDirectory()

    if (isDir) {
      nodes.push(buildDirNode(entryPath, name, parentDirname, fullLink))
    } else if (name.endsWith('.md')) {
      nodes.push(buildFileNode(entryPath, name, fullLink))
    }
  }

  // 按 sort 字段排序
  nodes.sort((a, b) => a.sort - b.sort)

  return nodes
}

/**
 * 构建目录节点
 */
function buildDirNode(
  dirPath: string,
  dirname: string,
  parentDirname: string,
  fullLink: string,
): NavNode {
  const config = readDirConfig(dirPath)
  const hasReadme = pathExists(path.join(dirPath, 'README.md'))
  const prefix = parentDirname ? `${dirname}/` : `/${dirname}/`

  return {
    text: config.title ?? stripOrderPrefix(dirname),
    icon: config.icon ?? '',
    prefix,
    sort: config.sort ?? 0,
    fullLink: hasReadme ? fullLink : '',
    link: hasReadme ? prefix : '',
    children: scanDir(dirPath, dirname, fullLink),
  }
}

/**
 * 构建文件节点
 */
function buildFileNode(
  filePath: string,
  filename: string,
  fullLink: string,
): NavNode {
  const attrs = parseFrontmatter(filePath)

  return {
    text: (attrs.title as string) ?? stripOrderPrefix(filename.replace(/\.md$/, '')),
    icon: (attrs.icon as string) ?? '',
    link: filename,
    fullLink,
    sort: (attrs.sort as number) ?? 0,
  }
}

/**
 * 生成导航树，并可选择将结果写入 data.json
 */
export function buildNavTree(options?: { writeToFile?: boolean }): NavNode[] {
  const { writeToFile = true } = options ?? {}
  const navTree = scanDir(DOCS_PATH, '', '')

  if (writeToFile) {
    const outputPath = path.resolve(__dirname, '../components/data.json')
    fs.writeFileSync(outputPath, JSON.stringify(navTree), 'utf8')
  }

  return navTree
}

/** 模块加载时自动生成导航树 */
const navTree = buildNavTree()
export default navTree
