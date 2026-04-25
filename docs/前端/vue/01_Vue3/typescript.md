
## script setup 使用 reactive

```vue
<template>
  <div>
    {{ msg }}
  </div>
</template>
<script setup lang="ts">
const state = reactive({
  msg: 123,
})

const { msg } = toRefs(state)
</script>
```

## defineProps 设置默认值

```vue
<template></template>
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    msg?: string
    labels?: string[]
  }>(),
  {
    msg: 'hello',
    labels: () => ['one', 'two'],
  },
)
</script>
```

## defineEmits 事件

[组件事件 | Vue.js](https://cn.vuejs.org/guide/components/events.html)

script setup 中调用事件

```vue
<!-- dialog.vue -->
<template>
  <div>
    <button @click="close">关闭</button>
  </div>
</template>
<script lang="ts" setup>
const emit = defineEmits<{
  (e: 'update:visible', visible: boolean): void
}>()
function close() {
  emit('update:visible', false)
}
</script>
```

```vue
<!-- index.vue -->
<template>
  <dialog v-model:visible="visible"> </dialog>
</template>
<script lang="ts" setup>
const visible = ref(false)
</script>
```

## vue 定义组件类型

```ts
/**此组件不会被打包 */
const TableFieldCompDef = defineComponent(
  (_props: { row: Recordable; field: string; value: any }) => {
    return () => {};
  },
);
export type TableFieldComp = typeof TableFieldCompDef;
```

## vue 为全局组件声明类型

### 方式 1 组件方式

picker.vue

```vue
<!-- 如果是第三方组件，此组件只用作声明类型 -->
<script lang="ts" setup>
defineProps<{
  mode: 'multiSelector'
}>()
defineEmits<{
  (e: 'change', d: { detail: any }): void
}>()
</script>
```

components.d.ts

```ts
import type picker from './picker.vue'

declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    picker: typeof picker
  }
}
```

### 方式 2 原始方式 -- 比较复杂，不推荐

```ts
import { DefineComponent } from 'vue'
declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    JButton: DefineComponent<
      {
        /**
         * 按钮类型
         */
        type?: 'green' | 'info'
      },
      {},
      {},
      {},
      {},
      {},
      {},
      /**事件没办法显示注释 */
      {
        click: (e: Event) => void
        test: (e: Event) => void
      }
    >
  }
}
```

## 给 props 声明类型 -- 选项式

```ts
import type { PropType } from 'vue'
export default {
  props: {
    data: Object as PropType<{ id:string, name: string }>,
  },
}
```

### 参考文档


[TypeScript 与选项式 API)](https://cn.vuejs.org/guide/typescript/options-api.html#typing-component-props)


## 问题

### Vue typescript 引入 svg 的问题

https://zhuanlan.zhihu.com/p/182893764

## watch 监听 props

```vue
<script lang="ts" setup>
import { ref, watch } from 'vue'
watch(
  () => props.orderInfo,
  (orderInfoVal) => {
    console.log('watch props.orderInfo')
  },
)
</script>
```

## 获取第三方组件的 props 类型

```ts
// 使用props中某个类型
type size = InstanceType<typeof ElButton>['size']
// 复制所有的 props，因为直接使用会编译异常，也许未来某个版本会改善
type ElButtonProps = Pick<ButtonInstance['$props'], keyof ButtonInstance['$props']>;
```

## 声明 props 但又实际又是 attrs
不影响 $attrs 继承，又可以类型约束

```vue
<script lang="ts" setup>
defineOptions({
  inheritAttrs: false,
});

type ButtonInstance = InstanceType<typeof ElButton>;
// 复制所有的 props，因为直接使用会编译异常，也许未来某个版本会改善
type ElButtonProps = Pick<ButtonInstance['$props'], keyof ButtonInstance['$props']>;
interface Props extends /* @vue-ignore */ ElButtonProps {
  icon?: any;
}


const props = defineProps<Props>();
</script>
<template>
  <el-button v-bind="$attrs">
    <template v-if="props.icon" #icon>
      <Icon :icon="props.icon" only-icon />
    </template>
    <slot></slot>
  </el-button>
</template>
```
