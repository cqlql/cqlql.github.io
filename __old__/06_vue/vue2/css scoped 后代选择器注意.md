scoped 不会影响到子组件。  
所以，如果子组件css写在父组件css中，父组件使用scoped，css就会无效

这种转换结果看上去总觉得不够好

```
<style scoped>
.example span{
  color: red;
}
</style>

<template>
  <div class="example">
    <span>hi</span>
  </div>
</template>

```
转换结果：
```
<style>
.example span[data-v-f3f3eg9] {
  color: red;
}
</style>

<template>
  <div data-v-4c878eb4="" class="example"><span data-v-4c878eb4="">hi</span></div>
</template>
```
