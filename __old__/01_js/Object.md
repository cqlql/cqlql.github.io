- [JSON字符串 -> JS对象](#json字符串---js对象)
- [删除操作](#删除操作)
- [快速效率查找实现](#快速效率查找实现)
- [Object.assign() 合并复制](#objectassign-合并复制)
  - [合并](#合并)
  - [复制](#复制)
- [Object.create() 创建原型对象](#objectcreate-创建原型对象)
- [Object.defineProperties() 定义属性的新方式](#objectdefineproperties-定义属性的新方式)
- [成员遍历](#成员遍历)
  - [for...in](#forin)
  - [Object.keys](#objectkeys)
  - [getOwnPropertyNames](#getownpropertynames)
- [判断是否是实例成员 - in关键字](#判断是否是实例成员---in关键字)
- [判断是否非 prototype 成员 - hasOwnProperty](#判断是否非-prototype-成员---hasownproperty)

## JSON字符串 -> JS对象

通过 JSON.parse

通过 eval，不推荐

```js
var objs = eval('({ "border": "2px #0068b7 solid", "height": "200px" })');
```

## 删除操作


## 快速效率查找实现

配合delete，for in，js空对象可做 数据字典，实现快速效率查找

实践：复选框绑定id，复选框对应空对象，空对象中的已有项可定位原数据

## Object.assign() 合并复制

### 合并

[Object.assign() - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)

将修改源对象

```js
var obj = { a: 1 };
Object.assign(obj, {b:2});
// obj 对象变了
console.log(obj); // { a: 1, b: 2 }
```

### 复制

```js
var obj = { a: 1 };
var copy = Object.assign({}, obj);
console.log(copy); // { a: 1 }
```

## Object.create() 创建原型对象

将目标对象的属性生成到新对象的原型上去

[Object.create() - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/create)

```js
let obj = Object.create({bar: 123})
console.log(obj.__proto__.bar === 123) // true
```

## Object.defineProperties() 定义属性的新方式

[Object.defineProperties() - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperties)

```js
var obj = {};
Object.defineProperties(obj, {
  'property1': {
    value: true,
    writable: true
  },
  'property2': {
    value: 'Hello',
    writable: false
  },
  'fun': {
    value: function () {},
    writable: false
  }
});
console.log(obj.property2) // Hello
console.log(obj.fun) // 这是一个值为函数的属性
```

## 成员遍历

### for...in
包括 **可枚举、原型上** 属性


### Object.keys
包括 **可枚举** 属性  
不包括 **原型上** 的属性

[Object.keys() - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/keys)

Object.keys 不包括原型上的属性，for...in 还将枚举原型上的属性

JSON.stringify()：也只串行化对象自身的可枚举的属性

```js
// simple array
var arr = ['a', 'b', 'c'];
console.log(Object.keys(arr)); // console: ['0', '1', '2']

// array like object
var obj = { 0: 'a', 1: 'b', 2: 'c' };
console.log(Object.keys(obj)); // console: ['0', '1', '2']
```


### getOwnPropertyNames

包括 **可枚举、不可枚举** 属性  
不包括 **原型上** 的属性

```js
var obj = {"name":"Poly", "career":"it"}

// 此方式将创建一个不可枚举属性
Object.defineProperty(obj, "age", {value:"forever 18", enumerable:false});

// 原型属性
Object.prototype.protoPer1 = function(){console.log("proto");};
Object.prototype.protoPer2 = 2;

console.log(
  "Object.getOwnPropertyNames: ",
  Object.getOwnPropertyNames(obj)); // ["name", "career", "age"]
```

## 判断是否是实例成员 - in关键字

[见关键字](./index.html#js/133094510)

## 判断是否非 prototype 成员 - hasOwnProperty

hasOwnProperty: 指示对象自身属性中是否具有指定的属性

实例的方法  
返回bool值，true表示是非通过prototype添加的成员

```js
Object.prototype.bar = 1; 
var foo = {goo: undefined};
foo.la=3;
foo.hasOwnProperty('bar'); // false
foo.hasOwnProperty('goo'); // true
foo.hasOwnProperty('la'); // true

// 推荐通过 prototype 调用。因为 hasOwnProperty 非敏感词，可能被占用
Object.prototype.hasOwnProperty.call(foo, 'la'); // true
```


