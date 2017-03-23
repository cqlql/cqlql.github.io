
/*
** 使用

先定义方法：
let vm = new Vue({
    methods:{
        clickFn(e){

        }
    }
});

模版使用：
<input v-click="clickFn">

*/
import Vue from 'vue';
import click from 'dom/click';


/*
旧实现：

Vue.directive('click', {
    bind: function (elem, d) {
        var on = d.value.on || d.value,
            data = d.value.data;

        c.click(elem, function (e) {
            on(e, this, data);
        });
    }
});*/

Vue.directive('click', {
    inserted: function (el, binding, vnode) {
        click(el, binding.value);
    }
});
