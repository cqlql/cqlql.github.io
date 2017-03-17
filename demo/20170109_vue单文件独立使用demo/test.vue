<template>
    <div class="test">
        aaaaaaaaa
        {{msg}}
        <a>xxx</a>
    </div>


</template>



<style lang="pcss">

    .test{
        a{
            color:red;
            box-shadow: 5px 5px rgba(0, 0, 0, .6);
            transition: all .5s ease-in .1s;
        }
    }

</style>

<script>

    export default{
        data(){
            return{
                msg:'hello vue'
            }
        }
    }
</script>