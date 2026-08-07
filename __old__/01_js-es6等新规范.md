
## class

### 常用模式、性能

es6 class 常用模式:

```js
// 私有成员，创建在class 外面，如果还是有其他class，使用 即时函数了
// 此为目前无奈解决方案

// 功能初始，最先执行，只执行一次
function testInit() {
    // 保证只执行一次
    testInit=function(){};
}

class test{
    constructor(){

        // 公共成员，非共享

    }

    // 公共成员，共享
    
}

```

### 基本语法

属性只能在constructor函数中创建

```
// 定义类
class hello {
  
  // 构造函数，如果没有显式定义，一个空的constructor方法会被默认添加。
  constructor(name) {
    // new 的时候执行
    // 参数也是 new 的时候传入的
    
    this.name = name;
    
    // 默认返回实例对象（即this）,完全可以指定返回另外一个对象
    // return {}
  }
  
  // 方法成员
  hi() {
    return 'hello '+this.name;
  }
}

// 调用。不使用new是没法调用的，会报错
let p1 = new hello('jony');

let p2 = new hello; // 不传参也没事

```

### 继承

#### 速度使用

extends：继承关键字
super：执行父类的构造函数

```
class ColorPoint extends Point {
  constructor(x, y, color) {
    super(x, y); // 调用父类的constructor(x, y)
    this.color = color;
  } 
}
```

