/**
 * Created by cql on 2016/11/9.
 */

/*
移动端模拟 click 事件自定义指令
*/
Vue.directive('click', {
    bind: function (elem, d) {
        var on = d.value.on || d.value,
            data = d.value.data;

        c.click(elem, function (e) {
            on(e, this, data);
        });
    }
});