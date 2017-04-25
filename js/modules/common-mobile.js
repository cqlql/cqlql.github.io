/**
 * 公共的必须初始化的小功能 - 移动端
 *
 * Created by cql on 2017/4/24.
 *
 */


import {isMobileIOS} from 'device';



/**
 * ios 移动端 解决 css active 不生效问题
 *
 * */
if(isMobileIOS){
    document.body.ontouchstart=function () { };
}



