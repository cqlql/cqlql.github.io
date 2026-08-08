---
title: Astro
sort: 85
---

## 渲染两次解决

### 常见但不彻底的解决方式

#### 在 Vue 中区分 SSR / Client
```
if (import.meta.env.SSR) {
  await load()
}
```
问题：

- SSR 阶段可以正常渲染
- Client 阶段没有初始数据
- hydration 后状态不一致，依然需要补请求

👉 本质问题仍然存在

### 最终结论（推荐实践）

> **不要在 Vue 组件中同时承担：数据加载 + SSR + 客户端交互**

### 推荐架构示例
```
TemplateListPage.astro   // 服务端加载数据（SSR）
TemplateList.vue         // Vue 组件，仅负责渲染 & 交互
```
#### TemplateListPage.astro（示意）
```
---
const data = await getTemplateList()
---

<TemplateList
  client:load
  list={data.list}
  total={data.total}
/>
```
#### TemplateList.vue（示意）
```
const props = defineProps<{
  list: Template[]
  total: number
}>()
```
特点：

- SSR 与 Client 使用 **同一份数据**
- 不会出现 hydration 后数据丢失
- 不会产生重复请求

### 总结一句话

> **在 Astro 中，列表等首屏数据： 放到 Astro 加载； Vue 只负责把数据“用好”，而不是“取数据”。**

这是目前最稳定、最清晰、最不容易踩坑的实践方式。