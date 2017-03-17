<template>
    <div>
        <div>foo++1</div>

    </div>
</template>
<style>
    body{

    }
</style>
<script type="text/javascript">

    export default{
        data(){
            return{
                msg:'hello vue'
            }
        },
        components:{

        },
        beforeRouteEnter (to, from, next) {
console.log(to,from);
  },
  beforeRouteLeave (to, from, next) {
    // 导航离开该组件的对应路由时调用
    // 可以访问组件实例 `this`
  }
    }
</script>
