- [组合式 API setup 中的用法](#组合式-api-setup-中的用法)
  - [相关文档](#相关文档)
  - [组件实例获取示例](#组件实例获取示例)
  - [实例成员调用](#实例成员调用)

## 组合式 API setup 中的用法

### 相关文档

https://v3.cn.vuejs.org/guide/composition-api-template-refs.html#%E6%A8%A1%E6%9D%BF%E5%BC%95%E7%94%A8

### 组件实例获取示例

元素实例

```vue
<template>
  <input ref="eWordInput" />
</template>

<script lang="ts" setup>
let eWordInput = ref<HTMLInputElement | null>(null)
watch(eWordInput, () => {
  eWordInput.value?.focus()
})
</script>
```

组件实例

```vue
<template>
  <el-input ref="vWordInput" />
</template>

<script lang="ts" setup>
let vWordInput = ref<ComponentPublicInstance | null>(null)
watch(vWordInput, () => {
  vWordInput.value?.$el.focus()
})
</script>
```

### 实例成员调用

创建 TimeCount.vue 组件

```vue
<template>
  <div> 1 </div>
</template>

<script lang="ts" setup>
// 暴露给外界访问
defineExpose({
  startTime: () => {
    // 实现...
  },
  stopTime: () => {
    // 实现...
  },
  getElapsedTime() {
    // 实现...
  },
})
</script>
<style lang="scss"></style>
```

调用

```vue
<template>
  <TimeCount ref="vTimeCount"></TimeCount>
</template>
<script>
const vTimeCount = ref({
  stopTime: () => {},
  startTime: () => {},
  getElapsedTime: () => '',
})
</script>
```
