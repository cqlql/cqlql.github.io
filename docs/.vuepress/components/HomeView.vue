<template>
  <nav class="home-view" aria-label="目录导航">
    <NavTree :items="sidebar" />
  </nav>
</template>

<script setup lang="ts">
import type { NavNode } from '../shared/types.js'
import sidebarData from '../.generated/nav-tree.json'
import NavTree from './NavTree.vue'
import { provideCollapse } from '../composables/useCollapse.js'

const sidebar = sidebarData as NavNode[]

// 全局折叠状态
provideCollapse()
</script>

<style lang="scss">
.home-view {
  padding: 10px 0;
  font-size: 15px;

  ul {
    margin: 0;
    padding: 0;
    list-style-type: none;
  }

  // 分类卡片
  > ul > li {
    break-inside: avoid;
    page-break-inside: avoid;
    background-color: var(--vp-c-bg-soft);
    margin-bottom: 20px;
    border-radius: 8px;
    padding: 28px 32px;
    border: 1px solid var(--vp-c-border);
    transition: border-color 0.2s;

    &:hover {
      border-color: var(--vp-c-brand);
    }

    // 分类标题行（带图标的顶层名称）
    > .name {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--vp-c-divider);

      .t {
        font-size: 22px;
        font-weight: 600;
      }

      .item-icon {
        font-size: 22px;
        color: var(--vp-c-brand);
        flex-shrink: 0;
      }
    }
  }
}

@media (min-width: 768px) {
  .home-view {
    columns: 2;
  }
}

@media (min-width: 1024px) {
  .home-view {
    columns: 3;
  }
}
</style>
