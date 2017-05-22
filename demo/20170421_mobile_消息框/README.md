

## degbug

有头部，有关闭按钮  

满屏，半透明


### 消息弹出
debugMsg(string html);

重复调用会覆盖上一次内容


### 自定义消息
ebugMsg(function(elem){

});

### 关闭
ebugMsg.close()

关闭将删除元素



## 一次性消息框

### 一般消息
msg(string msgContent[,1]);


### 错误消息
msg(string msgContent,2);


## 极简一次性消息框


### 消息弹出
msg(string msgContent);


## 队列消息框
