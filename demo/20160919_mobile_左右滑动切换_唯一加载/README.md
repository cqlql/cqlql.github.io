
- 跟数据没有关系，只是单纯的切换动画。输出当前页索引

# SliderOneLoadBase

## 创建实例

constructor({
    eBox,
    eMove,
    boxW,

    // 总项数
    count,
    // 滑动开始
    onStart = () => {
    },
    // 当前项索引发生改变后回调
    // 参数：上一项，当前项
    onChange = (pre, index) => {
    },
    // 加载新项情况，有动画则在动画结束后回调。没动画则直接回调
    // 等同 SliderOneLoadBase.onLoad
    onLoad = (index) => {

    }
})

## SliderOneLoadBase.swipeLeft(pre, index)
手动左滑(带动画的下一项)
## SliderOneLoadBase.swipeLeft(pre, index)
手动右滑(带动画的上一项)

## 项改变后回调 SliderOneLoadBase.onChange(pre, index)

## 加载新项情况回调 SliderOneLoadBase.onLoad(index)
- 有动画则在动画结束后回调。没动画则直接回调




## 只要动画结束就将回调 SliderOneLoadBase.onAnimeEnd()


## 回到初始状态：SliderOneLoad.reset(count=0)

currIndex 当前项回到-1   
count 可指定，默认回到 0;


## 直接加载指定项：SliderOneLoad.load(index)
- 如果加载的index与当前index不同，将不执行
- 此方法会触发onChange、onLoad



## 动画加载指定项：SliderOneLoad.animeLoad(index)

如果与currIndex相同将不加载

#SliderOneLoad


constructor({
    eBox,
    // 要加载的数据项总数。也可在实例化后直接设置
    count = 0,
    // 有加载新项情况，但在动画结束后才回调 
    onLoad
})




## 直接设置当前项索引

## 直接设置总数
SliderOneLoad.count