
# 任务
1. 重新整理具体交互 来书写此文档
2. mobile 触摸误差很大，居然点击都可能出发move。需测试(可以用 slider-one-load 测试)


# 记录
1. 放大基础 考虑  单纯的点击手势(onClick)

# 放大看图

## 需求列表
- 可指定倍数限制，最小，最大  
比如最小0.5，最大10倍




## 接口列表

- 设置比例限制 setScaleRestrict(min[,max])  
并非单纯设置 minScale  maxScale字段，还会生成最大x y

- 最小完全显示比例限制 fullScaleRestrict(min[,max])
  
- 初始或者更换图片 initImg(src[, min, max])  
必须第一次执行



# eBox 可以动态增加
eBox 可以以后被初始化，但必须首先被初始化  


# 大纲
- 裁剪
    - 裁剪。绑定元素，也在页面任意位置
    - 弹窗裁剪
    - 单实例弹窗裁剪


## 元素裁剪
会自动给跟元素加上 picture-clip-dom 类名
.picture-clip.picture-clip-dom{}

## 弹窗裁剪
会自动给跟元素加上 picture-clip-popup 类名
.picture-clip.picture-clip-popup{}


## 基础 ZoomTouch





### 实例化

```
let zoomTouch=new ZoomTouch({
    
    // 容器。事件范围
    eBox,
    
    // 放大回调，只要坐标尺寸改变就将调用
    onZoom(x, y, w, h, scale){
    
        // 使用 scale 自动中心偏移坐标
        var otherX = zoomTouch.imgWidth / 2 * (scale - 1),
            otherY = zoomTouch.imgHeight  / 2 * (scale - 1);

        eImg.style[transform] = 'translate3d(' + (x+otherX) + 'px,' + (y+otherY) + 'px,0) scale(' + scale + ', ' + scale + ')';
    }
});
```


### 放大开始。可重复调用 zoomTouch.zoomInit(img.width,img.height);
当图片(或者放大元素)更换后即需调用


## 裁剪 Clip
移动端裁剪

### html
``` html
<div class="picture-clip"></div>
```

### 实例化


```
let clip=new Clip({
    
    // 容器。事件范围
    eBox
    
});


```




### 获取当前 图片  x y w h scale
clip.currX
clip.currY
clip.currW
clip.currH
clip.currScale

### 取裁剪参数 Clip.getClipParams()

返回选择框相对于图片的  x y w h 。并且参照比例为原图尺寸
``` javascript
return { x, y, w, h}
```



### 更换图片 Clip.setSrc(src)


### 改变容器尺寸 Clip.resize()
当容器尺寸改变后调用

### /////

### 设置容器高宽 Clip.setBoxWH(w,h)
容器高宽改变  
重新生成选择高宽和坐标



### 设置放大元素高宽 Clip.setTargetWH(w,h)

当图片(或者放大元素)更换后即需调用，即原始高宽改变后需调用  


### 居中位置。或者说回到初始位置 Clip.toCenter()
第一次调用前，需先执行 Clip.setBoxWH 、 Clip.setTargetWH  
也可反复调用，比Clip.reset 多了一步回到居中位置



### 默认位置。裁剪重置 Clip.toDefault()

当调用 Clip.setBoxWH 或者  Clip.setBoxWH 后需调用