/**
 * 公共的必须初始化的小功能 - 全端适用
 *
 * Created by cql on 2017/4/24.
 */


/**
 * 原型扩展
 * */
if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/(^[\s\uFEFF]*)|(\s*$)/g, '');
    }
}