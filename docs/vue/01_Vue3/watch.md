## 组合式 api 中用法

### props 监听

```js
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      init()
    }
  },
  {
    immediate: true,
  },
)
```

### array ref 监听

```js
const list = ref<ItemType[]>([])

watch(list.value, (list, preList) => {

})

// 注意：直接监听 list 无效
```

## 相关文档

https://v3.cn.vuejs.org/guide/reactivity-computed-watchers.html#watch


## watchEffect

赋值表达式左侧不会被监听

```ts
 watchEffect(() => {
  multiApprovalMode.value = selectedNode.value!.value.approval?.multiApprovalMode || '';
});

```
