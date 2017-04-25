/**
 * Created by cql on 2017/1/14.
 */
import Vue from 'vue';
// import app from 'app.vue';

import VueRouter from 'vue-router';

import User from 'user.vue';
// import Foo from 'foo.vue';
import Bar from 'bar.vue';
const Foo = resolve => require(['foo.vue'], resolve)


const routes = [
    {path: '/user/:id', component: User}
];

//
const router = new VueRouter({
    // mode: 'history',
    routes: [
        {
            path: '/user/:id',
            alias: '/b/:id',
            component: User,
            children: [
                {
                    // 当 /user/:id/profile 匹配成功，
                    // UserProfile 会被渲染在 User 的 <router-view> 中
                    path: 'profile',
                    component: Foo
                },
                {
                    // 当 /user/:id/posts 匹配成功
                    // UserPosts 会被渲染在 User 的 <router-view> 中
                    path: 'posts',
                    component: Bar
                }
            ]
        }
    ]
});

// router.beforeEach((to, from, next) => {
// console.log(to, from);
// console.log(next());
//
// })
console.log(router);

Vue.use(VueRouter);

const app = new Vue({
    router
}).$mount('#app');
