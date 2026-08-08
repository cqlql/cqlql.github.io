---
title: vue-test-utils
icon: mdi:vuejs
sort: 20
---

Vue 官方组件测试工具库，配合 jest / vitest 使用。

## 挂载组件

```js
import { mount } from "@vue/test-utils";

const wrap = mount(ValueSetLockVue);

// 挂载内联组件
const wrap = mount({
  template: "<p>{{ msg }}</p>",
  props: ["msg"],
});
```

## 设置 data / props

返回 Promise，需 `await` 等待 DOM 更新。

```js
await wrap.setData({ value: 1 });
await wrap.setProps({ value: 1 });
```

## 获取子组件并调用方法

```js
const compWrap = wrap.getComponent({ name: "ValueSetLock" });
compWrap.vm.handleClick();
```

## 断言触发的事件

`emitted(eventName)` 返回二维数组：每次触发一项，每项是该次触发的参数列表。

```js
const incrementEvent = compWrap.emitted("update:value");
expect(incrementEvent).toHaveLength(1); // 触发了 1 次
expect(incrementEvent[0]).toEqual([2]); // 第 1 次的参数为 2
```
