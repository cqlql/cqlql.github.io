<template>
  <ul :class="['menu-list', props.depth > 0 && 'is-sub']">
    <li v-for="item in items" :key="item.fullLink || item.prefix || item.text">
      <div
        class="name"
        :class="{
          'is-dir': !item.fullLink,
          'is-collapsible': item.collapsible && item.children?.length,
        }"
        @click="toggleCollapse(item)"
      >
        <!-- 折叠箭头（仅可折叠目录显示） -->
        <span
          v-if="item.collapsible && item.children?.length"
          class="collapse-arrow"
          :class="{ collapsed: !isExpanded(item) }"
        >▾</span>

        <Icon
          v-if="item.icon"
          :icon="item.icon"
          class="item-icon"
        />

        <router-link
          v-if="item.fullLink"
          :to="item.fullLink.replace(/\.md$/, '.html')"
          @click.stop
        >
          {{ item.text }}
        </router-link>

        <span v-else class="t">{{ item.text }}</span>
      </div>

      <!-- 子列表：可折叠节点根据展开状态决定；不可折叠节点始终显示 -->
      <NavTree
        v-if="item.children?.length && (!item.collapsible || isExpanded(item))"
        :items="item.children"
        :depth="props.depth + 1"
      />
    </li>
  </ul>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { NavNode } from '../shared/types.js'
import { useCollapse } from '../composables/useCollapse.js'

const props = withDefaults(defineProps<{
  items: NavNode[]
  depth?: number
}>(), {
  depth: 0,
})

const collapse = useCollapse()

function getKey(item: NavNode): string {
  return item.prefix || item.fullLink || item.text
}

function isExpanded(item: NavNode): boolean {
  const key = getKey(item)
  // 默认：depth >= 1 折叠，depth 0 展开
  const defaultExpanded = props.depth < 1
  return collapse.isExpanded(key, defaultExpanded)
}

function toggleCollapse(item: NavNode) {
  if (!item.collapsible || !item.children?.length) return
  const key = getKey(item)
  collapse.toggle(key, isExpanded(item))
}
</script>

<style lang="scss" scoped>
// 子级缩进
.is-sub {
  padding-left: 16px;
  margin: 2px 0 2px 6px;
  border-left: 2px solid var(--vp-c-divider);
}

:deep(.is-sub) {
  padding-left: 12px;
  margin-left: 4px;
}

// 子级目录标题
.is-sub .name {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;

  .t {
    font-size: 15px;
    font-weight: 600;
    color: var(--vp-c-text-1);
  }

  .item-icon {
    font-size: 15px;
    color: var(--vp-c-text-2);
    flex-shrink: 0;
  }
}

// 叶子节点链接
.is-sub .name a {
  font-size: 13px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  padding: 2px 0;
  display: inline-block;
  transition: color 0.15s;

  &:hover {
    color: var(--vp-c-brand);
  }
}

// 可折叠目录标题
.is-collapsible {
  cursor: pointer;
  user-select: none;

  &:hover {
    color: var(--vp-c-brand);
  }
}

// 折叠箭头
.collapse-arrow {
  display: inline-block;
  font-size: 14px;
  width: 16px;
  transition: transform 0.2s;
  flex-shrink: 0;

  &.collapsed {
    transform: rotate(-90deg);
  }
}
</style>
