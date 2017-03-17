<template>
    <div>
        <h1>Hello App!</h1>
        <p>
            <!-- 使用 router-link 组件来导航. -->
            <!-- 通过传入 `to` 属性指定链接. -->
            <!-- <router-link> 默认会被渲染成一个 `<a>` 标签 -->
            <router-link to="/user/foo">Go to Foo</router-link>
            <router-link to="/user/bar">Go to Bar</router-link>
            <router-link to="/user/foo/profile">Go to Foo++</router-link>
            <router-link to="/user/bar/posts">Go to Bar++</router-link>
        </p>
        <!-- 路由出口 -->
        <!-- 路由匹配到的组件将渲染在这里 -->

        <transition name="fade" mode="out-in">
            <router-view class="view"></router-view>
        </transition>
    </div>
</template>
<style lang="postcss">

    body{
        background-color: #4cadff;
        
        a{
            color: #fff;
        }
    }

</style>
<script>






    export default{

        data:{

        }
    }
</script>
