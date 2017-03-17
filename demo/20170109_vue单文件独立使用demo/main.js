
import Vue from 'vue';


import test from './test.vue';


new Vue({
    el:'#app',
    template:'<test/>',
    components:{
        'test':test

    }
});