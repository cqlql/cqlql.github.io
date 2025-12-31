## 创建

**字面量方式**

```js
var arr = []
var arr = ['成员1', 2] //可以是不同成员
```

**构造函数方式**

1、空的

```js
var array = new Array()
```

2、指定长度

```js
var array2 = new Array(10);
成员值都是undefined。此方式有技巧使用
虽然值是undefined，但join后不会出现undefined字符串
比如：
new Array(10).join('') // 依然返回空字符串
new Array(10).join('x') // 9个x
new Array(10).join('<li></li>') // 9个li标签
```

## length

可读写属性

**读操作** 都懂...略过

**写操作** ==增==操作(比之前多)：相当于末尾追加了成员，初始值为 undefined。非真实存在，forEach、for in 会跳过此成员

==减==操作(比之前少)：少了多少相当于 末尾删了多少  
数组对 length 属性进行减少的 写操作，成员真的减少了。  
有时候想，length 属性如果没真正删除，reverse 反转后是不是能把删除的反过来？而实际上，  
reverse 反转操作正常(强调：正常指并没有把删掉的成员反转过来)

```js
div1.innerHTML = array.length
```

## 取成员

### 取单个,一般获取

根据索引获取

```js
var arr = ['张', '李', '陈', '黄']
console.log(arr[0])
console.log(arr['0']) // 根据以前的笔记说firefox这样不行？反正现在是行了...
```

### 取单个,带删除的获取 shift、pop、splice

取一个便少一个。将更改 原数组

**取第一个**

```js
arr.shift()
```

**取最后一个**

```js
arr.pop()
```

**取指定** 使用 splice 实现

```js
var arr = ['张', '李', '陈', '黄']
arr.splice(2, 1) // '陈'。取到了第3个成员
arr // ['张', '李', '黄']
```

### 取多个,带删除的获取 splice

取多个指定成员，取多少原数组便会减多少 `Array.splice(开始索引,数量)` 返回一个新数组，装载取到的成员

### 取多个，复制形式获取-slice

详见 [复制数组-slice](复制数组-slice)

## 增成员

### 追加

底部-push：追加一个或多个

```js
array.push('烧饼1')
```

头部-unshift：追加一个或多个

```js
array.unshift('烧饼0', '烧饼1')
```

返回值返回更改后的数组长度

### 指定位置增加

**使用 splice，真正意义上的指定位置增加** 参数 1：增加的位置，此位置原有的元素会往后挤参数 2：必须为 0 参数 3：要增加的成员，可以多个

```
var arr = [1, 2, 3];

arr.splice(1, 0, '成员1'); // [1, '成员1', 2, 3]
arr.splice(2, 0, '成员2', '成员3');
arr.splice(3, 0, ['成员4', '成员5']); // 注意，此方式没有例外，依然只添加一个成员，3索引位置是一个数组（以为会有concat特性，添加2个成员，实际不是）
```

**使用修改方式，严格来说这还是修改** 当索引大于等于 length 时，才是增加，否则为修改

```
var arr=[];
arr[3]=1;
console.log(arr.length);// 4
```

## 删成员

### 使用 delete 操作符

删第一个

```
var arr=["张", "李", "陈", "黄"];
delete arr[0];
console.log(arr[0]);// undefined
console.log(arr.length);// 4
```

删最后一个

```
var arr=["张", "李", "陈", "黄"];
delete arr[3];
console.log(arr[3]);// undefined
console.log(arr.length);// 4
```

两个例子说明，只是把值换成了 undefined 了，length 不变。  
==但是==  
使用 for in 无法循环出删掉的成员了，如果强行赋值 undefined，又能循环出来，看来真删除了。  
或者说这只是对象的特性而已，数组也是对象嘛

**总结** delete 操作不会致使数组的 length 属性改变 delete 操作与直接赋 undefined 是不一样的，for in 无法获取 delete 删除的成员，可获取服 undefined 的成员

**兼容性**：包括 ie6 的所有

### 通过设置 length

