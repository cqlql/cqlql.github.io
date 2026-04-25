## 给 solt 绑定事件

### 基础实现

::: warning
此实现中子元素的获取实现 `slots.default()[0].children[0]` 比较简易，只是提供思路，不能用于生产环境
:::

插槽事件绑定封装进组件中，主要通过 cloneVNode 实现。

ApprovalOpinionPopover.vue

```vue
<script lang="ts" setup>
const visible = ref(false);
const OnlyChild = defineComponent((props, { slots, attrs }) => {
  const btn = cloneVNode(slots.default!()[0].children[0], attrs);
  return () => {
    return btn;
  };
});
</script>
<template>
  <el-popover
    :visible="visible"
    trigger="click"
    :persistent="false"
  >
    <template #reference>
      <OnlyChild @click="visible = true"><slot></slot></OnlyChild>
    </template>

  </el-popover> 
</template>

```

使用时就不用给按钮绑定事件了

```vue
<template>
   <ApprovalOpinionPopover>
      <el-button type="primary">提交</el-button>
   </ApprovalOpinionPopover>
</template>

```


### 直接使用封装好的 ElOnlyChild

改写 ApprovalOpinionPopover.vue

```vue
<script lang="ts" setup>
import { ElOnlyChild } from 'element-plus/es/components/slot/index.mjs';
const visible = ref(false);
</script>
<template>
  <el-popover
    :visible="visible"
    trigger="click"
    :persistent="false"
  >
    <template #reference>
      <ElOnlyChild @click="visible = true"><slot></slot></ElOnlyChild>
    </template>

  </el-popover> 
</template>

```

## 获取插槽中第一个子元素

```ts
import {isObject} from '@vue/shared'
import {Comment,Fragment,Text} from 'vue'


const defaultSlot = slots.default?.(attrs)
if (!defaultSlot) return null
const firstLegitNode = findFirstLegitChild(defaultSlot)

function findFirstLegitChild(node: VNode[] | undefined): VNode | null {
  if (!node) return null
  const children = node as VNode[]
  for (const child of children) {
    /**
     * when user uses h(Fragment, [text]) to render plain string,
     * this switch case just cannot handle, when the value is primitives
     * we should just return the wrapped string
     */
    if (isObject(child)) {
      switch (child.type) {
        case Comment:
          continue
        case Text:
        case 'svg':
          return wrapTextContent(child)
        case Fragment:
          return findFirstLegitChild(child.children as VNode[])
        default:
          return child
      }
    }
    return wrapTextContent(child)
  }
  return null
}
```
