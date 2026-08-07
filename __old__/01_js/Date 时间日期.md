- [对象创建](#%E5%AF%B9%E8%B1%A1%E5%88%9B%E5%BB%BA)
- [ios "-" 号连接问题](#ios-%22-%22-%E5%8F%B7%E8%BF%9E%E6%8E%A5%E9%97%AE%E9%A2%98)
- [取月总天数](#%E5%8F%96%E6%9C%88%E6%80%BB%E5%A4%A9%E6%95%B0)
- [时间获取](#%E6%97%B6%E9%97%B4%E8%8E%B7%E5%8F%96)
  - [当前时间获取](#%E5%BD%93%E5%89%8D%E6%97%B6%E9%97%B4%E8%8E%B7%E5%8F%96)
  - [toString、toUTCString](#tostringtoutcstring)
  - [指定段获取](#%E6%8C%87%E5%AE%9A%E6%AE%B5%E8%8E%B7%E5%8F%96)
  - [毫秒获取](#%E6%AF%AB%E7%A7%92%E8%8E%B7%E5%8F%96)
- [时间设置](#%E6%97%B6%E9%97%B4%E8%AE%BE%E7%BD%AE)

## 对象创建


```js
// 当前时间创建
/**
* 不带参即可
*
* 兼容性：all浏览器
*/
var myDate = new Date();

// 指定时间创建
/**
* 带参即可 
*
* 参数格式：*****************************************************
* 1、yyyy/MM/dd HH:mm:ss(时分秒可以选带，年月日必须带)，兼容性最好
* 2、yyyy-MM-dd HH:mm:ss(时分秒可以选带，年月日必须带)，ie6\7\8 不支持，ios MM-dd HH:mm:ss 部分一位数必须补0
* 3、Mon, 21 May 2012 04:23:31 UTC
* 4、2019-04-22T12:35:00+08:00
* 5、number 单个多个参数
*/
var myDate = new Date('2012/03/04');
var exdate = new Date('Mon, 21 May 2012 04:23:31');
//使用UTC时间初始
var exdate = new Date('Mon, 21 May 2012 04:23:31 UTC');
// 多参数
var myDate = new Date(2013, 11, 1) //实际上是 2013-12-1
var myDate = new Date(2013, -1, 1) //实际上是 2012-12-1
// 一个参数：毫秒
var myDate = new Date(1000)
```




## ios "-" 号连接问题


月日必须是2位，"/" 没有此问题。Android也没有问题

ios版本：iPhone OS 11_0_3 AppleWebKit/604.1.38 Version/11.0 Mobile/15A432 Safari/604.1

```js
new Date('2017-1-1') // 不支持
new Date('2017-01-01') // 支持
```

## 取月总天数

指定年月, 天的总数

```js
// month 从1 开始
function getDayCount (year, month) {
  var d = new Date(year, month)
  d.setDate(0)
  return d.getDate()
}

```

## 时间获取

### 当前时间获取

毫秒方式直接取 `Date.now()`


对象方式 `new Date()`


### toString、toUTCString

```js
var timeTxt = exdate.toString() //将返回格式 如：Mon May 21 2012 12:19:10 UTC+0800 (中国标准时间)
var timeTxtUTC = exdate.toUTCString();//将返回格式 如：Mon, 21 May 2012 04:23:31 UTC
// toString：返回当前地区时间
// toUTCString：返回UTC时间
```

### 指定段获取

```js

// 年
// number类型
// 兼容性：all浏览器
myDate.getFullYear()

// 月
// 从0开始，即0代表1月份
// number类型
// 兼容性：all浏览器
myDate.getMonth();

// 号(天)
// number类型
// 兼容性：all浏览器
myDate.getDate();

// 星期
// 获取值范围：0~6
// 其中0代表星期天。其他不变
myDate.getDay();

```

### 毫秒获取

```js
// 毫秒
myDate.getTime();
// 简写
var time = +myDate
```

## 时间设置

```js
// 年
myDate.setFullYear(2012)
myDate.setFullYear(2012,2,2) // 支持月日
// 兼容性：包括ie6的所有

// 天
// 溢出情况，将累加到下个月
// 负数情况，往后退
// 参数0，为上个月的最后一天
myDate.setDate(31);
// 兼容性：包括ie6的所有

// 秒
myDate.setSeconds(-70);
// 兼容性：包括ie6的所有

// 毫秒
// 从1970年开始的毫秒数，负数可回到1970年之后
myDate.setTime(1); 
// 兼容性：包括ie6的所有

```