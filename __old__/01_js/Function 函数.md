- [两个重要特征](#两个重要特征)
- [函数创建](#函数创建)
- [prototype](#prototype)
  - [原型概念](#原型概念)
  - [写操作：将影响所有实例](#写操作将影响所有实例)
  - [与prototype相对的this的写操作：只影响当前实例](#与prototype相对的this的写操作只影响当前实例)
  - [可通过this(实例)访问](#可通过this实例访问)
  - [关于__proto__ 理解](#关于__proto__-理解)
  - [prototype起始值是一个空对象](#prototype起始值是一个空对象)
  - [prototype方式无法重写this添加的成员](#prototype方式无法重写this添加的成员)
  - [构造函数 - 性能](#构造函数---性能)
- [this](#this)
  - [this读操作](#this读操作)
  - [this成员读操作](#this成员读操作)
  - [this成员写操作，也就是给this增加新成员，或者修改现有成员](#this成员写操作也就是给this增加新成员或者修改现有成员)
  - [举例说明](#举例说明)
  - [改变this指向](#改变this指向)
- [js继承](#js继承)
  - [constructor 取实例的构造函数](#constructor-取实例的构造函数)
- [？name 属性](#name-属性)
- [函数作用域](#函数作用域)
- [闭包-函数声明位置可调用同级或上级变量](#闭包-函数声明位置可调用同级或上级变量)
- [声明VS表达式](#声明vs表达式)
- [回调函数 概念](#回调函数-概念)
- [call，apply](#callapply)
  - [apply妙用](#apply妙用)
- [变量、函数提升的区别](#变量函数提升的区别)
- [arguments 函数参数](#arguments-函数参数)
- [length，函数预设参数个数](#length函数预设参数个数)
- [函数执行](#函数执行)

## 两个重要特征
1、依然是对象
2、提供局部作用域

## 函数创建
**1 声明**

```js
function fn(argument) {
    // body...  
}
// 输出：有名字
el.innerHTML = fn;// function fn(argument) { // body... }
// 不管放到何处，都将最先被创建赋值。也就是可以如下写：
el.innerHTML = fn;
function fn(argument) { }
```

**2 表达式**


```js
// 匿名函数赋值
var fn = function(argument) {
    // body...  
};
// 输出：可以看到没有名字
info.innerHTML = fn;// function (argument) { // body... }
```

**3 构造函数**

类似eval，不推荐的方式，费效率
函数赋值的方式类似 2，也是匿名赋值
语法：`new Function ([arg1[, arg2[, ... argN]],] functionBody)`

```js
var fn = new Function('alert("")');// 不带参
var fn = new Function('a','b','alert(a+b)');// 带参
```

## prototype

### 原型概念

原型，其实就是将成员共享出去，共享给以后的每个实例，这样，每次创建新实例对象时，就不用每次都重新创建成员了

### 写操作：将影响所有实例

对类的prototype成员的增删改，会影响**之前之后**的所有实例。即现有的实例，后来新加的实例，都会被影响

### 与prototype相对的this的写操作：只影响当前实例

### 可通过this(实例)访问

prototype设置的成员，包括方法，属性，可通过this访问

this的本质就是当前实例，this可以访问，实例也可以访问

关于优先权：实例直接成员将优先访问，没有直接成员情况才会访问prototype

### 关于__proto__ 理解

函数的prototype 属性，当函数被实例化后，prototype 属性就变成__proto__了。  
相当于，**函数的prototype与实例的__proto__引用的是同一个对象**。下面问题的解答也证实了这点

问题1：__proto__ 只跟当前实例有关？  
操作实例的__proto__相当于操作类的prototype，所有跟所有之前之后的实例都有关系。


问题2：__proto__ 设置的成员可直接通过实例访问？  
当然可以，因为操作实例的__proto__相当于操作类的prototype，而类的prototype的修改是会影响之前之后的所有实例

### prototype起始值是一个空对象
兼容性：ie6+

### prototype方式无法重写this添加的成员
也就是实例直接添加成员
这里也引发了优先权问题，也就解释了为什么无法重写：实例直接成员将优先访问，没有直接成员情况才会访问prototype

```js
function foo() {
    this.add = function (x, y) {
        return x + y;
    }
}
foo.prototype.add = function (x, y) {
    return x + y + 10;
}

var f = new foo();
alert(f.add(1, 2)); //结果是3，而不是13

```

也无法重写直接指定的成员，看来this就是直接添加的成员

```js
var f = new foo();
f.hello='world';
foo.prototype.hello = 'what?';
alert(f.hello); //'world'
```





### 构造函数 - 性能
减少避免构造函数的复制操作： 
构造函数每次创建对象，其中的私有成员，包括this的赋值，都会重新创建。可以尽可能的将其中公共的成员通过prototype共享出来，减少复制操作，节约内存

## this

### this读操作
函数是需要一个对象来执行的，而this用来获取执行这个函数的对象
### this成员读操作
this(实例对象)成员读取：将优先访问自身成员，没有自身成员则访问prototype成员

### this成员写操作，也就是给this增加新成员，或者修改现有成员
增删改成员：影响当前实例，其实就是实例的增删改。此操作会覆盖当前实例同名prototype成员。强调，只对当前实例有影响，其他实例不影响

### 举例说明

```js
var obj={};

obj.fun=function () {
    console.log(this);// 这个this就是那个obj
};

// 看。用obj执行fun函数
obj.fun();

```

```js
// 那么这又是怎么回事呢
(function(){

function fun() {
    console.log(this);// 这个this是个啥？？？其实返回window，为啥？？
}

// 这是用什么执行的？？？！！！
fun();

})();

```

**对于不指明的函数执行，将固定使用window来执行。所以上例中的this是window对象。**  
上例加个自执行函数是为了说明即使不是全局对象(全局对象可隐藏window)，依然是使用window来执行

**但es5改变了这一标准。对于不指明的函数执行，this都将返回undefined**

```js
// 开启 es5
"use strict";

// #1
function fun() {
    return this;
}
fun();// undefined
window.fun();// window

// #2 即使显式的指明是window的成员，依然同上
window.fun2 = function () {
    return this;
};
fun2();// undefined
window.fun()2;// window 

```

### 改变this指向

**call、apply**

见[call，apply](#js/2847403752)

**Function.prototype.bind()**  
[Function.prototype.bind() - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)

指定 this 指向，固定的绑定。返回一个新函数

apply call 区别：apply call 是用指定的对象执行，立即执行。bind 是固定绑定一个对象，等待调用执行。除非更改绑定，否则不会执行

兼容性：es5 规范。ie中只ie9开始支持

```js
var obj = {
    fn: function () {
        console.log(this);
    }
};

var new_fn = obj.fn.bind({name: 'newObj'});

// 返回一个新函数
console.log(new_fn === obj.fn);// false

new_fn(); // this 是 bind 绑定的那个

({
    name: 'newObj-2',
    fn: new_fn
}).fn();// this 依然是 bind 绑定的那个

({
    name: 'newObj-2',
    fn: obj.fn
}).fn();// this 遵循一般规则，可任意改变

```

## js继承

子类继承父类  
子类拥有父类的成员。但父类不拥有子类的成员

**1模拟继承 错误例子：**

```js
function A() {

}

A.prototype.a=111;
A.prototype.b=function () {
    return 222;
};

function B() {

}

B.prototype=A.prototype;

A.prototype.c=333;
B.prototype.d=444;

console.log(new A);
console.log(new B);

```

上例中，A类和B类的prototype同时引用了同一个对象，所以父类也继承了子类的成员。。

**2模拟继承 正确例子：**

```js
function A() {

}

A.prototype.a=111;
A.prototype.b=function () {
    return 222;
};

function B() {

}

B.prototype=new A ;

A.prototype.c=333;
B.prototype.d=444;

console.log(new A);
console.log(new B);

```

### constructor 取实例的构造函数

constructor  
用来获取 创建此 对象 的函数

*可通过prototype改变指向*


**兼容性**  
包括ie6的所有

**代码示例**  

function a() { alert(); }
var _a = new a();

console.log((_a).constructor);//通过对象_a 取到了 函数a
//等同于 下面
console.log(a);

//可以通过 constructor执行 此函数
console.log((_a).constructor());


console.log(([]).constructor === Array);// true

## ？name 属性
函数表达式：

```js
var fun = function () { };// 未命名函数
fun.name // 'fun'，这是chrome结果
fun.name // ''(空字符串)，ie所有，包括最新的ie edge
```

所以，如果需要使用name属性，最好还是使用下面的方式：函数声明

```js
function fun() { }
fun.name // 'fun'
```


此属性不是ECAM 标准？？

## 函数作用域

**作用域 与 重写**

```js
console.log(sum(1 + 2)); // 3

function sum(a, b) {

    // 只能重写此域中的sum
    // 外部的sum并不受影响
    function sum(a) {
        return a + 99;
    }

    return a + b;
}
```

**只有函数提供作用域**  
并非使用花括号就能定义局部作用域  
只有函数能提供作用域，if等包裹并没有作用域

## 闭包-函数声明位置可调用同级或上级变量
**不管函数赋给了哪里的变量，也不管函数在哪里执行，它声明位置的同级或上级变量都可调用**

闭包详细：  
父函数中子函数，子函数将拥有一个不影响外界的空间(函数作用域)，如果再将子函数 return 出去，那么，子函数不管再何处执行(其他某个函数域)，并不影响子函数对这个封闭的空间中同级或上级变量使用，此时这个封闭的空间就是闭包了，一个可以在任何位置被激活的封闭空间

单纯的作用域虽然也是封闭空间，但不能叫闭包，这个封闭空间必须满足可在任意位置被激活

## 声明VS表达式

**声明拥有变量提升特性**

```js
// 调用在上
console.log(sum(1 + 2));

// 声明写下面
function sum(a, b) {
    return a + b;
}
// 甚至可以这样：
console.log(sum(1 + 2));

function sum(a, b) {

    return sum(a, b);
    
    function sum(a, b) {
        return a + b;
    }
}
```

**表达式其实就是赋值**  
把函数当成值来使用

## 回调函数 概念

函数A作为参数传入函数B，并可能在函数B内执行，那么A就被称为回调函数

```js
B(a);

function A() {

}

function B(callback) {
    callback();
}
```

## call，apply
指定对象执行函数

**使用 null 或者 undefined 去执行某函数，this 指向问题？**  
ES5 以下将指向 window  
ES5 直接就是 null 或者 undefined 。用的什么就指向什么

这样看来，call，apply 可以不带任何参数执行

兼容性：ie6也如上所说

### apply妙用
1. 实现两个函数参数一样，配合arguments

```js
function fn1(a1,a2,a3) {
    fn2.apply(undefined, arguments);
}
function fn2(a1, a2, a3) { }
```


2. 取数组 最大\最小值
兼容性：all

```js
console.log(Math.max.apply(Math, [34, 23, 43])); // 43
console.log(Math.min.apply(Math, [34, 23, 43])); // 23
```


## 变量、函数提升的区别

*es6将取消*

函数是完全的提升；
变量只是 声明提升，赋值运算不会提升

```js
console.log(a)
var a=1
console.log(a)
function a () {
    console.log(2)
}

// 提升后
var a
function a () {
    console.log(4)
}
console.log(a)
a=1
console.log(a)
```

## arguments 函数参数

[Arguments 对象 - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Functions/arguments)

类数组对象，获取当前函数参数

```js
function fun(a) {
    //获取
    console.log(arguments[0] === a) // true

    //获取参数个数 —— length 属性
    alert(a + "||" + arguments.length);

    //当前函数获取 —— callee属性 (严格模式不可用)
    //callee属性 属于 arguments对象
    //当然，直接通过 函数对象 变量名也可 获取当前 被执行的函数对象。对于一些无名函数可通过此方式
    alert(typeof arguments.callee);
}

```

兼容性：所有浏览器

## length，函数预设参数个数

```js
function fun(a,b,c){}
console.log(fun.length)//3
```

兼容性：ie6+、其他所有

## 函数执行

函数的每次执行，都将是一次全新的执行

```js
function fun () {
    var name = 123
    return {
    getName () {
        return name
    },
    setName (newName) {
        name = newName
    }
    }
}

var f1 = fun()
var f2 = fun()

f1.setName(111)
console.log(f1.getName()) // 111

// 函数每次执行都是新的
console.log(f2.getName()) // 123
```