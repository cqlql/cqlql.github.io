## 实时改变特性

**原生获取的 HTMLCollection 集合对象都具有实时改变特性**。  
即转移或者删除某元素，其存在的HTMLCollection集合对象会实时改变。children 属性获取的就是 HTMLCollection 。

兼容性：包括ie6的所有

```js
var eDiv = document.getElementById('test').getElementsByTagName('div');

console.log(eDiv.length); // 2

document.body.appendChild(eDiv[0]);

console.log(eDiv.length); // 1
```

## 判断某集合是否是HTMLCollection类派生


```js
document.getElementsByTagName('div') instanceof HTMLCollection;// true
```

## 根据name标签属性检索元素

从集合中检索

HTMLCollection.prototype.namedItem(name)

```js
var elem = document.getElementsByTagName('div').namedItem('name1')
```


兼容性：  
ie全系列，包括edge，只支持表单内元素。也许是因为name属性本身就是为表单元素而生
其他高级浏览器div都支持

## 根据标签名检索 - ie独有


返回：HTMLCollection集合

HTMLCollection.prototype.tags(tagName)

```js
document.getElementsByTagName('*').tags('input');
```

兼容性：全系列ie支持，包括edge。其他高级均不支持
