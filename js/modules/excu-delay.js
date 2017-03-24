/**
 * Created by cql on 2017/3/25.
 */




/**
 * 延时 有效执行
 指定时间内再次调用。将重新计时
 实现 快速更新 情况 实现在 在最后结束后再更新

 # 初始
 @@ common.delayExcu
 @example
 var delayExcu = new c.DelayExcu();
 # method
 @@ delayExcu.excu 不会发生重复调用。重复调用会删除之前的，最新的生效
 @param fn [function] 延迟执行的函数
 @param * time [number] 延迟的毫秒数。默认200
 @example
 delayExcu.excu(function () {alert('');});

 @@ delayExcu.clear 终止
 @return [bool] true表示fn没有执行，清除成功。false，表示fn已经执行，没进行清除
 @example
 delayExcu.clear();

 delayExcu.excu(function () {jBox.addClass('imgFullShowMove');});
 if(delayExcu.clear()===false) jBox.removeClass('imgFullShowMove');
 */

export default function ExcuDelay() {
    let timeId = null;

    function clear() {
        if (timeId !== null) {

            clearTimeout(timeId);

            timeId = null;

            return true;
        }
        return false;
    }

    this.excu = function (callBack, time) {
        clear();

        if (time === 0) {
            callBack();
        }
        else {
            timeId = setTimeout(function () {
                timeId = null;
                callBack();
            }, time || 200);
        }
    };

    this.clear = clear;

}