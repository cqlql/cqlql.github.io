---
title: MongoDB
---


[ubuntu 部署](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)





关于 mongod 商用是否收费：企业版收费，社区版随便用，不收费


[mongod 命令](https://docs.mongodb.com/manual/reference/program/mongod/index.html)

mongod 用来启动服务

mongo 用来输入脚本操作数据库

1.运行“locate mongo”命令查看系统默认把mongo装到了哪里

https://www.cnblogs.com/caicaizi/p/6160884.html


[配置文件文档](https://docs.mongodb.com/manual/reference/configuration-options/)

[创建用户](https://docs.mongodb.com/manual/tutorial/create-users/)

[用户角色](https://docs.mongodb.com/manual/reference/built-in-roles)

[MongoDB用户角色配置](https://www.cnblogs.com/out-of-memory/p/6810411.html)


修改mongod.conf文件

```ini
security:
  authorization: enabled // 启用授权
```

创建用户

超级用户
db.createUser({ user: 'root', pwd: '12345678', roles: [{ role: 'root', db: 'admin' }] })

admin 用户
db.createUser(  
  {  
    user: "admin",  
    pwd: "12345678",  
    roles: [{role: "userAdminAnyDatabase", db: "admin"}]  
  }  
)

读写用户
db.createUser(
  {
    user: "test",
    pwd: "12345678",
    roles: [
       { role: "readWrite", db: "test" }
    ]
  }
)
只读用户
db.createUser(
  {
    user: "test2",
    pwd: "12345678",
    roles: [
       { role: "read", db: "test" }
    ]
  }
)

修改权限
db.grantRolesToUser(
  "admin",
  [{role:"readWrite", db:"test"}]
)

登录：db.auth("admin","12345678")
db.auth("root","12345678")


新建数据库
use test
新建usr表，并添加一条数据
db.usr.insert({'name':'tompig'});

删除用户
db.dropUser('nodercms')

显示所有用户
show users



## 可视化管理工具
目前使用：[Robomongo](https://robomongo.org)

其中，Robo 3T 免费, Studio 3T 收费。附上一个`studio3t 续天.bat`

```sh
@echo off
ECHO 重置Studio 3T的使用日期......
FOR /f "tokens=1,2,* " %%i IN ('reg query "HKEY_CURRENT_USER\Software\JavaSoft\Prefs\3t\mongochef\enterprise" ^| find /V "installation" ^| find /V "HKEY"') DO ECHO yes | reg add "HKEY_CURRENT_USER\Software\JavaSoft\Prefs\3t\mongochef\enterprise" /v %%i /t REG_SZ /d ""
ECHO 重置完成, 按任意键退出......
pause>nul
exit
```

## 用户角色配置

创建普通用户步骤

```js
use admin
db.createUser({ user: 'admin', pwd: '12345678', roles: [{ role: 'admin', db: 'admin' }] }) // 超级用户
// 注意，必须要先 user，再 createUser，才能使用此用户登录此数据库
use test
db.createUser({ user: 'test', pwd: '3nk6U7H9o3Ct', roles: [{ role: 'readWrite', db: 'test' }] })
```

## 问题解决

### 远程连接被拒绝

将 mongodb.conf 中 `bind_ip=127.0.0.1` 的那一行，修改为 `bind_ip=0.0.0.0`

如果不需要远程连接，建议改回去，更安全

mongod.conf 默认位置：`/etc/mongod.conf`

可通过进程看到

```sh
# 查看 mongo 进程
ps -aux | grep mongo
```

## Node.JS Driver

[mongodb](http://mongodb.github.io/node-mongodb-native/)，这个是基础，官方维护

[mongoose](https://mongoosejs.com/)，基于 mongodb 封装，拥有对象模型，一般用这个



## nodejs mongoose 使用

```js
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/wcard', {useNewUrlParser: true});
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  // we're connected!
  console.log('mongobd 连接成功!')
});

var kittySchema = new mongoose.Schema({
  item: String,
  qty: Number
});

// var Kitten = mongoose.model('Kitten', kittySchema);
// var silence = new Kitten({ name: 'Silence' });
// console.log(silence.name); // 'Silence'
// NOTE: methods must be added to the schema before compiling it with mongoose.model()
// kittySchema.methods.speak = function () {
//   var greeting = this.name
//     ? "Meow name is " + this.name
//     : "I don't have a name";
//   console.log(greeting);
// }

var Kitten = mongoose.model('adoniswinner', kittySchema, 'adoniswinner');
var fluffy = new Kitten({ item: 'fluffy' });
// // fluffy.speak(); // "Meow name is fluffy"  

fluffy.save(function (err, fluffy) {
  if (err) return console.error(err);
  // fluffy.speak();
});
// var Person = mongoose.model('Person', yourSchema);

// find each person with a last name matching 'Ghost', selecting the `name` and `occupation` fields
Kitten.find({}, function (err, person) {
  if (err) return handleError(err);
  // Prints "Space Ghost is a talk show host".
  console.log(person)
  console.log('%s %s is a %s.', person.item, person.qty, person.qty);
})
```
