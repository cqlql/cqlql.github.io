/**
 * 公共的必须初始化的小功能 - 移动端
 *
 * 引用此模块后无需引用公用公共 common 模块
 *
 * Created by cql on 2017/4/24.
 *
 */


import {} from 'common';
import {isMobileIOS} from 'device';




/**
 * ios 移动端 解决 css active 不生效问题
 *
 * */
if(isMobileIOS){
    document.body.ontouchstart=function () { };
}

/**
 * 原型扩展
 * */
if(!Element.prototype.remove){
    Element.prototype.remove=function () {
        this.parentNode.removeChild(this);
    };
}