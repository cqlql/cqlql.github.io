## 站点

[github 仓库](https://github.com/expressjs/expressjs.com)

## 安装

```
npm install express
```

## 静态资源

```js
var express = require('express')
var app = express()
app.use('/Content', express.static(path.resolve(__dirname, 'public')) // 静态资源
```

## get

```js
app.get('/get', function (req, res) {
  res.send({
    data: {},
    status: 1,
  })
})
```

## post

```js

```

## 文件上传

[multer 文档](https://www.npmjs.com/package/multer)

此处为单文件上传，一次性多次文件待探索

```js
var express = require('express')
var router = express.Router()
var multer = require('multer')
var upload = multer({ dest: 'e:/uploads/' })

// upload.single('avatar') 这个 avatar 对应 input 的 name 值，如：<input name="avatar" type="file"/>。否则报错
router.post('/file', upload.single('file'), function (req, res) {
  res.send({
    status: 200,
    message: 'ok',
    result: {},
  })
})

module.exports = router
```

## 路由参数

```js
/**
Route path: /users/:userId/books/:bookId
Request URL: http://localhost:3000/users/34/books/8989
req.params: { "userId": "34", "bookId": "8989" }
 */
app.get('/users/:userId/books/:bookId', (req, res) => {
  res.send(req.params)
})
```

## get 参数获取

## post 参数获取

[req.body 说明 - express4 api 中文手册](http://www.expressjs.com.cn/4x/api.html#req.body)

```js
var app = require('express')()
var bodyParser = require('body-parser')
var multer = require('multer')

app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.use(multer()) // for parsing multipart/form-data

app.post('/', function (req, res) {
  console.log(req.body) // 获取
  res.json(req.body)
})
```

## 运行

```js
var express = require('express')
var app = express()
var server = app.listen(3003, '0.0.0.0', function () {
  var host = server.address().address
  var port = server.address().port
  console.log('Example app listening at http://%s:%s', host, port)
})
```
