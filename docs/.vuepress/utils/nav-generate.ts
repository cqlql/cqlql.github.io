import fs from 'fs'
import path from 'path'
import readdir from './readdir.js'
import fm from 'front-matter'

const rootPath = process.cwd()
const docsDir = 'docs'

export default navDataGenerate()

// 去掉文件 basename 序号
// 此序号主要用来排序
export function removeBasenameFirstNo(basename: string) {
  return basename.replace(/^\d\d_/, '')
}

function navDataGenerate () {
  const navData:NavDataItem[] = []
  readdir({
    initValue: navData,
    rootPath: path.join(rootPath, docsDir),
    ignore: ['.vuepress', '.config', 'image'],
    callback: (params) => {
      let { dirname, parentDir, parentDirname, isDirectory } = params
      if (dirname === 'README.md') return
      
      const fullLink = parentDir + '/' + dirname
  
      if (isDirectory) {
        return dirHandler({
          dirname,
          parentDir,
          parentDirname,
          fullLink,
        })
      }
      return fileHandler({
        dirname,
        parentDir,
        parentDirname,
        fullLink,
      })
    },
    sort(arr) {
      arr.sort((a, b) => {
        return a.sort - b.sort
      })
    },
  })

  fs.writeFileSync(
    path.resolve(__dirname, '../components/data.json'),
    JSON.stringify(navData),
    'utf8',
  )

  return navData
}


function dirHandler(params: HandlerParams) {
  const { parentDirname, dirname, fullLink } = params

  let dirConfigPath = path.join(rootPath, docsDir, fullLink, '.config')
  let readmePath = path.join(rootPath, docsDir, fullLink, 'README.md')

  const resultConfig = {
    text: removeBasenameFirstNo(dirname),
    icon: '',
    prefix: parentDirname ? `${dirname}/` : `/${dirname}/`,
    sort: 0,
    fullLink: '',
    link: '',
  }

  // 有 README.md
  try {
    fs.accessSync(readmePath)
    resultConfig.link = resultConfig.prefix
    resultConfig.fullLink = fullLink
  } catch (e) {}

  try {
    fs.openSync(dirConfigPath, 'r')

    const { title, icon, sort } = JSON.parse(fs.readFileSync(dirConfigPath, 'utf8'))
    resultConfig.text = title || resultConfig.text
    resultConfig.icon = icon || resultConfig.icon
    resultConfig.sort = sort || resultConfig.sort
  } catch (e) {}

  return resultConfig
}

function fileHandler(params: HandlerParams) {
  const { dirname, fullLink } = params
  let filePath = path.join(rootPath, docsDir, fullLink)

  const resultConfig = {
    text: removeBasenameFirstNo(dirname.replace(/\.md$/g, '')),
    link: dirname,
    icon: '',
    fullLink: fullLink,
    sort: 0,
  }

  try {
    fs.openSync(filePath, 'r')

    let { title, icon, sort } = (fm as any)(fs.readFileSync(filePath, 'utf8')).attributes as any

    // 优先使用 frontmatter 数据
    resultConfig.text = title || resultConfig.text
    resultConfig.icon = icon || resultConfig.icon
    resultConfig.sort = sort || resultConfig.sort
  } catch (e) {}

  return resultConfig
}


interface HandlerParams {
  parentDirname: string
  parentDir: string
  dirname: string
  fullLink: string
}

export interface NavDataItem {
  text: string;
  link: string;
  icon: string;
  prefix?: string;
  fullLink: string;
  sort: number;
  children?: NavDataItem[];
}
