<template>

    <div>
        {{ $route.params.id }}
        <transition name="fade" mode="out-in">
        <router-view class="child-view"></router-view>
        </transition>
    </div>



</template>
<style>

</style>
<script>

    export default{
        data(){
            return{
                msg:'hello vue'
            }
        },
         // dynamically set transition based on route change
  watch: {
    '$route' (to, from) {

    }
  }

    }
</script>