```
var arr=["张", "李", "陈", "黄"];
arr.length=1;
console.log(arr);//["张"] 。真的就只有这么一个了！！
```

兼容性：包括 ie6 的所有

详情 见 [length] 写操作

### 删头尾，一次删一个

使用 shift pop 见 [取成员]

### 指定范围删除，一次可删多个

使用 splice 见 [取成员]

### 根据索引删除-使用 splice

将更改原数组。返回一个新数组，装载删掉的成员

快速使用：

```js
// 删除指定索引位置成员，参数2固定为1
arr.splice(index, 1)
```

### 任意多个索引删除

```js
/**
 * 任意多个索引删除
 * @param {Array} arr 要操作的数组
 * @param {Array} indexs 要删除的索引集合
 * @return {Array} 新数组
 */
function arrayDelete(arr, indexs) {
  let dict = {}
  let hasOwnProperty = Object.prototype.hasOwnProperty
  indexs.forEach(function (index) {
    dict[index] = true
  })
  arr.forEach(function (el, i) {
    if (hasOwnProperty.call(dict, i)) {
      delete arr[i]
    }
  })
  return arr.filter((el) => true)
}
```

错误示例，使用 splice 循环删除

```js
/*
估计只有第1次准确，接下来的循环可能会删错。因为第1次删除会改变现有元素的索引，所以之前记录的删除索引已经不再准确
而且forEach 循环次数也发生了改变
*/
let arr = [1, 2, 3, 4, 5]
arr.forEach(function (el, i) {
  console.log(i)
  switch (i) {
    case 1:
    case 2: // 删除元素 2、3，实际删的是2
      arr.splice(i, 1)
      break
  }
})
console.log(arr)
```

## 改成员

根据索引覆盖操作。都懂...

```js
var arr = ['张', '李', '陈', '黄']
arr[0] = 'xx'
```

## 转换

### 字符串转数组-split

`String.split([string])`

**· 给参情况** 用字符串中指定子串 将 字符串 切割成 数组

```
'张,李,陈,黄'.split(',');//["张", "李", "陈", "黄"]
```

**· 空字符串情况** 将每个字符分割成数组

```
'张,李,陈,黄'.split('');//["张", ",", "李", ",", "陈", ",", "黄"]
```

**· 不给参情况** 返回只有原字符串一个成员的数组

```js
'张,李,陈,黄'.split() //["张,李,陈,黄"]
```

### 数组转字符串-join

**用指定字符串 将 数组 连接成 字符串**

```js
;['张', '李', '陈', '黄'].join('-') // '张-李-陈-黄'
```

**不带参：**

```js
;['张', '李', '陈', '黄'].join() // '张,李,陈,黄'
```

似乎默认使用了逗号相连也可以说是 直接将数组转换成字符串

**数组 length=1**

```js
;['张'].join('-') // '张'
```

**数组 length=0**

```js
;[].join('-').length === 0 //true。看来是空字符串...
```

### 集合转数组-slice 技巧

集合指的是那种有 length 属性的类数组对象

**HTMLCollection 集合例子**

```js
eItems = [].slice.call(document.body.children, 0)
```

这种集合 ie678 不支持，参数 3 不会影响 HTMLCollection 集合

**对象模拟 例子**

```js
var obj = {
  0: 0,
  1: 1,
  length: 10,
}
var arr = [].slice.call(obj, 0)
arr.lenght // 10
```

这种支持包括 ie6 的所有。参数 3 如果给，将影响 obj。不给或者负数都不影响

> 其他 splice 用法见 [splice 增删详解](splice增删详解)

### 数组转字符串-toString

```js
arr.toString() 相当于 arr.join(',')
var arr = ['成员1', '成员2', {}];
arr.toString() //成员1,成员2,[object Object]
arr.join(',') //成员1,成员2,[object Object]
```

## splice 增删详解

[参考网址](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/splice)

**语法** `array.splice(start, deleteCount[, item1[, item2[, ...]]])`

**参数：**

