- [快速了解](#%e5%bf%ab%e9%80%9f%e4%ba%86%e8%a7%a3)
- [快速使用、语法简要说明](#%e5%bf%ab%e9%80%9f%e4%bd%bf%e7%94%a8%e8%af%ad%e6%b3%95%e7%ae%80%e8%a6%81%e8%af%b4%e6%98%8e)
- [Promise](#promise)
  - [catch 简写](#catch-%e7%ae%80%e5%86%99)
  - [then catch 执行机制](#then-catch-%e6%89%a7%e8%a1%8c%e6%9c%ba%e5%88%b6)
  - [then catch 都将返回 Promise 实例](#then-catch-%e9%83%bd%e5%b0%86%e8%bf%94%e5%9b%9e-promise-%e5%ae%9e%e4%be%8b)
  - [catch 返回的也能被 then 接收](#catch-%e8%bf%94%e5%9b%9e%e7%9a%84%e4%b9%9f%e8%83%bd%e8%a2%ab-then-%e6%8e%a5%e6%94%b6)
  - [then 中手动抛错的正确方式](#then-%e4%b8%ad%e6%89%8b%e5%8a%a8%e6%8a%9b%e9%94%99%e7%9a%84%e6%ad%a3%e7%a1%ae%e6%96%b9%e5%bc%8f)
  - [resolve/reject 立即执行 then/catch 依然是异步](#resolvereject-%e7%ab%8b%e5%8d%b3%e6%89%a7%e8%a1%8c-thencatch-%e4%be%9d%e7%84%b6%e6%98%af%e5%bc%82%e6%ad%a5)
  - [resolve 只能传一个参数](#resolve-%e5%8f%aa%e8%83%bd%e4%bc%a0%e4%b8%80%e4%b8%aa%e5%8f%82%e6%95%b0)
  - [reject 传入什么，就返回什么](#reject-%e4%bc%a0%e5%85%a5%e4%bb%80%e4%b9%88%e5%b0%b1%e8%bf%94%e5%9b%9e%e4%bb%80%e4%b9%88)
- [resolve 后又执行 reject，或者先 reject 再 resolve ?](#resolve-%e5%90%8e%e5%8f%88%e6%89%a7%e8%a1%8c-reject%e6%88%96%e8%80%85%e5%85%88-reject-%e5%86%8d-resolve)
- [reject 后又重复 reject，或者是重复的 resolve ?](#reject-%e5%90%8e%e5%8f%88%e9%87%8d%e5%a4%8d-reject%e6%88%96%e8%80%85%e6%98%af%e9%87%8d%e5%a4%8d%e7%9a%84-resolve)
- [Promise.all 并发，返回所有结果](#promiseall-%e5%b9%b6%e5%8f%91%e8%bf%94%e5%9b%9e%e6%89%80%e6%9c%89%e7%bb%93%e6%9e%9c)
- [Promise.race 并发，返回第一个完成的结果](#promiserace-%e5%b9%b6%e5%8f%91%e8%bf%94%e5%9b%9e%e7%ac%ac%e4%b8%80%e4%b8%aa%e5%ae%8c%e6%88%90%e7%9a%84%e7%bb%93%e6%9e%9c)
- [async](#async)
  - [返回 Promise 对象](#%e8%bf%94%e5%9b%9e-promise-%e5%af%b9%e8%b1%a1)
  - [错误处理](#%e9%94%99%e8%af%af%e5%a4%84%e7%90%86)
    - [捕捉方式 1: try catch](#%e6%8d%95%e6%8d%89%e6%96%b9%e5%bc%8f-1-try-catch)
    - [捕捉方式 2: Promise 的 catch](#%e6%8d%95%e6%8d%89%e6%96%b9%e5%bc%8f-2-promise-%e7%9a%84-catch)
  - [手动抛错](#%e6%89%8b%e5%8a%a8%e6%8a%9b%e9%94%99)
  - [await 返回的是 resolve 传的值](#await-%e8%bf%94%e5%9b%9e%e7%9a%84%e6%98%af-resolve-%e4%bc%a0%e7%9a%84%e5%80%bc)
  - [处理并发](#%e5%a4%84%e7%90%86%e5%b9%b6%e5%8f%91)

## 快速了解

1. Promise 一般用于函数内，作为返回值
2. Promise 一般结合 async 函数和使用

## 快速使用、语法简要说明

**Promise**

```js
var fs = require("fs");

var readFile = function (fileName) {
  return new Promise(function (resolve, reject) {
    // 此处会立即执行(同步执行)
    // 强调：此处会在当前 new Promise 实例后立即执行

    // ...异步逻辑代码
    fs.readFile(fileName, function (error, data) {
      if (error) reject(error);
      // 异步失败
      else resolve(data); // 异步成功
    });
  });
};
```

**async**：实际上是 Promise 的扩展

```js
var asyncReadFile = async function () {
  // 此处会立马同步执行

  // await 返回的是 Promise 的 resolve 执行后传入的值
  var f1 = await readFile("/etc/fstab");
  // 此处等待 await 异步执行完后才会执行

  var f2 = await readFile("/etc/shells");
  // 此处等待 await 异步执行完后才会执行

  console.log(f1.toString());
  console.log(f2.toString());
};

// 异步函数执行
asyncReadFile();
```

## Promise

### catch 简写

2 种方式

```js
p.then((val) => console.log("fulfilled:", val)).catch((err) =>
  console.log("rejected", err)
);

// 等同于
p.then((val) => console.log("fulfilled:", val)).then(null, (err) =>
  console.log("rejected:", err)
);
```

### then catch 执行机制

- 执行 resolve 后，后面的 then 都会执行，除了 catch
- 执行 reject 后，从 catch 开始执行，后面的 then 都会执行

```js
new Promise(function (resolve, reject) {
  setTimeout(function () {
    reject("报错了");
    console.log("reject 执行后，这里依然会执行");
  }, 1000);
})
  .then(function () {
    console.log(1);
  })
  .then(function () {
    console.log(2);
  })
  .catch(function (err) {
    console.log(err);
  })
  .then(function () {
    console.log(3);
  })
  .then(function () {
    console.log(4);
  });

// 输出：(等待1s)'错了'、(同步)3、(同步)4
```

- then catch 中都可继续异步

```js
new Promise(function (resolve, reject) {
  setTimeout(function () {
    reject("错了");
  }, 1000);
})
  .then(function () {
    console.log(1);
  })
  .then(function () {
    console.log(2);
  })
  .catch(function (err) {
    console.log(err);
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        reject("继续错了");
      }, 1000);
    });
  })
  .then(function () {
    console.log(3);
  })
  .then(function () {
    console.log(4);
  })
  .catch(function (err) {
    console.log(err);
  })
  .then(function () {
    console.log(5);
  })
  .then(function () {
    console.log(6);
  });

// (等待1s)输出：'错了'、(等待1s)'继续错了'、(同步)5、(同步)6
```

### then catch 都将返回 Promise 实例

```js
function get() {
  return new Promise(function (resolve, reject) {
    resolve("hi");
  }).then(function (d) {
    return d;
  });
}

// 继续 then
// 因为 上一个 then 的执行返回的是 Promise
get().then(function (d) {
  console.log(d);
});
```

### catch 返回的也能被 then 接收

```js
function get() {
  return new Promise(function (resolve, reject) {
    reject("错了");
  });
}

get()
  .catch((err) => {
    return "err";
  })
  .then(function (d) {
    console.log(d === "err"); // true
  });
```

### then 中手动抛错的正确方式

实现自定义 catch 触发

```js
axios
  .post("/Mccard/ClassBrand/GetGroupEditModel", { code: equipmentCode })
  .then(({ data }) => {
    if (data.code === 0) {
      return data.data.id;
    }
    // 手动抛错
    return Promise.reject(new Error("classId 获取失败"));
  })
  .then((classId) => {
    // 不会执行
  })
  .catch((e) => {
    // 捕获到错误

    // 可再抛错
    e.message += ", 一错再错";
    return Promise.reject(e);
  })
  .catch((e) => {
    // 依然可以捕获
    console.dir(e);
  });
```

### resolve/reject 立即执行 then/catch 依然是异步

```js
new Promise(function (resolve, reject) {
  console.log(2); // 同步
  resolve(); // 直接执行
  console.log(3); // 同步
})
  .then(function () {
    console.log("处理"); // 异步
    return Promise.reject(new Error("失败"));
  })
  .catch(function (e) {
    console.log(e); // 异步
  });
console.log(1);

// 依次输出：2，3，1，'处理'，'失败'
```

### resolve 只能传一个参数

```js
new Promise(function (resolve) {
  resolve(1, 2, 3);
}).then(function (d1, d2, d3) {
  console.log(d1, d2, d3); // 1 undefined undefined
});
```

### reject 传入什么，就返回什么

不会自动包装成一个 Error 实例

```js
// 反例
new Promise(function (resolve, reject) {
  reject("err");
}).catch(function (err) {
  console.log(err === "err"); // true
});

// 正确示范
new Promise(function (resolve, reject) {
  reject(new Error("err"));
}).catch(function (err) {
  console.log(err.message === "err"); // true
});
```

## finally - 无论结果如何都会执行

```js
p.finally(() => {
  // 返回状态为(resolved 或 rejected)
});
// 相当于
p.then(() => {
  onFinally();
}).catch(() => {
  onFinally();
});
```

## resolve 后又执行 reject，或者先 reject 再 resolve ?

```js
// 不管怎样混着执行 resolve 、 reject, 只有第一次有效
function f() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve("结果"); // 有效
      console.log("1这里是否会执行"); // 会执行
      reject(new Error("错误")); // 无效，算是 resolve 成功
      console.log("2这里是否会执行"); // 会执行
    }, 300);
  });
}
f()
  .then((d) => {
    // 会执行
    console.log(d);
  })
  .catch((e) => {
    // 不会执行
    console.log(e);
  });
```

## reject 后又重复 reject，或者是重复的 resolve ?

```js
// 不管是重复的 reject, 还是 resolve, 只有第一次有效
function f() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("错误1")); // 有效
      console.log("1这里是否会执行"); // 会执行
      reject(new Error("错误2")); // 无效
      console.log("2这里是否会执行"); // 会执行
    }, 300);
  });
}
f().catch((e) => {
  // 返回 '错误1'
  console.log(e);
});
```

## Promise.all 并发，返回所有结果

出错情况：返回第一个出错的结果

```js
// 生成一个Promise对象的数组
const promises = [2, 3, 5, 7, 11, 13].map(function (id) {
  return getJSON("/post/" + id + ".json");
});

Promise.all(promises)
  .then(function (posts) {
    // ...
  })
  .catch(function (reason) {
    // ...
  });
```

## Promise.race 并发，返回第一个完成的结果

无论对错，都将只返回第一个完成的结果

```js
const p = Promise.race([
  fetch("/resource-that-may-take-a-while"),
  new Promise(function (resolve, reject) {
    setTimeout(() => reject(new Error("request timeout")), 5000);
  }),
]);

p.then(console.log).catch(console.error);
```

## async

```js
async function f() {
  const result = await new Promise(function (resolve, reject) {
    setTimeout(function () {
      if (0) {
        reject("e111");
      }
      resolve("111");
    }, 600);
  });
}
```

### 返回 Promise 对象

async 函数执行，将返回值包装成 Promise 对象，再返回

```js
async function f() {
  return "hello world";
}

f().then((v) => console.log(v));
// "hello world"
```

### 错误处理

如果出错，将不会继续往下，直接执行 catch。如果没有 catch 捕捉，直接报错并中断执行

#### try catch

```js
function get1() {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      if (1) {
        reject("e111");
      }
      resolve("111");
    }, 600);
  });
}
function get2() {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      if (1) {
        reject("e222");
      }
      resolve("222");
    }, 600);
  });
}
async function f() {
  try {
    const result = await get1();
  } catch (e) {
    console.log(e);
  }
  await get2();
}

f();
```

#### Promise 的 catch 或 finally

```js
async function f() {
  const result = await new Promise(function (resolve, reject) {
    setTimeout(function () {
      if (1) {
        reject("e111");
      }
      resolve("111");
    }, 600);
  });
  await new Promise(function (resolve, reject) {
    setTimeout(function () {
      if (1) {
        reject("e222");
      }
      resolve("222");
    }, 600);
  });
}

// 捕捉错误
f().catch((e) => console.log(e));

// 或者, 既可接收返回值，又能捕获错误
f().then(
  (v) => console.log(v),
  (e) => console.log(e)
);

// finally 固定执行，在正确结果或者错误结果返回前执行。不影响后面继续抛错
// 参考 https://es6.ruanyifeng.com/#docs/promise#Promise-prototype-finally
f().finally(() => {
  this.loading = false;
});
```

### 手动抛错

使用 throw 即可

```js
async function login(user) {
  let { data } = await axios.post("/comm/v1/token", user);
  if (data.code === 0) {
    return data.result;
  }
  throw new Error(data.message);
}
```

### await 返回的是 resolve 传的值

也就是 then 给函数输出的参数

**而 reject 返回的值**需 async 执行后通过 catch，或者不接受，报错直接中断执行

### 处理并发

借助 Promise.all

```js
function get1() {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      resolve("111");
    }, 2100);
  });
}
function get2() {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      resolve("222");
    }, 1100);
  });
}

async function f() {
  console.time();
  let results = await Promise.all([get1(), get2()]);
  console.log(results);
  console.timeEnd();
}
f();
```
