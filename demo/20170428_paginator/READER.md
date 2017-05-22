
# 翻页模块


## 快速使用


html
``` html
<div class="paginator"></div>
```

js
``` javascript
import Paginator from 'paginator.js';

let ePage = document.querySelector('.paginator');

let paginator = new Paginator({
    ePage,
    // 按钮翻页触发，页面改变才会触发
    onChange(page){
        console.log(page);
    }
});

// 初始情况，或者 新的数据环境绑定此实例情况
paginator.totalInit(68);

// 生成翻页按钮
paginator.build(0);

```