- **start** 必须。起始索引，负数表示从尾部开始起始，而超出情况将再尾部追加
- **deleteCount** 必须(实测可以不带)。删除的个数(含第 start 位) 0 或负数都表示不删除，一般用 0 超出情况将删除 index 之后的所有成员技术文档都说这个是必须，实测不带也可以，不带将删除 start(包含 start)之后的所有
- **itemN** 可选，要替换的成员。将指定区域替换成指定成员

**返回值：** 被删掉的成员组成的新数组没有被删返回空数组

**将更改原始数组：** deleteCount 删除、itemN 增加 将应用到原数组中。而被删除的成员将拼成一个新数组被返回

**兼容：** 包括 ie6 的所有

**关于 clone：** splice 不能实现 clone，arr.concat、arr.slice 可以实现

## slice-复制数组

可指定位置进行复制

**语法** `arr.slice(begin[, end])`

**参数**

- **begin** 开始索引，从 0 开始可以是负数，负数情况 相当于 length + begin，相减后结果如果还是负数将视 0 为起始包含，新数组将包含此位置的值经测试此参数也是可选的，省略情况相当于 arr.slice(0)

- **end** 结束索引，从 0 开始省略此参数将将一直取到原数组末尾可以是负数，负数情况原理同 begin 一样不包含，新数组将不包含此位置的值小于或者等于 begin 将 返回空数组，负数情况也如此

**返回新数组**

**不更改原数组**

**完全复制** 不带参或者 begin 为 0 即可实现完全复制

**可用于取子字符串** 详情见[String]()

**示例**

```js
test.innerHTML = [1, 2, 3, 4, 5].slice(1, 3) //[2,3]
test.innerHTML = [1, 2, 3, 4, 5].slice(1, 1) //[]
test.innerHTML = [1, 2, 3, 4, 5].slice(2) //[3,4,5]
```

**兼容性** 包括 ie6 的所有浏览器

**concat 也可以实现复制**

## concat-合并数组

实现 合并 或者 追加。返回一个新数组数组情况是合并，非数组是追加。

```js
var arr = ['成员1', '成员2', '成员3'],
arr.concat('成员4',['成员5'])// ["成员1", "成员2", "成员3", "成员4", "成员5"]
```

**语法：** `array.concat(value1, value2, ..., valueN)`

**参数：** valueN 可选，不带参将实现复制

**关于合并：** 就是将数组的所有子成员追加进来，相当于如果参数是数组，那么你当它没有中括号吧。合并只限于子级， 如果子成员还是数组 ，不会再去合并，此数组将视为成员。

```js
var arr = ['成员1', '成员2', '成员3'],
  arr2 = ['成员4', ['成员5']]
var newArr = arr.concat(arr2)
console.log(newArr) // ["成员1", "成员2", "成员3", "成员4", ["成员5"]]
```

**返回值：** 合并后的数组

**不更改原数组，也不会更改作为参数的数组**

```js
var arr = ['成员1', '成员2', '成员3'],
  arr2 = ['成员4', '成员5']
var newArr = arr.concat(arr2)

console.log(arr) // ["成员1", "成员2", "成员3"]
console.log(arr2) // ["成员4", "成员5"]
console.log(newArr) // ["成员1", "成员2", "成员3", "成员4", "成员5"]
```

**可实现 clone** 不带参即可 slice 也可以实现 clone

```
var arr = ['成员1', '成员2', '成员3'];
var newArr = arr.concat();
兼容性：包括ie6的所有
```

## sort 排序

### 默认排序，将按字符排序

不带参即可，升序，即小的在前面。

```js
;['B', 'A', 'C'].sort() // ["A", "B", "C"]
```

**将更改原数组**

**字符排序探索** 逐个字符进行对比(如果是数字，并非根据数量)

```
[100,99].sort()// [100, 99]
```

其实，如果看了下面的自定义排序，上例的结果感觉应该是这么来的。转字符串，再比较

```
'100'<'99'// true
```

**汉字** 的话根据 Unicode 编码，并非按照拼音

