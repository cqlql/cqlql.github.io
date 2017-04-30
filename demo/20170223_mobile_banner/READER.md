



# banner v1.0.0 移动端，不掉头 


## 快速使用

html
```html
<div class="banner">
    <ul class="move">
        <li>
            <img src="imgs/<%= require('./assets/1.png') %>" height="300" width="800"/>
        </li>
        <li><img data-src="imgs/<%= require('./assets/2.png')%>" height="300" width="800"/></li>
        <li><img data-src="imgs/<%= require('./assets/3.png')%>" height="300" width="800"/></li>
        <li><img data-src="imgs/<%= require('./assets/4.png')%>" height="300" width="800"/></li>
        <li><img data-src="imgs/<%= require('./assets/5.png')%>" height="300" width="800"/></li>
    </ul>
    <ul class="btn"></ul>
</div>
```

js
```javascript

import Banner from 'banner-mobile';

new Banner({
    eBox:document.querySelector('.banner')
});

```