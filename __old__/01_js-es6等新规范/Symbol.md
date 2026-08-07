[Symbol - JavaScript | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Symbol)

Symbol 解决属性冲突


```js
let sym1 = Symbol();
let sym2 = Symbol('foo');
let sym3 = Symbol('foo');

console.log(Symbol("foo") === Symbol("foo")); // false

let obj = {
  [sym2]: 2,
  [sym3]: 3,
}
console.log(obj)
console.log(obj[sym2]) // 2
console.log(obj[sym3]) // 3
```
