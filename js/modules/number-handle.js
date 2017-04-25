/**
 * Created by cql on 2017/4/16.
 */

// 计划处理多为，目前只有2位
export default function fill(number, len) {

    if(len===2){
        if (number < 10) {

            return '0' + number;
        }
    }

    return number;

}


/**
 * 只处理2位
 * */
function fillTwo(number) {

    if (number < 10) {

        return '0' + number;
    }
    return number;

}