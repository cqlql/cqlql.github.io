---
title: algolia 搜索部署
sort: 82
---

## facetFilters 使用

1. 先去设置里面增加属性（位置 Index -> Facets） ，如 `lang`
2. 然后数据记录增加一项属性和值，如 `lang:zh-CN`
3. 此时就可以在搜索参数中使用 facetFilters 了，如 `facetFilters: ["lang:zh-CN"]`
