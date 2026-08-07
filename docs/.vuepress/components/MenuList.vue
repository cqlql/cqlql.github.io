<template>
  <ul>
    <li v-for="item in items" :key="item.text">
      <div class="name">
        <i
          v-if="item.icon"
          :class="['icon', 'iconfont', `icon-${item.icon}`]"
        />

        <router-link
          v-if="item.fullLink"
          :to="item.fullLink.replace(/\.md$/, '.html')"
        >
          {{ item.text }}
        </router-link>

        <span v-else class="t">{{ item.text }}</span>
      </div>

      <MenuList
        v-if="item.children?.length"
        :items="item.children"
      />
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { NavNode } from '../shared/types.js'

defineProps<{
  items: NavNode[]
}>()
</script>
