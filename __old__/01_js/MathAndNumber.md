# Math And Number

## 数位处理

### 去小数

#### 直接去，黑魔法

参数可以使字符串

参数不是数字类型：返回 0

返回值类型：number

```js
console.log(~~12.123) // 12
console.log(~~'-12.123') // -12
console.log(~~num / 2) // num去小数后 在除2。如果是对结果去小数，需加个括号
console.log(~~'-12.123px') // 0 。非数字类型返回0，即 isNaN 为 false 的值

console.log('-12.123' ^ 0) // -12
console.log('-12.123' | 0) // -12
```

#### 向前取整

正数去小数后加一  
负数直接去小数

```js
console.log(Math.ceil(5.1)) // 6
console.log(Math.ceil('5.1')) // 6。返回 Number 类型
console.log(Math.ceil(-5.1)) // -5
console.log(Math.ceil(5.5)) // 6
console.log(Math.ceil(5.0)) // 5。这种情况不能看成小数
```

#### 向后取整

与 Math.ceil 相反

正数直接去小数  
负数去小数后减一

```js
console.log(Math.floor(5.1)) // 5
console.log(Math.floor('5.1')) // 5。返回 Number 类型
console.log(Math.floor(-5.1)) // -6
console.log(Math.floor(5.5)) // 5
console.log(Math.floor(5.0)) // 5。这种情况不能看成小数
```

#### 四舍五入

```js
console.log(Math.round(5.1)) // 5
console.log(Math.round('5.1')) // 5。返回 Number 类型
console.log(Math.round(-5.1)) // -5
console.log(Math.round(-5.6)) // -6
console.log(Math.round(5.5)) // 6
console.log(Math.round(5.0)) // 5。这种情况不能看成小数
```

### 保留指定位小数

numObj.toFixed([digits])

返回字符串

```js
console.log((56.45).toFixed()) // '56'。参数可选，默认0，即去掉所有小数
console.log((56.456).toFixed(2)) // '56.46'。 四舍五入
console.log((56).toFixed(2)) // '56.00'。根据参数固定保留
```

## 随机数 random

获取 0~1 之间的随机数。小数位大概在 17 位以上。20 位以下。

```js
document.write(Math.random())
```

**应用：** 指定范围整数

```js
// 0~1
~~(Math.random() * 2)
// 0~5
~~(Math.random() * 6)
// ...(类推)

// 附上循环测试例子
for (var i = 100; i--; ) {
  console.log(~~(Math.random() * 6))
}

// 可指定开始和结束
function randomNum(s, e) {
  return Math.random() * (e - s) + s
}
```

## 平方

```js
//参数：必须
alert(Math.sqrt(9)) //3
```

## 幂/平方

```js
//参数：必须
alert(Math.pow(3, 2)) //9，即3的2次幂
```

## 平方根，立方根

```js
Math.pow(9, 1 / 2) //3
Math.pow(8, 1 / 3) //2
```

## 角度 与 弧度

弧度与角度关系：π(弧度)= 180°

1 角度 所代表的 弧度 是：` Math.PI / 180`

1 弧度 所代表的 角度 是：`180 / Math.PI`

```js
// 角度转弧度：
// 参数：角度
function radian(angle) {
  return (angle * Math.PI) / 180
}

// 弧度转角度：
// 参数：弧度
function angle(radian) {
  return (radian * 180) / Math.PI
}
```

## 直角三角形

### 所有 相关 函数

Math.sin() -- 返回数字的正弦值  
Math.cos() -- 返回数字的余弦值  
Math.tan() -- 返回数字的正切值  
Math.asin() -- 返回数字的反正弦值  
Math.acos() -- 返回数字的反余弦值  
Math.atan() -- 返回数字的反正切值  
Math.atan2() -- 返回由 x 轴到点(x,y)的角度(以弧度为单位)  
Math.PI 属性 -- 返回圆的周长与其直径的比值(圆周率 π)，约等于 3.1415926

### 边的比值-正弦 余弦 正切

```js
Math.sin(r) //正弦
Math.cos(r) //余弦
Math.tan(r) //正切
```

**参数：**  
number 类型，弧度值  
**返回值：**  
number 类型，边的比值

**数学知识**  
正弦：对比斜  
余弦：邻比斜  
正切：对比邻

### 角度获取

所有代码示例：

```js
/* 参数: 边的比值 */
/* 返回值: 弧度值 */
// 反正弦
Math.asin(r)
// 反余弦
Math.acos(r)
// 反正切
Math.atan(r)


/* 参数: 点（x,y） */
/* 返回值: 弧度值 */
// 反正切2
Math.atan2(y,x)
```


## 圆

### PI

```js
alert(Math.PI) // 3.141592653589793。包括ie6的所有都返回这样一组数
```

## 绝对值

```js
console.log(Math.abs(-1)) // 1
console.log(Math.abs('-1')) // 1
```

## 取最大/小值

```js
Math.max(34, 23, 43) // 43
Math.min(34, 23, 43) // 23

// 可用来取数组最大/小值。通过 apply
console.log(Math.max.apply(Math, [34, 23, 43])) // 43 最大值
```

## e，某数乘 10 的 n 次方

```js
console.log(1e3) // 1000 即1*Math.pow(10, 3)
console.log(2e3) // 2000 即2*Math.pow(10, 3)
```

## 一些应用

### 3 点算角度

使用余弦定理
