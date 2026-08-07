


## 取索引


indexOf 从前往后; lastIndexOf 从后往前

- 什么时候匹配结束：匹配成功便结束，不再继续查找
- 没有匹配返回值：-1
- 参数多个字符情况: 返回开头字符索引

```
var str = "helloword";

//从前往后
str.indexOf('ow') // 4

//从后往前
srt.lastIndexOf('ow') // 6
```

## 字符串比较

小返回-1，相等返回0，大返回1。可实现排序

```js
'吧'.localeCompare('啊') // 1 。看来是按拼音来的，b比a大
'asd'.localeCompare('bcd') // -1

```

## 空字符串

```js
// length 为 0
console.log(''.length === 0) // true

// 默认转换为0
console.log('' - 23); // 相当于0-23
console.log('' > -1); // true。相当于0>-1
console.log('' === 0) // false
console.log('' == 0); // true
```

兼容性：all浏览器。包括严格模式

## length

只读属性。能获取字符串的字符个数

## 子字符获取

```js
var str = 'hello';
// 都是返回'h'字符。强调：依然是string类型

// charAt 获取
alert(str.charAt(index)); // 兼容所有浏览器

// 索引 获取
alert(str[0]); // ie6\7不兼容
```

## 子串获取

### substring

[substring 文档](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/substring)


#### 语法

```
str.substring(indexStart[, indexEnd])
```

#### 示例说明

```js

// 参数2不给将获取剩下的所有字符
console.log("hello word".substring(1)) // 'ello word'
// 超过情况同上
console.log("hello word".substring(1, 100)) // 'ello word'

console.log("hello word".substring(1, 2)) // 'e'

console.log("hello word".substring(0, 2)) // 'he'

// 几种特殊情况

// 超过范围情况。返回空字符串
console.log("hello word".substring(100)) // ''

// 2个参数都可不带。。返回原字符串
console.log("hello word".substring()) // 'hello word'
```

#### 兼容性
包括ie6的所有

### substr

[substr 文档](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/substr)

#### 语法

```
str.substr(start[, length])
```

#### 示例说明

```js

// 参数2不给将获取剩下的所有字符
console.log("hello word".substr(1)) // 'ello word'
// 超过情况同上
console.log("hello word".substr(1, 100)) // 'ello word'

console.log("hello word".substr(1, 2)) // 'el'

console.log("hello word".substr(0, 2)) // 'he'

// 几种特殊情况

// 超过范围情况。返回空字符串
console.log("hello word".substr(100)) // ''

// 2个参数都可不带。。返回原字符串
console.log("hello word".substr()) // 'hello word'
```

#### 兼容性
包括ie6的所有

## String(数字) Number 互转

```js

// Number -> String
console.log(1 + '') // '1'。性能最好
console.log(String(1)) // '1'。性能一般
console.log((1).toString()) // '1'。性能差

// String -> Number
console.log(+'1') // 性能最好
console.log(Number('1')) // 性能比 +1 稍差
console.log('1' * 1) // 1 性能比 Number稍差
console.log('1' - 0) // 1。性能与 *1 差不多
console.log(parseFloat('1')) // 1。性能不佳
console.log(parseInt('1')) // 1。性能不佳，与 parseFloat 差不多


// 性能测试
var j
console.time()
for (let i = 0; i < 100000; i++) {
  j = (1).toString()
}
console.timeEnd()


```

## 字符串 —> number

### 使用 parseFloat、parseFloat

都是 window 的方法：window.parseFloat、window.parseInt

parseFloat：最多只保留 14位小数，第14位如果有，进1

兼容性：所有浏览器

```js

parseInt('好啊') // NaN
parseFloat('好啊') // NaN

parseInt("123.45转不了") // 123
parseFloat("123.45转不了") // 123.45

```

### ECMAScript 3中的 parseInt 问题

ECMAScript 5 中没有这一问题

```js
parseInt('08') // 将返回0 。起始为0 的字符串将以8进制方式解析，相当于parseInt('08',8)

```

所以，在考虑 ECMAScript 3 环境时尽量带第二个参数 ：`parseInt('08',10)`。当然，转换的方式还有很多，比如正则

### 什么情况使用 parseFloat、parseInt

部分数字类型，且起始情况：

```js
console.log(parseFloat("123你好")) // 123
```

完全的数字类型使用如下方式，性能要好

```js
console.log(+"08") // 性能最好
console.log(Number("08"))
console.log("08" * 1)
```

## 其他类型 转 字符串

```js
// 兼容性：所有浏览器

// 推荐方式
document.write(123 + "" + 123);

// 其他方式1
document.write(String(123)+123);

// 其他方式2
document.write((123).toString() + 123);

```

## 字母大小写转换

```js
// ——>小写
var _info = ("AAAaaa").toLowerCase();

// ——>大写
var _info = ("AAAaaa").toUpperCase();

//兼容性：all浏览器

```

## 去掉两头空白字符-trim

```js
('   sss        ').trim()
```

兼容性：ie9+ 、其他高级

## 其他进制 --> 十进制

```js
parseInt("589E",16);// 某16进制字符串转10进制 。589E代表中文字符"增"
parseInt("10",8); //某8进制字符串转10进制
parseInt("10",2); //某2进制字符串转10进制

```

## 字符，Unicode码

### 字符 -> Unicode 的十进制数

返回值：编码值，number类型，十进制

兼容性：all浏览器

```js

// 字符 'a' 的 Unicode 值（参数不给将默认0）
console.log(('ac').charCodeAt()) // 97

// 字符 'c' 的 Unicode 值
console.log(('ac').charCodeAt(1)) // 99

// 超出情况，返回 NaN
console.log(('ac').charCodeAt()) // NaN
```

### 十进制 Unicode -> 字符

```js
String.fromCharCode(49);// '1'
```

### 字符 Unicode 直接量写法

\u + 16进制

直接输出显示转行后的字符

```js
console.log('\u4f60\u597d\u554a') // '你好啊'
```

16进制转10进制可使用parseInt

## 中文字符比较

[String.prototype.localeCompare() - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare)

referenceStr.localeCompare(compareString[, locales[, options]])

**referenceStr 字符：**
- 小，返回 -1
- 大 返回 1
- 相等 返回 0

```js
let referenceStr = '哈哈' // haha
let compareString = '啊啊' // aa
referenceStr.localeCompare(compareString, 'zh'); // 1
```
## 汉字范围 十六进制写法

**number**  
0x4e00  
0x9fa5

**字符串**  
\u4e00  
\u9fa5  

## 两种空格

空格符有两种，但正则表达式的 `\s` 两种都能匹配

两个空格的 Unicode 写法

```js

console.log('\u0020', '\u00A0')

```

