## 动画性能

尽量使用 translate3d，但translate3d 会造成模糊，动画完后删掉属性

## 滚动条下面隐藏的元素未渲染

滚动条下面未显示的元素，通过设置 translate3d 移上来依然是不显示的

**解决：**

原因是此元素为静态定位(static)所致。设置为非静态定位即可，比如相对定位(relative)

测试浏览器 chrome 53.0.2785.116 m、android  5.1 webview

## 对inline 元素无效，可使用 inline-block 代替


## 问题：ios wkwebview translate 居然 100% 不能好好动画，改成99%即可

看来跟完全隐藏有关系
