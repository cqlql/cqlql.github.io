
## 与原生交互接口


js 调 native


```js

// 开始抽奖、次数用完
Lottery.getLottery()

// 一轮抽奖结束
Lottery.showResult()
```

native 调 js

```js
// 初始化数据
transmitData({
	"nominates":[{
        name:'张三',
		prize:'100金币'
	},{
        name:'张三',
        prize:'100金币'
    },{
        name:'张三',
        prize:'100金币'
    },{
        name:'张三',
        prize:'100金币'
    }],
	"member":"false",
	"level":"1",// 奖品饼图标识
	"chances":"2",// 可抽奖次数
	"left":"0",// 是否可以抽奖。0, 可以抽象
	"next_level":"0"

})

// 抽奖成功
// 调用此方法停止转盘
// 参数：服务端返回奖品编号
priceResult(1);

```
