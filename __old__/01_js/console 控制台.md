

## 耗时查看。
可用来性能测试

```js
console.time('small loop');
for (var i = 0; i < 100000; i++) {}
console.timeEnd('small loop');
//small loop: 2.304ms
```

## 分组

```js
console.group("程序日志");
console.log("[07:21:36.754");
console.log("[07:21:36.754");
console.groupEnd();
```

## 换行写法 + 颜色

```js
console.log("换\n行");
console.log("默认部分 %c 红色部分）", "color:red");
console.log(`%c vue-devtools %c Detected Vue v${'2.0.0'} %c`, "background:#35495e ; padding: 1px; border-radius: 3px 0 0 3px;  color: #fff", "background:#41b883 ; padding: 1px; border-radius: 0 3px 3px 0;  color: #fff", "background:transparent")
```
