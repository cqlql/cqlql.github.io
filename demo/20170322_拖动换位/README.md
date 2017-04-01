
# 针对尺寸不一的拖动换位
- 换位只会改变坐标位置，不会改变文档顺序。所以可以使用translate3d，因此在移动端能获得更好的性能
- 支持拖动元素上点击动作
- 目前 drag-box 容器宽度没有考虑变宽，觉得没有必要
- 所有元素默认坐标位置都为0，重叠隐藏，隐藏使用opacity，这样方能获取高宽，进而计算坐标

  


## 两个方向，宽度不一，高度固定 

[demo](https://cqlql.github.io/demo/20170322_拖动换位/dist/index.html)
 
[drag-exchange.js 模块源码](https://github.com/cqlql/cqlql.github.io/blob/master/js/modules/drag-exchange.js)  


### 快速使用

#### html

- drag-item，drag-item-cont 这两个class不能更改
- drag-item-cont 中的html内容可以自定义
- drag-box 中初始可有项，也可无项，也就是直接 `<div class="drag-box"></div>` 即可
``` html
<div class="drag-box">
    <div class="drag-item">
        <div class="drag-item-cont">
            <a href="javascript:console.log('可点击');">text11111</a> <a class="del" title="删除" href="javascript:;">X</a>
        </div>
    </div>
    <div class="drag-item">
        <div class="drag-item-cont">text222222222222 <a class="del" title="删除" href="javascript:;">X</a></div>
    </div>
</div>
```

#### css

- drag-item 只是项容器，所以项的外观需通过 drag-item-cont 控制
- 项间距由css处理，通过 drag-item 的padding，未在js中考虑计算

``` css
.drag-box {
    & {
        font-size: 14px;
        border: 1px solid #333;
        height: 200px;
        //width: 600px;
        position: relative;
    }

    &.animate .drag-item {
        transition: 500ms ease;
    }
    &.animate .drag-item.drag {
        transition-duration: 0s;
    }
    &.animate .drag-item.move {
        transition-duration: 0s;
    }

    .drag-item {
        height: 32px;
        padding: 3px;
        position: absolute;
        left: 0;
        top: 0;

    }
    .drag-item-cont {
        & {
            border: 1px solid #333;
            line-height: calc(30 / 14 + 0.06);
            height: 30px;
            padding: 0 10px;
            background-color: #fff;
            text-overflow:ellipsis;
            white-space: nowrap;
        }
    }

    .drag-item.drag .drag-item-cont {
        border: 1px dashed #333;
        * {
            opacity: 0;
        }
    }

}

```

#### js
``` javascript


import DragExchange from 'drag-exchange';
import htmlToElems from 'dom/html-to-elems';

let eBox = document.querySelector('.drag-box');

// 创建拖动换位实例
let dragExchange = new DragExchange(eBox);

// 删除项
eBox.addEventListener('click', function (e) {
    if (e.target.classList.contains('del')) {
        
        // 根据索引删除。此索引与坐标顺序一致
        dragExchange.delItem(e.target.parentElement.parentElement.dataset.index);
    }
});

// 新增项。可增加多项
dragExchange.addItems(htmlToElems(`
<div class="drag-item">
    <div class="drag-item-cont">
        <a href="javascript:console.log(\'可点击\');">text11111</a> <a class="del" title="删除" href="javascript:;">X</a>
    </div>        
</div>
<div class="drag-item">
    <div class="drag-item-cont">
        <a href="javascript:console.log(\'可点击\');">text222222222222222</a> <a class="del" title="删除" href="javascript:;">X</a>       
    </div>
</div>`));

```


### 部分 API


#### 实例方法

##### dragExchange.getData
返回数组对象，数据集合，能对应正确的位置

##### dragExchange.getItems
返回数组对象，元素集合，不能对应正确的位置