```
['陈','张', '黄','李'].sort();//["张", "李", "陈", "黄"]
```

上例中，如果按照拼音，'陈'应该在最前才对。而输出字符对于的 Unicode 编码是 5F20 674E 9648 9EC4，这很明显 ==推想，估计所有字符，包括字母都是按照编码来的==

### 自定义排序

```js
// 升序。降序序 将1 和 -1 调换即可
;[2, 33, 12, 6, 3333]
  .sort(function (a, b) {
    if (a < b) return -1 // 小于0即可，可以不为-1
    if (a > b) return 1 // 大于0即可，可以不为1
    return 0 // 相等，不处理
  })(
    // 优化后
    // 升序。降序序 将 b-a 即可
    [2, 33, 12, 6, 3333],
  )
  .sort((a, b) => a - b)
```

**强调：将更改原数组**

### 有返回值

虽然更改了原数组，但还是有返回值，返回更改后的原数组，或者说返回原数组引用

## reverse 数组反转

`arr.reverse()` 差不多就是将整个数组倒过来，第一个位置就是 最后一个成员了

## 查找值，取值的索引-indexOf

取成员索引，不存在返回-1 ie 兼容性：ie9+

```js
var d = {}
var arr = ['a', 'b', d]
console.log(arr.indexOf('a')) // 0
console.log(arr.indexOf(arr[1])) // 1
// 支持对象
console.log(arr.indexOf(d)) // 2
```

## 查找值，是否包含指定值-includes

[Array.prototype.includes() - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/includes)

```js
var pets = ['cat', 'dog', 'bat']

console.log(pets.includes('cat'))
// expected output: true
```

## 数组类型判断

详见 [./类型判断.md](./类型判断.md)

## 遍历迭代

### 缺失数组避开问题

### every 和 some : 是否满足

every 和 some 都会避开缺失元素

可实现中断遍历：forEach 没法中断，但这个可以啊

**every**

必须全对

传递函数只有全部返回 true(或者可转化为 true 的值)，才返回 true

(此处可略看)反之，只要出现 false，遍历停止，返回 false

**some**

有一个对就行

传递函数只要出现 true(或者可转化为 true 的值)，便停止遍历，返回 true

(此处可略略看)反之，必须全部 false 才返回 false

### filter

实现过滤掉不符合条件的成员返回一个新数组，不更改原数组会避开缺失元素

**语法** `var new_arrary = arr.filter(callback[, thisArg])`

**参数**

- **callback** 用来测试数组的每个元素的函数。调用时使用参数 (element, index, array)。返回 true(或者可转化为 true 的值)表示保留该元素（通过测试），false(或者可转化为 false 的值)则不保留。

- **thisArg** 可选。执行 callback 时的用于 this 的值。

**浏览器兼容性**

ie9+

### forEach

[Array.prototype.forEach() - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)

> 注意: 没有返回值!

```js
var array1 = ['a', 'b', 'c']

array1.forEach(function (element, index, array) {
  // element 当前成员
  // index 当前索引
  // array 为原数组

  console.log(element)
})

// expected output: "a"
// expected output: "b"
// expected output: "c"
```

**兼容性** ie678 不支持。可用 for in 代替。不推荐 for 循环，主要是因为 for 循环如果不特殊处理不会跳过不存在成员，即稀疏数组问题

**注意** 只支持 array，其他集合，比如 document.getElementsByTagName('div')、document.body.children， 不支持。但可以变通实现

```js
;[].forEach.call(document.body.children, function (element, index) {
  console.log(element, index)
})
```

循环过程中**没法终止循环**。下例依然输出了所有成员，无法通过 false 终止

```js
// 这是一个错误的例子
;[1, 2, 3, 4, 5].forEach(function (n) {
  console.log(n)
  return false
})
```

### map

数组映射。遍历数组，并返回一个新的

不更改原数组

#### 也会避开空元素，但返回的新数组依然存在空元素

