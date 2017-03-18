"use strict";




window.Lottery={
	getLottery:function(){
		console.log('开始抽奖');
	},
    showResult(){
        console.log('一轮结束');
	}

}

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
    },{
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
    },{
        name:'张三',
        prize:'100金币'
    },{
        name:'张三',
        prize:'100金币'
    }],
	"member":"false",
	"level":"1",
	"chances":"2",
	"left":"0",
	"next_level":"0"

})


// 从1 
setTimeout(function(){
	priceResult(6)
},1000);
