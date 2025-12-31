## 文件列表(包括文件夹)

### 原生 readdir：只能当前目录，不寻找下级

```js
let dirList = fs.readdirSync('./dir')
// 返回值示例：
// [".DS_Store","Update.exe","version","views_resources_200_percent.pak","xinput1_3.dll"]
```

### 读取指定目录下的所有文件，支持过滤

使用 [recursive-readdir](https://github.com/jergason/recursive-readdir)，但不会列出文件夹

需列出文件夹使用：[readdir-enhanced](https://github.com/bigstickcarpet/readdir-enhanced)

## 判断是不是[文件/目录]

```js
fs.statSync(path).isDirectory() // 是不是目录，即路径最终指向的是文件夹
fs.statSync(path).isFile() // 是不是文件
```

当然，也可用来判断文件目录是否存在，但不推荐。**判断是否存在，推荐用 `fs.access`**

fs.stat 用来获取文件状态

```js
var fs = require('fs')
/*
    读取文件的状态；
    fs.stat(path,callback);
    callback有两个参数；err，stats；stats是一个fs.Stats对象；
    如果发生错误err.code是常见错误之一；
 不建议在调用 fs.open() 、fs.readFile() 或 fs.writeFile() 之前使用 fs.stat() 检查一个文件是否存在。 作为替代，用户代码应该直接打开/读取/写入文件，当文件无效时再处理错误。
 如果要检查一个文件是否存在且不操作它，推荐使用 fs.access()。
 */
fs.stat('./wenjian.txt', function (err, stats) {
  console.log(err)
  console.log(stats)
  //    获取文件的大小；
  console.log(stats.size)
  //    获取文件最后一次访问的时间；
  console.log(stats.atime.toLocaleString())
  //    文件创建的时间；
  console.log(stats.birthtime.toLocaleString())
  //    文件最后一次修改时间；
  console.log(stats.mtime.toLocaleString())
  //    状态发生变化的时间；
  console.log(stats.ctime.toLocaleString())
  //判断是否是目录；是返回true；不是返回false；
  console.log(stats.isFile())
  //    判断是否是文件；是返回true、不是返回false；
  console.log(stats.isDirectory())
})
// ---------------------
// 作者：sunlizhen
// 来源：CSDN
// 原文：https://blog.csdn.net/sunlizhen/article/details/78016202
// 版权声明：本文为博主原创文章，转载请附上博文链接！
```

## 判断[文件/目录]是否存在 - fs.access(path[, mode], callback)

```js
var fs = require('fs')
/*
-----判断文件和目录是否存在；
fs.access(path[, mode], callback);
path:判断的文件名；
callback：回调函数；
 */
fs.access('./wenjian.txt', function (err) {
  //    文件和目录不存在的情况下；
  if (err.code == 'ENOENT') {
    console.log('文件和目录不存在')
  }
})
/*
 不建议在调用 fs.open() 、 fs.readFile() 或 fs.writeFile() 之前使用 fs.access() 检查一个文件的可访问性
 */
//不建议使用：
fs.access('./wenjian.txt', function (err) {
  if (!err) {
    console.log('文件已经存在')
    return
  }
  fs.open('./wenjian.txt', function (err) {
    console.log(err)
  })
})
//推荐使用；
fs.open('./wenjian.txt', function (err, fd) {
  cnsole.log(err)
})
// ---------------------
// 作者：sunlizhen
// 来源：CSDN
// 原文：https://blog.csdn.net/sunlizhen/article/details/78016157
// 版权声明：本文为博主原创文章，转载请附上博文链接！
```

## 判断[文件/目录]是否存在 - fs.exists(弃用)

`fs.exists(path)` **nodejs 9.0 弃用**

对应的同步方法 `fs.existsSync(path)` ，这个还可以用

## 读取文件 fs.readFile

读取不存在文件会报错

```js
const fs = require('fs')
fs.readFile(file[, options], callback)
fs.readFileSync(file[, options])
```

```js
const fs = require('fs')
// 默认获取二进制数据。参数设置为utf8将获取文本数据
fs.readFile('note_data/index.html', 'utf8', function (err, data) {
  if (err) {
    console.log(err)
    return
  }
  console.log(arguments)
})

// 同步
let data = fs.readFileSync('note_data/index.html', 'utf8')
```

## 改名(文件名，目录名)

```js
fs.rename(oldPath, newPath, callback)
fs.renameSync(oldPath, newPath)
```

oldPath, newPath 必须相同级数，可以完全一样，只能修改末级

## 删除

### 标准删

只能删除文件

```js
fs.unlink(path, callback)
fs.unlinkSync(path)
```

```js
fs.unlink('/tmp/hello.txt', function (err) {
  if (err) throw err
  console.log('successfully deleted /tmp/hello')
})
```

只能删除空目录

```
fs.rmdir(path, callback)
```

### 递归删：第三方扩展

删除指定目录下的所有文件和目录

使用 [fs-extra](https://github.com/jprichardson/node-fs-extra) ，或者使用 [rimraf](https://github.com/isaacs/rimraf)

fs-extra 的 [remove-sync](https://github.com/jprichardson/node-fs-extra/blob/master/docs/remove-sync.md) 示例

```js
const fs = require('fs-extra')

// remove file
fs.removeSync('/tmp/myfile')

fs.removeSync('/home/jprichardson') // I just deleted my entire HOME directory.
```

## 创建目录

fs.mkdir(path[, mode], callback)  
fs.mkdirSync(path[, mode])

只能在已存在的目录下创建，越级创建将报错

## 写/创建 文件

- 将内容写入文件。
- 有文件将直接替换现有内容，没有将创建新的并写入。
- 路径不存在将无法写入

语法

```js
fs.writeFile(file, data[, options], callback)
fs.writeFileSync(file, data[, options])
```

例子

```js
fs.writeFile('note_data/hello.txt', 'hello', 'utf8', function (err) {
  if (err) throw err
  console.log('File write completed')
})

fs.writeFileSync('note_data/hello.txt', 'hello', 'utf8')
```

或直接使用 fs-extra 的 [outputFileSync](https://github.com/jprichardson/node-fs-extra/blob/master/docs/outputFile-sync.md)、[outputJsonSync](https://github.com/jprichardson/node-fs-extra/blob/master/docs/outputJson-sync.md)，路径不存在也能进行写入

```js
fs.outputJsonSync(path.resolve(outputPath, 'data-demo-list.json'), worksList)
```

## copy

使用 [fs-extra](https://github.com/jprichardson/node-fs-extra)

[copy 文档](https://github.com/jprichardson/node-fs-extra/blob/master/docs/copy.md)

[copySync 文档](https://github.com/jprichardson/node-fs-extra/blob/master/docs/copy-sync.md)

copySync 示例

```js
const fs = require('fs-extra')

// copy file
fs.copySync('/tmp/myfile', '/tmp/mynewfile')

// copy directory, even if it has subdirectories or files
fs.copySync('/tmp/mydir', '/tmp/mynewdir')

// 支持过滤
const filterFunc = (src, dest) => {
  // your logic here
  // it will be copied if return true
}
fs.copySync('/tmp/mydir', '/tmp/mynewdir', { filter: filterFunc })
```

## 应用

### 创建一个空白的二进制文件

> 由于当时没有备注， 已经不记得具体用在什么场景了

```js
const fs = require('fs-extra')
fs.outputFileSync('d:/blank-file', Buffer.alloc(0))
```