```js
let arr = [1, 2, 3, 4, 5]
// 删除元素，生成稀疏数组
delete arr[1]
delete arr[4]
let newArr = arr.map(function (el, i) {
  // 遇空数组不会执行此函数

  console.log(i)
  return el
})
console.log(newArr) // 依然有空数组
```

#### 语法

arr.map(callback[, thisArg])

#### 参数

- callback
- currentValue
- index
- array
- thisArg 可选。callback 函数中 this 调用

#### 示例

```js
var newArr = arr.map(function (currentValue, index, array) {
  console.log(arguments)
  console.log(this) //传入的第二个参数
  return arguments[1] //给新数组添加值
}, $)
```

#### 兼容性

ie678 不支持

### reduce、reduceRight(相反)

遍历累加

[Array.prototype.reduce() - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce)

**语法** arr.reduce(callback[, initialValue])

**参数**

- callback
- previousValue
- currentValue
- index
- array
- initialValue 可选。累加的初始值。如果不给，默认是数组的第一个，并且直接进行第二次遍历

**示例**

```js
var newArr = arr.reduce(function (previousValue, currentValue, index, array) {
  return previousValue + currentValue //给下一次遍历传入的值
})

// 还可以按属性对object分类: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#%E6%8C%89%E5%B1%9E%E6%80%A7%E5%AF%B9object%E5%88%86%E7%B1%BB
```

**兼容性** ie678 不支持

**注意** initialValue 如果不给，默认值是数组的第一个，并且直接进行第二次遍历

## 类型

### es5 方式

```js
Array.isArray([]) // true
Array.isArray({}) // false
```

### 全兼容方式

```js
var isArray =
  Array.isArray ||
  function (o) {
    return Object.prototype.toString.call(o) === '[object Array]'
  }
```

es5 方式本质也使用了 Object.prototype.toString

### 不推荐使用

iframe 情况可能会出问题

```js
;[] instanceof
  Array(
    // true
    {},
  ) instanceof
  Array // false
```

## delete

删除真实存在，不等同赋 undefined。具体见下

## 关于直接赋 undefined 与 delete 操作区别讨论

```js
var a = new Array(10)
a[1] = undefined
a[2] = undefined
a[3] = undefined

// 高级浏览器
a.forEach(function () {
  console.log(1)
})
// ie678使用如下
for (var k in a) {
  console.log(2)
}
// 上面两个循环都只循环了3次

// 删除真实存在，不等同赋undefined
delete a[1]

a.forEach(function () {
  console.log(1)
})
for (var k in a) {
  console.log(2)
}
// 现在只循环2次了

a.length = 10

a.forEach(function () {
  console.log(1)
})
for (var k in a) {
  console.log(2)
}
// 还是循环2次

a.length = 1

a.forEach(function () {
  console.log(1)
})
for (var k in a) {
  console.log(2)
}
// 循环1次
```

总结：

1. 即使是赋了 undefined 的成员，依然是存在的
2. 直接操作 length，增大操作，并不影响成员增加的本质。但对 lenght 直接减少操作会影响存在成员个数
3. forEach 看似是用 for in 实现的，而且这两种循环只根据真实存在成员，不参照 length 属性
4. 数组也是对象，依然保留对象特性。for in、delete 的使用跟对象一样，也是可以做数据字典的。即 delete 生效于 for in(当然还有 forEach)
5. delete 不改变 length。for 循环差不多是自己制定循环次数，受制于 length，属例外

一些根据 length 来实现的属性，即使成员不存在： toString、join、split

非根据 length 来实现的属性，只根据真实存在成员： forEach、for in

此处兼容性包括 ie6 的所有浏览器

## 取最大/小值

通过 fun.apply

```js
console.log(Math.max.apply(Math, [34, 23, 43])) // 43 最大值
```

## 数组类型检测

方式 1： `Array.isArray(obj)`

方式 2： `obj instanceof Array`

## valueOf 返回数组对象本身

[Object.prototype.valueOf() - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/valueOf)

## 参考文档

[Array - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array)
