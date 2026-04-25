## 读取文本

```js
function getApiData(cb) {
  http.get(
    {
      port: 80,
      hostname: 'uc.lwk.com',
      method: 'GET',
      path: '/apidoc/api_data.js',
    },
    (res) => {
      var content = ''
      res.on('data', (data) => {
        content += data
      })
      res.on('end', () => {
        cb(content)
      })
    },
  )
}
```

## 下载文件

```js
var http = require('http')
var fs = require('fs')

var download = function (url, dest, cb) {
  var file = fs.createWriteStream(dest)
  var request = http
    .get(url, function (response) {
      response.pipe(file)
      file.on('finish', function () {
        file.close(cb) // close() is async, call cb after close completes.
      })
    })
    .on('error', function (err) {
      // Handle errors
      fs.unlink(dest) // Delete the file async. (But we don't check the result)
      if (cb) cb(err.message)
    })
}
```
